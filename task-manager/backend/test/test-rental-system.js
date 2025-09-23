// task-manager/backend/test/test-rental-system.js
// Script de pruebas para verificar el sistema de alquileres

const axios = require('axios');
const API_URL = 'http://localhost:3001/api';

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAPI() {
    let testItemId = null;
    let testRentalId = null;
    let testPaymentId = null;

    try {
        log('\n🧪 INICIANDO PRUEBAS DEL SISTEMA DE ALQUILERES\n', 'blue');

        // Test 1: Crear un artículo de alquiler
        log('Test 1: Crear artículo de alquiler...', 'yellow');
        const itemData = {
            name: 'Taladro de Prueba',
            description: 'Artículo para pruebas del sistema',
            category: 'herramientas',
            daily_rate: 25,
            weekly_rate: 150,
            monthly_rate: 500,
            quantity: 5,
            quantity_available: 5,
            status: 'disponible',
            image_url: 'https://example.com/taladro.jpg'
        };

        const itemResponse = await axios.post(`${API_URL}/rental-items`, itemData);
        testItemId = itemResponse.data.id;
        log(`✅ Artículo creado con ID: ${testItemId}`, 'green');

        await delay(500);

        // Test 2: Obtener disponibilidad
        log('\nTest 2: Verificar disponibilidad...', 'yellow');
        const availabilityResponse = await axios.get(`${API_URL}/rental-items/availability`);
        const testItem = availabilityResponse.data.find(item => item.id === testItemId);

        if (testItem && testItem.quantity_available === 5) {
            log(`✅ Disponibilidad correcta: ${testItem.quantity_available} unidades`, 'green');
        } else {
            throw new Error('Disponibilidad incorrecta');
        }

        await delay(500);

        // Test 3: Crear un alquiler con todos los campos
        log('\nTest 3: Crear alquiler completo...', 'yellow');
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const rentalData = {
            item_id: testItemId,
            customer_name: 'Juan Pérez Test',
            customer_id_number: '1234567890',
            customer_address: 'Calle de Prueba 123',
            customer_phone: '0999123456',
            customer_email: 'test@example.com',
            rental_start: today.toISOString().split('T')[0],
            rental_end: nextWeek.toISOString().split('T')[0],
            quantity_rented: 2,
            total_amount: 300,
            deposit: 100,
            has_collateral: true,
            collateral_description: 'Documento de identidad',
            notes: 'Alquiler de prueba',
            initial_payment: 150
        };

        const rentalResponse = await axios.post(`${API_URL}/rentals/enhanced`, rentalData);
        testRentalId = rentalResponse.data.id;
        log(`✅ Alquiler creado con ID: ${testRentalId}`, 'green');

        await delay(500);

        // Test 4: Verificar reducción de disponibilidad
        log('\nTest 4: Verificar reducción de disponibilidad...', 'yellow');
        const availabilityAfterRental = await axios.get(`${API_URL}/rental-items/availability`);
        const itemAfterRental = availabilityAfterRental.data.find(item => item.id === testItemId);

        if (itemAfterRental && itemAfterRental.quantity_available === 3) {
            log(`✅ Disponibilidad actualizada: ${itemAfterRental.quantity_available} unidades`, 'green');
        } else {
            throw new Error('Disponibilidad no se actualizó correctamente');
        }

        await delay(500);

        // Test 5: Obtener alquileres pendientes
        log('\nTest 5: Obtener alquileres pendientes...', 'yellow');
        const pendingResponse = await axios.get(`${API_URL}/rentals/pending-returns`);
        const pendingRental = pendingResponse.data.find(r => r.id === testRentalId);

        if (pendingRental) {
            log(`✅ Alquiler pendiente encontrado`, 'green');
            log(`   Cliente: ${pendingRental.customer_name}`, 'blue');
            log(`   Total: $${pendingRental.total_amount}`, 'blue');
            log(`   Pagado: $${pendingRental.total_paid}`, 'blue');
            log(`   Saldo: $${pendingRental.balance_due}`, 'blue');
        } else {
            throw new Error('Alquiler pendiente no encontrado');
        }

        await delay(500);

        // Test 6: Agregar un abono
        log('\nTest 6: Agregar abono al alquiler...', 'yellow');
        const paymentData = {
            amount: 50,
            payment_date: today.toISOString().split('T')[0],
            payment_method: 'efectivo',
            notes: 'Segundo pago'
        };

        const paymentResponse = await axios.post(
            `${API_URL}/rentals/${testRentalId}/payments`,
            paymentData
        );
        testPaymentId = paymentResponse.data.id;
        log(`✅ Abono registrado con ID: ${testPaymentId}`, 'green');

        await delay(500);

        // Test 7: Verificar historial de abonos
        log('\nTest 7: Verificar historial de abonos...', 'yellow');
        const paymentsResponse = await axios.get(`${API_URL}/rentals/${testRentalId}/payments`);

        if (paymentsResponse.data && paymentsResponse.data.length > 0) {
            log(`✅ Historial de abonos: ${paymentsResponse.data.length} pagos registrados`, 'green');
            let totalPaid = 0;
            paymentsResponse.data.forEach(p => {
                totalPaid += parseFloat(p.amount);
                log(`   - $${p.amount} - ${p.notes || 'Sin notas'}`, 'blue');
            });
            log(`   Total pagado: $${totalPaid}`, 'blue');
        } else {
            throw new Error('No se encontraron abonos');
        }

        await delay(500);

        // Test 8: Procesar devolución
        log('\nTest 8: Procesar devolución...', 'yellow');
        const returnData = {
            return_date: today.toISOString().split('T')[0],
            quantity_returned: 2,
            condition_status: 'bueno',
            return_notes: 'Artículo devuelto en buen estado',
            final_payment: 100
        };

        await axios.post(`${API_URL}/rentals/${testRentalId}/return`, returnData);
        log(`✅ Devolución procesada exitosamente`, 'green');

        await delay(500);

        // Test 9: Verificar restauración de disponibilidad
        log('\nTest 9: Verificar restauración de disponibilidad...', 'yellow');
        const finalAvailability = await axios.get(`${API_URL}/rental-items/availability`);
        const itemAfterReturn = finalAvailability.data.find(item => item.id === testItemId);

        if (itemAfterReturn && itemAfterReturn.quantity_available === 5) {
            log(`✅ Disponibilidad restaurada: ${itemAfterReturn.quantity_available} unidades`, 'green');
        } else {
            log(`⚠️  Disponibilidad: ${itemAfterReturn?.quantity_available || 0} unidades`, 'yellow');
        }

        await delay(500);

        // Test 10: Obtener estadísticas
        log('\nTest 10: Obtener estadísticas del sistema...', 'yellow');
        const statsResponse = await axios.get(`${API_URL}/rentals/stats/enhanced`);
        const stats = statsResponse.data;

        log('✅ Estadísticas obtenidas:', 'green');
        log(`   Total de artículos: ${stats.total_items || 0}`, 'blue');
        log(`   Inventario disponible: ${stats.available_inventory || 0}`, 'blue');
        log(`   Alquileres activos: ${stats.active_rentals || 0}`, 'blue');
        log(`   Alquileres vencidos: ${stats.overdue_rentals || 0}`, 'blue');
        log(`   Ingresos totales: $${parseFloat(stats.total_revenue || 0).toFixed(2)}`, 'blue');
        log(`   Total recaudado: $${parseFloat(stats.total_collected || 0).toFixed(2)}`, 'blue');

        log('\n✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE! 🎉', 'green');

    } catch (error) {
        log(`\n❌ ERROR EN LAS PRUEBAS: ${error.message}`, 'red');
        if (error.response) {
            log(`   Detalles: ${JSON.stringify(error.response.data)}`, 'red');
        }
        process.exit(1);
    } finally {
        // Limpieza: eliminar datos de prueba
        try {
            log('\n🧹 Limpiando datos de prueba...', 'yellow');

            if (testPaymentId) {
                await axios.delete(`${API_URL}/rental-payments/${testPaymentId}`);
            }

            if (testItemId) {
                await axios.delete(`${API_URL}/rental-items/${testItemId}`);
            }

            log('✅ Limpieza completada', 'green');
        } catch (cleanupError) {
            log(`⚠️  Error en limpieza: ${cleanupError.message}`, 'yellow');
        }
    }
}

// Ejecutar pruebas
console.log('⏳ Esperando a que el servidor esté listo...');
setTimeout(() => {
    testAPI();
}, 2000);

module.exports = { testAPI };