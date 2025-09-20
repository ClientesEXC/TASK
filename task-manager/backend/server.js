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

// Obtener todas las tareas con el total de abonos (ACTUALIZADO: excluye archivadas por defecto)
app.get('/api/tasks', async (req, res) => {
    try {
        const { includeArchived } = req.query;

        let whereClause = '';
        if (!includeArchived || includeArchived === 'false') {
            // Excluir tareas entregadas hace más de 2 días
            whereClause = `WHERE (t.status != 'entregado' 
                           OR t.delivered_date IS NULL 
                           OR t.delivered_date > (CURRENT_TIMESTAMP - INTERVAL '2 days'))`;
        }

        const result = await pool.query(`
            SELECT 
                t.*,
                COALESCE(SUM(p.amount), 0) as total_advance_payment,
                COUNT(p.id) as payment_count,
                CASE 
                    WHEN t.status = 'entregado' AND t.delivered_date IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.delivered_date))/86400
                    ELSE NULL
                END as days_since_delivery,
                CASE 
                    WHEN t.status = 'entregado' 
                    AND t.delivered_date IS NOT NULL 
                    AND t.delivered_date <= (CURRENT_TIMESTAMP - INTERVAL '2 days') 
                    THEN true
                    ELSE false
                END as is_archived
            FROM tasks t
            LEFT JOIN payments p ON t.id = p.task_id
            ${whereClause}
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tareas' });
    }
});

// NUEVA RUTA: Obtener solo tareas archivadas
app.get('/api/tasks/archived', async (req, res) => {
    try {
        const { year, month } = req.query;

        let whereClause = `WHERE t.status = 'entregado' 
                          AND t.delivered_date IS NOT NULL 
                          AND t.delivered_date <= (CURRENT_TIMESTAMP - INTERVAL '2 days')`;

        // Filtros opcionales por año y mes
        if (year) {
            whereClause += ` AND EXTRACT(YEAR FROM t.delivered_date) = ${parseInt(year)}`;
        }
        if (month) {
            whereClause += ` AND EXTRACT(MONTH FROM t.delivered_date) = ${parseInt(month)}`;
        }

        const result = await pool.query(`
            SELECT 
                t.*,
                COALESCE(SUM(p.amount), 0) as total_advance_payment,
                COUNT(p.id) as payment_count,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.delivered_date))/86400 as days_since_delivery
            FROM tasks t
            LEFT JOIN payments p ON t.id = p.task_id
            ${whereClause}
            GROUP BY t.id
            ORDER BY t.delivered_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tareas archivadas' });
    }
});

// NUEVA RUTA: Obtener estadísticas de archivados
app.get('/api/tasks/archived/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_archived,
                EXTRACT(YEAR FROM delivered_date) as year,
                EXTRACT(MONTH FROM delivered_date) as month,
                COUNT(*) as count,
                SUM(price) as total_revenue
            FROM tasks
            WHERE status = 'entregado' 
            AND delivered_date IS NOT NULL 
            AND delivered_date <= (CURRENT_TIMESTAMP - INTERVAL '2 days')
            GROUP BY EXTRACT(YEAR FROM delivered_date), EXTRACT(MONTH FROM delivered_date)
            ORDER BY year DESC, month DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Obtener tarea por ID con sus abonos
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener tarea
        const taskResult = await pool.query(`
            SELECT *,
                CASE 
                    WHEN status = 'entregado' AND delivered_date IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - delivered_date))/86400
                    ELSE NULL
                END as days_since_delivery
            FROM tasks 
            WHERE id = $1`,
            [id]
        );

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

        // Si el estado es 'entregado', establecer delivered_date
        const deliveredDate = status === 'entregado' ? new Date() : null;

        // Crear tarea
        const taskResult = await client.query(
            `INSERT INTO tasks (title, client_name, price, status, description, due_date, delivered_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [title, client_name, price || 0, status, description, due_date, deliveredDate]
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

        // Obtener el estado anterior
        const previousResult = await pool.query('SELECT status FROM tasks WHERE id = $1', [id]);
        const previousStatus = previousResult.rows[0]?.status;

        let deliveredDate = null;
        // Si cambia a 'entregado', establecer la fecha
        if (status === 'entregado' && previousStatus !== 'entregado') {
            deliveredDate = new Date();
        }

        let updateQuery = `UPDATE tasks 
                          SET title = $1, client_name = $2, price = $3, 
                              status = $4, description = $5, due_date = $6`;
        let params = [title, client_name, price, status, description, due_date];

        if (deliveredDate) {
            updateQuery += ', delivered_date = $7';
            params.push(deliveredDate);
        } else if (status !== 'entregado') {
            // Si cambia de 'entregado' a otro estado, limpiar delivered_date
            updateQuery += ', delivered_date = NULL';
        }

        updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);

        const result = await pool.query(updateQuery, params);

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

        // Obtener el estado anterior
        const previousResult = await pool.query('SELECT status FROM tasks WHERE id = $1', [id]);
        const previousStatus = previousResult.rows[0]?.status;

        let query = 'UPDATE tasks SET status = $1';
        let params = [status];

        // Si cambia a 'entregado', establecer delivered_date
        if (status === 'entregado' && previousStatus !== 'entregado') {
            query += ', delivered_date = CURRENT_TIMESTAMP';
        } else if (status !== 'entregado' && previousStatus === 'entregado') {
            // Si cambia de 'entregado' a otro estado, limpiar delivered_date
            query += ', delivered_date = NULL';
        }

        query += ' WHERE id = $2 RETURNING *';
        params.push(id);

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// NUEVA RUTA: Restaurar tarea archivada (cambiar estado de entregado a otro)
app.patch('/api/tasks/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        const { newStatus } = req.body;

        const validStatuses = ['cotizacion', 'en_proceso', 'terminado'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ error: 'Estado inválido para restauración' });
        }

        const result = await pool.query(
            'UPDATE tasks SET status = $1, delivered_date = NULL WHERE id = $2 RETURNING *',
            [newStatus, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al restaurar tarea' });
    }
});

// ========== RUTAS DE ABONOS (sin cambios) ==========

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