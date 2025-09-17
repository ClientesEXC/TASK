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

// Obtener todas las tareas
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tareas' });
    }
});

// Obtener tarea por ID
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tarea' });
    }
});

// Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, client_name, price, advance_payment, status, description, due_date } = req.body;
        
        const result = await pool.query(
            `INSERT INTO tasks (title, client_name, price, advance_payment, status, description, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [title, client_name, price || 0, advance_payment || 0, status, description, due_date]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear tarea' });
    }
});

// Actualizar tarea
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, client_name, price, advance_payment, status, description, due_date } = req.body;
        
        const result = await pool.query(
            `UPDATE tasks 
             SET title = $1, client_name = $2, price = $3, advance_payment = $4, 
                 status = $5, description = $6, due_date = $7
             WHERE id = $8
             RETURNING *`,
            [title, client_name, price, advance_payment, status, description, due_date, id]
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

// Eliminar tarea
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});