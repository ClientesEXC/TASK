-- Conectarse a PostgreSQL y ejecutar:
-- Primero, verificar si la tabla users existe
CREATE TABLE IF NOT EXISTS users (
                                     id SERIAL PRIMARY KEY,
                                     email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insertar usuario por defecto
INSERT INTO users (id, email, name)
VALUES (1, 'sistema@taskmanager.com', 'Sistema')
    ON CONFLICT (id) DO NOTHING;

-- Asegurar que created_by tenga foreign key
ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_created_by
        FOREIGN KEY (created_by)
            REFERENCES users(id)
            ON DELETE SET NULL;

-- Lo mismo para payments si tiene created_by
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);