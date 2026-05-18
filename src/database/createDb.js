const { Client } = require('pg');
require('dotenv').config();

const createDatabase = async () => {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: 'postgres' // Connect to default DB
  });

  try {
    await client.connect();
    // Check if DB exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = 'monitoreoDocente'`);
    
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "monitoreoDocente"`);
      console.log('Database "monitoreoDocente" created successfully.');
    } else {
      console.log('Database "monitoreoDocente" already exists.');
    }
  } catch (err) {
    console.error('Error creating database:', err.message);
  } finally {
    await client.end();
  }
};

createDatabase();
