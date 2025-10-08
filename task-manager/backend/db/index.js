// backend/db/index.js
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'taskuser',
    password: process.env.DB_PASSWORD || 'taskpass',
    database: process.env.DB_NAME || 'taskmanager',
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('connect', () => console.log('✅ Conexión exitosa con PostgreSQL'));
pool.on('error', (err) => console.error('💥 Error inesperado en el pool PG', err));

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
