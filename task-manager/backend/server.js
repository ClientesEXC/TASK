require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { optionalAuth, DEFAULT_USER_ID } = require('./middleware/auth');

// Inicializar Express PRIMERO
const app = express();
const PORT = process.env.PORT || 3001;
const LOCAL_IP = process.env.LOCAL_IP || '19.18.1.101';


// Configuración de CORS mejorada
const corsOptions = {
    origin: function (origin, callback) {
        // Lista de orígenes permitidos
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://19.18.1.101:3000',
            'http://19.18.1.101:3001',
        ];

        // Permitir peticiones sin origin (Postman, apps móviles, etc.)
        if (!origin) return callback(null, true);

        // Permitir cualquier IP de tu red local 19.18.x.x
        if (origin && origin.match(/^http:\/\/19\.18\.\d{1,3}\.\d{1,3}:\d+$/)) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ Origen bloqueado por CORS:', origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(optionalAuth);

app.use(express.json());



// Middleware de validación
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Configuración de la base de datos
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    user: process.env.DB_USER || 'taskuser',
    password: process.env.DB_PASSWORD || 'taskpass',
    database: process.env.DB_NAME || 'taskmanager'
});



// Carpeta de uploads y estáticos
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer: solo PNG hasta 2 MB
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase(); // .png
        cb(null, `item_${Date.now()}${ext}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png') return cb(null, true);
    cb(new Error('Solo se aceptan imágenes PNG.'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

// Endpoint de subida de imagen
app.post('/api/upload/image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url });
});

// CONFIGURACIÓN DE USUARIO POR DEFECTO
// ===========================================
// En server.js, agrega:
const rentalRoutes = require('./routes/rentalRoutes');
app.use('/api', rentalRoutes);

// Middleware temporal para asignar usuario por defecto
const assignDefaultUser = (req, res, next) => {
    // Por ahora, siempre usar usuario sistema
    req.user = {
        id: DEFAULT_USER_ID,
        name: 'Sistema',
        email: 'sistema@taskmanager.com'
    };
    next();
};

// Aplicar a todas las rutas
app.use(assignDefaultUser);

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

        const {
            title,
            client_name,
            price = 0,
            status = 'cotizacion',
            description = '',
            due_date,
            initial_payment
        } = req.body;

        // Validación robusta
        const errors = [];

        if (!title || title.trim() === '') {
            errors.push('El título es requerido');
        }

        if (!client_name || client_name.trim() === '') {
            errors.push('El nombre del cliente es requerido');
        }

        if (price < 0) {
            errors.push('El precio no puede ser negativo');
        }

        const validStatuses = ['cotizacion', 'en_proceso', 'terminado', 'entregado'];
        if (!validStatuses.includes(status)) {
            errors.push(`Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`);
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validación fallida',
                errors: errors
            });
        }

        // IMPORTANTE: Usar el usuario del request o el por defecto
        const userId = req.user?.id || DEFAULT_USER_ID;

        console.log('📝 Creando tarea con usuario ID:', userId);

        // Query de inserción CON created_by
        const taskQuery = `
            INSERT INTO tasks (
                title, 
                client_name, 
                price, 
                status, 
                description, 
                due_date,
                created_by,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
            RETURNING *
        `;

        const taskValues = [
            title.trim(),
            client_name.trim(),
            price,
            status,
            description.trim(),
            due_date,
            userId // SIEMPRE tendrá un valor
        ];

        console.log('🔍 Valores a insertar:', taskValues);

        const taskResult = await client.query(taskQuery, taskValues);
        const newTask = taskResult.rows[0];

        // Si hay un abono inicial, insertarlo
        if (initial_payment && initial_payment.amount > 0) {
            const paymentQuery = `
                INSERT INTO payments (
                    task_id, 
                    amount, 
                    payment_date, 
                    notes,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5) 
                RETURNING *
            `;

            const paymentValues = [
                newTask.id,
                initial_payment.amount,
                initial_payment.payment_date || new Date(),
                initial_payment.notes || 'Abono inicial',
                userId
            ];

            const paymentResult = await client.query(paymentQuery, paymentValues);
            newTask.initial_payment = paymentResult.rows[0];
        }

        await client.query('COMMIT');

        console.log(`✅ Tarea creada exitosamente: ID ${newTask.id} - ${title}`);

        // Retornar con información del usuario
        const responseQuery = `
            SELECT 
                t.*,
                u.name as created_by_name,
                u.email as created_by_email
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = $1
        `;

        const responseResult = await pool.query(responseQuery, [newTask.id]);
        res.status(201).json(responseResult.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error al crear tarea:', error);
        console.error('Stack trace:', error.stack);

        // Manejo detallado de errores
        if (error.code === '23502') {
            return res.status(400).json({
                error: 'Campo requerido faltante',
                field: error.column,
                detail: error.detail,
                hint: 'Asegúrese de que todos los campos obligatorios estén completos'
            });
        }

        if (error.code === '23503') {
            return res.status(400).json({
                error: 'Referencia inválida',
                detail: 'El usuario especificado no existe',
                hint: 'Contacte al administrador del sistema'
            });
        }

        res.status(500).json({
            error: 'Error al crear la tarea',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
            code: error.code
        });
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


// ============================================
// SISTEMA DE ALQUILERES MEJORADO - PRODUCCIÓN
// ============================================
// ===== RENTALS MODULE DISABLED (legacy endpoints blocked) =====
app.all(
    [
        '/api/rentals',
        '/api/rentals/*',
        '/api/rental-items',
        '/api/rental-items/*',
        '/api/rental-payments',
        '/api/rental-payments/*'
    ],
    (req, res) => {
        res.status(410).json({
            error: 'El módulo de alquileres fue retirado.',
        });
    }
);

// Escuchar en todas las interfaces de red
// Escuchar en todas las interfaces de red
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('\n🚀 ========================================');
    console.log('✅ SERVIDOR BACKEND INICIADO');
    console.log('========================================');
    console.log(`📍 Local:      http://localhost:${PORT}`);
    console.log(`🌐 Red Local:  http://19.18.1.101:${PORT}`);
    console.log(`📊 Base Datos: PostgreSQL puerto ${process.env.DB_PORT || 5433}`);
    console.log('========================================\n');
});