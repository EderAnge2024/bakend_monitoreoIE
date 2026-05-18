const app = require('./src/app');
const dotenv = require('dotenv');
const initAdmin = require('./src/utils/initAdmin');
const runMigrations = require('./src/database/migrationRunner');

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await runMigrations();
  await initAdmin();
});
