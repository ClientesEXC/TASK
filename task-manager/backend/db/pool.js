// backend/db/pool.js
// =====================================================
// Singleton de conexión a PostgreSQL (export nombrado)
// =====================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'taskuser',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'taskmanager',
    password: process.env.DB_PASSWORD || 'taskpass',
    port: +process.env.DB_PORT,

    // Pool tuning
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true
});

pool.on('connect', () => {
    console.log('✅ PG pool conectado');
});

pool.on('error', (err) => {
    console.error('❌ PG pool error:', err);
    // No hagas exit aquí: permite que Express maneje el error
});

async function ping() {
    await pool.query('SELECT 1');
    return true;
}

module.exports = { pool, ping };
