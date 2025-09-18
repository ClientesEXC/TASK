const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de la base de datos
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'taskuser',
    password: process.env.DB_PASSWORD || 'taskpass',
    database: process.env.DB_NAME || 'taskmanager'
});

// Middleware
app.use(cors());
app.use(express.json());

// Rutas

// Obtener todas las tareas con el total de abonos
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.*,
                COALESCE(SUM(p.amount), 0) as total_advance_payment,
                COUNT(p.id) as payment_count
            FROM tasks t
            LEFT JOIN payments p ON t.id = p.task_id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tareas' });
    }
});

// Obtener tarea por ID con sus abonos
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener tarea
        const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        // Obtener abonos de la tarea
        const paymentsResult = await pool.query(
            'SELECT * FROM payments WHERE task_id = $1 ORDER BY payment_date DESC',
            [id]
        );

        const task = taskResult.rows[0];
        task.payments = paymentsResult.rows;
        task.total_advance_payment = paymentsResult.rows.reduce((sum, payment) =>
            sum + parseFloat(payment.amount), 0
        );

        res.json(task);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tarea' });
    }
});

// Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { title, client_name, price, status, description, due_date, initial_payment } = req.body;

        // Crear tarea
        const taskResult = await client.query(
            `INSERT INTO tasks (title, client_name, price, status, description, due_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, client_name, price || 0, status, description, due_date]
        );

        const task = taskResult.rows[0];

        // Si hay un abono inicial, crearlo
        if (initial_payment && initial_payment.amount > 0) {
            await client.query(
                `INSERT INTO payments (task_id, amount, payment_date, notes)
                 VALUES ($1, $2, $3, $4)`,
                [task.id, initial_payment.amount, initial_payment.date || new Date(), initial_payment.notes || 'Abono inicial']
            );
        }

        await client.query('COMMIT');
        res.status(201).json(task);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear tarea' });
    } finally {
        client.release();
    }
});

// Actualizar tarea
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, client_name, price, status, description, due_date } = req.body;

        const result = await pool.query(
            `UPDATE tasks 
             SET title = $1, client_name = $2, price = $3, 
                 status = $4, description = $5, due_date = $6
             WHERE id = $7
             RETURNING *`,
            [title, client_name, price, status, description, due_date, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar tarea' });
    }
});

// Eliminar tarea (los abonos se eliminan automáticamente por CASCADE)
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        res.json({ message: 'Tarea eliminada exitosamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar tarea' });
    }
});

// Actualizar solo el estado de una tarea
app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// ========== RUTAS DE ABONOS ==========

// Obtener todos los abonos de una tarea
app.get('/api/tasks/:id/payments', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM payments WHERE task_id = $1 ORDER BY payment_date DESC',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener abonos' });
    }
});

// Agregar un nuevo abono
app.post('/api/tasks/:id/payments', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_date, notes } = req.body;

        // Verificar que la tarea existe
        const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const result = await pool.query(
            `INSERT INTO payments (task_id, amount, payment_date, notes)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [id, amount, payment_date || new Date(), notes || '']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al agregar abono' });
    }
});

// Actualizar un abono
app.put('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_date, notes } = req.body;

        const result = await pool.query(
            `UPDATE payments 
             SET amount = $1, payment_date = $2, notes = $3
             WHERE id = $4
             RETURNING *`,
            [amount, payment_date, notes, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Abono no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar abono' });
    }
});

// Eliminar un abono
app.delete('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Abono no encontrado' });
        }

        res.json({ message: 'Abono eliminado exitosamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar abono' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});