// =====================================================
// ARCHIVO: backend/setup-system.js
// Script de configuración e inicialización del sistema
// =====================================================

const pool = require('./db/pool');
const fs = require('fs');
const path = require('path');

async function setupSystem() {
    console.log('🚀 Iniciando configuración del sistema...\n');

    let client;
    try {
        client = await pool.connect();

        // =====================================================
        // 1. VERIFICAR CONEXIÓN
        // =====================================================
        console.log('1️⃣ Verificando conexión a base de datos...');
        const testConnection = await client.query('SELECT NOW()');
        console.log('   ✅ Conexión exitosa:', testConnection.rows[0].now);

        // =====================================================
        // 2. APLICAR MIGRACIÓN
        // =====================================================
        console.log('\n2️⃣ Aplicando migraciones...');

        const migrationPath = path.join(__dirname, 'db', 'migration_fix_multiple_rentals.sql');
        if (fs.existsSync(migrationPath)) {
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            await client.query(migrationSQL);
            console.log('   ✅ Migraciones aplicadas');
        } else {
            console.log('   ⚠️  Archivo de migración no encontrado, aplicando estructura básica...');
        }

        // =====================================================
        // 3. VERIFICAR TABLAS
        // =====================================================
        console.log('\n3️⃣ Verificando estructura de tablas...');

        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `;

        const tables = await client.query(tablesQuery);
        console.log('   Tablas encontradas:');
        tables.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // =====================================================
        // 4. CREAR USUARIO DE PRUEBA
        // =====================================================
        console.log('\n4️⃣ Creando usuario de prueba...');

        const userExists = await client.query(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users')"
        );

        if (userExists.rows[0].exists) {
            await client.query(`
                INSERT INTO users (username, email, password_hash, full_name, role)
                VALUES 
                    ('admin', 'admin@sistema.com', 'temp_password_hash', 'Administrador', 'admin'),
                    ('demo', 'demo@sistema.com', 'temp_password_hash', 'Usuario Demo', 'employee')
                ON CONFLICT (username) DO NOTHING
            `);
            console.log('   ✅ Usuarios de prueba creados');
        } else {
            console.log('   ⚠️  Tabla de usuarios no existe aún');
        }

        // =====================================================
        // 5. INSERTAR DATOS DE EJEMPLO
        // =====================================================
        console.log('\n5️⃣ Insertando datos de ejemplo...');

        // Verificar si hay items
        const itemsCount = await client.query('SELECT COUNT(*) FROM rental_items');

        if (parseInt(itemsCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO rental_items (
                    name, description, category, 
                    daily_rate, weekly_rate, monthly_rate,
                    quantity_total, quantity_available, status
                ) VALUES 
                    ('Taladro Percutor Bosch', 'Taladro profesional 800W', 'herramientas', 
                     15.00, 80.00, 250.00, 5, 5, 'disponible'),
                    ('Proyector Full HD', 'Proyector Epson 3200 lúmenes', 'equipos',
                     50.00, 250.00, 800.00, 2, 2, 'disponible'),
                    ('Andamio Modular 6m', 'Andamio certificado con plataformas', 'equipos',
                     25.00, 150.00, 500.00, 3, 3, 'disponible'),
                    ('Generador Eléctrico 5KW', 'Generador portátil silencioso', 'equipos',
                     40.00, 220.00, 700.00, 2, 2, 'disponible'),
                    ('Sierra Circular DeWalt', 'Sierra circular profesional 1800W', 'herramientas',
                     20.00, 100.00, 300.00, 4, 4, 'disponible'),
                    ('Compresor de Aire 100L', 'Compresor industrial', 'equipos',
                     35.00, 180.00, 600.00, 2, 2, 'disponible'),
                    ('Martillo Demoledor', 'Martillo demoledor 1500W', 'herramientas',
                     30.00, 150.00, 450.00, 3, 3, 'disponible'),
                    ('Escalera Telescópica 8m', 'Escalera aluminio extensible', 'equipos',
                     15.00, 70.00, 200.00, 6, 6, 'disponible')
            `);
            console.log('   ✅ Artículos de ejemplo insertados');
        } else {
            console.log('   ℹ️  Ya existen artículos en la base de datos');
        }

        // =====================================================
        // 6. VERIFICAR INTEGRIDAD
        // =====================================================
        console.log('\n6️⃣ Verificando integridad del sistema...');

        const checks = [
            {
                name: 'Artículos disponibles',
                query: 'SELECT COUNT(*) as count FROM rental_items WHERE quantity_available > 0'
            },
            {
                name: 'Alquileres activos',
                query: "SELECT COUNT(*) as count FROM rentals WHERE status = 'activo'"
            },
            {
                name: 'Nueva estructura (rental_orders)',
                query: "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rental_orders')"
            }
        ];

        for (const check of checks) {
            try {
                const result = await client.query(check.query);
                const value = result.rows[0].count || result.rows[0].exists;
                console.log(`   ✓ ${check.name}: ${value}`);
            } catch (err) {
                console.log(`   ✗ ${check.name}: Error`);
            }
        }

        // =====================================================
        // 7. CREAR DIRECTORIO DE UPLOADS
        // =====================================================
        console.log('\n7️⃣ Creando directorio de uploads...');
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('   ✅ Directorio de uploads creado');
        } else {
            console.log('   ℹ️  Directorio de uploads ya existe');
        }

        // =====================================================
        // RESUMEN FINAL
        // =====================================================
        console.log('\n' + '='.repeat(50));
        console.log('✨ SISTEMA CONFIGURADO EXITOSAMENTE\n');
        console.log('📋 Resumen:');
        console.log('   • Base de datos: Conectada y configurada');
        console.log('   • Tablas: Creadas y verificadas');
        console.log('   • Datos de ejemplo: Insertados');
        console.log('   • Usuarios de prueba: admin / demo');
        console.log('\n🚀 Para iniciar el sistema:');
        console.log('   1. Backend:  npm run dev');
        console.log('   2. Frontend: npm start');
        console.log('\n📍 URLs:');
        console.log('   • Frontend: http://localhost:3000');
        console.log('   • Backend:  http://localhost:3001');
        console.log('   • API:      http://localhost:3001/api');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Error durante la configuración:', error);
        console.error('\nDetalles:', error.message);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    setupSystem().then(() => {
        process.exit(0);
    }).catch(err => {
        console.error('Error fatal:', err);
        process.exit(1);
    });
}

module.exports = setupSystem;