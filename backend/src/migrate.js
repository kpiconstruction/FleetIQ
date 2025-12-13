const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function run() {
  const sqlPath = path.resolve(__dirname, '../../db/migrations.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  const statements = content.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log('Migrations applied');
  process.exit(0);
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
