-- Archivo: migration_004_multiple_items.sql
-- Migración para permitir múltiples artículos en un mismo alquiler
-- y corregir el error en devoluciones.

-- ========================================
-- TABLA DE DETALLES DE ALQUILER
-- ========================================
CREATE TABLE IF NOT EXISTS rental_details (
                                              id SERIAL PRIMARY KEY,
                                              rental_id INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES rental_items(id) ON DELETE RESTRICT,
    quantity_rented INTEGER NOT NULL DEFAULT 1,
    daily_rate DECIMAL(10,2),
    weekly_rate DECIMAL(10,2),
    monthly_rate DECIMAL(10,2),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_rental_details_rental_id ON rental_details(rental_id);

-- ========================================
-- FUNCIÓN Y TRIGGER PARA DEVOLUCIONES
-- ========================================
CREATE OR REPLACE FUNCTION process_item_return()
RETURNS TRIGGER AS $$
BEGIN
    -- Al registrar una devolución, devolver solo la cantidad real
UPDATE rental_items
SET quantity_available = quantity_available + NEW.quantity_returned,
    status = 'disponible'
WHERE id = (
    SELECT item_id FROM rentals WHERE id = NEW.rental_id
);

RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rental_return_update ON rental_returns;
CREATE TRIGGER rental_return_update
    AFTER INSERT ON rental_returns
    FOR EACH ROW
    EXECUTE FUNCTION process_item_return();
