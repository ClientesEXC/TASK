// backend/repos/products.repo.js
const db = require('../db');

/**
 * Whitelist de columnas permitidas para ORDER BY
 */
const SORTABLE_COLUMNS = new Set([
    'created_at',
    'updated_at',
    'name',
    'price',
    'stock_total',
    'stock_available',
    'is_active',
    'id',
]);

/**
 * Normaliza y valida sort/dir para ORDER BY seguro
 */
function normalizeSort(sort = 'created_at', dir = 'desc') {
    const col = String(sort).toLowerCase();
    const safeCol = SORTABLE_COLUMNS.has(col) ? col : 'created_at';

    const d = String(dir).toLowerCase();
    const safeDir = d === 'asc' ? 'asc' : 'desc';

    return { safeCol, safeDir };
}

/**
 * Lista de productos con filtros, paginación y conteo total
 */
async function list({
                        q,
                        is_active,
                        min_stock,
                        include_deleted,
                        sort,
                        dir,
                        offset,
                        limit,
                    }) {
    const where = [];
    const params = [];

    // Búsqueda por texto
    if (q) {
        params.push(`%${q}%`);
        where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }

    // Filtro activo/inactivo (acepta boolean o string "true"/"false")
    if (is_active !== undefined) {
        const activeBool = typeof is_active === 'string'
            ? is_active === 'true'
            : Boolean(is_active);
        params.push(activeBool);
        where.push(`p.is_active = $${params.length}`);
    }

    // Stock mínimo (acepta string o número)
    if (min_stock !== undefined && min_stock !== null && min_stock !== '') {
        const min = Number(min_stock);
        params.push(Number.isFinite(min) ? min : 0);
        where.push(`p.stock_available >= $${params.length}`);
    }

    // Excluir borrados lógicamente por defecto
    if (!include_deleted) {
        where.push(`p.deleted_at IS NULL`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Conteo total
    const countSql = `SELECT COUNT(*)::int AS total FROM products p ${whereSql}`;
    const { rows: countRows } = await db.query(countSql, params);
    const total = countRows[0]?.total || 0;

    // Orden seguro + paginación
    const { safeCol, safeDir } = normalizeSort(sort, dir);
    const safeOffset = Number(offset) >= 0 ? Number(offset) : 0;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 12;

    const dataSql = `
    SELECT p.*
    FROM products p
    ${whereSql}
    ORDER BY ${safeCol} ${safeDir}
    OFFSET $${params.length + 1}
    LIMIT $${params.length + 2}
  `;
    const { rows } = await db.query(dataSql, [...params, safeOffset, safeLimit]);

    return { rows, total };
}

/**
 * Obtiene producto por id (opcionalmente incluye borrados)
 */
async function getById(id, { includeDeleted = false } = {}) {
    const sql = `
    SELECT p.*
    FROM products p
    WHERE p.id = $1 ${includeDeleted ? '' : 'AND p.deleted_at IS NULL'}
    LIMIT 1
  `;
    const { rows } = await db.query(sql, [id]);
    return rows[0] || null;
}

/**
 * Crea un producto (stock_available = stock_total)
 */
async function createOne({ name, description, price, stock_total, image_url, is_active }) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `
      INSERT INTO products (
        name, description, price, stock_total, stock_available, image_url, is_active,
        version, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$4,$5,$6, 1, NOW(), NOW())
      RETURNING *
      `,
            [
                name,
                description ?? null,
                Number(price),
                Number(stock_total),
                image_url ?? null,
                is_active === undefined ? true : Boolean(is_active),
            ]
        );

        await client.query('COMMIT');
        return rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Actualiza un producto con optimistic locking (expected_version)
 * y recalcula stock_available cuando cambia stock_total.
 */
async function updateOne(id, body) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Bloquea fila para edición
        const { rows: curRows } = await client.query(
            `
      SELECT id, name, description, price, stock_total, stock_available, image_url, is_active, version
      FROM products
      WHERE id=$1 AND deleted_at IS NULL
      FOR UPDATE
      `,
            [id]
        );

        if (!curRows.length) {
            const err = new Error('Producto no encontrado');
            err.status = 404;
            throw err;
        }
        const cur = curRows[0];

        // Optimistic locking
        const expected = body.expected_version;
        if (expected !== undefined && Number(expected) !== Number(cur.version)) {
            const err = new Error('Conflicto de versión (optimistic locking)');
            err.status = 409;
            throw err;
        }

        // Valores nuevos (mantén actuales si no vienen en body)
        const newName = body.name !== undefined ? body.name : cur.name;
        const newDesc = body.description !== undefined ? body.description : cur.description;
        const newPrice = body.price !== undefined ? Number(body.price) : Number(cur.price);
        const newImg = body.image_url !== undefined ? body.image_url : cur.image_url;
        const newActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(cur.is_active);

        // Cálculo de stock
        let newTotal = cur.stock_total;
        let newAvail = cur.stock_available;

        if (body.stock_total !== undefined) {
            newTotal = Number(body.stock_total);
            const rentedNow = Number(cur.stock_total) - Number(cur.stock_available); // alquiladas actualmente
            if (newTotal < rentedNow) {
                const err = new Error(`No puede reducir stock por debajo de alquilado (${rentedNow})`);
                err.status = 400;
                throw err;
            }
            newAvail = newTotal - rentedNow;
        }

        const { rows } = await client.query(
            `
      UPDATE products
      SET
        name = $1,
        description = $2,
        price = $3,
        stock_total = $4,
        stock_available = $5,
        image_url = $6,
        is_active = $7,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
            [newName, newDesc, newPrice, newTotal, newAvail, newImg, newActive, id]
        );

        await client.query('COMMIT');
        return rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Borrado lógico
 */
async function softDelete(id) {
    const { rows } = await db.query(
        `
    UPDATE products
    SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW(), version = version + 1
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
        [id]
    );
    return rows[0] || null;
}

/**
 * Restaurar borrado lógico
 */
async function restore(id) {
    const { rows } = await db.query(
        `
    UPDATE products
    SET deleted_at = NULL, is_active = TRUE, updated_at = NOW(), version = version + 1
    WHERE id = $1 AND deleted_at IS NOT NULL
    RETURNING *
    `,
        [id]
    );
    return rows[0] || null;
}

module.exports = {
    list,
    getById,
    createOne,
    updateOne,
    softDelete,
    restore,
};
