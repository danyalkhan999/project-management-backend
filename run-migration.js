const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    try {
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL\s*=\s*(.+)/);
        if (match) {
          connectionString = match[1].trim();
        }
      }
    } catch (e) {
      console.warn('Could not read .env file directly:', e.message);
    }
  }

  if (!connectionString) {
    console.error('✗ Error: DATABASE_URL not found in environment or .env file');
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const sqlPath = path.join(__dirname, 'src/db/migrations/0000_previous_supreme_intelligence.sql');
    console.log('Reading migration SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration query...');
    await client.query(sql);
    console.log('✓ Migration executed successfully! Database tables are ready.');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
