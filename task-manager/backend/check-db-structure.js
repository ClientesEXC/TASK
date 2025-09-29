const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'task_manager',
    password: process.env.DB_PASSWORD || 'admin',
    port: process.env.DB_PORT || 5432,
});

async function checkDatabaseStructure() {
    try {
        console.log('=== ESTRUCTURA DE LA BASE DE DATOS ===\n');

        // Verificar tabla rental_items
        console.log('📦 TABLA: rental_items');
        const itemsColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'rental_items'
            ORDER BY ordinal_position;
        `);
        console.log('Columnas:');
        itemsColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });

        // Verificar tabla rentals
        console.log('\n📋 TABLA: rentals');
        const rentalsColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'rentals'
            ORDER BY ordinal_position;
        `);
        console.log('Columnas:');
        rentalsColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });

        // Verificar tabla rental_payments
        console.log('\n💰 TABLA: rental_payments');
        const paymentsColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'rental_payments'
            ORDER BY ordinal_position;
        `);
        console.log('Columnas:');
        paymentsColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        });

        // Mostrar algunos datos de ejemplo
        console.log('\n=== DATOS DE EJEMPLO ===\n');

        const sampleItems = await pool.query('SELECT * FROM rental_items LIMIT 1');
        if (sampleItems.rows.length > 0) {
            console.log('Ejemplo de rental_items:');
            console.log(sampleItems.rows[0]);
        }

        const sampleRentals = await pool.query('SELECT * FROM rentals LIMIT 1');
        if (sampleRentals.rows.length > 0) {
            console.log('\nEjemplo de rentals:');
            console.log(sampleRentals.rows[0]);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkDatabaseStructure();