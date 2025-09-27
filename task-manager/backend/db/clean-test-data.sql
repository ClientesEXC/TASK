-- Limpiar todos los datos de prueba del sistema de alquileres

-- 1. Eliminar pagos de alquileres
DELETE FROM rental_payments;

-- 2. Eliminar devoluciones
DELETE FROM rental_returns WHERE TRUE;

-- 3. Eliminar TODOS los alquileres
DELETE FROM rentals;

-- 4. Eliminar TODOS los artículos
DELETE FROM rental_items;

-- 5. Reiniciar secuencias (IDs)
ALTER SEQUENCE rental_items_id_seq RESTART WITH 1;
ALTER SEQUENCE rentals_id_seq RESTART WITH 1;
ALTER SEQUENCE rental_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE rental_returns_id_seq RESTART WITH 1;

-- Mensaje de confirmación
SELECT 'Base de datos limpiada exitosamente - Sistema de alquileres vacío' AS resultado;