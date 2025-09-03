"""
Test Index Performance for Supplier/Month Queries
=================================================
Tests for database index performance, especially for supplier and month-based queries.
All indexed queries must complete within specified time limits.

These tests follow TDD principles - defining performance requirements before implementation.
"""

import pytest
import asyncio
import time
import random
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import List, Dict, Any
import asyncpg
import pandas as pd
import numpy as np


class TestIndexPerformance:
    """Test index performance for common query patterns"""
    
    @pytest.fixture
    async def db_connection(self):
        """Create database connection with large dataset"""
        # WILL FAIL: Database not configured
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            database='svoa_test',
            user='test_user',
            password='test_pass'
        )
        
        # Setup large test dataset
        await self.setup_large_dataset(conn)
        
        yield conn
        await conn.close()
    
    async def setup_large_dataset(self, conn):
        """Setup large dataset for performance testing"""
        # Generate data for 100 suppliers over 24 months
        suppliers = [f"SUP{i:04d}" for i in range(1, 101)]
        months = pd.date_range('2023-01-01', '2024-12-31', freq='MS')
        
        # Bulk insert loads
        load_records = []
        for supplier in suppliers:
            for month in months:
                load_records.append((
                    supplier,
                    month.date(),
                    f"/data/{supplier}/{month.strftime('%Y%m')}.csv",
                    datetime.now()
                ))
        
        await conn.executemany("""
            INSERT INTO load (supplier_id, month, file_path, created_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
        """, load_records)
    
    async def test_composite_index_creation(self, db_connection):
        """Test creation of composite index on supplier_id and month"""
        # WILL FAIL: Index not created
        
        # Check if composite index exists
        index_info = await db_connection.fetchrow("""
            SELECT 
                i.indexname,
                i.indexdef,
                pg_size_pretty(pg_relation_size(i.indexname::regclass)) as size
            FROM pg_indexes i
            WHERE i.tablename = 'load'
            AND i.indexname = 'idx_load_supplier_month'
        """)
        
        assert index_info is not None, "Composite index idx_load_supplier_month must exist"
        assert 'supplier_id' in index_info['indexdef']
        assert 'month' in index_info['indexdef']
        assert 'btree' in index_info['indexdef'].lower(), "Should use B-tree for range queries"
    
    async def test_supplier_query_performance(self, db_connection):
        """Test performance of queries filtered by supplier"""
        # WILL FAIL: Index not optimized
        
        # Single supplier query
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT l.*, COUNT(r.id) as row_count, SUM(r.amount) as total_amount
            FROM load l
            LEFT JOIN row r ON l.id = r.load_id
            WHERE l.supplier_id = $1
            GROUP BY l.id
            ORDER BY l.month DESC
        """, 'SUP0042')
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 50, f"Single supplier query must complete in < 50ms, took {elapsed:.2f}ms"
        assert len(result) > 0, "Must return results"
        
        # Verify query plan uses index
        plan = await db_connection.fetch("""
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM load WHERE supplier_id = $1
        """, 'SUP0042')
        
        plan_json = plan[0][0]
        assert 'Index Scan' in str(plan_json) or 'Bitmap Index Scan' in str(plan_json)
    
    async def test_month_range_query_performance(self, db_connection):
        """Test performance of month range queries"""
        # WILL FAIL: Date index not optimized
        
        start_date = date(2024, 1, 1)
        end_date = date(2024, 6, 30)
        
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT 
                DATE_TRUNC('month', l.month) as month,
                COUNT(DISTINCT l.supplier_id) as supplier_count,
                COUNT(l.id) as load_count,
                SUM(r.amount) as total_amount
            FROM load l
            LEFT JOIN row r ON l.id = r.load_id
            WHERE l.month >= $1 AND l.month <= $2
            GROUP BY DATE_TRUNC('month', l.month)
            ORDER BY month
        """, start_date, end_date)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 100, f"Month range query must complete in < 100ms, took {elapsed:.2f}ms"
        assert len(result) == 6, "Should return 6 months of data"
    
    async def test_supplier_month_combo_query_performance(self, db_connection):
        """Test performance of queries with both supplier and month filters"""
        # WILL FAIL: Composite index not properly utilized
        
        suppliers = ['SUP0001', 'SUP0002', 'SUP0003', 'SUP0004', 'SUP0005']
        start_date = date(2024, 1, 1)
        end_date = date(2024, 3, 31)
        
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT 
                l.supplier_id,
                l.month,
                l.file_path,
                COUNT(r.id) as invoice_count,
                SUM(r.amount) as total_amount,
                AVG(r.amount) as avg_amount
            FROM load l
            LEFT JOIN row r ON l.id = r.load_id
            WHERE l.supplier_id = ANY($1::text[])
            AND l.month >= $2 
            AND l.month <= $3
            GROUP BY l.supplier_id, l.month, l.file_path
            ORDER BY l.supplier_id, l.month
        """, suppliers, start_date, end_date)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 75, f"Combo query must complete in < 75ms, took {elapsed:.2f}ms"
        
        # Verify result correctness
        result_suppliers = {r['supplier_id'] for r in result}
        assert result_suppliers.issubset(set(suppliers))
    
    async def test_covering_index_performance(self, db_connection):
        """Test performance improvement from covering indexes"""
        # WILL FAIL: Covering index not created
        
        # Check for covering index
        index_info = await db_connection.fetchrow("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'load'
            AND indexname = 'idx_load_supplier_month_covering'
        """)
        
        assert index_info is not None, "Covering index must exist"
        assert 'file_path' in index_info['indexdef'], "Should include file_path"
        assert 'created_at' in index_info['indexdef'], "Should include created_at"
        
        # Test index-only scan
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT supplier_id, month, file_path, created_at
            FROM load
            WHERE supplier_id = $1
            AND month >= $2
        """, 'SUP0010', date(2024, 1, 1))
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 10, f"Index-only scan must complete in < 10ms, took {elapsed:.2f}ms"
        
        # Verify index-only scan in plan
        plan = await db_connection.fetch("""
            EXPLAIN (FORMAT JSON)
            SELECT supplier_id, month, file_path, created_at
            FROM load
            WHERE supplier_id = $1 AND month >= $2
        """, 'SUP0010', date(2024, 1, 1))
        
        assert 'Index Only Scan' in str(plan[0][0])
    
    async def test_partial_index_efficiency(self, db_connection):
        """Test partial indexes for common filter conditions"""
        # WILL FAIL: Partial indexes not created
        
        # Check for partial index on recent data
        index_info = await db_connection.fetchrow("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'load'
            AND indexdef LIKE '%WHERE%'
            AND indexname = 'idx_load_recent_months'
        """)
        
        assert index_info is not None, "Partial index for recent months must exist"
        assert 'month >=' in index_info['indexdef'], "Should filter recent months"
        
        # Test query performance with partial index
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT * FROM load
            WHERE month >= CURRENT_DATE - INTERVAL '3 months'
            ORDER BY month DESC, supplier_id
        """)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 30, f"Recent data query must complete in < 30ms, took {elapsed:.2f}ms"
    
    async def test_index_maintenance_impact(self, db_connection):
        """Test impact of index maintenance on write performance"""
        # WILL FAIL: Index maintenance not optimized
        
        # Measure insert performance with indexes
        test_records = [
            (f"PERF_TEST_{i:04d}", date(2024, 1, 1), f"/test/{i}.csv", datetime.now())
            for i in range(1000)
        ]
        
        start_time = time.perf_counter()
        
        await db_connection.executemany("""
            INSERT INTO load (supplier_id, month, file_path, created_at)
            VALUES ($1, $2, $3, $4)
        """, test_records)
        
        insert_time = (time.perf_counter() - start_time) * 1000
        
        assert insert_time < 500, f"Bulk insert with indexes must complete in < 500ms, took {insert_time:.2f}ms"
        
        # Test update performance
        start_time = time.perf_counter()
        
        await db_connection.execute("""
            UPDATE load
            SET file_path = file_path || '.processed'
            WHERE supplier_id LIKE 'PERF_TEST_%'
        """)
        
        update_time = (time.perf_counter() - start_time) * 1000
        
        assert update_time < 200, f"Bulk update must complete in < 200ms, took {update_time:.2f}ms"
    
    async def test_index_fragmentation_monitoring(self, db_connection):
        """Test monitoring of index fragmentation"""
        # WILL FAIL: Fragmentation monitoring not implemented
        
        # Check index bloat
        bloat_info = await db_connection.fetch("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
                indexrelid::regclass AS index_name,
                ROUND(100 * (1 - (index_bytes::FLOAT / NULLIF(index_bytes + table_bytes, 0))), 2) AS bloat_pct
            FROM (
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    indexrelid,
                    pg_relation_size(indexrelid) AS index_bytes,
                    pg_relation_size(indrelid) AS table_bytes
                FROM pg_stat_user_indexes
                JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
                WHERE schemaname = 'public'
                AND tablename = 'load'
            ) AS index_stats
        """)
        
        for index in bloat_info:
            bloat_pct = index.get('bloat_pct', 0)
            assert bloat_pct < 30, f"Index {index['indexname']} bloat {bloat_pct}% exceeds 30% threshold"
    
    async def test_concurrent_index_access(self, db_connection):
        """Test index performance under concurrent access"""
        # WILL FAIL: Concurrent access not optimized
        
        async def query_task(supplier_id):
            return await db_connection.fetch("""
                SELECT * FROM load
                WHERE supplier_id = $1
                ORDER BY month DESC
            """, supplier_id)
        
        # Create 50 concurrent queries
        suppliers = [f"SUP{random.randint(1, 100):04d}" for _ in range(50)]
        tasks = [query_task(s) for s in suppliers]
        
        start_time = time.perf_counter()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = (time.perf_counter() - start_time) * 1000
        
        # Check for errors
        errors = [r for r in results if isinstance(r, Exception)]
        assert len(errors) == 0, f"Queries failed: {errors}"
        
        # Performance check
        assert elapsed < 500, f"50 concurrent queries must complete in < 500ms, took {elapsed:.2f}ms"
        
        # Average time per query
        avg_time = elapsed / 50
        assert avg_time < 20, f"Average query time must be < 20ms, was {avg_time:.2f}ms"


class TestSpecializedIndexes:
    """Test specialized index types for specific query patterns"""
    
    async def test_gin_index_for_jsonb(self, db_connection):
        """Test GIN index performance for JSONB metadata queries"""
        # WILL FAIL: GIN index not created
        
        # Check for GIN index on metadata
        index_info = await db_connection.fetchrow("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename IN ('load', 'row')
            AND indexdef LIKE '%gin%'
            AND indexdef LIKE '%metadata%'
        """)
        
        assert index_info is not None, "GIN index on metadata must exist"
        
        # Insert test data with metadata
        for i in range(100):
            await db_connection.execute("""
                INSERT INTO load (supplier_id, month, file_path, metadata)
                VALUES ($1, $2, $3, $4)
            """, 
                f"JSON_TEST_{i:03d}",
                date(2024, 1, 1),
                f"/test/{i}.csv",
                {
                    'department': random.choice(['IT', 'HR', 'Finance', 'Operations']),
                    'cost_center': f"CC{random.randint(100, 999)}",
                    'tags': [f"tag{j}" for j in range(random.randint(1, 5))],
                    'approved': random.choice([True, False])
                }
            )
        
        # Test JSONB containment query performance
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT supplier_id, metadata
            FROM load
            WHERE metadata @> '{"department": "Finance"}'::jsonb
        """)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 20, f"JSONB containment query must complete in < 20ms, took {elapsed:.2f}ms"
        assert all(r['metadata']['department'] == 'Finance' for r in result)
    
    async def test_brin_index_for_time_series(self, db_connection):
        """Test BRIN index for time-series data"""
        # WILL FAIL: BRIN index not created
        
        # Check for BRIN index on created_at
        index_info = await db_connection.fetchrow("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'load'
            AND indexdef LIKE '%brin%'
            AND indexname = 'idx_load_created_at_brin'
        """)
        
        assert index_info is not None, "BRIN index on created_at must exist"
        
        # Test range query performance with BRIN
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT COUNT(*) as count, 
                   DATE_TRUNC('day', created_at) as day
            FROM load
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY day
        """)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 50, f"BRIN time-range query must complete in < 50ms, took {elapsed:.2f}ms"
        
        # BRIN indexes should be much smaller than B-tree
        size_comparison = await db_connection.fetchrow("""
            SELECT 
                pg_size_pretty(pg_relation_size('idx_load_created_at_brin'::regclass)) as brin_size,
                pg_size_pretty(pg_relation_size('idx_load_created_at'::regclass)) as btree_size
        """)
        
        # BRIN should be significantly smaller (rough check)
        assert size_comparison is not None
    
    async def test_hash_index_for_equality(self, db_connection):
        """Test hash index for equality-only queries"""
        # WILL FAIL: Hash index not created
        
        # Check for hash index on supplier_id
        index_info = await db_connection.fetchrow("""
            SELECT indexname, indexdef, am.amname
            FROM pg_indexes i
            JOIN pg_class c ON c.relname = i.indexname
            JOIN pg_am am ON c.relam = am.oid
            WHERE i.tablename = 'load'
            AND am.amname = 'hash'
            AND i.indexname = 'idx_load_supplier_hash'
        """)
        
        assert index_info is not None, "Hash index on supplier_id must exist"
        
        # Test equality lookup performance
        start_time = time.perf_counter()
        
        result = await db_connection.fetchrow("""
            SELECT * FROM load
            WHERE supplier_id = $1
            LIMIT 1
        """, 'SUP0050')
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 5, f"Hash index lookup must complete in < 5ms, took {elapsed:.2f}ms"
        assert result is not None
    
    async def test_expression_index(self, db_connection):
        """Test expression-based indexes for computed columns"""
        # WILL FAIL: Expression index not created
        
        # Check for expression index on UPPER(supplier_id)
        index_info = await db_connection.fetchrow("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'load'
            AND indexdef LIKE '%upper%supplier_id%'
        """)
        
        assert index_info is not None, "Expression index on UPPER(supplier_id) must exist"
        
        # Test case-insensitive search performance
        start_time = time.perf_counter()
        
        result = await db_connection.fetch("""
            SELECT * FROM load
            WHERE UPPER(supplier_id) = UPPER($1)
        """, 'sup0042')
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 20, f"Expression index query must complete in < 20ms, took {elapsed:.2f}ms"
    
    async def test_multicolumn_statistics(self, db_connection):
        """Test extended statistics for correlated columns"""
        # WILL FAIL: Extended statistics not created
        
        # Check for extended statistics
        stats_info = await db_connection.fetchrow("""
            SELECT 
                stxname,
                stxkeys,
                stxkind
            FROM pg_statistic_ext
            WHERE stxname = 'load_supplier_month_stats'
        """)
        
        assert stats_info is not None, "Extended statistics must exist"
        
        # Analyze to update statistics
        await db_connection.execute("ANALYZE load")
        
        # Test query with correlated columns
        plan = await db_connection.fetch("""
            EXPLAIN (ANALYZE, FORMAT JSON)
            SELECT * FROM load
            WHERE supplier_id = 'SUP0001'
            AND month >= '2024-01-01'
            AND month <= '2024-06-30'
        """)
        
        # Check that row estimate is accurate
        plan_json = plan[0][0]
        actual_rows = plan_json['Plan']['Actual Rows']
        planned_rows = plan_json['Plan']['Plan Rows']
        
        # Estimate should be within 20% of actual
        accuracy = abs(1 - (planned_rows / max(actual_rows, 1)))
        assert accuracy < 0.2, f"Row estimate accuracy {accuracy:.2%} exceeds 20% threshold"