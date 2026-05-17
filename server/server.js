require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/b2b', require('./routes/b2b'));
app.use('/api/b2c', require('./routes/b2c'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DB connection test & server start
const startServer = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();

    app.listen(PORT, () => {
      console.log(`🚀 CMO Dashboard Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.log('⚠️  Starting server without database connection...');
    console.log('⚠️  Make sure PostgreSQL is running and run database/init.sql');

    app.listen(PORT, () => {
      console.log(`🚀 CMO Dashboard Server running on http://localhost:${PORT} (no DB)`);
    });
  }
};

startServer();
