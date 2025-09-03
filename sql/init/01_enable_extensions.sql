-- Enable required PostgreSQL extensions for SVOA Lea platform
-- Following TDD approach - minimal setup to pass tests

-- Enable pgvector for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation for human-friendly IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable hstore for metadata storage
CREATE EXTENSION IF NOT EXISTS hstore;

-- Enable pg_stat_statements for performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable pg_trgm for fuzzy text matching (Swedish supplier names)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extensions are loaded
SELECT extension_name, extension_version 
FROM information_schema.applicable_roles 
WHERE role_name = 'postgres';