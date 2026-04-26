const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query('ALTER TABLE users DISABLE ROW LEVEL SECURITY;');
    console.log('RLS disabled on users table to restore service.');
  } catch (err) {
    console.error('Failed to restore access:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
