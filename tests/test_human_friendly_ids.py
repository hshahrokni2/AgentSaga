"""
Test Human-Friendly ID Generation System
========================================
Tests for generating and managing human-readable IDs with patterns:
- INS-YYYY-MM-NNN for insights
- SCN-YYYY-MM-NNN for scenarios

These tests follow TDD principles - defining ID requirements before implementation.
"""

import pytest
import asyncio
import re
from datetime import datetime, timedelta
from typing import List, Set, Optional
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from concurrent.futures import ThreadPoolExecutor
import threading


class TestHumanFriendlyIDGeneration:
    """Test human-friendly ID generation with date-based patterns"""
    
    @pytest.fixture
    async def db_connection(self):
        """Create database connection for testing"""
        # WILL FAIL: Database not setup
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            database='svoa_test',
            user='test_user',
            password='test_pass'
        )
        yield conn
        await conn.close()
    
    @pytest.fixture
    async def id_generator(self, db_connection):
        """Get ID generator service"""
        # WILL FAIL: ID generator not implemented
        from app.services.id_generator import HumanFriendlyIDGenerator
        generator = HumanFriendlyIDGenerator(db_connection)
        await generator.initialize()
        return generator
    
    async def test_insight_id_format(self, id_generator):
        """Test that insight IDs follow INS-YYYY-MM-NNN format"""
        # WILL FAIL: ID generation not implemented
        
        # Generate an insight ID
        insight_id = await id_generator.generate_insight_id()
        
        # Verify format: INS-YYYY-MM-NNN
        pattern = r'^INS-\d{4}-\d{2}-\d{3}$'
        assert re.match(pattern, insight_id), f"ID {insight_id} doesn't match INS-YYYY-MM-NNN format"
        
        # Verify components
        parts = insight_id.split('-')
        assert parts[0] == 'INS', "Must start with INS prefix"
        
        year = int(parts[1])
        month = int(parts[2])
        sequence = int(parts[3])
        
        current_date = datetime.now()
        assert year == current_date.year, f"Year should be {current_date.year}, got {year}"
        assert 1 <= month <= 12, f"Month should be 1-12, got {month}"
        assert 1 <= sequence <= 999, f"Sequence should be 1-999, got {sequence}"
    
    async def test_scenario_id_format(self, id_generator):
        """Test that scenario IDs follow SCN-YYYY-MM-NNN format"""
        # WILL FAIL: ID generation not implemented
        
        # Generate a scenario ID
        scenario_id = await id_generator.generate_scenario_id()
        
        # Verify format: SCN-YYYY-MM-NNN
        pattern = r'^SCN-\d{4}-\d{2}-\d{3}$'
        assert re.match(pattern, scenario_id), f"ID {scenario_id} doesn't match SCN-YYYY-MM-NNN format"
        
        # Verify components
        parts = scenario_id.split('-')
        assert parts[0] == 'SCN', "Must start with SCN prefix"
        
        year = int(parts[1])
        month = int(parts[2])
        sequence = int(parts[3])
        
        current_date = datetime.now()
        assert year == current_date.year, f"Year should be {current_date.year}"
        assert month == current_date.month, f"Month should be {current_date.month}"
        assert 1 <= sequence <= 999, f"Sequence should be 1-999"
    
    async def test_id_sequence_increment(self, id_generator):
        """Test that IDs increment sequentially within the same month"""
        # WILL FAIL: Sequence management not implemented
        
        # Generate multiple insight IDs
        ids = []
        for _ in range(5):
            id = await id_generator.generate_insight_id()
            ids.append(id)
        
        # Extract sequence numbers
        sequences = [int(id.split('-')[3]) for id in ids]
        
        # Verify sequential increment
        for i in range(1, len(sequences)):
            assert sequences[i] == sequences[i-1] + 1, f"Sequences should increment: {sequences}"
    
    async def test_id_uniqueness(self, id_generator):
        """Test that generated IDs are always unique"""
        # WILL FAIL: Uniqueness not guaranteed
        
        # Generate many IDs rapidly
        ids = set()
        for _ in range(100):
            id = await id_generator.generate_insight_id()
            assert id not in ids, f"Duplicate ID generated: {id}"
            ids.add(id)
        
        assert len(ids) == 100, "All IDs must be unique"
    
    async def test_concurrent_id_generation(self, id_generator):
        """Test ID generation under concurrent access"""
        # WILL FAIL: Concurrency control not implemented
        
        async def generate_ids(count: int) -> Set[str]:
            ids = set()
            for _ in range(count):
                id = await id_generator.generate_insight_id()
                ids.add(id)
            return ids
        
        # Generate IDs concurrently
        tasks = [generate_ids(20) for _ in range(5)]  # 5 tasks, 20 IDs each
        results = await asyncio.gather(*tasks)
        
        # Combine all IDs
        all_ids = set()
        for id_set in results:
            # Check for duplicates between tasks
            duplicates = all_ids.intersection(id_set)
            assert len(duplicates) == 0, f"Duplicate IDs across tasks: {duplicates}"
            all_ids.update(id_set)
        
        assert len(all_ids) == 100, "Must generate 100 unique IDs"
        
        # Verify all IDs are properly formatted
        for id in all_ids:
            assert re.match(r'^INS-\d{4}-\d{2}-\d{3}$', id)
    
    async def test_month_rollover(self, id_generator, db_connection):
        """Test that sequence resets when month changes"""
        # WILL FAIL: Month rollover not handled
        
        # Mock current date to end of month
        from unittest.mock import patch
        
        with patch('app.services.id_generator.datetime') as mock_datetime:
            # Set to end of January
            mock_datetime.now.return_value = datetime(2024, 1, 31)
            
            # Generate ID for January
            jan_id = await id_generator.generate_insight_id()
            assert jan_id.startswith('INS-2024-01-'), f"Should be January: {jan_id}"
            
            # Move to February
            mock_datetime.now.return_value = datetime(2024, 2, 1)
            
            # Generate ID for February
            feb_id = await id_generator.generate_insight_id()
            assert feb_id.startswith('INS-2024-02-'), f"Should be February: {feb_id}"
            
            # February sequence should start at 001
            assert feb_id.endswith('-001'), f"February should start at 001: {feb_id}"
    
    async def test_year_rollover(self, id_generator):
        """Test that sequence resets when year changes"""
        # WILL FAIL: Year rollover not handled
        
        from unittest.mock import patch
        
        with patch('app.services.id_generator.datetime') as mock_datetime:
            # Set to end of year
            mock_datetime.now.return_value = datetime(2023, 12, 31)
            
            # Generate ID for December 2023
            dec_id = await id_generator.generate_insight_id()
            assert dec_id.startswith('INS-2023-12-'), f"Should be Dec 2023: {dec_id}"
            
            # Move to January 2024
            mock_datetime.now.return_value = datetime(2024, 1, 1)
            
            # Generate ID for January 2024
            jan_id = await id_generator.generate_insight_id()
            assert jan_id.startswith('INS-2024-01-'), f"Should be Jan 2024: {jan_id}"
            assert jan_id.endswith('-001'), f"January should start at 001: {jan_id}"
    
    async def test_id_persistence(self, id_generator, db_connection):
        """Test that generated IDs are persisted correctly"""
        # WILL FAIL: Persistence not implemented
        
        # Generate an insight ID
        insight_id = await id_generator.generate_insight_id()
        
        # Verify it's recorded in database
        result = await db_connection.fetchrow("""
            SELECT * FROM id_sequences
            WHERE prefix = 'INS'
            AND year = EXTRACT(YEAR FROM CURRENT_DATE)
            AND month = EXTRACT(MONTH FROM CURRENT_DATE)
        """)
        
        assert result is not None, "Sequence record must exist"
        assert result['last_sequence'] > 0, "Sequence must be recorded"
        
        # Verify the ID can be looked up
        exists = await db_connection.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM generated_ids
                WHERE id = $1
            )
        """, insight_id)
        
        assert exists, f"Generated ID {insight_id} must be recorded"
    
    async def test_custom_prefix_support(self, id_generator):
        """Test support for custom ID prefixes"""
        # WILL FAIL: Custom prefixes not supported
        
        # Generate with custom prefix
        custom_id = await id_generator.generate_id(prefix='RPT')  # Report ID
        
        assert custom_id.startswith('RPT-'), f"Should start with RPT: {custom_id}"
        assert re.match(r'^RPT-\d{4}-\d{2}-\d{3}$', custom_id)
    
    async def test_id_validation(self, id_generator):
        """Test ID format validation"""
        # WILL FAIL: Validation not implemented
        
        # Valid IDs
        valid_ids = [
            'INS-2024-01-001',
            'INS-2024-12-999',
            'SCN-2023-06-042',
        ]
        
        for id in valid_ids:
            assert await id_generator.validate_id(id), f"{id} should be valid"
        
        # Invalid IDs
        invalid_ids = [
            'INS-2024-13-001',  # Invalid month
            'INS-2024-01-1000',  # Sequence too large
            'INS-2024-01-000',   # Zero sequence
            'INS-24-01-001',     # Wrong year format
            'INS-2024-1-001',    # Wrong month format
            'INS-2024-01-01',    # Wrong sequence format
            'ABC-2024-01-001',   # Unknown prefix
            'INS_2024_01_001',   # Wrong separator
        ]
        
        for id in invalid_ids:
            assert not await id_generator.validate_id(id), f"{id} should be invalid"
    
    async def test_sequence_gap_handling(self, id_generator, db_connection):
        """Test that system handles gaps in sequence numbers"""
        # WILL FAIL: Gap handling not implemented
        
        # Manually insert a gap
        await db_connection.execute("""
            INSERT INTO id_sequences (prefix, year, month, last_sequence)
            VALUES ('INS', 2024, 1, 10)
            ON CONFLICT (prefix, year, month) 
            DO UPDATE SET last_sequence = 10
        """)
        
        # Generate next ID
        id = await id_generator.generate_insight_id()
        
        # Should continue from 11, not restart
        assert id.endswith('-011'), f"Should continue sequence after gap: {id}"
    
    async def test_id_recovery_after_failure(self, id_generator, db_connection):
        """Test ID generation recovery after database failure"""
        # WILL FAIL: Recovery mechanism not implemented
        
        # Simulate partial failure during ID generation
        with pytest.raises(Exception):
            with patch.object(db_connection, 'execute', side_effect=Exception("DB Error")):
                await id_generator.generate_insight_id()
        
        # System should recover and generate valid ID
        recovered_id = await id_generator.generate_insight_id()
        assert re.match(r'^INS-\d{4}-\d{2}-\d{3}$', recovered_id)
        
        # Verify no duplicates were created
        count = await db_connection.fetchval("""
            SELECT COUNT(DISTINCT id) 
            FROM generated_ids
            WHERE id LIKE 'INS-%'
        """)
        
        unique_count = await db_connection.fetchval("""
            SELECT COUNT(id) 
            FROM generated_ids
            WHERE id LIKE 'INS-%'
        """)
        
        assert count == unique_count, "No duplicate IDs after recovery"


class TestIDQueryPerformance:
    """Test performance of ID-based queries"""
    
    async def test_id_lookup_performance(self, db_connection):
        """Test that human-friendly ID lookups are fast"""
        # WILL FAIL: Indexes not created
        
        import time
        
        # Insert test data
        for i in range(1000):
            await db_connection.execute("""
                INSERT INTO insight (id, insight_id, title, description)
                VALUES (gen_random_uuid(), $1, $2, $3)
            """, f"INS-2024-01-{i:03d}", f"Test Insight {i}", f"Description {i}")
        
        # Test lookup performance
        start_time = time.perf_counter()
        
        result = await db_connection.fetchrow("""
            SELECT * FROM insight
            WHERE insight_id = $1
        """, "INS-2024-01-500")
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert result is not None, "Must find the record"
        assert elapsed < 10, f"ID lookup must complete in < 10ms, took {elapsed:.2f}ms"
    
    async def test_id_range_query_performance(self, db_connection):
        """Test performance of range queries on human-friendly IDs"""
        # WILL FAIL: Range queries not optimized
        
        import time
        
        start_time = time.perf_counter()
        
        # Query for all January 2024 insights
        results = await db_connection.fetch("""
            SELECT insight_id, title
            FROM insight
            WHERE insight_id LIKE 'INS-2024-01-%'
            ORDER BY insight_id
        """)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 50, f"Range query must complete in < 50ms, took {elapsed:.2f}ms"
        assert len(results) > 0, "Must return results"
        
        # Verify ordering
        for i in range(1, len(results)):
            assert results[i]['insight_id'] > results[i-1]['insight_id'], "Results must be ordered"
    
    async def test_id_prefix_index(self, db_connection):
        """Test that prefix-based indexes exist and are used"""
        # WILL FAIL: Prefix indexes not created
        
        # Check for prefix index
        index_exists = await db_connection.fetchval("""
            SELECT EXISTS(
                SELECT 1 
                FROM pg_indexes 
                WHERE tablename = 'insight' 
                AND indexdef LIKE '%insight_id%pattern%'
            )
        """)
        
        assert index_exists, "Prefix index must exist for pattern matching"
        
        # Verify index is used in query plan
        plan = await db_connection.fetch("""
            EXPLAIN (FORMAT JSON)
            SELECT * FROM insight
            WHERE insight_id LIKE 'INS-2024-%'
        """)
        
        plan_json = plan[0]['QUERY PLAN'][0]
        assert 'Index Scan' in str(plan_json) or 'Bitmap Index Scan' in str(plan_json), "Must use index"


class TestIDBusinessRules:
    """Test business rules for human-friendly IDs"""
    
    async def test_id_immutability(self, db_connection):
        """Test that IDs cannot be changed once assigned"""
        # WILL FAIL: Immutability not enforced
        
        # Insert a record
        await db_connection.execute("""
            INSERT INTO insight (id, insight_id, title, description)
            VALUES (gen_random_uuid(), 'INS-2024-01-001', 'Test', 'Test insight')
        """)
        
        # Try to update the ID
        with pytest.raises(Exception) as exc_info:
            await db_connection.execute("""
                UPDATE insight 
                SET insight_id = 'INS-2024-01-002'
                WHERE insight_id = 'INS-2024-01-001'
            """)
        
        assert 'immutable' in str(exc_info.value).lower() or 'cannot update' in str(exc_info.value).lower()
    
    async def test_id_format_constraint(self, db_connection):
        """Test that only properly formatted IDs can be inserted"""
        # WILL FAIL: Format constraint not enforced
        
        # Try to insert with invalid format
        invalid_ids = [
            'INS-24-01-001',     # Wrong year format
            'INS-2024-13-001',   # Invalid month
            'INS-2024-01-0001',  # Wrong sequence format
            'INVALID-ID',        # Completely wrong format
        ]
        
        for invalid_id in invalid_ids:
            with pytest.raises(Exception) as exc_info:
                await db_connection.execute("""
                    INSERT INTO insight (id, insight_id, title, description)
                    VALUES (gen_random_uuid(), $1, 'Test', 'Test')
                """, invalid_id)
            
            assert 'constraint' in str(exc_info.value).lower() or 'invalid' in str(exc_info.value).lower()
    
    async def test_id_case_sensitivity(self, db_connection):
        """Test that ID prefixes are case-sensitive"""
        # WILL FAIL: Case sensitivity not enforced
        
        # Lowercase prefix should fail
        with pytest.raises(Exception):
            await db_connection.execute("""
                INSERT INTO insight (id, insight_id, title, description)
                VALUES (gen_random_uuid(), 'ins-2024-01-001', 'Test', 'Test')
            """)
        
        # Mixed case should fail
        with pytest.raises(Exception):
            await db_connection.execute("""
                INSERT INTO insight (id, insight_id, title, description)
                VALUES (gen_random_uuid(), 'Ins-2024-01-001', 'Test', 'Test')
            """)
    
    async def test_id_reserved_sequences(self, db_connection):
        """Test that certain sequence numbers can be reserved"""
        # WILL FAIL: Reservation system not implemented
        
        from app.services.id_generator import HumanFriendlyIDGenerator
        generator = HumanFriendlyIDGenerator(db_connection)
        
        # Reserve sequence numbers 100-110
        await generator.reserve_sequence_range('INS', 2024, 1, 100, 110)
        
        # Generate IDs - should skip reserved range
        ids = []
        for _ in range(5):
            id = await generator.generate_insight_id()
            ids.append(id)
        
        # Extract sequence numbers
        sequences = [int(id.split('-')[3]) for id in ids]
        
        # Verify none are in reserved range
        for seq in sequences:
            assert seq < 100 or seq > 110, f"Sequence {seq} should not be in reserved range"
    
    async def test_id_audit_trail(self, db_connection):
        """Test that ID generation creates audit trail"""
        # WILL FAIL: Audit trail not implemented
        
        from app.services.id_generator import HumanFriendlyIDGenerator
        generator = HumanFriendlyIDGenerator(db_connection)
        
        # Generate an ID
        id = await generator.generate_insight_id()
        
        # Check audit log
        audit_record = await db_connection.fetchrow("""
            SELECT * FROM id_generation_audit
            WHERE generated_id = $1
        """, id)
        
        assert audit_record is not None, "Audit record must exist"
        assert audit_record['generated_at'] is not None
        assert audit_record['generated_by'] is not None
        assert audit_record['entity_type'] == 'insight'