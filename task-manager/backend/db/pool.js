// =====================================================
// ARCHIVO: backend/db/pool.js
// Configuración del pool de conexiones PostgreSQL
// =====================================================

const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool
const pool = new Pool({
    user: process.env.DB_USER || 'taskuser',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'taskmanager',
    password: process.env.DB_PASSWORD || 'taskpass',
    port: parseInt(process.env.DB_PORT || '5433'),

    // Configuraciones adicionales del pool
    max: 20,                    // Máximo de conexiones en el pool
    idleTimeoutMillis: 30000,   // Tiempo antes de cerrar conexión inactiva
    connectionTimeoutMillis: 2000, // Tiempo máximo para establecer conexión
});

// Manejo de errores del pool
pool.on('error', (err, client) => {
    console.error('Error inesperado en cliente del pool', err);
    process.exit(-1);
});

// Verificar conexión al iniciar
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar con la base de datos:', err);
        return;
    }
    console.log('✅ Conexión exitosa con PostgreSQL');
    release();
});

module.exports = pool;