-- Script de corrección automática 
 
-- 1. Hacer created_by nullable 
ALTER TABLE tasks ALTER COLUMN created_by DROP NOT NULL; 
 
-- 2. Crear tabla users si no existe 
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
 
-- 3. Insertar usuario sistema 
INSERT INTO users (id, email, name, role) 
VALUES (1, 'sistema@taskmanager.com', 'Sistema', 'system') 
ON CONFLICT (id) DO UPDATE 
SET name = 'Sistema', role = 'system'; 
 
-- 4. Actualizar tareas sin created_by 
UPDATE tasks SET created_by = 1 WHERE created_by IS NULL; 
 
-- 5. Resetear secuencia 
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1)); 
