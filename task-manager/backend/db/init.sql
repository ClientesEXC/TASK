-- Tabla de tareas (modificada - sin el campo advance_payment)
CREATE TABLE IF NOT EXISTS tasks (
                                     id SERIAL PRIMARY KEY,
                                     title VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL CHECK (status IN ('cotizacion', 'en_proceso', 'terminado', 'entregado')),
    description TEXT,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Nueva tabla para registro de abonos
CREATE TABLE IF NOT EXISTS payments (
                                        id SERIAL PRIMARY KEY,
                                        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Índice para mejorar las consultas
CREATE INDEX idx_payments_task_id ON payments(task_id);

-- Trigger para actualizar updated_at en tasks
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
INSERT INTO tasks (title, client_name, price, status, description, due_date)
VALUES
    ('Diseño de Logo', 'Juan Pérez', 500.00, 'cotizacion', 'Diseño de logo corporativo', '2024-02-15'),
    ('Desarrollo Web', 'María García', 2000.00, 'en_proceso', 'Sitio web empresarial', '2024-02-20'),
    ('Mantenimiento', 'Carlos López', 300.00, 'terminado', 'Mantenimiento mensual', '2024-01-31');

-- Datos de ejemplo para abonos
INSERT INTO payments (task_id, amount, payment_date, notes)
VALUES
    (1, 250.00, '2024-01-15', 'Primer abono 50%'),
    (2, 800.00, '2024-01-20', 'Abono inicial'),
    (2, 500.00, '2024-01-25', 'Segundo abono'),
    (3, 300.00, '2024-01-10', 'Pago completo');