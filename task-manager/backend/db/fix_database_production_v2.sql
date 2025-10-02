-- =====================================================
-- FIX ROBUSTO PARA PRODUCCIÓN (tasks/payments + airbag)
-- =====================================================

-- 0) Usuario sistema y tabla users
CREATE TABLE IF NOT EXISTS users (
                                     id SERIAL PRIMARY KEY,
                                     email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

INSERT INTO users (id, email, name, role)
VALUES (1, 'sistema@taskmanager.com', 'Sistema', 'system')
    ON CONFLICT (id) DO UPDATE
                            SET name = EXCLUDED.name, role = EXCLUDED.role;

-- Ajusta secuencia si aplica
DO $$
DECLARE
max_id INT;
BEGIN
SELECT MAX(id) INTO max_id FROM users;
IF max_id IS NULL THEN
    max_id := 1;
END IF;
  PERFORM setval(pg_get_serial_sequence('users','id'), max_id, true);
END$$;

-- 1) TASKS: columna, saneo, DEFAULT/NOT NULL, FK fuerte
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS created_by INTEGER;

UPDATE tasks SET created_by = 1 WHERE created_by IS NULL;

-- Elimina FK anterior si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_created_by'
      AND table_name = 'tasks'
  ) THEN
ALTER TABLE tasks DROP CONSTRAINT fk_tasks_created_by;
END IF;
END$$;

-- Fija DEFAULT y NOT NULL (robusto)
ALTER TABLE tasks
    ALTER COLUMN created_by SET DEFAULT 1;

ALTER TABLE tasks
    ALTER COLUMN created_by SET NOT NULL;

-- Crea FK con SET DEFAULT (si borran user -> vuelve a 1)
ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
            ON DELETE SET DEFAULT
            ON UPDATE CASCADE;

-- updated_by opcional
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- 2) PAYMENTS: misma filosofía
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS created_by INTEGER;

UPDATE payments SET created_by = 1 WHERE created_by IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_payments_created_by'
      AND table_name = 'payments'
  ) THEN
ALTER TABLE payments DROP CONSTRAINT fk_payments_created_by;
END IF;
END$$;

ALTER TABLE payments
    ALTER COLUMN created_by SET DEFAULT 1;

-- Si quieres obligatorio:
-- ALTER TABLE payments
--   ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE payments
    ADD CONSTRAINT fk_payments_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
            ON DELETE SET DEFAULT
            ON UPDATE CASCADE;

-- 3) Índices recomendados
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_by ON tasks(updated_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);

-- 4) Auditoría updated_at (si las columnas existen)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5) Airbag: evita NULL/0 en created_by aunque el backend falle
CREATE OR REPLACE FUNCTION enforce_created_by_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL OR NEW.created_by = 0 THEN
    NEW.created_by := 1;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_tasks_created_by ON tasks;
CREATE TRIGGER trg_enforce_tasks_created_by
    BEFORE INSERT OR UPDATE ON tasks
                         FOR EACH ROW
                         EXECUTE FUNCTION enforce_created_by_default();

DROP TRIGGER IF EXISTS trg_enforce_payments_created_by ON payments;
CREATE TRIGGER trg_enforce_payments_created_by
    BEFORE INSERT OR UPDATE ON payments
                         FOR EACH ROW
                         EXECUTE FUNCTION enforce_created_by_default();

-- 6) Verificación
-- created_by en tasks: NOT NULL + DEFAULT 1
-- payments.created_by: DEFAULT 1 (y si quieres, NOT NULL también)
