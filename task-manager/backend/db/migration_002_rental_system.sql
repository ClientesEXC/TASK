-- Archivo: task-manager/backend/db/migration_002_rental_system.sql
-- Migración para agregar sistema de alquileres

-- 1. Crear tabla de items de alquiler
CREATE TABLE IF NOT EXISTS rental_items (
                                            id SERIAL PRIMARY KEY,
                                            name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('herramientas', 'equipos', 'vehiculos', 'espacios', 'otros')),
    daily_rate DECIMAL(10, 2) DEFAULT 0,
    weekly_rate DECIMAL(10, 2) DEFAULT 0,
    monthly_rate DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'alquilado', 'reservado', 'mantenimiento')),
    quantity INTEGER DEFAULT 1,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 2. Crear tabla de alquileres
CREATE TABLE IF NOT EXISTS rentals (
                                       id SERIAL PRIMARY KEY,
                                       item_id INTEGER NOT NULL REFERENCES rental_items(id) ON DELETE RESTRICT,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    customer_address TEXT,
    rental_start DATE NOT NULL,
    rental_end DATE NOT NULL,
    return_date DATE,
    total_amount DECIMAL(10, 2) NOT NULL,
    deposit DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'finalizado', 'cancelado')),
    notes TEXT,
    condition_notes TEXT, -- Notas sobre el estado del item al devolverlo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rental_dates_check CHECK (rental_end >= rental_start)
    );

-- 3. Crear índices para mejorar las consultas
CREATE INDEX IF NOT EXISTS idx_rental_items_status ON rental_items(status);
CREATE INDEX IF NOT EXISTS idx_rental_items_category ON rental_items(category);
CREATE INDEX IF NOT EXISTS idx_rentals_item_id ON rentals(item_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(rental_start, rental_end);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_name);

-- 4. Trigger para actualizar updated_at en rental_items
CREATE TRIGGER update_rental_items_updated_at
    BEFORE UPDATE ON rental_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Trigger para actualizar updated_at en rentals
CREATE TRIGGER update_rentals_updated_at
    BEFORE UPDATE ON rentals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Función para verificar disponibilidad de items
CREATE OR REPLACE FUNCTION check_item_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar si el item está disponible antes de crear un alquiler
    IF NEW.status = 'activo' THEN
        IF NOT EXISTS (
            SELECT 1 FROM rental_items
            WHERE id = NEW.item_id
            AND status = 'disponible'
        ) THEN
            RAISE EXCEPTION 'El item no está disponible para alquiler';
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Crear trigger para verificar disponibilidad
CREATE TRIGGER check_availability_before_rental
    BEFORE INSERT ON rentals
    FOR EACH ROW
    EXECUTE FUNCTION check_item_availability();

-- 8. Vista para alquileres vencidos
CREATE OR REPLACE VIEW overdue_rentals AS
SELECT
    r.*,
    ri.name as item_name,
    ri.category as item_category,
    CURRENT_DATE - r.rental_end as days_overdue
FROM rentals r
         JOIN rental_items ri ON r.item_id = ri.id
WHERE r.status = 'activo'
  AND r.rental_end < CURRENT_DATE;

-- 9. Vista para estadísticas de alquileres
CREATE OR REPLACE VIEW rental_statistics AS
SELECT
    ri.id as item_id,
    ri.name as item_name,
    ri.category,
    COUNT(r.id) as total_rentals,
    COUNT(CASE WHEN r.status = 'activo' THEN 1 END) as active_rentals,
    COUNT(CASE WHEN r.status = 'finalizado' THEN 1 END) as completed_rentals,
    COALESCE(SUM(r.total_amount), 0) as total_revenue,
    COALESCE(AVG(r.rental_end - r.rental_start), 0) as avg_rental_days
FROM rental_items ri
         LEFT JOIN rentals r ON ri.id = r.item_id
GROUP BY ri.id, ri.name, ri.category;

-- 10. Datos de ejemplo para items de alquiler
INSERT INTO rental_items (name, description, category, daily_rate, weekly_rate, monthly_rate, status)
VALUES
    ('Taladro Percutor Bosch', 'Taladro profesional 800W con maletín y accesorios', 'herramientas', 15.00, 80.00, 250.00, 'disponible'),
    ('Proyector Full HD', 'Proyector Epson 3200 lúmenes con pantalla', 'equipos', 50.00, 250.00, 800.00, 'disponible'),
    ('Andamio Modular 6m', 'Andamio certificado con plataformas y barandas', 'equipos', 25.00, 150.00, 500.00, 'disponible'),
    ('Generador Eléctrico 5KW', 'Generador portátil silencioso', 'equipos', 40.00, 220.00, 700.00, 'disponible'),
    ('Sierra Circular DeWalt', 'Sierra circular profesional 1800W', 'herramientas', 20.00, 100.00, 300.00, 'disponible'),
    ('Compresor de Aire 100L', 'Compresor industrial de alta presión', 'equipos', 35.00, 180.00, 600.00, 'disponible');

-- 11. Datos de ejemplo para alquileres
INSERT INTO rentals (item_id, customer_name, customer_phone, customer_email, rental_start, rental_end, total_amount, deposit, status)
VALUES
    (1, 'Carlos Mendoza', '0999123456', 'carlos@email.com', '2024-01-25', '2024-01-28', 45.00, 50.00, 'finalizado'),
    (2, 'Ana Silva', '0998765432', 'ana.silva@empresa.com', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 250.00, 100.00, 'activo'),
    (3, 'Constructora ABC', '022345678', 'info@constructora.com', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '2 days', 200.00, 150.00, 'activo');

-- 12. Actualizar items alquilados
UPDATE rental_items SET status = 'alquilado' WHERE id IN (2, 3);