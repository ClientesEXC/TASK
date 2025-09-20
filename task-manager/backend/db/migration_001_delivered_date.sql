-- Archivo: task-manager/backend/db/migration_001_delivered_date.sql
-- Migración para agregar campo de fecha de entrega y vista de archivados

-- 1. Agregar columna delivered_date a la tabla tasks
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS delivered_date TIMESTAMP;

-- 2. Crear índice para mejorar consultas por estado y fecha de entrega
CREATE INDEX IF NOT EXISTS idx_tasks_status_delivered
    ON tasks(status, delivered_date);

-- 3. Actualizar el trigger para establecer delivered_date cuando cambia a 'entregado'
CREATE OR REPLACE FUNCTION update_delivered_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el status cambió a 'entregado' y no tenía delivered_date
    IF NEW.status = 'entregado' AND OLD.status != 'entregado' AND NEW.delivered_date IS NULL THEN
        NEW.delivered_date = CURRENT_TIMESTAMP;
END IF;
    -- Si el status cambió de 'entregado' a otro, limpiamos delivered_date
    IF NEW.status != 'entregado' AND OLD.status = 'entregado' THEN
        NEW.delivered_date = NULL;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear el trigger
DROP TRIGGER IF EXISTS update_tasks_delivered_date ON tasks;
CREATE TRIGGER update_tasks_delivered_date
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_delivered_date();

-- 5. Actualizar registros existentes que están en 'entregado' (asumiendo que fueron entregados al momento de su última actualización)
UPDATE tasks
SET delivered_date = updated_at
WHERE status = 'entregado'
  AND delivered_date IS NULL;

-- 6. Crear vista para tareas archivadas (entregadas hace más de 2 días)
CREATE OR REPLACE VIEW archived_tasks AS
SELECT
    t.*,
    CURRENT_TIMESTAMP - t.delivered_date as time_since_delivery,
    CASE
        WHEN t.status = 'entregado' AND t.delivered_date <= (CURRENT_TIMESTAMP - INTERVAL '2 days') THEN true
        ELSE false
        END as is_archived
FROM tasks t
WHERE t.status = 'entregado'
  AND t.delivered_date IS NOT NULL
  AND t.delivered_date <= (CURRENT_TIMESTAMP - INTERVAL '2 days');