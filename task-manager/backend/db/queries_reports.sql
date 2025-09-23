-- task-manager/backend/db/queries_reports.sql
-- Consultas SQL útiles para reportes y mantenimiento del sistema

-- ============================================
-- REPORTES DE ALQUILERES
-- ============================================

-- 1. Reporte de alquileres del mes actual
SELECT
    r.id AS "Nro Alquiler",
    ri.name AS "Artículo",
    r.customer_name AS "Cliente",
    r.customer_id_number AS "CI",
    r.customer_phone AS "Teléfono",
    r.rental_start AS "Fecha Inicio",
    r.rental_end AS "Fecha Fin",
    r.quantity_rented AS "Cantidad",
    r.total_amount AS "Total",
    COALESCE(SUM(rp.amount), 0) AS "Pagado",
    r.total_amount - COALESCE(SUM(rp.amount), 0) AS "Saldo",
    r.status AS "Estado",
    CASE
        WHEN r.has_collateral THEN 'Sí - ' || r.collateral_description
        ELSE 'No'
        END AS "Prenda"
FROM rentals r
         JOIN rental_items ri ON r.item_id = ri.id
         LEFT JOIN rental_payments rp ON r.id = rp.rental_id
WHERE DATE_TRUNC('month', r.rental_start) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY r.id, ri.name
ORDER BY r.rental_start DESC;

-- 2. Artículos más alquilados
SELECT
    ri.name AS "Artículo",
    ri.category AS "Categoría",
    COUNT(r.id) AS "Veces Alquilado",
    SUM(r.quantity_rented) AS "Unidades Totales",
    SUM(r.total_amount) AS "Ingresos Generados",
    AVG(r.rental_end - r.rental_start) AS "Días Promedio",
    ri.quantity_total AS "Inventario Total",
    ri.quantity_available AS "Disponible Ahora"
FROM rental_items ri
         LEFT JOIN rentals r ON ri.id = r.item_id
GROUP BY ri.id
ORDER BY COUNT(r.id) DESC;

-- 3. Clientes frecuentes
SELECT
    customer_name AS "Cliente",
    customer_id_number AS "CI",
    customer_phone AS "Teléfono",
    COUNT(*) AS "Nro Alquileres",
    SUM(total_amount) AS "Total Gastado",
    SUM(CASE WHEN status = 'activo' THEN 1 ELSE 0 END) AS "Alquileres Activos",
    MAX(rental_start) AS "Último Alquiler"
FROM rentals
GROUP BY customer_name, customer_id_number, customer_phone
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 4. Alquileres vencidos con detalles
SELECT
    r.id AS "ID",
    ri.name AS "Artículo",
    r.customer_name AS "Cliente",
    r.customer_phone AS "Teléfono",
    r.rental_end AS "Fecha Vencimiento",
    CURRENT_DATE - r.rental_end AS "Días Vencido",
    r.total_amount AS "Total",
    COALESCE(SUM(rp.amount), 0) AS "Pagado",
    r.total_amount - COALESCE(SUM(rp.amount), 0) AS "Saldo Pendiente",
    r.has_collateral AS "Tiene Prenda",
    r.collateral_description AS "Descripción Prenda"
FROM rentals r
         JOIN rental_items ri ON r.item_id = ri.id
         LEFT JOIN rental_payments rp ON r.id = rp.rental_id
WHERE r.status = 'activo'
  AND r.rental_end < CURRENT_DATE
GROUP BY r.id, ri.name
ORDER BY r.rental_end;

-- 5. Reporte financiero mensual
SELECT
    TO_CHAR(rental_start, 'YYYY-MM') AS "Mes",
    COUNT(*) AS "Total Alquileres",
    SUM(total_amount) AS "Ingresos Proyectados",
    SUM(deposit) AS "Depósitos",
    COUNT(CASE WHEN status = 'activo' THEN 1 END) AS "Activos",
    COUNT(CASE WHEN status = 'finalizado' THEN 1 END) AS "Finalizados",
    COUNT(CASE WHEN status = 'activo' AND rental_end < CURRENT_DATE THEN 1 END) AS "Vencidos"
FROM rentals
WHERE rental_start >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(rental_start, 'YYYY-MM')
ORDER BY "Mes" DESC;

-- 6. Estado del inventario
SELECT
    category AS "Categoría",
    COUNT(*) AS "Tipos de Artículos",
    SUM(quantity_total) AS "Unidades Totales",
    SUM(quantity_available) AS "Unidades Disponibles",
    SUM(quantity_total - quantity_available) AS "Unidades Alquiladas",
    ROUND(AVG(quantity_available::numeric / NULLIF(quantity_total, 0) * 100), 2) AS "% Disponibilidad"
FROM rental_items
GROUP BY category
ORDER BY category;

-- 7. Historial de pagos detallado
SELECT
    r.id AS "Alquiler",
    ri.name AS "Artículo",
    r.customer_name AS "Cliente",
    rp.payment_date AS "Fecha Pago",
    rp.amount AS "Monto",
    rp.payment_method AS "Método",
    rp.notes AS "Notas",
    r.total_amount AS "Total Alquiler",
    SUM(rp.amount) OVER (PARTITION BY r.id ORDER BY rp.payment_date) AS "Acumulado"
FROM rental_payments rp
         JOIN rentals r ON rp.rental_id = r.id
         JOIN rental_items ri ON r.item_id = ri.id
ORDER BY rp.payment_date DESC;

-- ============================================
-- CONSULTAS DE MANTENIMIENTO
-- ============================================

-- 8. Verificar integridad de datos
SELECT
    'Artículos sin categoría' AS "Problema",
    COUNT(*) AS "Cantidad"
FROM rental_items
WHERE category IS NULL OR category = ''
UNION ALL
SELECT
    'Alquileres sin cliente',
    COUNT(*)
FROM rentals
WHERE customer_name IS NULL OR customer_name = ''
UNION ALL
SELECT
    'Cantidades negativas',
    COUNT(*)
FROM rental_items
WHERE quantity_available < 0
UNION ALL
SELECT
    'Alquileres con fechas inválidas',
    COUNT(*)
FROM rentals
WHERE rental_end < rental_start;

-- 9. Actualizar alquileres vencidos automáticamente
UPDATE rentals
SET is_overdue = true
WHERE status = 'activo'
  AND rental_end < CURRENT_DATE
  AND is_overdue = false;

-- 10. Limpiar pagos huérfanos
DELETE FROM rental_payments
WHERE rental_id NOT IN (SELECT id FROM rentals);

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- 11. Vista de rentabilidad por artículo
CREATE OR REPLACE VIEW item_profitability AS
SELECT
    ri.id,
    ri.name,
    ri.category,
    ri.daily_rate,
    ri.weekly_rate,
    ri.monthly_rate,
    COUNT(r.id) AS rental_count,
    COALESCE(SUM(r.total_amount), 0) AS total_revenue,
    COALESCE(AVG(r.total_amount), 0) AS avg_revenue_per_rental,
    CASE
        WHEN COUNT(r.id) > 0 THEN
            ROUND((SUM(r.rental_end - r.rental_start) / COUNT(r.id))::numeric, 2)
        ELSE 0
        END AS avg_rental_days,
    ri.quantity_total,
    ri.quantity_available
FROM rental_items ri
         LEFT JOIN rentals r ON ri.id = r.item_id
GROUP BY ri.id;

-- 12. Vista de clientes con saldos pendientes
CREATE OR REPLACE VIEW customers_with_balance AS
SELECT
    r.customer_name,
    r.customer_id_number,
    r.customer_phone,
    r.customer_email,
    COUNT(r.id) AS active_rentals,
    SUM(r.total_amount) AS total_amount,
    COALESCE(SUM(rp.paid), 0) AS total_paid,
    SUM(r.total_amount) - COALESCE(SUM(rp.paid), 0) AS balance_due
FROM rentals r
         LEFT JOIN (
    SELECT rental_id, SUM(amount) as paid
    FROM rental_payments
    GROUP BY rental_id
) rp ON r.id = rp.rental_id
WHERE r.status = 'activo'
GROUP BY r.customer_name, r.customer_id_number, r.customer_phone, r.customer_email
HAVING SUM(r.total_amount) - COALESCE(SUM(rp.paid), 0) > 0;

-- ============================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================

-- 13. Función para calcular disponibilidad futura
CREATE OR REPLACE FUNCTION check_future_availability(
    p_item_id INTEGER,
    p_start_date DATE,
    p_end_date DATE,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
v_max_rented INTEGER;
    v_total_quantity INTEGER;
BEGIN
    -- Obtener cantidad total del artículo
SELECT quantity_total INTO v_total_quantity
FROM rental_items
WHERE id = p_item_id;

-- Calcular máxima cantidad alquilada en el período
SELECT COALESCE(SUM(quantity_rented), 0) INTO v_max_rented
FROM rentals
WHERE item_id = p_item_id
  AND status = 'activo'
  AND rental_start <= p_end_date
  AND rental_end >= p_start_date;

RETURN (v_total_quantity - v_max_rented) >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- 14. Función para generar reporte de ingresos
CREATE OR REPLACE FUNCTION generate_income_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE(
    periodo TEXT,
    alquileres_nuevos BIGINT,
    ingresos_proyectados NUMERIC,
    pagos_recibidos NUMERIC,
    saldo_pendiente NUMERIC
) AS $$
BEGIN
RETURN QUERY
SELECT
    p_start_date::TEXT || ' a ' || p_end_date::TEXT AS periodo,
    COUNT(r.id) AS alquileres_nuevos,
    COALESCE(SUM(r.total_amount), 0) AS ingresos_proyectados,
    COALESCE(SUM(rp.total_paid), 0) AS pagos_recibidos,
    COALESCE(SUM(r.total_amount), 0) - COALESCE(SUM(rp.total_paid), 0) AS saldo_pendiente
FROM rentals r
         LEFT JOIN (
    SELECT rental_id, SUM(amount) as total_paid
    FROM rental_payments
    WHERE payment_date BETWEEN p_start_date AND p_end_date
    GROUP BY rental_id
) rp ON r.id = rp.rental_id
WHERE r.rental_start BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- 15. Índices adicionales para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_rentals_customer_name ON rentals(customer_name);
CREATE INDEX IF NOT EXISTS idx_rentals_dates_combined ON rentals(rental_start, rental_end);
CREATE INDEX IF NOT EXISTS idx_rental_payments_date ON rental_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_rental_items_name ON rental_items(name);

-- ============================================
-- CONSULTAS DE EJEMPLO DE USO
-- ============================================

-- Ejemplo 1: Verificar disponibilidad futura
SELECT check_future_availability(1, '2025-02-01', '2025-02-07', 2);

-- Ejemplo 2: Generar reporte de ingresos del mes
SELECT * FROM generate_income_report(
        DATE_TRUNC('month', CURRENT_DATE)::DATE,
        (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
              );

-- Ejemplo 3: Top 5 artículos más rentables
SELECT * FROM item_profitability
ORDER BY total_revenue DESC
    LIMIT 5;

-- Ejemplo 4: Clientes con mayores deudas
SELECT * FROM customers_with_balance
ORDER BY balance_due DESC
    LIMIT 10;