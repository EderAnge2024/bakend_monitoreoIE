const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runSeeds = async () => {
  const seedsDir = path.join(__dirname, 'seeds');
  const files = fs.readdirSync(seedsDir).sort();

  console.log('Starting seeds...');

  for (const file of files) {
    if (file.endsWith('.sql')) {
      const filePath = path.join(seedsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`Seed successful: ${file}`);
      } catch (err) {
        console.error(`Seed failed: ${file}`);
        console.error(err);
        process.exit(1);
      }
    }
  }

  console.log('All seeds completed.');
};

if (require.main === module) {
  runSeeds().then(() => process.exit(0));
}

module.exports = runSeeds;
