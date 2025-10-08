const fs = require('fs');
const path = require('path');
const { pool } = require('../db/pool');

(async () => {
    try {
        const rel = process.argv[2];
        if (!rel) {
            console.error('Uso: node scripts/apply-sql.js <ruta-relativa-sql>');
            process.exit(1);
        }
        const filePath = path.join(__dirname, '..', rel);
        const sql = fs.readFileSync(filePath, 'utf8');
        await pool.query(sql);
        console.log(`✅ Aplicado: ${rel}`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
})();
