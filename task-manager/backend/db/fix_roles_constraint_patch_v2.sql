-- Asegura columna updated_at en users (evita el error del trigger)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
ALTER TABLE users
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
END IF;
END$$;

-- (Opcional) asegura created_at también, por consistencia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'created_at'
  ) THEN
ALTER TABLE users
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
END IF;
END$$;

-- Quita trigger de users si existe para que el upsert no falle
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Si tu constraint de roles no permite 'system', la reemplazamos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'users'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'users_role_check'
  ) THEN
ALTER TABLE users DROP CONSTRAINT users_role_check;
END IF;

  -- Crea el CHECK aceptando estos roles (ajusta si quieres más/menos)
ALTER TABLE users
    ADD CONSTRAINT users_role_check
        CHECK (role IN ('user','admin','system'));
END$$;

-- Asegura que existe el usuario sistema id=1 (o lo actualiza)
INSERT INTO users (id, email, name, role)
VALUES (1, 'sistema@taskmanager.com', 'Sistema', 'system')
    ON CONFLICT (id) DO UPDATE
                            SET name = EXCLUDED.name,
                            role = EXCLUDED.role;

-- Alinea la secuencia de users.id por si acaso
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

-- (Re)crea la función de auditoría si fuera necesario
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vuelve a crear el trigger de auditoría en users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
