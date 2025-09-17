CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0,
    advance_payment DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL CHECK (status IN ('cotizacion', 'en_proceso', 'terminado', 'entregado')),
    description TEXT,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE
    ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Datos de ejemplo
INSERT INTO tasks (title, client_name, price, advance_payment, status, description, due_date)
VALUES 
    ('Diseño de Logo', 'Juan Pérez', 500.00, 250.00, 'cotizacion', 'Diseño de logo corporativo', '2024-02-15'),
    ('Desarrollo Web', 'María García', 2000.00, 800.00, 'en_proceso', 'Sitio web empresarial', '2024-02-20'),
    ('Mantenimiento', 'Carlos López', 300.00, 300.00, 'terminado', 'Mantenimiento mensual', '2024-01-31');