"""
Test PGVector Embedding and Similarity Search Performance
=========================================================
Performance tests for vector embeddings, similarity search, and RAG queries.
All queries must complete within specified time constraints.

These tests follow TDD principles - defining performance requirements before implementation.
"""

import pytest
import asyncio
import time
import numpy as np
from datetime import datetime
from typing import List, Tuple, Dict, Any
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from pgvector.asyncpg import register_vector
import openai
from sentence_transformers import SentenceTransformer


class TestPgVectorPerformance:
    """Test pgvector performance for embeddings and similarity search"""
    
    @pytest.fixture
    async def db_connection(self):
        """Create direct asyncpg connection for performance testing"""
        # WILL FAIL: Database not configured
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            database='svoa_test',
            user='test_user',
            password='test_pass'
        )
        await register_vector(conn)
        yield conn
        await conn.close()
    
    @pytest.fixture
    def embedding_model(self):
        """Load embedding model for testing"""
        # WILL FAIL: Model not configured
        # Using Swedish BERT model for better Swedish text understanding
        model = SentenceTransformer('KBLab/sentence-bert-swedish-cased')
        return model
    
    @pytest.fixture
    async def sample_embeddings(self, embedding_model) -> List[Tuple[str, List[float]]]:
        """Generate sample embeddings for testing"""
        texts = [
            "Leverantör Åkerlund har överskridit budget med 15%",
            "Örebro kommun visar ovanligt höga kostnader för städtjänster",
            "Fakturaverifikation saknas för belopp över 100,000 SEK",
            "Momsavdrag felaktigt tillämpat på exempt tjänster",
            "Återkommande dubbletter i leverantörsfakturor från Skåne",
            "Avtalspriser följs inte för ramavtalsleverantörer",
            "Betalningsvillkor 30 dagar överskrids systematiskt",
            "Kostnadsställe saknas för 20% av fakturorna",
            "Felaktig kontering av investeringskostnader",
            "Prisjusteringar utan godkännande från inköpsavdelningen"
        ]
        
        embeddings = embedding_model.encode(texts).tolist()
        return list(zip(texts, embeddings))
    
    async def test_embedding_insertion_performance(self, db_connection, sample_embeddings):
        """Test performance of inserting embeddings into database"""
        # WILL FAIL: Table and indexes not optimized
        
        # Prepare batch insert
        records = []
        for i, (text, embedding) in enumerate(sample_embeddings * 100):  # 1000 records
            records.append((
                f"FIND-2024-01-{i:04d}",
                text,
                embedding,
                datetime.now()
            ))
        
        start_time = time.perf_counter()
        
        # Batch insert with COPY for performance
        await db_connection.executemany("""
            INSERT INTO finding (id, finding_type, description, embedding, created_at)
            VALUES (gen_random_uuid(), 'anomaly', $1, $2, $3)
        """, [(r[1], r[2], r[3]) for r in records])
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 1000, f"Batch insert of 1000 embeddings must complete in < 1s, took {elapsed:.2f}ms"
        
        # Test single insert performance
        single_start = time.perf_counter()
        await db_connection.execute("""
            INSERT INTO finding (id, finding_type, description, embedding, created_at)
            VALUES (gen_random_uuid(), 'anomaly', $1, $2, $3)
        """, sample_embeddings[0][0], sample_embeddings[0][1], datetime.now())
        
        single_elapsed = (time.perf_counter() - single_start) * 1000
        assert single_elapsed < 10, f"Single embedding insert must complete in < 10ms, took {single_elapsed:.2f}ms"
    
    async def test_similarity_search_performance(self, db_connection, sample_embeddings):
        """Test vector similarity search performance with HNSW index"""
        # WILL FAIL: HNSW index not configured properly
        
        # Insert test data
        for text, embedding in sample_embeddings * 100:  # 1000 embeddings
            await db_connection.execute("""
                INSERT INTO finding (id, finding_type, description, embedding)
                VALUES (gen_random_uuid(), 'anomaly', $1, $2::vector)
            """, text, embedding)
        
        # Test similarity search performance
        query_embedding = sample_embeddings[0][1]
        
        start_time = time.perf_counter()
        
        # Cosine similarity search - should use HNSW index
        results = await db_connection.fetch("""
            SELECT description, embedding <=> $1::vector AS distance
            FROM finding
            ORDER BY embedding <=> $1::vector
            LIMIT 10
        """, query_embedding)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 100, f"Similarity search must complete in < 100ms, took {elapsed:.2f}ms"
        assert len(results) == 10, "Must return exactly 10 results"
        assert results[0]['distance'] < 0.01, "Top result should be very similar (distance < 0.01)"
    
    async def test_filtered_similarity_search_performance(self, db_connection, sample_embeddings):
        """Test performance of similarity search with filters"""
        # WILL FAIL: Composite indexes not optimized
        
        # Insert test data with metadata
        for i, (text, embedding) in enumerate(sample_embeddings * 100):
            await db_connection.execute("""
                INSERT INTO finding (id, finding_type, description, embedding, created_at, metadata)
                VALUES (gen_random_uuid(), $1, $2, $3::vector, $4, $5)
            """, 
                'anomaly' if i % 2 == 0 else 'compliance',
                text,
                embedding,
                datetime(2024, 1 + (i % 3), 1 + (i % 28)),
                {'supplier_id': f'SUP{i % 20:03d}', 'amount': 1000 * (i % 100)}
            )
        
        query_embedding = sample_embeddings[0][1]
        
        start_time = time.perf_counter()
        
        # Filtered similarity search
        results = await db_connection.fetch("""
            SELECT description, embedding <=> $1::vector AS distance
            FROM finding
            WHERE finding_type = 'anomaly'
            AND created_at >= '2024-01-01'
            AND created_at < '2024-02-01'
            AND (metadata->>'amount')::numeric > 50000
            ORDER BY embedding <=> $1::vector
            LIMIT 10
        """, query_embedding)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 150, f"Filtered similarity search must complete in < 150ms, took {elapsed:.2f}ms"
        assert len(results) > 0, "Must return results matching filters"
    
    async def test_multi_vector_search_performance(self, db_connection, sample_embeddings):
        """Test performance of searching across multiple tables with embeddings"""
        # WILL FAIL: Cross-table vector search not optimized
        
        # Insert findings
        for text, embedding in sample_embeddings[:500]:
            await db_connection.execute("""
                INSERT INTO finding (id, finding_type, description, embedding)
                VALUES (gen_random_uuid(), 'anomaly', $1, $2::vector)
            """, text, embedding)
        
        # Insert insights
        for text, embedding in sample_embeddings[:500]:
            await db_connection.execute("""
                INSERT INTO insight (id, insight_id, title, description, embedding)
                VALUES (gen_random_uuid(), $1, $2, $3, $4::vector)
            """, 
                f"INS-2024-01-{np.random.randint(1, 999):03d}",
                text[:50],  # Title from first 50 chars
                text,
                embedding
            )
        
        query_embedding = sample_embeddings[0][1]
        
        start_time = time.perf_counter()
        
        # Union search across both tables
        results = await db_connection.fetch("""
            WITH combined_search AS (
                SELECT 'finding' as source, description, embedding <=> $1::vector AS distance
                FROM finding
                WHERE embedding <=> $1::vector < 0.5
                UNION ALL
                SELECT 'insight' as source, description, embedding <=> $1::vector AS distance
                FROM insight
                WHERE embedding <=> $1::vector < 0.5
            )
            SELECT * FROM combined_search
            ORDER BY distance
            LIMIT 20
        """, query_embedding)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 200, f"Multi-table vector search must complete in < 200ms, took {elapsed:.2f}ms"
        assert len(results) <= 20, "Must respect limit"
        assert 'finding' in [r['source'] for r in results], "Should have findings in results"
        assert 'insight' in [r['source'] for r in results], "Should have insights in results"
    
    async def test_rag_context_retrieval_performance(self, db_connection, embedding_model):
        """Test RAG context retrieval performance for LLM queries"""
        # WILL FAIL: RAG pipeline not optimized
        
        # Simulate a typical RAG query
        user_query = "Vilka leverantörer har problem med faktureringsfel?"
        query_embedding = embedding_model.encode([user_query])[0].tolist()
        
        start_time = time.perf_counter()
        
        # Step 1: Vector search for relevant findings
        findings = await db_connection.fetch("""
            SELECT 
                f.id,
                f.description,
                f.embedding <=> $1::vector AS distance,
                r.invoice_number,
                r.amount,
                l.supplier_id
            FROM finding f
            JOIN row r ON f.row_id = r.id
            JOIN load l ON r.load_id = l.id
            WHERE f.embedding <=> $1::vector < 0.7
            ORDER BY f.embedding <=> $1::vector
            LIMIT 20
        """, query_embedding)
        
        # Step 2: Get related insights
        finding_ids = [f['id'] for f in findings]
        insights = await db_connection.fetch("""
            SELECT DISTINCT i.*
            FROM insight i
            WHERE i.embedding <=> $1::vector < 0.5
            OR EXISTS (
                SELECT 1 FROM finding f
                WHERE f.id = ANY($2::uuid[])
                AND i.metadata @> jsonb_build_object('finding_ids', jsonb_build_array(f.id))
            )
            ORDER BY i.embedding <=> $1::vector
            LIMIT 10
        """, query_embedding, finding_ids)
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 100, f"RAG context retrieval must complete in < 100ms, took {elapsed:.2f}ms"
        assert len(findings) > 0, "Must find relevant findings"
        
        # Verify context quality
        context_text = "\n".join([f['description'] for f in findings[:5]])
        assert len(context_text) > 100, "Must have substantial context for LLM"
        assert any('leverantör' in f['description'].lower() for f in findings), "Should find supplier-related content"
    
    async def test_vector_index_size_and_performance(self, db_connection):
        """Test vector index size and performance with large dataset"""
        # WILL FAIL: Index not optimized for scale
        
        # Check index size
        index_info = await db_connection.fetchrow("""
            SELECT 
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                idx.indrelid::regclass AS table_name,
                idx.indisvalid AS is_valid,
                am.amname AS index_type
            FROM pg_index idx
            JOIN pg_class cls ON idx.indexrelid = cls.oid
            JOIN pg_am am ON cls.relam = am.oid
            WHERE idx.indrelid::regclass::text IN ('finding', 'insight')
            AND am.amname = 'hnsw'
        """)
        
        assert index_info is not None, "HNSW index must exist"
        assert index_info['is_valid'], "Index must be valid"
        
        # Test with 10,000 vectors
        dimension = 768  # Swedish BERT dimension
        large_embeddings = [np.random.randn(dimension).tolist() for _ in range(10000)]
        
        # Bulk insert
        start_time = time.perf_counter()
        
        records = [(f"Test finding {i}", emb) for i, emb in enumerate(large_embeddings)]
        await db_connection.executemany("""
            INSERT INTO finding (id, finding_type, description, embedding)
            VALUES (gen_random_uuid(), 'test', $1, $2::vector)
        """, records)
        
        insert_elapsed = (time.perf_counter() - start_time) * 1000
        assert insert_elapsed < 10000, f"Inserting 10k vectors must complete in < 10s, took {insert_elapsed:.2f}ms"
        
        # Test search performance at scale
        query_embedding = large_embeddings[0]
        
        search_start = time.perf_counter()
        results = await db_connection.fetch("""
            SELECT description, embedding <=> $1::vector AS distance
            FROM finding
            ORDER BY embedding <=> $1::vector
            LIMIT 10
        """, query_embedding)
        
        search_elapsed = (time.perf_counter() - search_start) * 1000
        assert search_elapsed < 100, f"Search in 10k vectors must complete in < 100ms, took {search_elapsed:.2f}ms"
    
    async def test_concurrent_vector_operations(self, db_connection, sample_embeddings):
        """Test concurrent vector operations performance"""
        # WILL FAIL: Concurrent access not optimized
        
        async def search_task(query_embedding):
            return await db_connection.fetch("""
                SELECT description, embedding <=> $1::vector AS distance
                FROM finding
                ORDER BY embedding <=> $1::vector
                LIMIT 5
            """, query_embedding)
        
        async def insert_task(text, embedding):
            return await db_connection.execute("""
                INSERT INTO finding (id, finding_type, description, embedding)
                VALUES (gen_random_uuid(), 'concurrent', $1, $2::vector)
            """, text, embedding)
        
        # Create mixed workload
        tasks = []
        for i in range(50):
            if i % 2 == 0:
                # Search task
                tasks.append(search_task(sample_embeddings[i % len(sample_embeddings)][1]))
            else:
                # Insert task
                text, emb = sample_embeddings[i % len(sample_embeddings)]
                tasks.append(insert_task(f"Concurrent {text}", emb))
        
        start_time = time.perf_counter()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = (time.perf_counter() - start_time) * 1000
        
        # Check for errors
        errors = [r for r in results if isinstance(r, Exception)]
        assert len(errors) == 0, f"No operations should fail: {errors}"
        
        # Performance check
        assert elapsed < 2000, f"50 concurrent operations must complete in < 2s, took {elapsed:.2f}ms"
        
        # Average operation time
        avg_time = elapsed / 50
        assert avg_time < 40, f"Average operation time must be < 40ms, was {avg_time:.2f}ms"


class TestEmbeddingQuality:
    """Test embedding quality and semantic search accuracy"""
    
    @pytest.fixture
    def swedish_model(self):
        """Load Swedish-specific embedding model"""
        # WILL FAIL: Model not configured
        return SentenceTransformer('KBLab/sentence-bert-swedish-cased')
    
    async def test_swedish_semantic_similarity(self, swedish_model, db_connection):
        """Test that Swedish semantic similarity works correctly"""
        # WILL FAIL: Swedish embeddings not properly implemented
        
        test_pairs = [
            # Similar meanings in Swedish
            ("faktura betalning försenad", "försenad betalning av faktura", 0.9),
            ("leverantör kostnad ökning", "ökade kostnader från leverantör", 0.85),
            ("moms avdrag fel", "felaktigt momsavdrag", 0.9),
            
            # Different meanings
            ("faktura godkänd", "faktura avvisad", 0.3),
            ("kostnad minskning", "kostnad ökning", 0.4),
        ]
        
        for text1, text2, expected_similarity in test_pairs:
            emb1 = swedish_model.encode([text1])[0].tolist()
            emb2 = swedish_model.encode([text2])[0].tolist()
            
            # Calculate cosine similarity
            result = await db_connection.fetchval("""
                SELECT 1 - ($1::vector <=> $2::vector) as similarity
            """, emb1, emb2)
            
            if expected_similarity > 0.8:
                assert result > 0.8, f"'{text1}' and '{text2}' should be similar (got {result:.2f})"
            else:
                assert result < 0.5, f"'{text1}' and '{text2}' should be different (got {result:.2f})"
    
    async def test_embedding_dimension_consistency(self, db_connection):
        """Test that all embeddings have consistent dimensions"""
        # WILL FAIL: Dimension validation not implemented
        
        result = await db_connection.fetch("""
            SELECT 
                'finding' as table_name,
                vector_dims(embedding) as dimension,
                COUNT(*) as count
            FROM finding
            WHERE embedding IS NOT NULL
            GROUP BY vector_dims(embedding)
            UNION ALL
            SELECT 
                'insight' as table_name,
                vector_dims(embedding) as dimension,
                COUNT(*) as count
            FROM insight
            WHERE embedding IS NOT NULL
            GROUP BY vector_dims(embedding)
        """)
        
        dimensions = {r['dimension'] for r in result}
        assert len(dimensions) == 1, f"All embeddings must have same dimension, found: {dimensions}"
        
        dimension = list(dimensions)[0]
        assert dimension in [768, 1536], f"Dimension must be 768 (Swedish BERT) or 1536 (OpenAI), got {dimension}"
    
    async def test_null_embedding_handling(self, db_connection):
        """Test handling of null embeddings in searches"""
        # WILL FAIL: Null handling not implemented
        
        # Insert record with null embedding
        await db_connection.execute("""
            INSERT INTO finding (id, finding_type, description, embedding)
            VALUES (gen_random_uuid(), 'test', 'No embedding', NULL)
        """)
        
        # Search should not fail with null embeddings
        query_embedding = [0.1] * 768
        
        results = await db_connection.fetch("""
            SELECT description, 
                   CASE 
                       WHEN embedding IS NULL THEN 999.0
                       ELSE embedding <=> $1::vector 
                   END AS distance
            FROM finding
            ORDER BY distance
            LIMIT 10
        """, query_embedding)
        
        assert len(results) > 0, "Query should return results even with null embeddings"
        
        # Null embeddings should be last
        null_results = [r for r in results if r['description'] == 'No embedding']
        if null_results:
            assert null_results[0]['distance'] == 999.0, "Null embeddings should have max distance"