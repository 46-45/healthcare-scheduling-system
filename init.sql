-- PostgreSQL Schema Initialization Script
-- This script runs automatically when the PostgreSQL container starts for the first time
-- via docker-entrypoint-initdb.d volume mount

-- Create schema for Authentication Service
CREATE SCHEMA IF NOT EXISTS auth_schema;

-- Create schema for Schedule Service
CREATE SCHEMA IF NOT EXISTS schedule_schema;

-- Grant necessary permissions (optional but recommended for security)
-- These ensure the postgres user has full access to both schemas
GRANT ALL PRIVILEGES ON SCHEMA auth_schema TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA schedule_schema TO postgres;
