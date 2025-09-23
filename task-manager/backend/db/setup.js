// task-manager/backend/db/setup.js
// Script para inicializar la base de datos con todas las migraciones
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const pool = new Pool({
    user: process.env.DB_USER || 'taskuser',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'taskmanager',
    password: process.env.DB_PASSWORD || 'taskpass',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5433
});

async function runMigration(filename) {
    try {
        const sql = fs.readFileSync(
            path.join(__dirname, filename),
            'utf8'
        );

        await pool.query(sql);
        console.log(`✅ Migración ejecutada: ${filename}`);
        return true;
    } catch (error) {
        console.error(`❌ Error en migración ${filename}:`, error.message);
        return false;
    }
}

async function setupDatabase() {
    console.log('🚀 Iniciando configuración de base de datos...\n');

    try {
        // Verificar conexión
        await pool.query('SELECT NOW()');
        console.log('✅ Conexión a base de datos exitosa\n');

        // Ejecutar migraciones en orden
        const migrations = [
            'init.sql',
            'migration_002_rental_system.sql',
            'migration_003_rental_system_enhanced.sql'
        ];

        for (const migration of migrations) {
            const success = await runMigration(migration);
            if (!success && migration !== 'init.sql') {
                console.log('⚠️  Continuando con siguiente migración...');
            }
        }

        // Verificar tablas creadas
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `;

        const result = await pool.query(tablesQuery);
        console.log('\n📊 Tablas en la base de datos:');
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        // Contar registros
        const counts = await Promise.all([
            pool.query('SELECT COUNT(*) FROM tasks'),
            pool.query('SELECT COUNT(*) FROM rental_items'),
            pool.query('SELECT COUNT(*) FROM rentals'),
            pool.query('SELECT COUNT(*) FROM rental_payments')
        ]);

        console.log('\n📈 Estado actual:');
        console.log(`   - Tareas: ${counts[0].rows[0].count}`);
        console.log(`   - Artículos de alquiler: ${counts[1].rows[0].count}`);
        console.log(`   - Alquileres: ${counts[2].rows[0].count}`);
        console.log(`   - Pagos de alquiler: ${counts[3].rows[0].count}`);

        console.log('\n✨ Base de datos configurada exitosamente!');

    } catch (error) {
        console.error('❌ Error fatal:', error);
    } finally {
        await pool.end();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };