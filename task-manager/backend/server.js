// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const multer = require('multer');
const morgan = require('morgan');
const fs = require('fs');

const { optionalAuth, DEFAULT_USER_ID } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error-handler');

// ✅ Usa SIEMPRE el módulo de DB compartido
const { pool } = require('./db');
// task-manager/backend/server.js
const quotesRouter = require('./routes/quotes.routes');


const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const LOCAL_IP = process.env.LOCAL_IP || '19.18.1.101';

// -------------------- CORS --------------------
// Configuración de CORS mejorada (una sola subred 192.168.100.0/24)
const corsOptions = {
    origin: function (origin, callback) {
        // Expresiones regulares para aceptar la subred completa
        const allowRegexes = [
            // Cualquier IP en 192.168.100.x
            /^http:\/\/192\.168\.100\.\d{1,3}(:\d+)?$/,
            // Localhost
            /^http:\/\/localhost(:\d+)?$/,
            /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        ];

        // Sin origen (Postman, etc)
        if (!origin) return callback(null, true);

        // Verificar si cumple alguna regla
        if (allowRegexes.some((rx) => rx.test(origin))) {
            return callback(null, true);
        }

        console.log('❌ CORS bloqueado:', origin);
        callback(new Error('CORS no permitido'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

// ---------------- Middlewares base -------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));


// 2) Seguridad sin romper estáticos/CORS
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false
}));

// 3) Sanitizador: "" -> null (evita errores de tipos en DB)
app.use((req, _res, next) => {
    const scrub = (o) => {
        if (o && typeof o === 'object') {
            for (const k of Object.keys(o)) {
                if (o[k] === '') o[k] = null;
                else if (typeof o[k] === 'object') scrub(o[k]);
            }
        }
    };
    scrub(req.body);
    next();
});
// --------- Auth opcional + usuario por defecto ----------
app.use(optionalAuth);
const assignDefaultUser = (req, res, next) => {
    if (!req.user) {
        req.user = {
            id: DEFAULT_USER_ID,
            name: 'Sistema',
            email: 'sistema@taskmanager.com',
        };
    }
    next();
};
app.use(assignDefaultUser);

// ---------------- Rutas informativas ----------------
app.get('/', (req, res) => {
    res.json({
        name: 'Task Manager API',
        base: '/api/v1',
        health: '/api/health',
    });
});

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ status: 'error', db: 'down', message: e.message });
    }
});

// --------------- Estáticos /uploads -----------------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// --------------- Subida de imagen (PNG <= 2MB) ---------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `item_${Date.now()}${ext}`);
    },
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png') return cb(null, true);
    cb(new Error('Solo se aceptan imágenes PNG.'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

app.post('/api/upload/image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url });
});

// ---------------- Routers v1 (Products) ----------------
const productsRouter = require('./routes/products.routes');
app.use('/api/v1/products', productsRouter);

// ======================================================
// ================ RUTAS DE TASKS ======================
// ======================================================

// Obtener todas las tareas (excluye archivadas por defecto)
app.get('/api/tasks', async (req, res) => {
    try {
        const { includeArchived } = req.query;

        let whereClause = '';
        if (!includeArchived || includeArchived === 'false') {
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

// Tareas archivadas
app.get('/api/tasks/archived', async (req, res) => {
    try {
        const { year, month } = req.query;

        let whereClause = `WHERE t.status = 'entregado' 
                      AND t.delivered_date IS NOT NULL 
                      AND t.delivered_date <= (CURRENT_TIMESTAMP - INTERVAL '2 days')`;

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

// Stats de archivados
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

// Tarea por ID (con abonos)
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const taskResult = await pool.query(`
      SELECT *,
        CASE 
          WHEN status = 'entregado' AND delivered_date IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - delivered_date))/86400
          ELSE NULL
        END as days_since_delivery
      FROM tasks 
      WHERE id = $1
    `, [id]);

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        const paymentsResult = await pool.query(
            'SELECT * FROM payments WHERE task_id = $1 ORDER BY payment_date DESC',
            [id]
        );

        const task = taskResult.rows[0];
        task.payments = paymentsResult.rows;
        task.total_advance_payment = paymentsResult.rows.reduce(
            (sum, p) => sum + parseFloat(p.amount), 0
        );

        res.json(task);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tarea' });
    }
});

// Crear tarea
// POST /api/tasks - Crear nueva tarea
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, client_name, price, status, description, due_date, initial_payment } = req.body;

        const result = await pool.query(
            `INSERT INTO tasks (title, client_name, price, status, description, due_date) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [title, client_name, price || 0, status, description, due_date]
        );

        const taskId = result.rows[0].id;

        // Si hay abono inicial
        if (initial_payment && initial_payment.amount > 0) {
            await pool.query(
                `INSERT INTO payments (task_id, amount, payment_date, notes) 
                 VALUES ($1, $2, $3, $4)`,
                [taskId, initial_payment.amount, initial_payment.payment_date, initial_payment.notes]
            );
        }

        const taskWithPayments = await pool.query(`
            SELECT 
                t.*,
                COALESCE(SUM(p.amount), 0) as total_advance_payment,
                COUNT(p.id) as payment_count
            FROM tasks t
            LEFT JOIN payments p ON t.id = p.task_id
            WHERE t.id = $1
            GROUP BY t.id
        `, [taskId]);

        res.json(taskWithPayments.rows[0]);
    } catch (error) {
        console.error('❌ Error creating task:', error);
        res.status(500).json({ error: error.message });
    }
});
// Actualizar tarea
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, client_name, price, status, description, due_date } = req.body;

        const previousResult = await pool.query('SELECT status FROM tasks WHERE id = $1', [id]);
        const previousStatus = previousResult.rows[0]?.status;

        let deliveredDate = null;
        if (status === 'entregado' && previousStatus !== 'entregado') {
            deliveredDate = new Date();
        }

        let updateQuery = `
      UPDATE tasks 
      SET title=$1, client_name=$2, price=$3, status=$4, description=$5, due_date=$6
    `;
        const params = [title, client_name, price, status, description, due_date];

        if (deliveredDate) {
            updateQuery += ', delivered_date=$7';
            params.push(deliveredDate);
        } else if (status !== 'entregado') {
            updateQuery += ', delivered_date=NULL';
        }

        updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);

        const result = await pool.query(updateQuery, params);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
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
        const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
        res.json({ message: 'Tarea eliminada exitosamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar tarea' });
    }
});

// Cambiar estado solamente
app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const previousResult = await pool.query('SELECT status FROM tasks WHERE id = $1', [id]);
        const previousStatus = previousResult.rows[0]?.status;

        let query = 'UPDATE tasks SET status=$1';
        const params = [status];

        if (status === 'entregado' && previousStatus !== 'entregado') {
            query += ', delivered_date = CURRENT_TIMESTAMP';
        } else if (status !== 'entregado' && previousStatus === 'entregado') {
            query += ', delivered_date = NULL';
        }

        query += ' WHERE id = $2 RETURNING *';
        params.push(id);

        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// Restaurar tarea (desde entregado a otro estado)
app.patch('/api/tasks/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        const { newStatus } = req.body;

        const validStatuses = ['cotizacion', 'en_proceso', 'terminado'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ error: 'Estado inválido para restauración' });
        }

        const result = await pool.query(
            'UPDATE tasks SET status=$1, delivered_date=NULL WHERE id=$2 RETURNING *',
            [newStatus, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al restaurar tarea' });
    }
});

// --------- Rutas de pagos ---------
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

// POST /api/tasks/:id/payments - Agregar abono
app.post('/api/tasks/:id/payments', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_date, notes } = req.body;

        await pool.query(
            `INSERT INTO payments (task_id, amount, payment_date, notes) 
             VALUES ($1, $2, $3, $4)`,
            [id, amount, payment_date, notes]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error adding payment:', error);
        res.status(500).json({ error: error.message });
    }
});
app.put('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_date, notes } = req.body;

        const result = await pool.query(
            `UPDATE payments 
       SET amount=$1, payment_date=$2, notes=$3
       WHERE id=$4
       RETURNING *`,
            [amount, payment_date, notes, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Abono no encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar abono' });
    }
});

app.delete('/api/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM payments WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Abono no encontrado' });

        res.json({ message: 'Abono eliminado exitosamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar abono' });
    }
});

// ======================================================
// =========== RENTALS LEGACY DESHABILITADO ============
// ======================================================
// ❌ Quita el require y el use del router legacy si aún los tenías
// const rentalRoutes = require('./routes/rentalRoutes');
// app.use('/api', rentalRoutes);

// Bloqueo explícito de endpoints legacy
app.all(
    [
        '/api/rentals',
        '/api/rentals/*',
        '/api/rental-items',
        '/api/rental-items/*',
        '/api/rental-payments',
        '/api/rental-payments/*',
    ],
    (req, res) => {
        res.status(410).json({ error: 'El módulo de alquileres fue retirado.' });
    }
);

// ---------------- 404 y errores (AL FINAL) ----------------
app.use('/api', quotesRouter);
app.use(notFound);
app.use(errorHandler);

// ---------------- Listen ----------------
app.listen(PORT, HOST, () => {
    console.log('\n🚀 ========================================');
    console.log('✅ SERVIDOR BACKEND INICIADO');
    console.log('========================================');
    console.log(`📍 Local:      http://localhost:${PORT}`);
    console.log(`🌐 Red Local:  http://${LOCAL_IP}:${PORT}`);
    console.log(`📊 Base Datos: PostgreSQL puerto ${process.env.DB_PORT || 5433}`);
    console.log(`🌐 Backend escuchando en http://0.0.0.0:${PORT}`);
    console.log('========================================\n');
});
