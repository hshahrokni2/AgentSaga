"""
Test DuckDB Analytics Integration and Performance
=================================================
Tests for DuckDB analytical queries, PostgreSQL integration, and performance benchmarks.
Analytics queries must complete within 1 second even on large datasets.

These tests follow TDD principles - defining analytical requirements before implementation.
"""

import pytest
import asyncio
import time
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any
import duckdb
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


class TestDuckDBAnalytics:
    """Test DuckDB integration for analytical queries"""
    
    @pytest.fixture
    def duckdb_conn(self):
        """Create DuckDB connection with PostgreSQL extension"""
        # WILL FAIL: DuckDB not configured
        conn = duckdb.connect(':memory:')
        
        # Install and load PostgreSQL extension
        conn.execute("INSTALL postgres_scanner")
        conn.execute("LOAD postgres_scanner")
        
        # Configure connection to PostgreSQL
        conn.execute("""
            CREATE SECRET postgres_secret (
                TYPE POSTGRES,
                HOST 'localhost',
                PORT 5432,
                DATABASE 'svoa_test',
                USER 'test_user',
                PASSWORD 'test_pass'
            )
        """)
        
        yield conn
        conn.close()
    
    @pytest.fixture
    async def pg_connection(self):
        """PostgreSQL connection for data setup"""
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            database='svoa_test',
            user='test_user',
            password='test_pass'
        )
        yield conn
        await conn.close()
    
    async def setup_test_data(self, pg_connection):
        """Setup test data in PostgreSQL for analytics"""
        # Generate realistic test data
        suppliers = [f"SUP{i:03d}" for i in range(1, 51)]
        months = pd.date_range('2023-01-01', '2024-12-31', freq='MS')
        
        # Insert loads
        for supplier in suppliers[:20]:  # 20 suppliers
            for month in months[:12]:  # 12 months
                load_id = await pg_connection.fetchval("""
                    INSERT INTO load (supplier_id, month, file_path, created_at)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                """, supplier, month.date(), f"/data/{supplier}/{month.strftime('%Y%m')}.csv", datetime.now())
                
                # Insert rows for this load (50-200 rows per load)
                num_rows = np.random.randint(50, 200)
                for row_num in range(num_rows):
                    amount = Decimal(str(np.random.uniform(100, 100000)))
                    vat_amount = amount * Decimal('0.25')
                    
                    await pg_connection.execute("""
                        INSERT INTO row (load_id, row_number, invoice_number, amount, vat_amount, category)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    """, load_id, row_num + 1, f"INV-{supplier}-{row_num:05d}", 
                        amount, vat_amount, np.random.choice(['GOODS', 'SERVICES', 'CONSULTING', 'LICENSES']))
    
    def test_duckdb_postgres_connection(self, duckdb_conn):
        """Test that DuckDB can connect to PostgreSQL"""
        # WILL FAIL: Connection not configured
        
        # Test direct query to PostgreSQL
        result = duckdb_conn.execute("""
            SELECT COUNT(*) as count
            FROM postgres_scan('postgres_secret', 'public', 'load')
        """).fetchone()
        
        assert result is not None, "Must be able to query PostgreSQL from DuckDB"
        assert result[0] >= 0, "Should return row count"
    
    def test_analytics_view_creation(self, duckdb_conn):
        """Test creation of analytical views in DuckDB"""
        # WILL FAIL: Views not created
        
        # Create analytical view for supplier spending
        duckdb_conn.execute("""
            CREATE OR REPLACE VIEW supplier_spending AS
            SELECT 
                l.supplier_id,
                DATE_TRUNC('month', l.month) as month,
                COUNT(DISTINCT l.id) as load_count,
                COUNT(r.id) as invoice_count,
                SUM(r.amount) as total_amount,
                SUM(r.vat_amount) as total_vat,
                AVG(r.amount) as avg_invoice_amount,
                STDDEV(r.amount) as stddev_amount
            FROM postgres_scan('postgres_secret', 'public', 'load') l
            LEFT JOIN postgres_scan('postgres_secret', 'public', 'row') r
                ON l.id = r.load_id
            GROUP BY l.supplier_id, DATE_TRUNC('month', l.month)
        """)
        
        # Verify view exists and has data
        result = duckdb_conn.execute("SELECT * FROM supplier_spending LIMIT 1").fetchone()
        assert result is not None, "View must be created and queryable"
    
    async def test_monthly_aggregation_performance(self, duckdb_conn, pg_connection):
        """Test performance of monthly spending aggregation"""
        # WILL FAIL: Query not optimized
        
        # Setup test data
        await self.setup_test_data(pg_connection)
        
        start_time = time.perf_counter()
        
        # Complex aggregation query
        result = duckdb_conn.execute("""
            WITH monthly_stats AS (
                SELECT 
                    DATE_TRUNC('month', l.month) as month,
                    l.supplier_id,
                    SUM(r.amount) as total_amount,
                    COUNT(DISTINCT r.invoice_number) as invoice_count,
                    AVG(r.amount) as avg_amount,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.amount) as median_amount,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY r.amount) as p95_amount
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                GROUP BY DATE_TRUNC('month', l.month), l.supplier_id
            ),
            supplier_rankings AS (
                SELECT 
                    month,
                    supplier_id,
                    total_amount,
                    RANK() OVER (PARTITION BY month ORDER BY total_amount DESC) as spending_rank,
                    total_amount - LAG(total_amount) OVER (PARTITION BY supplier_id ORDER BY month) as month_over_month_change,
                    100.0 * (total_amount - LAG(total_amount) OVER (PARTITION BY supplier_id ORDER BY month)) / 
                        NULLIF(LAG(total_amount) OVER (PARTITION BY supplier_id ORDER BY month), 0) as mom_change_pct
                FROM monthly_stats
            )
            SELECT * FROM supplier_rankings
            ORDER BY month DESC, spending_rank
        """).fetchall()
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 1000, f"Monthly aggregation must complete in < 1s, took {elapsed:.2f}ms"
        assert len(result) > 0, "Must return aggregated results"
    
    def test_category_analysis_performance(self, duckdb_conn):
        """Test performance of category-based analysis"""
        # WILL FAIL: Category analysis not implemented
        
        start_time = time.perf_counter()
        
        result = duckdb_conn.execute("""
            WITH category_stats AS (
                SELECT 
                    r.category,
                    DATE_TRUNC('quarter', l.month) as quarter,
                    COUNT(*) as transaction_count,
                    SUM(r.amount) as total_amount,
                    AVG(r.amount) as avg_amount,
                    STDDEV(r.amount) as stddev_amount,
                    MIN(r.amount) as min_amount,
                    MAX(r.amount) as max_amount
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                GROUP BY r.category, DATE_TRUNC('quarter', l.month)
            ),
            category_trends AS (
                SELECT 
                    category,
                    quarter,
                    total_amount,
                    LAG(total_amount, 4) OVER (PARTITION BY category ORDER BY quarter) as same_quarter_last_year,
                    100.0 * (total_amount - LAG(total_amount, 4) OVER (PARTITION BY category ORDER BY quarter)) / 
                        NULLIF(LAG(total_amount, 4) OVER (PARTITION BY category ORDER BY quarter), 0) as yoy_growth
                FROM category_stats
            )
            SELECT * FROM category_trends
            WHERE quarter >= '2024-01-01'
            ORDER BY category, quarter
        """).fetchall()
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 500, f"Category analysis must complete in < 500ms, took {elapsed:.2f}ms"
    
    def test_anomaly_detection_query(self, duckdb_conn):
        """Test statistical anomaly detection queries"""
        # WILL FAIL: Anomaly detection not implemented
        
        start_time = time.perf_counter()
        
        # Z-score based anomaly detection
        result = duckdb_conn.execute("""
            WITH supplier_baseline AS (
                SELECT 
                    l.supplier_id,
                    AVG(r.amount) as mean_amount,
                    STDDEV(r.amount) as stddev_amount,
                    COUNT(*) as sample_size
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                WHERE l.month >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY l.supplier_id
                HAVING COUNT(*) >= 30  -- Minimum sample size
            ),
            recent_transactions AS (
                SELECT 
                    l.supplier_id,
                    r.invoice_number,
                    r.amount,
                    l.month
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                WHERE l.month >= CURRENT_DATE - INTERVAL '1 month'
            ),
            anomalies AS (
                SELECT 
                    rt.supplier_id,
                    rt.invoice_number,
                    rt.amount,
                    sb.mean_amount,
                    sb.stddev_amount,
                    (rt.amount - sb.mean_amount) / NULLIF(sb.stddev_amount, 0) as z_score,
                    CASE 
                        WHEN ABS((rt.amount - sb.mean_amount) / NULLIF(sb.stddev_amount, 0)) > 3 THEN 'HIGH'
                        WHEN ABS((rt.amount - sb.mean_amount) / NULLIF(sb.stddev_amount, 0)) > 2 THEN 'MEDIUM'
                        ELSE 'LOW'
                    END as anomaly_level
                FROM recent_transactions rt
                JOIN supplier_baseline sb ON rt.supplier_id = sb.supplier_id
                WHERE ABS((rt.amount - sb.mean_amount) / NULLIF(sb.stddev_amount, 0)) > 2
            )
            SELECT * FROM anomalies
            ORDER BY ABS(z_score) DESC
            LIMIT 100
        """).fetchall()
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 1000, f"Anomaly detection must complete in < 1s, took {elapsed:.2f}ms"
    
    def test_time_series_analysis(self, duckdb_conn):
        """Test time series analysis capabilities"""
        # WILL FAIL: Time series functions not implemented
        
        # Moving averages and seasonal decomposition
        result = duckdb_conn.execute("""
            WITH daily_aggregates AS (
                SELECT 
                    DATE_TRUNC('day', l.created_at) as day,
                    SUM(r.amount) as daily_total,
                    COUNT(*) as transaction_count
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                GROUP BY DATE_TRUNC('day', l.created_at)
            ),
            time_series AS (
                SELECT 
                    day,
                    daily_total,
                    -- 7-day moving average
                    AVG(daily_total) OVER (
                        ORDER BY day 
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) as ma_7d,
                    -- 30-day moving average
                    AVG(daily_total) OVER (
                        ORDER BY day 
                        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                    ) as ma_30d,
                    -- Year-over-year comparison
                    LAG(daily_total, 365) OVER (ORDER BY day) as same_day_last_year,
                    -- Week-over-week change
                    daily_total - LAG(daily_total, 7) OVER (ORDER BY day) as wow_change
                FROM daily_aggregates
            )
            SELECT 
                day,
                daily_total,
                ma_7d,
                ma_30d,
                same_day_last_year,
                wow_change,
                CASE 
                    WHEN daily_total > ma_30d * 1.5 THEN 'SPIKE'
                    WHEN daily_total < ma_30d * 0.5 THEN 'DIP'
                    ELSE 'NORMAL'
                END as trend_status
            FROM time_series
            WHERE day >= CURRENT_DATE - INTERVAL '90 days'
            ORDER BY day DESC
        """).fetchall()
        
        assert len(result) > 0, "Time series analysis must return results"
    
    def test_pivot_table_generation(self, duckdb_conn):
        """Test pivot table generation for reporting"""
        # WILL FAIL: Pivot functionality not implemented
        
        result = duckdb_conn.execute("""
            PIVOT (
                SELECT 
                    l.supplier_id,
                    DATE_TRUNC('month', l.month) as month,
                    SUM(r.amount) as total
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                WHERE l.month >= '2024-01-01'
                GROUP BY l.supplier_id, DATE_TRUNC('month', l.month)
            )
            ON month
            USING SUM(total)
            GROUP BY supplier_id
            ORDER BY supplier_id
        """).fetchall()
        
        assert len(result) > 0, "Pivot table must be generated"
        
        # Verify pivot structure
        columns = duckdb_conn.execute("DESCRIBE SELECT * FROM last_query_result").fetchall()
        month_columns = [col for col in columns if '2024' in str(col)]
        assert len(month_columns) >= 12, "Should have column for each month"
    
    def test_window_functions_performance(self, duckdb_conn):
        """Test complex window functions performance"""
        # WILL FAIL: Window functions not optimized
        
        start_time = time.perf_counter()
        
        result = duckdb_conn.execute("""
            WITH ranked_invoices AS (
                SELECT 
                    l.supplier_id,
                    r.invoice_number,
                    r.amount,
                    r.category,
                    l.month,
                    -- Ranking within supplier
                    ROW_NUMBER() OVER (PARTITION BY l.supplier_id ORDER BY r.amount DESC) as amount_rank,
                    DENSE_RANK() OVER (PARTITION BY l.supplier_id ORDER BY r.amount DESC) as amount_dense_rank,
                    PERCENT_RANK() OVER (PARTITION BY l.supplier_id ORDER BY r.amount) as amount_percentile,
                    -- Cumulative statistics
                    SUM(r.amount) OVER (PARTITION BY l.supplier_id ORDER BY l.month, r.invoice_number) as running_total,
                    AVG(r.amount) OVER (PARTITION BY l.supplier_id ORDER BY l.month ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as moving_avg,
                    -- Lead/Lag analysis
                    LEAD(r.amount, 1) OVER (PARTITION BY l.supplier_id ORDER BY r.invoice_number) as next_amount,
                    LAG(r.amount, 1) OVER (PARTITION BY l.supplier_id ORDER BY r.invoice_number) as prev_amount,
                    -- First/Last values
                    FIRST_VALUE(r.amount) OVER (PARTITION BY l.supplier_id, DATE_TRUNC('month', l.month) ORDER BY r.amount DESC) as month_max,
                    LAST_VALUE(r.amount) OVER (PARTITION BY l.supplier_id, DATE_TRUNC('month', l.month) ORDER BY r.amount DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as month_min
                FROM postgres_scan('postgres_secret', 'public', 'load') l
                JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
            )
            SELECT * FROM ranked_invoices
            WHERE amount_rank <= 10
            ORDER BY supplier_id, amount_rank
        """).fetchall()
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 1000, f"Window functions must complete in < 1s, took {elapsed:.2f}ms"
    
    def test_parquet_export_performance(self, duckdb_conn):
        """Test export to Parquet for data lake integration"""
        # WILL FAIL: Parquet export not implemented
        
        import tempfile
        import os
        
        with tempfile.TemporaryDirectory() as tmpdir:
            parquet_path = os.path.join(tmpdir, "analytics_export.parquet")
            
            start_time = time.perf_counter()
            
            # Export analytical dataset to Parquet
            duckdb_conn.execute(f"""
                COPY (
                    SELECT 
                        l.*,
                        r.*,
                        f.finding_type,
                        f.description as finding_description
                    FROM postgres_scan('postgres_secret', 'public', 'load') l
                    LEFT JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
                    LEFT JOIN postgres_scan('postgres_secret', 'public', 'finding') f ON r.id = f.row_id
                ) TO '{parquet_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
            """)
            
            elapsed = (time.perf_counter() - start_time) * 1000
            
            assert elapsed < 5000, f"Parquet export must complete in < 5s, took {elapsed:.2f}ms"
            assert os.path.exists(parquet_path), "Parquet file must be created"
            
            # Verify Parquet file can be read back
            df = pd.read_parquet(parquet_path)
            assert len(df) > 0, "Parquet file must contain data"
            assert 'supplier_id' in df.columns, "Must preserve column names"


class TestDuckDBPostgreSQLSync:
    """Test synchronization between DuckDB and PostgreSQL"""
    
    async def test_real_time_sync(self, duckdb_conn, pg_connection):
        """Test near real-time sync from PostgreSQL to DuckDB"""
        # WILL FAIL: Sync mechanism not implemented
        
        # Insert data in PostgreSQL
        await pg_connection.execute("""
            INSERT INTO load (supplier_id, month, file_path)
            VALUES ('TEST_SYNC_001', '2024-01-01', '/test/sync.csv')
        """)
        
        # Wait briefly for sync (should be automatic or triggered)
        await asyncio.sleep(0.1)
        
        # Query from DuckDB
        result = duckdb_conn.execute("""
            SELECT supplier_id 
            FROM postgres_scan('postgres_secret', 'public', 'load')
            WHERE supplier_id = 'TEST_SYNC_001'
        """).fetchone()
        
        assert result is not None, "New data must be visible in DuckDB"
        assert result[0] == 'TEST_SYNC_001'
    
    def test_materialized_view_refresh(self, duckdb_conn):
        """Test materialized view refresh strategy"""
        # WILL FAIL: Materialized views not implemented
        
        # Create materialized view
        duckdb_conn.execute("""
            CREATE MATERIALIZED VIEW supplier_summary AS
            SELECT 
                l.supplier_id,
                COUNT(DISTINCT l.id) as total_loads,
                COUNT(DISTINCT r.invoice_number) as total_invoices,
                SUM(r.amount) as total_amount,
                MIN(l.month) as first_month,
                MAX(l.month) as last_month
            FROM postgres_scan('postgres_secret', 'public', 'load') l
            LEFT JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
            GROUP BY l.supplier_id
        """)
        
        # Get initial count
        initial_result = duckdb_conn.execute("SELECT COUNT(*) FROM supplier_summary").fetchone()
        
        # Refresh view
        duckdb_conn.execute("REFRESH MATERIALIZED VIEW supplier_summary")
        
        # Verify refresh completed
        final_result = duckdb_conn.execute("SELECT COUNT(*) FROM supplier_summary").fetchone()
        assert final_result is not None, "Materialized view must be refreshed"
    
    async def test_transaction_consistency(self, duckdb_conn, pg_connection):
        """Test transactional consistency between databases"""
        # WILL FAIL: Transaction coordination not implemented
        
        # Start PostgreSQL transaction
        async with pg_connection.transaction():
            # Insert in PostgreSQL
            load_id = await pg_connection.fetchval("""
                INSERT INTO load (supplier_id, month, file_path)
                VALUES ('TXN_TEST_001', '2024-01-01', '/test/txn.csv')
                RETURNING id
            """)
            
            # This should NOT be visible in DuckDB yet
            result = duckdb_conn.execute("""
                SELECT COUNT(*) 
                FROM postgres_scan('postgres_secret', 'public', 'load')
                WHERE supplier_id = 'TXN_TEST_001'
            """).fetchone()
            
            assert result[0] == 0, "Uncommitted data should not be visible"
            
            # Commit will happen automatically when exiting context
        
        # Now it should be visible
        result = duckdb_conn.execute("""
            SELECT COUNT(*) 
            FROM postgres_scan('postgres_secret', 'public', 'load')
            WHERE supplier_id = 'TXN_TEST_001'
        """).fetchone()
        
        assert result[0] == 1, "Committed data must be visible"


class TestAnalyticsOptimization:
    """Test query optimization and performance tuning"""
    
    def test_query_plan_optimization(self, duckdb_conn):
        """Test that queries use optimal execution plans"""
        # WILL FAIL: Query optimization not configured
        
        # Get execution plan
        plan = duckdb_conn.execute("""
            EXPLAIN ANALYZE
            SELECT 
                l.supplier_id,
                SUM(r.amount) as total
            FROM postgres_scan('postgres_secret', 'public', 'load') l
            JOIN postgres_scan('postgres_secret', 'public', 'row') r ON l.id = r.load_id
            WHERE l.month >= '2024-01-01'
            GROUP BY l.supplier_id
        """).fetchall()
        
        plan_text = str(plan)
        
        # Verify optimization strategies
        assert 'HASH JOIN' in plan_text or 'MERGE JOIN' in plan_text, "Should use efficient join"
        assert 'Filter' in plan_text, "Should push down filters"
        assert 'HASH GROUP BY' in plan_text, "Should use hash aggregation"
    
    def test_partition_pruning(self, duckdb_conn):
        """Test partition pruning for time-based queries"""
        # WILL FAIL: Partitioning not implemented
        
        # Query with date filter should prune partitions
        plan = duckdb_conn.execute("""
            EXPLAIN
            SELECT COUNT(*)
            FROM postgres_scan('postgres_secret', 'public', 'load')
            WHERE month >= '2024-06-01' AND month < '2024-07-01'
        """).fetchall()
        
        plan_text = str(plan)
        assert 'Partition Pruning' in plan_text or 'Filter Pushdown' in plan_text
    
    def test_columnar_storage_benefits(self, duckdb_conn):
        """Test columnar storage performance benefits"""
        # WILL FAIL: Columnar optimization not verified
        
        # Create columnar table
        duckdb_conn.execute("""
            CREATE TABLE analytics_cache AS
            SELECT * FROM postgres_scan('postgres_secret', 'public', 'row')
        """)
        
        # Compare performance: columnar vs row-based
        start_columnar = time.perf_counter()
        duckdb_conn.execute("""
            SELECT category, SUM(amount), AVG(amount)
            FROM analytics_cache
            GROUP BY category
        """).fetchall()
        columnar_time = time.perf_counter() - start_columnar
        
        start_row = time.perf_counter()
        duckdb_conn.execute("""
            SELECT category, SUM(amount), AVG(amount)
            FROM postgres_scan('postgres_secret', 'public', 'row')
            GROUP BY category
        """).fetchall()
        row_time = time.perf_counter() - start_row
        
        # Columnar should be faster for analytical queries
        assert columnar_time < row_time * 0.5, "Columnar storage should be at least 2x faster"