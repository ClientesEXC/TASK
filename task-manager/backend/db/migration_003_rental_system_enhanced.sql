-- Archivo: task-manager/backend/db/migration_003_rental_system_enhanced.sql
-- Migración para mejorar el sistema de alquileres con todas las funcionalidades solicitadas

-- 1. Actualizar tabla rental_items para incluir cantidad disponible y total
ALTER TABLE rental_items
    ADD COLUMN IF NOT EXISTS quantity_total INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT 1;

-- Actualizar valores existentes
UPDATE rental_items
SET quantity_total = quantity,
    quantity_available = CASE
                             WHEN status = 'disponible' THEN quantity
                             ELSE 0
        END
WHERE quantity_total IS NULL;

-- 2. Actualizar tabla de alquileres con nuevos campos
ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS customer_id_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS has_collateral BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS collateral_description TEXT,
    ADD COLUMN IF NOT EXISTS quantity_rented INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT false;

-- 3. Crear tabla de abonos para alquileres (similar a payments de tasks)
CREATE TABLE IF NOT EXISTS rental_payments (
                                               id SERIAL PRIMARY KEY,
                                               rental_id INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'efectivo',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 4. Crear tabla de historial de devoluciones
CREATE TABLE IF NOT EXISTS rental_returns (
                                              id SERIAL PRIMARY KEY,
                                              rental_id INTEGER NOT NULL REFERENCES rentals(id),
    return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quantity_returned INTEGER NOT NULL,
    condition_status VARCHAR(50) CHECK (condition_status IN ('bueno', 'regular', 'dañado')),
    damage_notes TEXT,
    return_notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 5. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_rental_payments_rental_id ON rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_returns_rental_id ON rental_returns(rental_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer_id ON rentals(customer_id_number);
CREATE INDEX IF NOT EXISTS idx_rentals_is_overdue ON rentals(is_overdue);

-- 6. Vista para artículos con disponibilidad
CREATE OR REPLACE VIEW items_availability AS
SELECT
    ri.id,
    ri.name,
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
        END as availability_status
FROM rental_items ri;

-- 7. Vista para alquileres pendientes de devolución
CREATE OR REPLACE VIEW pending_returns AS
SELECT
    r.*,
    ri.name as item_name,
    ri.image_url as item_image,
    CURRENT_DATE - r.rental_end as days_overdue,
    COALESCE(SUM(rp.amount), 0) as total_paid,
    r.total_amount - COALESCE(SUM(rp.amount), 0) as balance_due
FROM rentals r
         JOIN rental_items ri ON r.item_id = ri.id
         LEFT JOIN rental_payments rp ON r.id = rp.rental_id
WHERE r.status = 'activo'
GROUP BY r.id, ri.name, ri.image_url;

-- 8. Vista para estadísticas de alquileres con abonos
CREATE OR REPLACE VIEW rental_statistics_enhanced AS
SELECT
    COUNT(DISTINCT r.id) as total_rentals,
    COUNT(DISTINCT CASE WHEN r.status = 'activo' THEN r.id END) as active_rentals,
    COUNT(DISTINCT CASE WHEN r.status = 'activo' AND r.rental_end < CURRENT_DATE THEN r.id END) as overdue_rentals,
    COUNT(DISTINCT CASE WHEN r.status = 'finalizado' THEN r.id END) as completed_rentals,
    COALESCE(SUM(r.total_amount), 0) as total_revenue,
    COALESCE(SUM(CASE WHEN r.status = 'activo' THEN r.total_amount ELSE 0 END), 0) as pending_revenue,
    COALESCE(SUM(rp.amount), 0) as total_collected,
    COUNT(DISTINCT ri.id) as total_items,
    SUM(ri.quantity_total) as total_inventory,
    SUM(ri.quantity_available) as available_inventory
FROM rental_items ri
         LEFT JOIN rentals r ON ri.id = r.item_id
         LEFT JOIN rental_payments rp ON r.id = rp.rental_id;

-- 9. Función para actualizar cantidad disponible al alquilar
CREATE OR REPLACE FUNCTION update_item_availability_on_rental()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Al crear un alquiler, reducir cantidad disponible
UPDATE rental_items
SET quantity_available = quantity_available - NEW.quantity_rented
WHERE id = NEW.item_id;

-- Verificar si quedan unidades disponibles
UPDATE rental_items
SET status = CASE
                 WHEN quantity_available = 0 THEN 'agotado'
                 ELSE 'disponible'
    END
WHERE id = NEW.item_id;

ELSIF TG_OP = 'UPDATE' THEN
        -- Si se marca como finalizado, devolver cantidad
        IF OLD.status = 'activo' AND NEW.status = 'finalizado' THEN
UPDATE rental_items
SET quantity_available = quantity_available + NEW.quantity_rented,
    status = 'disponible'
WHERE id = NEW.item_id;
END IF;
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Crear trigger para actualizar disponibilidad
DROP TRIGGER IF EXISTS update_availability_on_rental ON rentals;
CREATE TRIGGER update_availability_on_rental
    AFTER INSERT OR UPDATE ON rentals
                        FOR EACH ROW
                        EXECUTE FUNCTION update_item_availability_on_rental();

-- 11. Función para marcar alquileres vencidos
CREATE OR REPLACE FUNCTION mark_overdue_rentals()
RETURNS void AS $$
BEGIN
UPDATE rentals
SET is_overdue = true
WHERE status = 'activo'
  AND rental_end < CURRENT_DATE
  AND is_overdue = false;
END;
$$ LANGUAGE plpgsql;

-- 12. Trigger para actualizar updated_at en rental_payments
CREATE TRIGGER update_rental_payments_updated_at
    BEFORE UPDATE ON rental_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 13. Datos de ejemplo mejorados
-- Actualizar items existentes con cantidades
UPDATE rental_items
SET quantity_total = 5,
    quantity_available = 5,
    image_url = 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=300&h=200&fit=crop'
WHERE name LIKE '%Taladro%';

UPDATE rental_items
SET quantity_total = 2,
    quantity_available = 2,
    image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop'
WHERE name LIKE '%Proyector%';

-- Insertar nuevos artículos con cantidades
INSERT INTO rental_items (name, description, category, daily_rate, weekly_rate, monthly_rate, quantity_total, quantity_available, image_url)
VALUES
    ('Martillo Demoledor', 'Martillo demoledor profesional 1500W', 'herramientas', 30.00, 150.00, 450.00, 3, 3, 'https://images.unsplash.com/photo-1609205807720-816d85412460?w=300&h=200&fit=crop'),
    ('Escalera Telescópica 8m', 'Escalera de aluminio extensible', 'equipos', 15.00, 70.00, 200.00, 6, 6, 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=300&h=200&fit=crop'),
    ('Mezcladora de Concreto', 'Mezcladora eléctrica 180L', 'equipos', 45.00, 250.00, 800.00, 2, 2, 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=300&h=200&fit=crop'),
    ('Amoladora Angular', 'Amoladora 7 pulgadas 2000W', 'herramientas', 18.00, 90.00, 280.00, 8, 8, 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=300&h=200&fit=crop')
    ON CONFLICT DO NOTHING;