// One-time migration script
require('dotenv').config();
const { pool } = require('./config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migration...');
    await client.query(`ALTER TABLE datasets ADD COLUMN IF NOT EXISTS data_type VARCHAR(3) DEFAULT NULL`);
    console.log('✅ Added data_type column to datasets');
    await client.query(`ALTER TABLE column_mappings ADD COLUMN IF NOT EXISTS extra_columns JSONB DEFAULT '[]'::jsonb`);
    console.log('✅ Added extra_columns column to column_mappings');
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
