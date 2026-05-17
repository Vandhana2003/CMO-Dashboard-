/**
 * Run this script ONCE to create the default Super Admin user.
 * Usage: node seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');

async function seed() {
  try {
    console.log('🔗 Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Connected!');
    client.release();

    // Hash password properly
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    console.log('🔑 Password hashed');

    // Insert or update super admin
    await pool.query(`
      INSERT INTO users (name, email, password_hash, phone, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password_hash = $3
    `, ['Super Admin', 'admin@cmo.com', hash, '1234567890', 'super_admin']);

    console.log('');
    console.log('✅ Super Admin created successfully!');
    console.log('');
    console.log('   Email:    admin@cmo.com');
    console.log('   Password: admin123');
    console.log('   Role:     Super Admin');
    console.log('');
    console.log('🚀 You can now login at http://localhost:5173');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('');
    console.log('Make sure:');
    console.log('  1. PostgreSQL is running');
    console.log('  2. Database "cmo_dashboard" exists');
    console.log('  3. init.sql has been executed');
    console.log('  4. .env has the correct DB_PASSWORD');
    process.exit(1);
  }
}

seed();
