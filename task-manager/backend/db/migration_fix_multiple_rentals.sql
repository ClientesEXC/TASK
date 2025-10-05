-- =====================================================
-- MIGRACIÓN COMPLETA PARA CORREGIR SISTEMA DE ALQUILERES
-- Permite múltiples artículos por alquiler y agrega usuarios
-- =====================================================

-- 1. CREAR TABLA DE USUARIOS (Si no existe)
CREATE TABLE IF NOT EXISTS users (
                                     id SERIAL PRIMARY KEY,
                                     username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 2. MODIFICAR TABLA RENTALS PARA USUARIO PROPIETARIO
ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER REFERENCES users(id);

-- 3. CREAR NUEVA TABLA PARA ALQUILERES (ESTRUCTURA MEJORADA)
CREATE TABLE IF NOT EXISTS rental_orders (
                                             id SERIAL PRIMARY KEY,
                                             order_number VARCHAR(50) UNIQUE NOT NULL DEFAULT concat('RNT-', to_char(CURRENT_DATE, 'YYYYMMDD'), '-', nextval('rental_orders_id_seq')),
    -- Información del cliente
    customer_name VARCHAR(255) NOT NULL,
    customer_id_number VARCHAR(50) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    customer_address TEXT,
    -- Fechas
    rental_start DATE NOT NULL,
    rental_end DATE NOT NULL,
    actual_return_date DATE,
    -- Valores totales
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    deposit DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    -- Estados
    status VARCHAR(50) DEFAULT 'activo' CHECK (status IN ('activo', 'finalizado', 'cancelado', 'vencido')),
    payment_status VARCHAR(50) DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'parcial', 'completo')),
    -- Prenda
    has_collateral BOOLEAN DEFAULT false,
    collateral_description TEXT,
    -- Notas y condiciones
    notes TEXT,
    return_notes TEXT,
    -- Usuario que creó y gestiona
    created_by_user_id INTEGER REFERENCES users(id),
    assigned_to_user_id INTEGER REFERENCES users(id),
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 4. CREAR TABLA DE ITEMS DE CADA ALQUILER
CREATE TABLE IF NOT EXISTS rental_order_items (
                                                  id SERIAL PRIMARY KEY,
                                                  rental_order_id INTEGER NOT NULL REFERENCES rental_orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES rental_items(id),
    quantity_rented INTEGER NOT NULL DEFAULT 1,
    -- Precios al momento del alquiler (histórico)
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    -- Estado de devolución
    quantity_returned INTEGER DEFAULT 0,
    return_condition VARCHAR(50) CHECK (return_condition IN ('bueno', 'regular', 'dañado', 'perdido')),
    return_notes TEXT,
    return_date TIMESTAMP,
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_quantities CHECK (quantity_returned <= quantity_rented)
    );

-- 5. MIGRAR DATOS EXISTENTES A LA NUEVA ESTRUCTURA
INSERT INTO rental_orders (
    customer_name, customer_id_number, customer_phone, customer_email,
    customer_address, rental_start, rental_end, actual_return_date,
    total_amount, deposit, status, has_collateral, collateral_description,
    notes, created_at, updated_at
)
SELECT
    customer_name, customer_id_number, customer_phone, customer_email,
    customer_address, rental_start, rental_end, return_date,
    total_amount, deposit, status, has_collateral, collateral_description,
    notes, created_at, updated_at
FROM rentals
WHERE NOT EXISTS (
    SELECT 1 FROM rental_orders ro
    WHERE ro.customer_name = rentals.customer_name
      AND ro.rental_start = rentals.rental_start
);

-- 6. MIGRAR ITEMS DE ALQUILERES EXISTENTES
INSERT INTO rental_order_items (rental_order_id, item_id, quantity_rented, unit_price, subtotal)
SELECT
    ro.id,
    r.item_id,
    COALESCE(r.quantity_rented, 1),
    ri.daily_rate,
    r.total_amount
FROM rentals r
         JOIN rental_orders ro ON
    ro.customer_name = r.customer_name AND
    ro.rental_start = r.rental_start
         JOIN rental_items ri ON ri.id = r.item_id
WHERE NOT EXISTS (
    SELECT 1 FROM rental_order_items roi
    WHERE roi.rental_order_id = ro.id AND roi.item_id = r.item_id
);

-- 7. ACTUALIZAR TABLA DE PAGOS PARA NUEVA ESTRUCTURA
ALTER TABLE rental_payments
    ADD COLUMN IF NOT EXISTS rental_order_id INTEGER REFERENCES rental_orders(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS processed_by_user_id INTEGER REFERENCES users(id);

-- Migrar pagos existentes
UPDATE rental_payments rp
SET rental_order_id = (
    SELECT ro.id FROM rental_orders ro
                          JOIN rentals r ON r.id = rp.rental_id
    WHERE ro.customer_name = r.customer_name
      AND ro.rental_start = r.rental_start
    LIMIT 1
    )
WHERE rental_order_id IS NULL;

-- 8. CREAR ÍNDICES OPTIMIZADOS
CREATE INDEX IF NOT EXISTS idx_rental_orders_status ON rental_orders(status);
CREATE INDEX IF NOT EXISTS idx_rental_orders_customer ON rental_orders(customer_id_number);
CREATE INDEX IF NOT EXISTS idx_rental_orders_dates ON rental_orders(rental_start, rental_end);
CREATE INDEX IF NOT EXISTS idx_rental_orders_created_by ON rental_orders(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_rental_order_items_order ON rental_order_items(rental_order_id);
CREATE INDEX IF NOT EXISTS idx_rental_order_items_item ON rental_order_items(item_id);

-- 9. CREAR VISTAS ÚTILES
CREATE OR REPLACE VIEW v_rental_orders_complete AS
SELECT
    ro.id,
    ro.order_number,
    ro.customer_name,
    ro.customer_id_number,
    ro.customer_phone,
    ro.rental_start,
    ro.rental_end,
    ro.status,
    ro.payment_status,
    ro.total_amount,
    ro.deposit,
    -- Items agregados
    COUNT(DISTINCT roi.id) as total_items,
    SUM(roi.quantity_rented) as total_quantity,
    STRING_AGG(DISTINCT ri.name, ', ') as items_list,
    -- Pagos
    COALESCE(SUM(rp.amount), 0) as total_paid,
    ro.total_amount - COALESCE(SUM(rp.amount), 0) as balance_due,
    -- Usuario
    u.full_name as created_by,
    -- Vencimiento
    CASE WHEN ro.rental_end < CURRENT_DATE AND ro.status = 'activo'
             THEN CURRENT_DATE - ro.rental_end
         ELSE 0 END as days_overdue
FROM rental_orders ro
         LEFT JOIN rental_order_items roi ON roi.rental_order_id = ro.id
         LEFT JOIN rental_items ri ON ri.id = roi.item_id
         LEFT JOIN rental_payments rp ON rp.rental_order_id = ro.id
         LEFT JOIN users u ON u.id = ro.created_by_user_id
GROUP BY ro.id, u.full_name;

-- 10. FUNCIONES PARA MANEJO DE INVENTARIO
CREATE OR REPLACE FUNCTION update_inventory_on_rental()
RETURNS TRIGGER AS $$
BEGIN
    -- Al crear un item de alquiler, reducir inventario
    IF TG_OP = 'INSERT' THEN
UPDATE rental_items
SET quantity_available = quantity_available - NEW.quantity_rented
WHERE id = NEW.item_id;

-- Verificar que no quede negativo
IF (SELECT quantity_available FROM rental_items WHERE id = NEW.item_id) < 0 THEN
            RAISE EXCEPTION 'No hay suficiente inventario disponible';
END IF;
    -- Al eliminar, devolver al inventario
    ELSIF TG_OP = 'DELETE' THEN
UPDATE rental_items
SET quantity_available = quantity_available + OLD.quantity_rented
WHERE id = OLD.item_id;
-- Al actualizar, ajustar la diferencia
ELSIF TG_OP = 'UPDATE' THEN
UPDATE rental_items
SET quantity_available = quantity_available + OLD.quantity_rented - NEW.quantity_rented
WHERE id = NEW.item_id;
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS update_inventory_trigger ON rental_order_items;
CREATE TRIGGER update_inventory_trigger
    AFTER INSERT OR UPDATE OR DELETE ON rental_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_rental();

-- 11. FUNCIÓN PARA PROCESAR DEVOLUCIONES
CREATE OR REPLACE FUNCTION process_return(
    p_rental_order_id INTEGER,
    p_item_id INTEGER,
    p_quantity_returned INTEGER,
    p_condition VARCHAR(50),
    p_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
v_quantity_rented INTEGER;
    v_already_returned INTEGER;
BEGIN
    -- Obtener cantidad alquilada y devuelta
SELECT quantity_rented, COALESCE(quantity_returned, 0)
INTO v_quantity_rented, v_already_returned
FROM rental_order_items
WHERE rental_order_id = p_rental_order_id AND item_id = p_item_id;

-- Validar
IF v_quantity_rented IS NULL THEN
        RAISE EXCEPTION 'Item no encontrado en este alquiler';
END IF;

    IF v_already_returned + p_quantity_returned > v_quantity_rented THEN
        RAISE EXCEPTION 'La cantidad a devolver excede la cantidad alquilada';
END IF;

    -- Actualizar item del alquiler
UPDATE rental_order_items
SET
    quantity_returned = COALESCE(quantity_returned, 0) + p_quantity_returned,
    return_condition = p_condition,
    return_notes = p_notes,
    return_date = CURRENT_TIMESTAMP
WHERE rental_order_id = p_rental_order_id AND item_id = p_item_id;

-- Devolver al inventario
UPDATE rental_items
SET quantity_available = quantity_available + p_quantity_returned
WHERE id = p_item_id;

-- Si todos los items fueron devueltos, marcar orden como finalizada
IF NOT EXISTS (
        SELECT 1 FROM rental_order_items
        WHERE rental_order_id = p_rental_order_id
        AND (quantity_returned IS NULL OR quantity_returned < quantity_rented)
    ) THEN
UPDATE rental_orders
SET status = 'finalizado', actual_return_date = CURRENT_DATE
WHERE id = p_rental_order_id;
END IF;

RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 12. CREAR USUARIOS DE EJEMPLO
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES
    ('admin', 'admin@rental.com', '$2b$10$YourHashedPasswordHere', 'Administrador Sistema', 'admin'),
    ('juan.perez', 'juan@rental.com', '$2b$10$YourHashedPasswordHere', 'Juan Pérez', 'employee'),
    ('maria.garcia', 'maria@rental.com', '$2b$10$YourHashedPasswordHere', 'María García', 'employee')
    ON CONFLICT (username) DO NOTHING;

-- 13. ACTUALIZAR TRIGGERS DE TIMESTAMP
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rental_orders_updated_at
    BEFORE UPDATE ON rental_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- FIN DE LA MIGRACIÓN
-- Para ejecutar: psql -U tu_usuario -d tu_base_datos -f este_archivo.sql