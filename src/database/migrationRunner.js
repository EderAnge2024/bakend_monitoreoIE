const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  console.log('Starting migrations...');

  for (const file of files) {
    if (file.endsWith('.sql')) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`Migration successful: ${file}`);
      } catch (err) {
        console.error(`Migration failed: ${file}`);
        console.error(err);
        process.exit(1);
      }
    }
  }

  console.log('All migrations completed.');
};

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

module.exports = runMigrations;
