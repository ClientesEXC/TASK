// =====================================================
// ARCHIVO: backend/routes/rentalRoutes.js
// Sistema de alquileres con múltiples items y usuarios
// =====================================================

const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // Asegúrate de tener configurado el pool

// =====================================================
// MIDDLEWARE DE AUTENTICACIÓN (Simplificado)
// =====================================================
const authenticateUser = (req, res, next) => {
    // Por ahora, usar un usuario por defecto
    // En producción, implementar JWT o sesiones
    req.user = { id: 1, role: 'admin' };
    next();
};

// =====================================================
// RUTAS DE ARTÍCULOS (RENTAL ITEMS)
// =====================================================

// GET - Obtener todos los artículos con disponibilidad
router.get('/rental-items/enhanced', async (req, res) => {
    try {
        const query = `
            SELECT 
                ri.*,
                COALESCE(ri.quantity_available, 0) as quantity_available,
                CASE 
                    WHEN ri.quantity_available > 0 THEN 'disponible'
                    WHEN ri.quantity_available = 0 THEN 'agotado'
                    ELSE ri.status
                END as availability_status
            FROM rental_items ri
            ORDER BY ri.name
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({
            error: 'Error al obtener artículos',
            details: error.message
        });
    }
});

// POST - Crear nuevo artículo
router.post('/rental-items', authenticateUser, async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            name, description, category,
            daily_rate, weekly_rate, monthly_rate,
            quantity_total, image_url
        } = req.body;

        // Validación
        if (!name || !category || !quantity_total) {
            return res.status(400).json({
                error: 'Nombre, categoría y cantidad son requeridos'
            });
        }

        const query = `
            INSERT INTO rental_items (
                name, description, category,
                daily_rate, weekly_rate, monthly_rate,
                quantity_total, quantity_available, 
                status, image_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'disponible', $8)
            RETURNING *
        `;

        const values = [
            name, description || '', category,
            daily_rate || 0, weekly_rate || 0, monthly_rate || 0,
            quantity_total, image_url || null
        ];

        const result = await client.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Artículo creado exitosamente',
            item: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({
            error: 'Error al crear artículo',
            details: error.message
        });
    } finally {
        client.release();
    }
});

// =====================================================
// RUTAS DE ALQUILERES (RENTAL ORDERS)
// =====================================================

// GET - Obtener todos los alquileres con detalles
router.get('/rentals/enhanced', async (req, res) => {
    try {
        const query = `
            SELECT 
                ro.*,
                v.items_list,
                v.total_items,
                v.total_quantity,
                v.total_paid,
                v.balance_due,
                v.created_by,
                v.days_overdue,
                CASE 
                    WHEN v.days_overdue > 0 THEN true 
                    ELSE false 
                END as is_overdue
            FROM rental_orders ro
            LEFT JOIN v_rental_orders_complete v ON v.id = ro.id
            ORDER BY ro.created_at DESC
        `;

        const result = await pool.query(query);

        // Si la vista no existe, usar query alternativo
        if (result.rows.length === 0 || result.rows[0].items_list === undefined) {
            const altQuery = `
                SELECT 
                    r.*,
                    ri.name as item_name,
                    COALESCE(
                        (SELECT SUM(amount) FROM rental_payments WHERE rental_id = r.id),
                        0
                    ) as total_paid
                FROM rentals r
                LEFT JOIN rental_items ri ON ri.id = r.item_id
                ORDER BY r.created_at DESC
            `;
            const altResult = await pool.query(altQuery);
            return res.json(altResult.rows);
        }

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching rentals:', error);

        // Fallback para tabla antigua
        try {
            const fallbackQuery = `
                SELECT 
                    r.*,
                    ri.name as item_name,
                    ri.image_url as item_image
                FROM rentals r
                LEFT JOIN rental_items ri ON ri.id = r.item_id
                ORDER BY r.created_at DESC
            `;
            const fallbackResult = await pool.query(fallbackQuery);
            res.json(fallbackResult.rows);
        } catch (fallbackError) {
            res.status(500).json({
                error: 'Error al obtener alquileres',
                details: error.message
            });
        }
    }
});

// POST - Crear nuevo alquiler con múltiples items
router.post('/rentals/enhanced', authenticateUser, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            customer_name, customer_id_number, customer_phone,
            customer_email, customer_address,
            rental_start, rental_end,
            deposit, has_collateral, collateral_description,
            notes, items
        } = req.body;

        // Validación básica
        if (!customer_name || !customer_id_number || !customer_phone) {
            throw new Error('Datos del cliente incompletos');
        }

        if (!rental_start || !rental_end) {
            throw new Error('Fechas de alquiler requeridas');
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('Debe incluir al menos un artículo');
        }

        // Calcular total del alquiler
        let totalAmount = 0;
        const itemsWithPrices = [];

        for (const item of items) {
            if (!item.item_id || !item.quantity_rented) {
                throw new Error('Información de artículo incompleta');
            }

            // Obtener información y precio del artículo
            const itemQuery = `
                SELECT 
                    id, name, daily_rate, weekly_rate, monthly_rate,
                    quantity_available
                FROM rental_items 
                WHERE id = $1
            `;

            const itemResult = await client.query(itemQuery, [item.item_id]);

            if (itemResult.rows.length === 0) {
                throw new Error(`Artículo con ID ${item.item_id} no encontrado`);
            }

            const itemData = itemResult.rows[0];

            // Verificar disponibilidad
            if (itemData.quantity_available < item.quantity_rented) {
                throw new Error(
                    `${itemData.name}: Solo hay ${itemData.quantity_available} disponibles`
                );
            }

            // Calcular precio (días entre fechas)
            const start = new Date(rental_start);
            const end = new Date(rental_end);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            let unitPrice = itemData.daily_rate || 0;
            if (days >= 30) {
                unitPrice = (itemData.monthly_rate || 0) / 30;
            } else if (days >= 7) {
                unitPrice = (itemData.weekly_rate || 0) / 7;
            }

            const subtotal = unitPrice * days * item.quantity_rented;
            totalAmount += subtotal;

            itemsWithPrices.push({
                ...item,
                itemData,
                unitPrice: unitPrice * days,
                subtotal
            });
        }

        // Verificar si existe la tabla nueva o usar la antigua
        const tableExistsQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'rental_orders'
            )
        `;

        const tableExists = await client.query(tableExistsQuery);
        const useNewTable = tableExists.rows[0].exists;

        let rentalId;

        if (useNewTable) {
            // USAR NUEVA ESTRUCTURA
            const insertRentalQuery = `
                INSERT INTO rental_orders (
                    customer_name, customer_id_number, customer_phone,
                    customer_email, customer_address,
                    rental_start, rental_end,
                    total_amount, deposit,
                    has_collateral, collateral_description,
                    notes, status, payment_status,
                    created_by_user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'activo', 'pendiente', $13)
                RETURNING *
            `;

            const rentalValues = [
                customer_name, customer_id_number, customer_phone,
                customer_email || null, customer_address || null,
                rental_start, rental_end,
                totalAmount, deposit || 0,
                has_collateral || false, collateral_description || null,
                notes || null,
                req.user.id
            ];

            const rentalResult = await client.query(insertRentalQuery, rentalValues);
            rentalId = rentalResult.rows[0].id;

            // Insertar items del alquiler
            for (const item of itemsWithPrices) {
                const insertItemQuery = `
                    INSERT INTO rental_order_items (
                        rental_order_id, item_id, quantity_rented,
                        unit_price, subtotal
                    ) VALUES ($1, $2, $3, $4, $5)
                `;

                await client.query(insertItemQuery, [
                    rentalId,
                    item.item_id,
                    item.quantity_rented,
                    item.unitPrice,
                    item.subtotal
                ]);
            }

        } else {
            // USAR ESTRUCTURA ANTIGUA (compatibilidad)
            // Si hay múltiples items, crear múltiples registros
            for (const item of itemsWithPrices) {
                const insertQuery = `
                    INSERT INTO rentals (
                        item_id, customer_name, customer_id_number,
                        customer_phone, customer_email, customer_address,
                        rental_start, rental_end, 
                        total_amount, deposit,
                        status, notes,
                        has_collateral, collateral_description,
                        quantity_rented
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'activo', $11, $12, $13, $14)
                    RETURNING id
                `;

                const values = [
                    item.item_id,
                    customer_name, customer_id_number, customer_phone,
                    customer_email || null, customer_address || null,
                    rental_start, rental_end,
                    item.subtotal,
                    (deposit || 0) / items.length, // Dividir depósito entre items
                    notes || null,
                    has_collateral || false,
                    collateral_description || null,
                    item.quantity_rented
                ];

                const result = await client.query(insertQuery, values);
                if (!rentalId) rentalId = result.rows[0].id;

                // Actualizar inventario manualmente
                await client.query(
                    `UPDATE rental_items 
                     SET quantity_available = quantity_available - $1 
                     WHERE id = $2`,
                    [item.quantity_rented, item.item_id]
                );
            }
        }

        // Registrar depósito inicial si existe
        if (deposit && deposit > 0) {
            const paymentQuery = useNewTable
                ? `INSERT INTO rental_payments (rental_order_id, amount, payment_method, notes, payment_date)
                   VALUES ($1, $2, 'efectivo', 'Depósito inicial', CURRENT_DATE)`
                : `INSERT INTO rental_payments (rental_id, amount, payment_method, notes, payment_date)
                   VALUES ($1, $2, 'efectivo', 'Depósito inicial', CURRENT_DATE)`;

            await client.query(paymentQuery, [rentalId, deposit]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Alquiler creado exitosamente',
            rentalId: rentalId,
            totalAmount: totalAmount,
            itemsCount: items.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating rental:', error);
        res.status(400).json({
            error: error.message || 'Error al crear alquiler',
            details: error.detail
        });
    } finally {
        client.release();
    }
});

// PATCH - Procesar devolución de artículos
router.patch('/rentals/:id/return', authenticateUser, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const rentalId = req.params.id;
        const { items_returned, condition_notes, return_condition } = req.body;

        // Verificar si usar nueva o antigua estructura
        const tableExistsQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'rental_orders'
            )
        `;

        const tableExists = await client.query(tableExistsQuery);
        const useNewTable = tableExists.rows[0].exists;

        if (useNewTable && items_returned) {
            // Procesar cada item devuelto
            for (const item of items_returned) {
                await client.query(
                    `SELECT process_return($1, $2, $3, $4, $5)`,
                    [
                        rentalId,
                        item.item_id,
                        item.quantity_returned,
                        return_condition || 'bueno',
                        condition_notes || ''
                    ]
                );
            }
        } else {
            // Estructura antigua
            const rental = await client.query(
                'SELECT * FROM rentals WHERE id = $1',
                [rentalId]
            );

            if (rental.rows.length === 0) {
                throw new Error('Alquiler no encontrado');
            }

            const rentalData = rental.rows[0];

            // Actualizar estado del alquiler
            await client.query(
                `UPDATE rentals 
                 SET status = 'finalizado', 
                     return_date = CURRENT_DATE,
                     condition_notes = $1
                 WHERE id = $2`,
                [condition_notes || '', rentalId]
            );

            // Devolver al inventario
            await client.query(
                `UPDATE rental_items 
                 SET quantity_available = quantity_available + $1
                 WHERE id = $2`,
                [rentalData.quantity_rented || 1, rentalData.item_id]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Devolución procesada exitosamente'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing return:', error);
        res.status(500).json({
            error: 'Error al procesar devolución',
            details: error.message
        });
    } finally {
        client.release();
    }
});

// POST - Registrar pago/abono
router.post('/rentals/:id/payments', authenticateUser, async (req, res) => {
    const client = await pool.connect();

    try {
        const rentalId = req.params.id;
        const { amount, payment_method, notes } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'El monto debe ser mayor a 0'
            });
        }

        // Verificar estructura
        const tableExists = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'rental_orders'
            )`
        );

        const useNewTable = tableExists.rows[0].exists;

        const insertQuery = useNewTable
            ? `INSERT INTO rental_payments 
               (rental_order_id, amount, payment_method, notes, payment_date, processed_by_user_id)
               VALUES ($1, $2, $3, $4, CURRENT_DATE, $5) RETURNING *`
            : `INSERT INTO rental_payments 
               (rental_id, amount, payment_method, notes, payment_date)
               VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING *`;

        const values = useNewTable
            ? [rentalId, amount, payment_method || 'efectivo', notes || '', req.user.id]
            : [rentalId, amount, payment_method || 'efectivo', notes || ''];

        const result = await client.query(insertQuery, values);

        // Actualizar estado de pago si es nueva estructura
        if (useNewTable) {
            const checkPaymentStatus = `
                SELECT 
                    ro.total_amount,
                    COALESCE(SUM(rp.amount), 0) as total_paid
                FROM rental_orders ro
                LEFT JOIN rental_payments rp ON rp.rental_order_id = ro.id
                WHERE ro.id = $1
                GROUP BY ro.id, ro.total_amount
            `;

            const paymentStatus = await client.query(checkPaymentStatus, [rentalId]);

            if (paymentStatus.rows.length > 0) {
                const { total_amount, total_paid } = paymentStatus.rows[0];
                const newStatus = total_paid >= total_amount ? 'completo' : 'parcial';

                await client.query(
                    `UPDATE rental_orders SET payment_status = $1 WHERE id = $2`,
                    [newStatus, rentalId]
                );
            }
        }

        res.status(201).json({
            success: true,
            message: 'Pago registrado exitosamente',
            payment: result.rows[0]
        });

    } catch (error) {
        console.error('Error registering payment:', error);
        res.status(500).json({
            error: 'Error al registrar pago',
            details: error.message
        });
    } finally {
        client.release();
    }
});

// GET - Obtener pagos de un alquiler
router.get('/rentals/:id/payments', async (req, res) => {
    try {
        const rentalId = req.params.id;

        // Intentar con nueva estructura primero
        let query = `
            SELECT * FROM rental_payments 
            WHERE rental_order_id = $1 
            ORDER BY payment_date DESC, created_at DESC
        `;

        let result = await pool.query(query, [rentalId]);

        // Si no hay resultados, intentar con estructura antigua
        if (result.rows.length === 0) {
            query = `
                SELECT * FROM rental_payments 
                WHERE rental_id = $1 
                ORDER BY payment_date DESC, created_at DESC
            `;
            result = await pool.query(query, [rentalId]);
        }

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            error: 'Error al obtener pagos',
            details: error.message
        });
    }
});

// GET - Estadísticas del sistema
router.get('/rentals/stats', async (req, res) => {
    try {
        // Intentar con nueva estructura
        let statsQuery = `
            SELECT 
                COUNT(DISTINCT CASE WHEN status = 'activo' THEN id END) as active,
                COUNT(DISTINCT id) as total,
                COUNT(DISTINCT CASE 
                    WHEN status = 'activo' AND rental_end < CURRENT_DATE 
                    THEN id 
                END) as overdue
            FROM rental_orders
        `;

        let result = await pool.query(statsQuery);

        // Si la tabla no existe, usar estructura antigua
        if (!result || result.rows[0].total === null) {
            statsQuery = `
                SELECT 
                    COUNT(DISTINCT CASE WHEN status = 'activo' THEN id END) as active,
                    COUNT(DISTINCT id) as total,
                    COUNT(DISTINCT CASE 
                        WHEN status = 'activo' AND rental_end < CURRENT_DATE 
                        THEN id 
                    END) as overdue
                FROM rentals
            `;
            result = await pool.query(statsQuery);
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.json({ active: 0, total: 0, overdue: 0 });
    }
});

module.exports = router;