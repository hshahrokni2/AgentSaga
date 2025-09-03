"""
Test Database Schema Creation and Migration
============================================
Tests for PostgreSQL schema with pgvector extension, ensuring all tables,
indexes, constraints, and migrations work correctly.

These tests follow TDD principles - written before implementation to drive design.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
import asyncpg
from sqlalchemy import create_engine, MetaData, Table, Column, String, Integer, DateTime, ForeignKey, Index, Text, JSON, DECIMAL, Boolean, UniqueConstraint
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from pgvector.sqlalchemy import Vector
import alembic
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext


Base = declarative_base()


class TestDatabaseSchemaCreation:
    """Test database schema creation with all required tables and extensions"""
    
    @pytest.fixture
    async def db_engine(self):
        """Create test database engine with pgvector extension"""
        # This will fail until implementation exists
        engine = create_async_engine(
            "postgresql+asyncpg://test_user:test_pass@localhost:5432/svoa_test",
            echo=True
        )
        return engine
    
    @pytest.fixture
    async def db_session(self, db_engine):
        """Create async database session"""
        async_session = sessionmaker(
            db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with async_session() as session:
            yield session
    
    async def test_pgvector_extension_enabled(self, db_session):
        """Test that pgvector extension is properly installed and configured"""
        # WILL FAIL: Extension not installed
        result = await db_session.execute(
            "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
        )
        extension = result.fetchone()
        
        assert extension is not None, "pgvector extension must be installed"
        assert extension.extname == 'vector'
        assert extension.extversion >= '0.5.0', "pgvector version must be >= 0.5.0"
    
    async def test_load_table_schema(self, db_session):
        """Test load table with all required columns and constraints"""
        # WILL FAIL: Table doesn't exist
        result = await db_session.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'load'
            ORDER BY ordinal_position
        """)
        columns = {row.column_name: row for row in result}
        
        # Verify required columns exist with correct types
        assert 'id' in columns
        assert columns['id'].data_type == 'uuid'
        assert columns['id'].is_nullable == 'NO'
        
        assert 'supplier_id' in columns
        assert columns['supplier_id'].data_type == 'character varying'
        assert columns['supplier_id'].is_nullable == 'NO'
        
        assert 'month' in columns
        assert columns['month'].data_type == 'date'
        
        assert 'file_path' in columns
        assert 'created_at' in columns
        assert columns['created_at'].column_default is not None  # Should have default timestamp
        
        assert 'metadata' in columns
        assert columns['metadata'].data_type == 'jsonb'
    
    async def test_row_table_schema(self, db_session):
        """Test row table for storing parsed invoice rows"""
        # WILL FAIL: Table doesn't exist
        result = await db_session.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'row'
        """)
        columns = {row.column_name: row for row in result}
        
        assert 'id' in columns
        assert 'load_id' in columns  # Foreign key to load
        assert 'row_number' in columns
        assert 'invoice_number' in columns
        assert 'amount' in columns
        assert columns['amount'].data_type == 'numeric'  # For precise financial calculations
        assert 'vat_amount' in columns
        assert 'category' in columns
        assert 'raw_data' in columns  # JSONB for original row data
    
    async def test_finding_table_with_embeddings(self, db_session):
        """Test finding table with vector embeddings for RAG"""
        # WILL FAIL: Table doesn't exist with vector column
        result = await db_session.execute("""
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'finding'
        """)
        columns = {row.column_name: row for row in result}
        
        assert 'id' in columns
        assert 'row_id' in columns  # Foreign key to row
        assert 'finding_type' in columns
        assert 'description' in columns
        assert 'embedding' in columns
        assert columns['embedding'].udt_name == 'vector'  # pgvector type
        
        # Check embedding dimension constraint
        result = await db_session.execute("""
            SELECT pg_typeof(embedding)::text 
            FROM finding 
            LIMIT 1
        """)
        # Should be vector(1536) for OpenAI embeddings or vector(768) for Swedish models
    
    async def test_insight_table_with_human_friendly_id(self, db_session):
        """Test insight table with INS-YYYY-MM-NNN format IDs"""
        # WILL FAIL: Table doesn't exist
        result = await db_session.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'insight'
        """)
        columns = {row.column_name: row for row in result}
        
        assert 'id' in columns  # UUID primary key
        assert 'insight_id' in columns  # Human-friendly ID: INS-YYYY-MM-NNN
        assert 'title' in columns
        assert 'description' in columns
        assert 'impact_score' in columns
        assert 'category' in columns
        assert 'embedding' in columns  # For similarity search
        assert 'metadata' in columns  # JSONB for flexible data
        
        # Test unique constraint on insight_id
        result = await db_session.execute("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'insight' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%insight_id%'
        """)
        assert result.rowcount > 0, "insight_id must have unique constraint"
    
    async def test_scenario_table_with_human_friendly_id(self, db_session):
        """Test scenario table with SCN-YYYY-MM-NNN format IDs"""
        # WILL FAIL: Table doesn't exist
        result = await db_session.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'scenario'
        """)
        columns = {row.column_name: row for row in result}
        
        assert 'id' in columns  # UUID primary key
        assert 'scenario_id' in columns  # Human-friendly ID: SCN-YYYY-MM-NNN
        assert 'insight_id' in columns  # Foreign key to insight
        assert 'description' in columns
        assert 'assumptions' in columns  # JSONB
        assert 'projected_savings' in columns
        assert 'implementation_cost' in columns
        assert 'roi_months' in columns
    
    async def test_comment_table_schema(self, db_session):
        """Test comment table for user annotations"""
        # WILL FAIL: Table doesn't exist
        result = await db_session.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'comment'
        """)
        columns = {row.column_name: row for row in result}
        
        assert 'id' in columns
        assert 'entity_type' in columns  # 'finding', 'insight', 'scenario'
        assert 'entity_id' in columns  # UUID of related entity
        assert 'user_id' in columns
        assert 'content' in columns
        assert 'created_at' in columns
        assert 'updated_at' in columns
    
    async def test_checklist_run_table(self, db_session):
        """Test checklist_run table for validation tracking"""
        # WILL FAIL: Table doesn't exist
        result = await db_session.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'checklist_run'
        """)
        columns = {row.column_name: row for row in result}
        
        assert 'id' in columns
        assert 'load_id' in columns
        assert 'checklist_type' in columns
        assert 'status' in columns  # 'pending', 'running', 'completed', 'failed'
        assert 'results' in columns  # JSONB for detailed results
        assert 'started_at' in columns
        assert 'completed_at' in columns
        assert 'error_message' in columns
    
    async def test_supplier_month_composite_index(self, db_session):
        """Test composite index on supplier_id and month for fast queries"""
        # WILL FAIL: Index doesn't exist
        result = await db_session.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'load'
            AND indexname = 'idx_load_supplier_month'
        """)
        index = result.fetchone()
        
        assert index is not None, "Composite index idx_load_supplier_month must exist"
        assert 'supplier_id' in index.indexdef
        assert 'month' in index.indexdef
        assert 'btree' in index.indexdef.lower()  # Should use btree for range queries
    
    async def test_vector_similarity_index(self, db_session):
        """Test vector similarity search indexes for RAG queries"""
        # WILL FAIL: HNSW index doesn't exist
        result = await db_session.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename IN ('finding', 'insight')
            AND indexdef LIKE '%hnsw%'
        """)
        indexes = result.fetchall()
        
        assert len(indexes) >= 2, "Must have HNSW indexes on finding and insight embeddings"
        
        for index in indexes:
            assert 'vector_cosine_ops' in index.indexdef or 'vector_l2_ops' in index.indexdef
            assert 'embedding' in index.indexdef
    
    async def test_swedish_text_columns(self, db_session):
        """Test that text columns support Swedish characters (åäö)"""
        # WILL FAIL: Encoding not properly configured
        
        # Insert Swedish text
        test_text = "Leverantör Åkerlund & Rausing köpte äpplen från Örebro"
        await db_session.execute("""
            INSERT INTO finding (id, row_id, finding_type, description, embedding)
            VALUES (gen_random_uuid(), gen_random_uuid(), 'anomaly', %s, %s)
        """, (test_text, [0.1] * 1536))
        
        # Retrieve and verify
        result = await db_session.execute("""
            SELECT description FROM finding WHERE description LIKE '%Åkerlund%'
        """)
        row = result.fetchone()
        
        assert row is not None
        assert 'Åkerlund' in row.description
        assert 'äpplen' in row.description
        assert 'Örebro' in row.description
    
    async def test_personnummer_validation_constraint(self, db_session):
        """Test Swedish personnummer pattern validation if stored"""
        # WILL FAIL: Constraint doesn't exist
        result = await db_session.execute("""
            SELECT constraint_name, check_clause
            FROM information_schema.check_constraints
            WHERE constraint_name = 'chk_valid_personnummer'
        """)
        constraint = result.fetchone()
        
        if constraint:  # Only if personnummer is stored
            # Should match pattern YYYYMMDD-XXXX or YYYYMMDDXXXX
            assert '~' in constraint.check_clause  # Regex constraint
            assert '[0-9]{8}' in constraint.check_clause


class TestDatabaseMigrations:
    """Test database migration system using Alembic"""
    
    @pytest.fixture
    def alembic_config(self):
        """Get Alembic configuration"""
        # WILL FAIL: Alembic not configured
        config = Config("alembic.ini")
        return config
    
    def test_migration_scripts_exist(self, alembic_config):
        """Test that migration scripts are properly structured"""
        # WILL FAIL: No migration directory
        script_dir = ScriptDirectory.from_config(alembic_config)
        revisions = list(script_dir.walk_revisions())
        
        assert len(revisions) > 0, "Must have at least one migration"
        
        # Check for initial migration
        initial = [r for r in revisions if r.down_revision is None]
        assert len(initial) == 1, "Must have exactly one initial migration"
        
        # Verify migration naming convention
        for revision in revisions:
            assert revision.revision is not None
            assert revision.doc is not None, f"Migration {revision.revision} must have description"
    
    async def test_migration_up_down(self, db_session, alembic_config):
        """Test migration upgrade and downgrade"""
        # WILL FAIL: Migrations not implemented
        from alembic import command
        
        # Downgrade to base
        command.downgrade(alembic_config, "base")
        
        # Verify tables don't exist
        result = await db_session.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name IN ('load', 'row', 'finding', 'insight', 'scenario')
        """)
        assert result.rowcount == 0, "Tables should not exist after downgrade to base"
        
        # Upgrade to head
        command.upgrade(alembic_config, "head")
        
        # Verify all tables exist
        result = await db_session.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name IN ('load', 'row', 'finding', 'insight', 'scenario')
        """)
        tables = {row.table_name for row in result}
        
        assert 'load' in tables
        assert 'row' in tables
        assert 'finding' in tables
        assert 'insight' in tables
        assert 'scenario' in tables
    
    async def test_migration_data_preservation(self, db_session, alembic_config):
        """Test that migrations preserve existing data"""
        # WILL FAIL: Data preservation not implemented
        from alembic import command
        
        # Insert test data
        await db_session.execute("""
            INSERT INTO load (id, supplier_id, month, file_path)
            VALUES (gen_random_uuid(), 'TEST001', '2024-01-01', '/test/path.csv')
        """)
        await db_session.commit()
        
        # Run a migration that modifies the schema
        command.upgrade(alembic_config, "+1")
        
        # Verify data still exists
        result = await db_session.execute("""
            SELECT supplier_id FROM load WHERE supplier_id = 'TEST001'
        """)
        assert result.rowcount == 1, "Data must be preserved during migration"
    
    def test_migration_rollback_safety(self, alembic_config):
        """Test that all migrations can be safely rolled back"""
        # WILL FAIL: Rollback safety not verified
        script_dir = ScriptDirectory.from_config(alembic_config)
        
        for revision in script_dir.walk_revisions():
            module = revision.module
            
            # Check for downgrade function
            assert hasattr(module, 'downgrade'), f"Migration {revision.revision} must have downgrade"
            
            # Verify downgrade doesn't use dangerous operations
            downgrade_source = inspect.getsource(module.downgrade)
            assert 'DROP TABLE' not in downgrade_source or 'IF EXISTS' in downgrade_source
            assert 'CASCADE' not in downgrade_source or '-- SAFE:' in downgrade_source


class TestDatabaseConstraints:
    """Test database constraints and data integrity rules"""
    
    async def test_foreign_key_constraints(self, db_session):
        """Test all foreign key relationships are properly defined"""
        # WILL FAIL: Foreign keys not defined
        result = await db_session.execute("""
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
        """)
        fks = result.fetchall()
        
        # Verify expected foreign keys exist
        fk_map = {(fk.table_name, fk.column_name): fk for fk in fks}
        
        assert ('row', 'load_id') in fk_map
        assert fk_map[('row', 'load_id')].foreign_table_name == 'load'
        
        assert ('finding', 'row_id') in fk_map
        assert fk_map[('finding', 'row_id')].foreign_table_name == 'row'
        
        assert ('scenario', 'insight_id') in fk_map
        assert fk_map[('scenario', 'insight_id')].foreign_table_name == 'insight'
    
    async def test_cascade_delete_rules(self, db_session):
        """Test cascade delete rules for data consistency"""
        # WILL FAIL: Cascade rules not configured
        result = await db_session.execute("""
            SELECT
                tc.table_name,
                rc.delete_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.referential_constraints rc
                ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
        """)
        
        for row in result:
            if row.table_name in ['row', 'finding']:
                assert row.delete_rule == 'CASCADE', f"{row.table_name} should cascade delete"
            else:
                assert row.delete_rule in ['RESTRICT', 'NO ACTION'], f"{row.table_name} should restrict delete"
    
    async def test_check_constraints(self, db_session):
        """Test check constraints for data validation"""
        # WILL FAIL: Check constraints not defined
        result = await db_session.execute("""
            SELECT
                tc.table_name,
                cc.constraint_name,
                cc.check_clause
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc
                ON tc.constraint_name = cc.constraint_name
            WHERE tc.constraint_type = 'CHECK'
        """)
        constraints = result.fetchall()
        
        # Verify amount constraints
        amount_checks = [c for c in constraints if 'amount' in c.check_clause.lower()]
        assert len(amount_checks) > 0, "Must have check constraints on amount columns"
        
        for check in amount_checks:
            assert '>= 0' in check.check_clause or '> 0' in check.check_clause
    
    async def test_not_null_constraints(self, db_session):
        """Test NOT NULL constraints on critical columns"""
        # WILL FAIL: NOT NULL constraints missing
        critical_columns = [
            ('load', 'supplier_id'),
            ('load', 'file_path'),
            ('row', 'load_id'),
            ('row', 'row_number'),
            ('finding', 'finding_type'),
            ('insight', 'insight_id'),
            ('scenario', 'scenario_id')
        ]
        
        for table, column in critical_columns:
            result = await db_session.execute("""
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s
            """, (table, column))
            row = result.fetchone()
            
            assert row is not None, f"Column {table}.{column} must exist"
            assert row.is_nullable == 'NO', f"Column {table}.{column} must be NOT NULL"