-- 1) Permitir 'system' en el CHECK de role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'users'
      AND constraint_name = 'users_role_check'
  ) THEN
ALTER TABLE users DROP CONSTRAINT users_role_check;
END IF;
END$$;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
        CHECK (role IN ('user','admin','system'));

-- 2) Upsert del usuario sistema (ID=1) con role=system
INSERT INTO users (id, email, name, role)
VALUES (1, 'sistema@taskmanager.com', 'Sistema', 'system')
    ON CONFLICT (id) DO UPDATE
                            SET name = EXCLUDED.name,
                            role = EXCLUDED.role;

-- 3) Alinear la secuencia por si acaso
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
