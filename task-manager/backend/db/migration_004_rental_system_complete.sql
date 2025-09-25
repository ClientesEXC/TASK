-- task-manager/backend/db/migration_004_rental_system_complete.sql
-- Migración completa para el sistema de alquileres mejorado

-- ============================================
-- 1. MODIFICAR TABLA rental_items
-- ============================================

-- Agregar columnas faltantes si no existen
ALTER TABLE rental_items
    ADD COLUMN IF NOT EXISTS quantity_total INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS rental_price DECIMAL(10, 2) DEFAULT 0;

-- Actualizar valores existentes
UPDATE rental_items
SET
    quantity_total = COALESCE(quantity, 1),
    quantity_available = COALESCE(quantity, 1),
    rental_price = COALESCE(daily_rate, 0)
WHERE quantity_total IS NULL;

-- ============================================
-- 2. MODIFICAR TABLA rentals
-- ============================================

ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS customer_id_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS quantity_rented INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS has_collateral BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS collateral_description TEXT,
    ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT false;

-- ============================================
-- 3. CREAR TABLA rental_payments SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS rental_payments (
                                               id SERIAL PRIMARY KEY,
                                               rental_id INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- ============================================
-- 4. CREAR TABLA rental_returns SI NO EXISTE
-- ============================================

CREATE TABLE IF NOT EXISTS rental_returns (
                                              id SERIAL PRIMARY KEY,
                                              rental_id INTEGER NOT NULL REFERENCES rentals(id),
    return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quantity_returned INTEGER NOT NULL DEFAULT 1,
    condition_status VARCHAR(50) DEFAULT 'bueno'
    CHECK (condition_status IN ('bueno', 'regular', 'dañado')),
    damage_notes TEXT,
    return_notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- ============================================
-- 5. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índices para rental_items
CREATE INDEX IF NOT EXISTS idx_rental_items_status ON rental_items(status);
CREATE INDEX IF NOT EXISTS idx_rental_items_category ON rental_items(category);
CREATE INDEX IF NOT EXISTS idx_rental_items_availability
    ON rental_items(quantity_available);
CREATE INDEX IF NOT EXISTS idx_rental_items_name ON rental_items(name);

-- Índices para rentals
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_customer_name ON rentals(customer_name);
CREATE INDEX IF NOT EXISTS idx_rentals_customer_id ON rentals(customer_id_number);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(rental_start, rental_end);
CREATE INDEX IF NOT EXISTS idx_rentals_item_id ON rentals(item_id);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_rental_payments_rental_id ON rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_date ON rental_payments(payment_date);

-- Índices para devoluciones
CREATE INDEX IF NOT EXISTS idx_rental_returns_rental_id ON rental_returns(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_returns_date ON rental_returns(return_date);

-- ============================================
-- 6. CREAR VISTAS ÚTILES
-- ============================================

-- Vista de disponibilidad de artículos
CREATE OR REPLACE VIEW v_items_availability AS
SELECT
    ri.id,
    ri.name,
    ri.description,
    ri.category,
    ri.image_url,
    ri.quantity_total,
    ri.quantity_available,
    ri.quantity_total - ri.quantity_available as quantity_rented,
    ri.daily_rate,
    ri.weekly_rate,
    ri.monthly_rate,
    CASE
        WHEN ri.quantity_available > 0 THEN 'disponible'
        WHEN ri.quantity_available = 0 THEN 'agotado'
        ELSE ri.status
        END as availability_status,
    COUNT(DISTINCT r.id) as total_rentals,
    COALESCE(SUM(r.total_amount), 0) as revenue_generated
FROM rental_items ri
         LEFT JOIN rentals r ON ri.id = r.item_id AND r.status = 'finalizado'
GROUP BY ri.id;

-- Vista de alquileres activos con detalles
CREATE OR REPLACE VIEW v_active_rentals AS
SELECT
    r.*,
    ri.name as item_name,
    ri.category as item_category,
    ri.image_url as item_image,
    CURRENT_DATE - r.rental_end as days_overdue,
    CASE
        WHEN r.rental_end < CURRENT_DATE THEN true
        ELSE false
        END as is_overdue,
    COALESCE(
            (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
            0
    ) as total_paid,
    r.total_amount - COALESCE(
            (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
            0
                     ) as balance_due
FROM rentals r
         JOIN rental_items ri ON r.item_id = ri.id
WHERE r.status = 'activo';

-- Vista de alquileres vencidos
CREATE OR REPLACE VIEW v_overdue_rentals AS
SELECT * FROM v_active_rentals
WHERE is_overdue = true
ORDER BY days_overdue DESC;

-- Vista de estadísticas generales
CREATE OR REPLACE VIEW v_rental_statistics AS
SELECT
    -- Artículos
    COUNT(DISTINCT ri.id) as total_items,
    SUM(ri.quantity_total) as total_units,
    SUM(ri.quantity_available) as available_units,
    SUM(ri.quantity_total - ri.quantity_available) as rented_units,

    -- Alquileres
    COUNT(DISTINCT r.id) as total_rentals,
    COUNT(DISTINCT CASE WHEN r.status = 'activo' THEN r.id END) as active_rentals,
    COUNT(DISTINCT CASE WHEN r.status = 'finalizado' THEN r.id END) as completed_rentals,
    COUNT(DISTINCT CASE WHEN r.status = 'cancelado' THEN r.id END) as cancelled_rentals,

    -- Vencidos
    COUNT(DISTINCT CASE
                       WHEN r.status = 'activo' AND r.rental_end < CURRENT_DATE
                           THEN r.id
        END) as overdue_rentals,

    -- Financiero
    COALESCE(SUM(r.total_amount), 0) as total_revenue,
    COALESCE(SUM(CASE WHEN r.status = 'activo' THEN r.total_amount ELSE 0 END), 0) as pending_revenue,
    COALESCE(SUM(rp.amount), 0) as total_collected,

    -- Clientes
    COUNT(DISTINCT r.customer_id_number) as total_customers
FROM rental_items ri
         LEFT JOIN rentals r ON ri.id = r.item_id
         LEFT JOIN rental_payments rp ON r.id = rp.rental_id;

-- Vista de historial de pagos
CREATE OR REPLACE VIEW v_payment_history AS
SELECT
    rp.*,
    r.customer_name,
    r.customer_id_number,
    ri.name as item_name
FROM rental_payments rp
         JOIN rentals r ON rp.rental_id = r.id
         JOIN rental_items ri ON r.item_id = ri.id
ORDER BY rp.payment_date DESC, rp.created_at DESC;

-- ============================================
-- 7. FUNCIONES ÚTILES
-- ============================================

-- Función para calcular el precio de alquiler
CREATE OR REPLACE FUNCTION calculate_rental_price(
    p_item_id INTEGER,
    p_start_date DATE,
    p_end_date DATE,
    p_quantity INTEGER DEFAULT 1
) RETURNS DECIMAL AS $$
DECLARE
v_daily_rate DECIMAL;
    v_weekly_rate DECIMAL;
    v_monthly_rate DECIMAL;
    v_days INTEGER;
    v_price DECIMAL;
BEGIN
    -- Obtener tarifas del artículo
SELECT daily_rate, weekly_rate, monthly_rate
INTO v_daily_rate, v_weekly_rate, v_monthly_rate
FROM rental_items
WHERE id = p_item_id;

-- Calcular días
v_days := (p_end_date - p_start_date) + 1;

    -- Calcular precio según período
    IF v_days >= 30 THEN
        v_price := (v_days / 30) * v_monthly_rate;
    ELSIF v_days >= 7 THEN
        v_price := (v_days / 7) * v_weekly_rate;
ELSE
        v_price := v_days * v_daily_rate;
END IF;

RETURN v_price * p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar disponibilidad
CREATE OR REPLACE FUNCTION check_item_availability(
    p_item_id INTEGER,
    p_quantity INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
v_available INTEGER;
BEGIN
SELECT quantity_available
INTO v_available
FROM rental_items
WHERE id = p_item_id;

RETURN COALESCE(v_available, 0) >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas
CREATE TRIGGER update_rental_items_updated_at
    BEFORE UPDATE ON rental_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rentals_updated_at
    BEFORE UPDATE ON rentals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rental_payments_updated_at
    BEFORE UPDATE ON rental_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para marcar alquileres vencidos
CREATE OR REPLACE FUNCTION mark_overdue_rentals()
RETURNS VOID AS $$
BEGIN
UPDATE rentals
SET is_overdue = true
WHERE status = 'activo'
  AND rental_end < CURRENT_DATE
  AND is_overdue = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. DATOS DE EJEMPLO (OPCIONAL)
-- ============================================

-- Insertar categorías de ejemplo si la tabla está vacía
INSERT INTO rental_items (
    name, description, category,
    daily_rate, weekly_rate, monthly_rate,
    quantity, quantity_total, quantity_available,
    image_url, status
)
SELECT * FROM (VALUES
                   ('Taladro Percutor Bosch', 'Taladro profesional 800W con maletín', 'herramientas',
                    15.00, 80.00, 250.00, 5, 5, 5,
                    'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400', 'disponible'),
                   ('Proyector Full HD', 'Proyector Epson 3200 lúmenes', 'equipos',
                    50.00, 250.00, 800.00, 2, 2, 2,
                    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400', 'disponible'),
                   ('Sierra Circular DeWalt', 'Sierra circular profesional 1800W', 'herramientas',
                    20.00, 100.00, 300.00, 3, 3, 3,
                    'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400', 'disponible'),
                   ('Compresor de Aire', 'Compresor 100L industrial', 'equipos',
                    35.00, 180.00, 600.00, 2, 2, 2,
                    'https://images.unsplash.com/photo-1609246265412-6d4b09c44e3d?w=400', 'disponible'),
                   ('Andamio Modular', 'Andamio certificado 6m altura', 'equipos',
                    25.00, 150.00, 500.00, 4, 4, 4,
                    'https://images.unsplash.com/photo-1581141849291-1125c7b692b5?w=400', 'disponible')
              ) AS t(name, description, category, daily_rate, weekly_rate, monthly_rate,
                     quantity, quantity_total, quantity_available, image_url, status)
WHERE NOT EXISTS (SELECT 1 FROM rental_items LIMIT 1);

-- ============================================
-- 10. PERMISOS (AJUSTAR SEGÚN TU CONFIGURACIÓN)
-- ============================================

-- Dar permisos al usuario de la aplicación (reemplazar 'tu_usuario' con el usuario real)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tu_usuario;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tu_usuario;

-- ============================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ============================================

-- Ejecutar esta consulta para verificar que todo está instalado correctamente
DO $$
BEGIN
    RAISE NOTICE 'Verificando instalación...';

    -- Verificar tablas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_items') THEN
        RAISE NOTICE '✓ Tabla rental_items existe';
END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rentals') THEN
        RAISE NOTICE '✓ Tabla rentals existe';
END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_payments') THEN
        RAISE NOTICE '✓ Tabla rental_payments existe';
END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_returns') THEN
        RAISE NOTICE '✓ Tabla rental_returns existe';
END IF;

    -- Verificar vistas
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_items_availability') THEN
        RAISE NOTICE '✓ Vista v_items_availability existe';
END IF;

    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_rental_statistics') THEN
        RAISE NOTICE '✓ Vista v_rental_statistics existe';
END IF;

    RAISE NOTICE 'Instalación completada exitosamente!';
END $$;