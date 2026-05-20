-- CMO MVP Dashboard - PostgreSQL Schema
-- Run this file to initialize the database

-- =============================================
-- DATABASE CREATION
-- =============================================
-- CREATE DATABASE cmo_dashboard;
-- \c cmo_dashboard;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
    profile_pic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DATASETS TABLE (tracks imported Excel/API data)
-- =============================================
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source_type VARCHAR(10) NOT NULL CHECK (source_type IN ('excel', 'api')),
    file_name VARCHAR(255),
    original_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'mapped', 'validated', 'active')),
    data_type VARCHAR(3) DEFAULT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DATASET ROWS (raw imported data as JSONB)
-- =============================================
CREATE TABLE IF NOT EXISTS dataset_rows (
    id BIGSERIAL PRIMARY KEY,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    row_data JSONB NOT NULL
);

CREATE INDEX idx_dataset_rows_dataset ON dataset_rows(dataset_id);

-- =============================================
-- COLUMN MAPPINGS (Excel column → system parameter)
-- =============================================
CREATE TABLE IF NOT EXISTS column_mappings (
    id SERIAL PRIMARY KEY,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    source_column VARCHAR(255) NOT NULL,
    system_parameter VARCHAR(255),
    match_status VARCHAR(10) DEFAULT 'missing' CHECK (match_status IN ('auto', 'manual', 'missing')),
    extra_columns JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX idx_column_mappings_dataset ON column_mappings(dataset_id);

-- =============================================
-- KPI CACHE (pre-calculated KPI values)
-- =============================================
CREATE TABLE IF NOT EXISTS kpi_cache (
    id SERIAL PRIMARY KEY,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    section VARCHAR(20) NOT NULL CHECK (section IN ('dashboard', 'b2b', 'b2c')),
    kpi_name VARCHAR(100) NOT NULL,
    kpi_value DOUBLE PRECISION,
    metadata JSONB,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dataset_id, section, kpi_name)
);

-- =============================================
-- CHART DATA CACHE
-- =============================================
CREATE TABLE IF NOT EXISTS chart_cache (
    id SERIAL PRIMARY KEY,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    section VARCHAR(20) NOT NULL,
    chart_name VARCHAR(100) NOT NULL,
    chart_data JSONB NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dataset_id, section, chart_name)
);

-- =============================================
-- API INTEGRATIONS (saved API configs)
-- =============================================
CREATE TABLE IF NOT EXISTS api_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    endpoint_url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    headers JSONB,
    auth_type VARCHAR(20),
    auth_credentials JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP,
  last_dataset_id INTEGER
);

-- =============================================
-- SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- =============================================
-- INSERT DEFAULT SUPER ADMIN
-- Password: admin123 (bcrypt hash)
-- =============================================
INSERT INTO users (name, email, password_hash, phone, role)
VALUES (
    'Super Admin',
    'admin@cmo.com',
    '$2b$10$KIXxqL2oKMqyKzFGpJ7Hve8DK7X7g0Hl5I5VfGZGjKlJk8z3XZ5Hy',
    '1234567890',
    'super_admin'
) ON CONFLICT (email) DO NOTHING;
