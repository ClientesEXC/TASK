require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

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


// ============================================
// SISTEMA DE ALQUILERES MEJORADO - PRODUCCIÓN
// ============================================

// Obtener items con información completa
app.get('/api/rental-items/enhanced', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ri.*,
                COALESCE(ri.quantity_total, ri.quantity, 0) as quantity_total,
                COALESCE(ri.quantity_available, ri.quantity, 0) as quantity_available,
                CASE 
                    WHEN COALESCE(ri.quantity_available, ri.quantity, 0) > 0 THEN 'disponible'
                    ELSE 'agotado'
                END as status
            FROM rental_items ri
            ORDER BY ri.name ASC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching enhanced items:', error);
        res.status(500).json({ error: 'Error al obtener artículos' });
    }
});

// Obtener alquileres con información completa
app.get('/api/rentals/enhanced', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                ri.name as item_name,
                ri.category as item_category,
                ri.image_url as item_image,
                COALESCE(
                    (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
                    0
                ) as total_paid,
                r.total_amount - COALESCE(
                    (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
                    0
                ) as balance_due
            FROM rentals r
            JOIN rental_items ri ON r.item_id = ri.id
            ORDER BY r.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching enhanced rentals:', error);
        res.status(500).json({ error: 'Error al obtener alquileres' });
    }
});

// Crear alquiler completo con validaciones
app.post('/api/rentals/complete', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            item_id,
            customer_name,
            customer_id_number,
            customer_address,
            customer_phone,
            customer_email,
            rental_start,
            rental_end,
            quantity_rented = 1,
            has_collateral = false,
            collateral_description,
            total_amount,
            initial_deposit = 0,
            notes
        } = req.body;

        // Validar disponibilidad
        const itemCheck = await client.query(
            'SELECT quantity_available FROM rental_items WHERE id = $1',
            [item_id]
        );

        if (itemCheck.rows.length === 0) {
            throw new Error('Artículo no encontrado');
        }

        if (itemCheck.rows[0].quantity_available < quantity_rented) {
            throw new Error('Cantidad no disponible');
        }

        // Crear alquiler
        const rentalResult = await client.query(
            `INSERT INTO rentals 
            (item_id, customer_name, customer_id_number, customer_address,
             customer_phone, customer_email, rental_start, rental_end,
             quantity_rented, has_collateral, collateral_description,
             total_amount, deposit, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'activo')
            RETURNING *`,
            [
                item_id, customer_name, customer_id_number, customer_address,
                customer_phone, customer_email, rental_start, rental_end,
                quantity_rented, has_collateral, collateral_description,
                total_amount, initial_deposit, notes
            ]
        );

        const rental = rentalResult.rows[0];

        // Actualizar disponibilidad del artículo
        await client.query(
            `UPDATE rental_items 
            SET quantity_available = quantity_available - $1
            WHERE id = $2`,
            [quantity_rented, item_id]
        );

        // Si hay depósito inicial, registrarlo como pago
        if (initial_deposit > 0) {
            await client.query(
                `INSERT INTO rental_payments 
                (rental_id, amount, payment_method, notes, payment_date)
                VALUES ($1, $2, 'efectivo', 'Depósito inicial', CURRENT_DATE)`,
                [rental.id, initial_deposit]
            );
        }

        await client.query('COMMIT');

        // Obtener el alquiler completo con información adicional
        const completeRental = await pool.query(
            `SELECT 
                r.*,
                ri.name as item_name,
                ri.category as item_category
            FROM rentals r
            JOIN rental_items ri ON r.item_id = ri.id
            WHERE r.id = $1`,
            [rental.id]
        );

        res.status(201).json(completeRental.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating rental:', error);
        res.status(400).json({ error: error.message || 'Error al crear alquiler' });
    } finally {
        client.release();
    }
});

// Registrar devolución con actualización de disponibilidad
app.patch('/api/rentals/:id/return', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { condition_notes, return_condition = 'bueno' } = req.body;

        // Obtener información del alquiler
        const rentalInfo = await client.query(
            `SELECT r.*, ri.name as item_name
            FROM rentals r
            JOIN rental_items ri ON r.item_id = ri.id
            WHERE r.id = $1`,
            [id]
        );

        if (rentalInfo.rows.length === 0) {
            throw new Error('Alquiler no encontrado');
        }

        const rental = rentalInfo.rows[0];

        if (rental.status !== 'activo') {
            throw new Error('Este alquiler ya fue finalizado');
        }

        // Actualizar alquiler
        const result = await client.query(
            `UPDATE rentals 
            SET status = 'finalizado', 
                return_date = CURRENT_DATE,
                condition_notes = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *`,
            [condition_notes, id]
        );

        // Devolver unidades al inventario
        await client.query(
            `UPDATE rental_items 
            SET quantity_available = quantity_available + $1
            WHERE id = $2`,
            [rental.quantity_rented || 1, rental.item_id]
        );

        // Registrar en historial de devoluciones si la tabla existe
        await client.query(
            `INSERT INTO rental_returns 
            (rental_id, return_date, quantity_returned, condition_status, return_notes)
            VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4)
            ON CONFLICT DO NOTHING`,
            [id, rental.quantity_rented || 1, return_condition, condition_notes]
        ).catch(() => {}); // Ignorar si la tabla no existe

        await client.query('COMMIT');

        res.json({
            ...result.rows[0],
            item_name: rental.item_name
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing return:', error);
        res.status(400).json({ error: error.message || 'Error al procesar devolución' });
    } finally {
        client.release();
    }
});

// Crear nuevo artículo de alquiler
app.post('/api/rental-items', async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            daily_rate,
            weekly_rate,
            monthly_rate,
            quantity_total,
            quantity_available,
            status = 'disponible',
            image_url
        } = req.body;

        // Si no se especifica quantity_available, usar quantity_total
        const available = quantity_available !== undefined ? quantity_available : quantity_total;

        const result = await pool.query(
            `INSERT INTO rental_items 
            (name, description, category, daily_rate, weekly_rate, monthly_rate, 
             quantity_total, quantity_available, status, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [name, description, category, daily_rate, weekly_rate, monthly_rate,
                quantity_total, available, status, image_url]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating rental item:', error);
        res.status(500).json({ error: 'Error al crear artículo' });
    }
});

// Obtener pagos de un alquiler
app.get('/api/rentals/:id/payments', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM rental_payments 
            WHERE rental_id = $1 
            ORDER BY payment_date DESC`,
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Error al obtener pagos' });
    }
});

// Registrar nuevo pago/abono
app.post('/api/rentals/:id/payments', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { amount, payment_method = 'efectivo', notes = '' } = req.body;

        // Validar que el alquiler existe
        const rentalCheck = await client.query(
            'SELECT total_amount FROM rentals WHERE id = $1',
            [id]
        );

        if (rentalCheck.rows.length === 0) {
            throw new Error('Alquiler no encontrado');
        }

        // Obtener total ya pagado
        const paidCheck = await client.query(
            'SELECT COALESCE(SUM(amount), 0) as total_paid FROM rental_payments WHERE rental_id = $1',
            [id]
        );

        const totalPaid = parseFloat(paidCheck.rows[0].total_paid);
        const totalAmount = parseFloat(rentalCheck.rows[0].total_amount);
        const remaining = totalAmount - totalPaid;

        if (amount > remaining) {
            throw new Error(`El monto excede el saldo pendiente de $${remaining.toFixed(2)}`);
        }

        // Registrar pago
        const result = await client.query(
            `INSERT INTO rental_payments 
            (rental_id, amount, payment_method, notes, payment_date)
            VALUES ($1, $2, $3, $4, CURRENT_DATE)
            RETURNING *`,
            [id, amount, payment_method, notes]
        );

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating payment:', error);
        res.status(400).json({ error: error.message || 'Error al registrar pago' });
    } finally {
        client.release();
    }
});

// REEMPLAZAR la ruta DELETE en server.js con esta versión corregida:

// Eliminar artículo con validación mejorada
app.delete('/api/rental-items/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { id } = req.params;

        // 1. Verificar si el artículo existe
        const itemCheck = await client.query(
            'SELECT * FROM rental_items WHERE id = $1',
            [id]
        );

        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }

        // 2. Verificar si hay alquileres ACTIVOS
        const activeRentals = await client.query(
            `SELECT COUNT(*) as count 
             FROM rentals 
             WHERE item_id = $1 
             AND status = 'activo'`,
            [id]
        );

        if (parseInt(activeRentals.rows[0].count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'No se puede eliminar: El artículo tiene alquileres activos'
            });
        }

        // 3. Desvincular alquileres históricos (mantener para registro)
        await client.query(
            `UPDATE rentals 
             SET item_id = NULL 
             WHERE item_id = $1 
             AND status != 'activo'`,
            [id]
        );

        // 4. Eliminar el artículo
        const result = await client.query(
            'DELETE FROM rental_items WHERE id = $1 RETURNING *',
            [id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Artículo eliminado exitosamente',
            deleted: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar artículo:', error);

        // Manejo específico de errores de PostgreSQL
        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({
                error: 'No se puede eliminar: El artículo está relacionado con otros registros'
            });
        }

        res.status(500).json({
            error: 'Error al eliminar el artículo',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        client.release();
    }
});


// Eliminar pago
app.delete('/api/rental-payments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM rental_payments WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        res.json({ message: 'Pago eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({ error: 'Error al eliminar pago' });
    }
});

// Estadísticas del dashboard
app.get('/api/rentals/statistics', async (req, res) => {
    try {
        const result = await pool.query(`
            WITH rental_stats AS (
                SELECT
                    COUNT(DISTINCT CASE WHEN status = 'activo' THEN id END) as active_rentals,
                    COUNT(DISTINCT CASE 
                        WHEN status = 'activo' AND rental_end < CURRENT_DATE 
                        THEN id 
                    END) as overdue_rentals
                FROM rentals
            ),
            item_stats AS (
                SELECT
                    COUNT(DISTINCT id) as total_items,
                    COALESCE(SUM(quantity_total), 0) as total_units,
                    COALESCE(SUM(quantity_available), 0) as available_units
                FROM rental_items
            )
            SELECT
                i.total_items,
                i.total_units,
                i.available_units,
                -- FIX: Calcular correctamente las unidades alquiladas
                (i.total_units - i.available_units) as rented_units,
                COALESCE(r.active_rentals, 0) as active_rentals,
                COALESCE(r.overdue_rentals, 0) as overdue_rentals
            FROM item_stats i
            CROSS JOIN rental_stats r
        `);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});
// Reporte de alquileres vencidos
app.get('/api/rentals/overdue', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                ri.name as item_name,
                ri.image_url as item_image,
                CURRENT_DATE - r.rental_end as days_overdue,
                COALESCE(
                    (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
                    0
                ) as total_paid,
                r.total_amount - COALESCE(
                    (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
                    0
                ) as balance_due
            FROM rentals r
            JOIN rental_items ri ON r.item_id = ri.id
            WHERE r.status = 'activo' 
            AND r.rental_end < CURRENT_DATE
            ORDER BY r.rental_end ASC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching overdue rentals:', error);
        res.status(500).json({ error: 'Error al obtener vencidos' });
    }
});

// Validar disponibilidad antes de alquilar
app.post('/api/rentals/check-availability', async (req, res) => {
    try {
        const { item_id, quantity = 1, start_date, end_date } = req.body;

        const result = await pool.query(
            `SELECT 
                ri.quantity_available,
                ri.name,
                CASE 
                    WHEN ri.quantity_available >= $2 THEN true 
                    ELSE false 
                END as is_available
            FROM rental_items ri
            WHERE ri.id = $1`,
            [item_id, quantity]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ error: 'Error al verificar disponibilidad' });
    }
});

app.get('/api/rentals/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(DISTINCT CASE WHEN status = 'activo' THEN id END) as active,
                COUNT(DISTINCT id) as total,
                COUNT(DISTINCT CASE 
                    WHEN status = 'activo' AND rental_end < CURRENT_DATE 
                    THEN id 
                END) as overdue
            FROM rentals
        `);

        res.json(result.rows[0] || { active: 0, total: 0, overdue: 0 });
    } catch (error) {
        console.error('Error fetching rental stats:', error);
        res.status(500).json({
            active: 0,
            total: 0,
            overdue: 0
        });
    }
});


// Agregar esta ruta en server.js para poder sincronizar manualmente:

app.post('/api/rental-items/sync-quantities', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Corregir valores negativos
        await client.query(`
            UPDATE rental_items 
            SET 
                quantity_total = GREATEST(COALESCE(quantity_total, 1), 1),
                quantity_available = GREATEST(COALESCE(quantity_available, 0), 0)
            WHERE quantity_total < 1 OR quantity_available < 0
        `);

        // 2. Sincronizar con alquileres activos
        await client.query(`
            WITH rental_counts AS (
                SELECT 
                    item_id,
                    COALESCE(SUM(COALESCE(quantity_rented, 1)), 0) as total_rented
                FROM rentals
                WHERE status = 'activo'
                GROUP BY item_id
            )
            UPDATE rental_items ri
            SET quantity_available = GREATEST(
                ri.quantity_total - COALESCE(rc.total_rented, 0),
                0
            )
            FROM rental_counts rc
            WHERE ri.id = rc.item_id
        `);

        // 3. Para items sin alquileres activos, restaurar disponibilidad total
        await client.query(`
            UPDATE rental_items
            SET quantity_available = quantity_total
            WHERE id NOT IN (
                SELECT DISTINCT item_id 
                FROM rentals 
                WHERE status = 'activo' 
                AND item_id IS NOT NULL
            )
        `);

        await client.query('COMMIT');

        // Obtener estadísticas actualizadas
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_items,
                SUM(quantity_total) as total_units,
                SUM(quantity_available) as available_units,
                SUM(quantity_total - quantity_available) as rented_units
            FROM rental_items
        `);

        res.json({
            success: true,
            message: 'Cantidades sincronizadas correctamente',
            stats: stats.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error syncing quantities:', error);
        res.status(500).json({ error: 'Error al sincronizar cantidades' });
    } finally {
        client.release();
    }
});



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