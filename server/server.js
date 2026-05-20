require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./config/db');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5001;

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

// Auto-migration: add new columns if they don't exist
async function runMigrations(client) {
  try {
    await client.query(`ALTER TABLE datasets ADD COLUMN IF NOT EXISTS data_type VARCHAR(3) DEFAULT NULL`);
    await client.query(`ALTER TABLE column_mappings ADD COLUMN IF NOT EXISTS extra_columns JSONB DEFAULT '[]'::jsonb`);
    console.log('✅ Database migrations applied');
  } catch (err) {
    console.warn('⚠️  Migration warning:', err.message);
  }
}

// Kill any existing process on the port (Windows)
function killPortProcess(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', timeout: 5000 });
    const lines = result.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && pid !== String(process.pid)) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8', timeout: 5000 });
        console.log(`🔄 Killed old process on port ${port} (PID: ${pid})`);
      } catch (_) {}
    }
    if (pids.size > 0) {
      // Small delay to let OS release the port
      return new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (_) {
    // No process found on port — that's fine
  }
  return Promise.resolve();
}

// Graceful shutdown
let server;
function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      pool.end().then(() => {
        console.log('✅ Database pool closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => { process.exit(1); }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// DB connection test & server start
const startServer = async () => {
  // Kill any existing process on our port first
  await killPortProcess(PORT);

  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    await runMigrations(client);
    client.release();
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.log('⚠️  Starting server without database connection...');
  }

  server = app.listen(PORT, () => {
    console.log(`🚀 CMO Dashboard Server running on http://localhost:${PORT}`);
  });

  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${PORT} is still in use. Retrying...`);
      await killPortProcess(PORT);
      // Wait a bit more and retry once
      setTimeout(() => {
        server = app.listen(PORT, () => {
          console.log(`🚀 CMO Dashboard Server running on http://localhost:${PORT} (retry)`);
        });
      }, 2000);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
};

startServer();
