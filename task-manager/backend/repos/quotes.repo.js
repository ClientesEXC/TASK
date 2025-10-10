// task-manager/backend/repos/quotes.repo.js
const pool = require('../db');

async function createQuote(payload) {
    const {
        type_service,
        materials,
        include_print,
        include_design,
        design_level,
        ojales_count,
        include_vinyl_cut,
        include_pvc_base,
        pricing_snapshot,
        details,
        final_total
    } = payload;

    const sql = `
    INSERT INTO quotes (
      type_service, materials, include_print, include_design, design_level, ojales_count,
      include_vinyl_cut, include_pvc_base, pricing_snapshot, details, final_total
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `;

    const params = [
        type_service,
        JSON.stringify(materials),
        !!include_print,
        !!include_design,
        design_level || null,
        ojales_count ?? null,
        !!include_vinyl_cut,
        !!include_pvc_base,
        pricing_snapshot ? JSON.stringify(pricing_snapshot) : null,
        JSON.stringify(details),
        final_total
    ];

    const { rows } = await pool.query(sql, params);
    return rows[0];
}

async function listQuotes() {
    const { rows } = await pool.query(`SELECT * FROM quotes ORDER BY created_at DESC`);
    return rows;
}

async function getQuoteById(id) {
    const { rows } = await pool.query(`SELECT * FROM quotes WHERE id=$1`, [id]);
    return rows[0] || null;
}

module.exports = { createQuote, listQuotes, getQuoteById };
