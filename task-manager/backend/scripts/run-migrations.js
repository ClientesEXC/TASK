const fs = require('fs');
const path = require('path');
const { pool } = require('../db/pool'); // usa tu pool actual

async function ensureMigrationsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function alreadyApplied(filename) {
    const { rows } = await pool.query(
        'SELECT 1 FROM public._migrations WHERE filename=$1 LIMIT 1',
        [filename]
    );
    return rows.length > 0;
}

async function applyMigration(filePath, filename) {
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query('BEGIN');
    try {
        await pool.query(sql);
        await pool.query(
            'INSERT INTO public._migrations (filename) VALUES ($1)',
            [filename]
        );
        await pool.query('COMMIT');
        console.log(`✅ ${filename} aplicada`);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`❌ Error aplicando ${filename}:`, err.message);
        process.exit(1);
    }
}

(async () => {
    try {
        await ensureMigrationsTable();
        const dir = path.join(__dirname, '..', 'db', 'migrations');
        const files = fs
            .readdirSync(dir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const f of files) {
            if (await alreadyApplied(f)) {
                console.log(`↪︎ ${f} ya aplicada, saltando`);
                continue;
            }
            await applyMigration(path.join(dir, f), f);
        }
        console.log('🎉 Migraciones completas');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
