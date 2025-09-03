"""
Test RAG System with pgvector Integration
==========================================
Comprehensive tests for the Retrieval-Augmented Generation system using pgvector.
Following TDD principles - RED phase: all tests should fail initially.

Requirements:
- Embedding generation with Swedish/English support
- Vector similarity search with pgvector
- Scoped retrieval (supplier→month→global hierarchy)
- Human-friendly ID resolution (INS-YYYY-MM-NNN, SCN-YYYY-MM-NNN)
- Performance targets: <100ms for search, <1s for embedding generation
"""

import pytest
import asyncio
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from unittest.mock import Mock, AsyncMock, patch

# These imports will fail initially - part of TDD RED phase
from src.services.rag_service import (
    RAGService,
    EmbeddingGenerator,
    VectorStore,
    ScopedRetriever,
    HumanFriendlyIDResolver,
    RAGConfig,
    SearchScope,
    SearchResult,
    EmbeddingModel
)


class TestEmbeddingGeneration:
    """Test embedding generation for Swedish and English content"""
    
    @pytest.fixture
    def embedding_generator(self):
        """Create embedding generator instance"""
        # WILL FAIL: EmbeddingGenerator class doesn't exist
        config = RAGConfig(
            model_name="KBLab/sentence-bert-swedish-cased",
            dimension=768,
            batch_size=32,
            cache_embeddings=True
        )
        return EmbeddingGenerator(config)
    
    @pytest.fixture
    def sample_texts(self):
        """Sample texts in Swedish and English"""
        return {
            'swedish': [
                "Leverantör Åkerlund har överskridit budget med 15% under Q1",
                "Avvikelser i fakturahantering upptäckta för Stockholms kommun",
                "Återkommande problem med momsavdrag för tjänster",
                "Kostnadsökning på 25% jämfört med föregående år",
                "Felaktig kontering av investeringskostnader identifierad"
            ],
            'english': [
                "Supplier Akerlund exceeded budget by 15% in Q1",
                "Invoice handling deviations detected for Stockholm municipality",
                "Recurring issues with VAT deductions for services",
                "Cost increase of 25% compared to previous year",
                "Incorrect accounting of investment costs identified"
            ],
            'mixed': [
                "Budget överskridande detected for supplier SUP-2024-001",
                "Anomaly in kostnadsställe allocation for Q1 2024",
                "Missing verifikationer for amounts över 100,000 SEK"
            ]
        }
    
    async def test_embedding_generation_accuracy(self, embedding_generator, sample_texts):
        """Test that embeddings are generated with correct dimensions"""
        # WILL FAIL: generate_embeddings method not implemented
        
        # Test Swedish embeddings
        swedish_embeddings = await embedding_generator.generate_embeddings(
            texts=sample_texts['swedish'],
            language='sv'
        )
        
        assert len(swedish_embeddings) == len(sample_texts['swedish'])
        for embedding in swedish_embeddings:
            assert len(embedding) == 768, "Swedish BERT should produce 768-dim vectors"
            assert isinstance(embedding, list)
            assert all(isinstance(x, float) for x in embedding)
            # Check embedding is normalized
            norm = np.linalg.norm(embedding)
            assert 0.99 < norm < 1.01, "Embeddings should be normalized"
    
    async def test_embedding_consistency(self, embedding_generator, sample_texts):
        """Test that same text produces consistent embeddings"""
        # WILL FAIL: Consistency not guaranteed without implementation
        
        text = sample_texts['swedish'][0]
        
        # Generate embedding multiple times
        embeddings = []
        for _ in range(3):
            emb = await embedding_generator.generate_embeddings([text], language='sv')
            embeddings.append(emb[0])
        
        # Check consistency
        for i in range(1, len(embeddings)):
            similarity = np.dot(embeddings[0], embeddings[i])
            assert similarity > 0.999, f"Same text should produce identical embeddings, got similarity {similarity}"
    
    async def test_embedding_batch_performance(self, embedding_generator):
        """Test batch embedding generation performance"""
        # WILL FAIL: Performance optimization not implemented
        
        # Generate 100 sample texts
        texts = [f"Test text number {i} with some Swedish words åäö" for i in range(100)]
        
        start_time = time.perf_counter()
        embeddings = await embedding_generator.generate_embeddings(texts, language='sv')
        elapsed = time.perf_counter() - start_time
        
        assert len(embeddings) == 100
        assert elapsed < 1.0, f"Batch embedding of 100 texts should complete in <1s, took {elapsed:.2f}s"
        
        # Test that batching is more efficient than individual processing
        individual_start = time.perf_counter()
        for text in texts[:10]:
            await embedding_generator.generate_embeddings([text], language='sv')
        individual_elapsed = (time.perf_counter() - individual_start) * 10  # Extrapolate to 100
        
        assert elapsed < individual_elapsed / 2, "Batch processing should be at least 2x faster"
    
    async def test_embedding_cache(self, embedding_generator, sample_texts):
        """Test embedding caching for repeated texts"""
        # WILL FAIL: Caching not implemented
        
        text = sample_texts['swedish'][0]
        
        # First generation - should compute
        start1 = time.perf_counter()
        emb1 = await embedding_generator.generate_embeddings([text], language='sv')
        time1 = time.perf_counter() - start1
        
        # Second generation - should use cache
        start2 = time.perf_counter()
        emb2 = await embedding_generator.generate_embeddings([text], language='sv')
        time2 = time.perf_counter() - start2
        
        assert np.allclose(emb1[0], emb2[0]), "Cached embedding should be identical"
        assert time2 < time1 / 10, f"Cached lookup should be >10x faster, was {time2/time1:.2f}x"
        
        # Test cache invalidation on text change
        modified_text = text + " (modified)"
        emb3 = await embedding_generator.generate_embeddings([modified_text], language='sv')
        assert not np.allclose(emb1[0], emb3[0]), "Modified text should produce different embedding"
    
    async def test_language_specific_embeddings(self, embedding_generator, sample_texts):
        """Test that language-specific models are used correctly"""
        # WILL FAIL: Language routing not implemented
        
        # Swedish text with Swedish model
        swedish_emb = await embedding_generator.generate_embeddings(
            sample_texts['swedish'][:1],
            language='sv'
        )
        
        # Same meaning in English
        english_emb = await embedding_generator.generate_embeddings(
            sample_texts['english'][:1],
            language='en'
        )
        
        # Should capture similar semantic meaning despite language difference
        similarity = np.dot(swedish_emb[0], english_emb[0])
        assert 0.7 < similarity < 0.95, f"Similar meanings should have high similarity, got {similarity}"
        
        # Test mixed language handling
        mixed_emb = await embedding_generator.generate_embeddings(
            sample_texts['mixed'],
            language='auto'  # Auto-detect language
        )
        assert len(mixed_emb) == len(sample_texts['mixed'])


class TestVectorSimilaritySearch:
    """Test vector similarity search with pgvector"""
    
    @pytest.fixture
    async def vector_store(self):
        """Create vector store instance"""
        # WILL FAIL: VectorStore class doesn't exist
        store = VectorStore(
            connection_string="postgresql://test_user:test_pass@localhost:5432/svoa_test",
            dimension=768,
            index_type="hnsw",
            index_params={"m": 16, "ef_construction": 200}
        )
        await store.initialize()
        return store
    
    @pytest.fixture
    def sample_documents(self):
        """Sample documents with embeddings"""
        np.random.seed(42)
        return [
            {
                'id': f'FIND-2024-01-{i:04d}',
                'content': f'Finding {i}: Budget deviation detected',
                'embedding': np.random.randn(768).tolist(),
                'metadata': {
                    'supplier_id': f'SUP-{i % 10:03d}',
                    'month': '2024-01',
                    'severity': ['low', 'medium', 'high'][i % 3],
                    'type': 'finding'
                }
            }
            for i in range(100)
        ]
    
    async def test_similarity_search_relevance(self, vector_store, sample_documents):
        """Test that similarity search returns relevant results"""
        # WILL FAIL: upsert and search methods not implemented
        
        # Insert documents
        await vector_store.upsert(sample_documents)
        
        # Create query embedding (similar to first document)
        query_embedding = sample_documents[0]['embedding'].copy()
        query_embedding[0] += 0.1  # Slight modification
        
        # Search
        results = await vector_store.search(
            embedding=query_embedding,
            limit=10,
            threshold=0.8
        )
        
        assert len(results) > 0, "Should find similar documents"
        assert results[0].id == sample_documents[0]['id'], "Most similar should be first document"
        assert all(r.similarity >= 0.8 for r in results), "All results should meet threshold"
        assert all(results[i].similarity >= results[i+1].similarity for i in range(len(results)-1)), \
            "Results should be ordered by similarity"
    
    async def test_filtered_search_performance(self, vector_store, sample_documents):
        """Test performance of filtered similarity search"""
        # WILL FAIL: Filtered search not optimized
        
        await vector_store.upsert(sample_documents)
        
        query_embedding = np.random.randn(768).tolist()
        
        start_time = time.perf_counter()
        
        # Search with metadata filters
        results = await vector_store.search(
            embedding=query_embedding,
            limit=10,
            filters={
                'supplier_id': 'SUP-001',
                'month': '2024-01',
                'severity': ['medium', 'high']
            }
        )
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        assert elapsed < 100, f"Filtered search should complete in <100ms, took {elapsed:.2f}ms"
        assert all(r.metadata['supplier_id'] == 'SUP-001' for r in results), "Filter should be applied"
        assert all(r.metadata['severity'] in ['medium', 'high'] for r in results), "Multiple filters should work"
    
    async def test_hybrid_search(self, vector_store, sample_documents):
        """Test hybrid search combining vector similarity and keyword matching"""
        # WILL FAIL: Hybrid search not implemented
        
        await vector_store.upsert(sample_documents)
        
        # Hybrid search: vector similarity + keyword filter
        results = await vector_store.hybrid_search(
            embedding=sample_documents[0]['embedding'],
            keywords=['budget', 'deviation'],
            limit=10,
            vector_weight=0.7,
            keyword_weight=0.3
        )
        
        assert len(results) > 0, "Hybrid search should return results"
        
        # Verify results contain keywords
        for result in results[:5]:
            content_lower = result.content.lower()
            assert 'budget' in content_lower or 'deviation' in content_lower, \
                "Top results should contain search keywords"
    
    async def test_cross_table_search(self, vector_store):
        """Test searching across multiple tables (findings, insights, scenarios)"""
        # WILL FAIL: Cross-table search not implemented
        
        # Insert different types of documents
        findings = [
            {'id': f'FIND-{i}', 'type': 'finding', 'content': f'Finding {i}', 
             'embedding': np.random.randn(768).tolist()}
            for i in range(50)
        ]
        
        insights = [
            {'id': f'INS-2024-01-{i:03d}', 'type': 'insight', 'content': f'Insight {i}',
             'embedding': np.random.randn(768).tolist()}
            for i in range(30)
        ]
        
        scenarios = [
            {'id': f'SCN-2024-01-{i:03d}', 'type': 'scenario', 'content': f'Scenario {i}',
             'embedding': np.random.randn(768).tolist()}
            for i in range(20)
        ]
        
        await vector_store.upsert(findings + insights + scenarios)
        
        # Search across all types
        query_embedding = np.random.randn(768).tolist()
        
        results = await vector_store.search(
            embedding=query_embedding,
            limit=20,
            source_types=['finding', 'insight', 'scenario']
        )
        
        # Verify we get results from all types
        result_types = set(r.metadata['type'] for r in results)
        assert 'finding' in result_types, "Should have findings in results"
        assert 'insight' in result_types, "Should have insights in results"
        assert 'scenario' in result_types, "Should have scenarios in results"


class TestScopedRetrieval:
    """Test scoped retrieval hierarchy (supplier→month→global)"""
    
    @pytest.fixture
    async def scoped_retriever(self):
        """Create scoped retriever instance"""
        # WILL FAIL: ScopedRetriever class doesn't exist
        retriever = ScopedRetriever(
            vector_store=Mock(),
            embedding_generator=Mock(),
            scope_hierarchy=['supplier', 'month', 'global']
        )
        return retriever
    
    @pytest.fixture
    def hierarchical_data(self):
        """Create hierarchical test data"""
        data = []
        suppliers = ['SUP-001', 'SUP-002', 'SUP-003']
        months = ['2024-01', '2024-02', '2024-03']
        
        for supplier in suppliers:
            for month in months:
                for i in range(10):
                    data.append({
                        'id': f'{supplier}-{month}-{i:03d}',
                        'content': f'Document for {supplier} in {month}',
                        'embedding': np.random.randn(768).tolist(),
                        'scope': {
                            'supplier': supplier,
                            'month': month,
                            'global': True
                        }
                    })
        return data
    
    async def test_supplier_scoped_retrieval(self, scoped_retriever, hierarchical_data):
        """Test retrieval scoped to specific supplier"""
        # WILL FAIL: retrieve method not implemented
        
        # Setup mock vector store
        scoped_retriever.vector_store.search = AsyncMock(return_value=hierarchical_data[:5])
        
        # Retrieve for specific supplier
        results = await scoped_retriever.retrieve(
            query="budget issues",
            scope=SearchScope(supplier='SUP-001'),
            limit=10
        )
        
        assert all(r.scope['supplier'] == 'SUP-001' for r in results), \
            "All results should be from specified supplier"
        assert len(results) <= 10, "Should respect limit"
    
    async def test_month_scoped_retrieval(self, scoped_retriever, hierarchical_data):
        """Test retrieval scoped to supplier and month"""
        # WILL FAIL: Month scoping not implemented
        
        results = await scoped_retriever.retrieve(
            query="anomalies",
            scope=SearchScope(supplier='SUP-002', month='2024-02'),
            limit=5
        )
        
        assert all(r.scope['supplier'] == 'SUP-002' for r in results), \
            "Results should match supplier"
        assert all(r.scope['month'] == '2024-02' for r in results), \
            "Results should match month"
    
    async def test_hierarchical_fallback(self, scoped_retriever, hierarchical_data):
        """Test fallback to broader scope when specific scope has insufficient results"""
        # WILL FAIL: Hierarchical fallback not implemented
        
        # Mock: no results at supplier level, some at month level, more at global
        async def mock_search(embedding, filters=None, limit=10):
            if filters and 'supplier' in filters and 'month' in filters:
                return []  # No results at most specific level
            elif filters and 'month' in filters:
                return hierarchical_data[:3]  # Few results at month level
            else:
                return hierarchical_data[:10]  # More at global level
        
        scoped_retriever.vector_store.search = mock_search
        
        results = await scoped_retriever.retrieve(
            query="specific issue",
            scope=SearchScope(supplier='SUP-001', month='2024-01'),
            limit=10,
            fallback=True
        )
        
        assert len(results) == 10, "Should fallback to get requested number of results"
        # Results should be ordered by scope specificity
        supplier_specific = [r for r in results if r.scope.get('supplier') == 'SUP-001']
        month_specific = [r for r in results if r.scope.get('month') == '2024-01' and r.scope.get('supplier') != 'SUP-001']
        global_results = [r for r in results if not r.scope.get('month')]
        
        # More specific scopes should appear first
        assert results[:len(supplier_specific)] == supplier_specific, \
            "Supplier-specific results should be first"
    
    async def test_scope_weighting(self, scoped_retriever):
        """Test that scope relevance affects ranking"""
        # WILL FAIL: Scope weighting not implemented
        
        results = await scoped_retriever.retrieve(
            query="cost overrun",
            scope=SearchScope(supplier='SUP-003', month='2024-03'),
            limit=20,
            scope_weights={
                'exact_match': 1.5,  # Boost exact scope matches
                'partial_match': 1.2,  # Smaller boost for partial matches
                'global': 1.0  # No boost for global results
            }
        )
        
        # Calculate weighted scores
        for result in results:
            assert hasattr(result, 'weighted_score'), "Results should have weighted scores"
            
            # Exact match should have highest score
            if result.scope['supplier'] == 'SUP-003' and result.scope['month'] == '2024-03':
                assert result.weighted_score >= results[-1].weighted_score * 1.4, \
                    "Exact scope matches should be boosted"


class TestHumanFriendlyIDResolution:
    """Test resolution of human-friendly IDs (INS-YYYY-MM-NNN, SCN-YYYY-MM-NNN)"""
    
    @pytest.fixture
    def id_resolver(self):
        """Create ID resolver instance"""
        # WILL FAIL: HumanFriendlyIDResolver class doesn't exist
        return HumanFriendlyIDResolver()
    
    @pytest.fixture
    def sample_ids(self):
        """Sample human-friendly IDs"""
        return {
            'insights': [
                'INS-2024-01-001',
                'INS-2024-01-042',
                'INS-2024-02-003',
                'INS-2023-12-999'
            ],
            'scenarios': [
                'SCN-2024-01-001',
                'SCN-2024-01-015',
                'SCN-2024-03-002'
            ],
            'invalid': [
                'INS-2024-13-001',  # Invalid month
                'SCN-2024-01-0001',  # Wrong number format
                'ABC-2024-01-001',  # Invalid prefix
                'INS-202401-001'  # Missing dashes
            ]
        }
    
    async def test_id_parsing_and_validation(self, id_resolver, sample_ids):
        """Test parsing and validation of human-friendly IDs"""
        # WILL FAIL: parse_id method not implemented
        
        # Test valid insight IDs
        for id_str in sample_ids['insights']:
            parsed = await id_resolver.parse_id(id_str)
            assert parsed is not None, f"Should parse valid ID: {id_str}"
            assert parsed['type'] == 'insight'
            assert parsed['year'] == int(id_str.split('-')[1])
            assert parsed['month'] == int(id_str.split('-')[2])
            assert parsed['sequence'] == int(id_str.split('-')[3])
        
        # Test valid scenario IDs
        for id_str in sample_ids['scenarios']:
            parsed = await id_resolver.parse_id(id_str)
            assert parsed['type'] == 'scenario'
        
        # Test invalid IDs
        for id_str in sample_ids['invalid']:
            with pytest.raises(ValueError):
                await id_resolver.parse_id(id_str)
    
    async def test_id_to_embedding_resolution(self, id_resolver, sample_ids):
        """Test resolving IDs to their document embeddings"""
        # WILL FAIL: resolve_to_embedding method not implemented
        
        # Mock database with embeddings
        mock_embeddings = {
            'INS-2024-01-001': np.random.randn(768).tolist(),
            'SCN-2024-01-001': np.random.randn(768).tolist()
        }
        
        id_resolver.set_embedding_store(mock_embeddings)
        
        # Resolve existing ID
        embedding = await id_resolver.resolve_to_embedding('INS-2024-01-001')
        assert embedding is not None
        assert len(embedding) == 768
        assert embedding == mock_embeddings['INS-2024-01-001']
        
        # Resolve non-existent ID
        embedding = await id_resolver.resolve_to_embedding('INS-2024-01-999')
        assert embedding is None
    
    async def test_batch_id_resolution(self, id_resolver, sample_ids):
        """Test batch resolution of multiple IDs"""
        # WILL FAIL: batch_resolve method not implemented
        
        ids_to_resolve = sample_ids['insights'][:3] + sample_ids['scenarios'][:2]
        
        start_time = time.perf_counter()
        results = await id_resolver.batch_resolve(ids_to_resolve)
        elapsed = time.perf_counter() - start_time
        
        assert len(results) == len(ids_to_resolve)
        assert elapsed < 0.1, f"Batch resolution should be fast, took {elapsed:.2f}s"
        
        # Results should maintain order
        for i, id_str in enumerate(ids_to_resolve):
            assert results[i]['id'] == id_str
    
    async def test_id_search_in_content(self, id_resolver):
        """Test finding and resolving IDs mentioned in text content"""
        # WILL FAIL: extract_and_resolve_ids method not implemented
        
        content = """
        Based on the analysis in INS-2024-01-042, we identified several issues.
        See also scenario SCN-2024-01-015 for mitigation strategies.
        The insight INS-2024-02-003 provides additional context.
        Invalid reference: INS-2024-13-001 should be ignored.
        """
        
        resolved = await id_resolver.extract_and_resolve_ids(content)
        
        assert len(resolved) == 3, "Should find 3 valid IDs"
        assert 'INS-2024-01-042' in [r['id'] for r in resolved]
        assert 'SCN-2024-01-015' in [r['id'] for r in resolved]
        assert 'INS-2024-02-003' in [r['id'] for r in resolved]
        assert 'INS-2024-13-001' not in [r['id'] for r in resolved], "Invalid ID should be excluded"


class TestRAGSystemIntegration:
    """Test complete RAG system integration"""
    
    @pytest.fixture
    async def rag_service(self):
        """Create complete RAG service instance"""
        # WILL FAIL: RAGService class doesn't exist
        service = RAGService(
            config=RAGConfig(
                embedding_model="KBLab/sentence-bert-swedish-cased",
                vector_dimension=768,
                search_limit=20,
                cache_ttl=3600
            )
        )
        await service.initialize()
        return service
    
    async def test_end_to_end_rag_query(self, rag_service):
        """Test complete RAG query pipeline"""
        # WILL FAIL: Complete pipeline not implemented
        
        # User query in Swedish
        query = "Vilka leverantörer har problem med faktureringsfel under Q1 2024?"
        
        start_time = time.perf_counter()
        
        # Execute RAG query
        result = await rag_service.query(
            text=query,
            scope=SearchScope(month_range=('2024-01', '2024-03')),
            include_sources=True,
            max_tokens=2000
        )
        
        elapsed = time.perf_counter() - start_time
        
        # Performance check
        assert elapsed < 2.0, f"Complete RAG query should complete in <2s, took {elapsed:.2f}s"
        
        # Result structure
        assert result.answer is not None, "Should have an answer"
        assert len(result.sources) > 0, "Should include source documents"
        assert result.confidence > 0, "Should have confidence score"
        
        # Sources should be relevant
        for source in result.sources[:5]:
            assert source.relevance_score > 0.7, "Top sources should be relevant"
            assert hasattr(source, 'id'), "Sources should have IDs"
            assert hasattr(source, 'content'), "Sources should have content"
    
    async def test_rag_with_context_window_management(self, rag_service):
        """Test RAG with context window size management"""
        # WILL FAIL: Context window management not implemented
        
        # Query that might return many results
        query = "List all anomalies and their root causes"
        
        result = await rag_service.query(
            text=query,
            max_context_tokens=4000,  # Limit context size
            prioritize_recent=True
        )
        
        # Calculate approximate token count
        context_text = " ".join(s.content for s in result.sources)
        approx_tokens = len(context_text) / 4  # Rough estimate: 4 chars per token
        
        assert approx_tokens <= 4000, "Context should respect token limit"
        
        # Recent sources should be prioritized
        if len(result.sources) > 1:
            dates = [s.metadata.get('created_at') for s in result.sources if s.metadata.get('created_at')]
            if len(dates) > 1:
                assert dates[0] >= dates[-1], "Recent sources should appear first"
    
    async def test_rag_multilingual_support(self, rag_service):
        """Test RAG with multilingual queries and responses"""
        # WILL FAIL: Multilingual support not implemented
        
        queries = [
            ("Visa alla kritiska avvikelser", "sv"),  # Swedish
            ("Show all critical deviations", "en"),  # English
            ("Budget överskridande for supplier SUP-001", "mixed")  # Mixed
        ]
        
        for query_text, expected_lang in queries:
            result = await rag_service.query(
                text=query_text,
                response_language=expected_lang if expected_lang != "mixed" else "auto"
            )
            
            assert result.detected_language in ["sv", "en", "mixed"], \
                f"Should detect language for: {query_text}"
            
            if expected_lang != "mixed":
                # Response should be in requested language
                # This is a simplified check - real implementation would use language detection
                if expected_lang == "sv":
                    assert any(word in result.answer.lower() for word in ["avvikelse", "leverantör", "fel"]) or \
                           len(result.answer) == 0, "Swedish response should contain Swedish words"
                else:
                    assert any(word in result.answer.lower() for word in ["deviation", "supplier", "error"]) or \
                           len(result.answer) == 0, "English response should contain English words"
    
    async def test_rag_with_feedback_loop(self, rag_service):
        """Test RAG with relevance feedback for improving results"""
        # WILL FAIL: Feedback loop not implemented
        
        # Initial query
        query = "Find invoice processing errors"
        result1 = await rag_service.query(query)
        
        # Provide feedback on relevance
        feedback = {
            result1.sources[0].id: 1.0,  # Very relevant
            result1.sources[1].id: 0.8,  # Relevant
            result1.sources[2].id: 0.2,  # Not relevant
        }
        
        await rag_service.provide_feedback(
            query_id=result1.query_id,
            relevance_scores=feedback
        )
        
        # Repeat query - should improve based on feedback
        result2 = await rag_service.query(query)
        
        # Results should be different (improved)
        source_ids1 = [s.id for s in result1.sources[:5]]
        source_ids2 = [s.id for s in result2.sources[:5]]
        
        assert source_ids1 != source_ids2, "Results should change based on feedback"
        
        # Highly rated sources should rank higher
        assert result1.sources[0].id in source_ids2[:3], \
            "Previously high-rated source should remain high"


class TestRAGPerformanceAndScaling:
    """Test RAG system performance and scaling characteristics"""
    
    @pytest.fixture
    async def large_dataset(self):
        """Generate large dataset for performance testing"""
        np.random.seed(42)
        documents = []
        
        for i in range(10000):
            documents.append({
                'id': f'DOC-{i:06d}',
                'content': f'Document {i} with various content about suppliers, invoices, and anomalies',
                'embedding': np.random.randn(768).tolist(),
                'metadata': {
                    'supplier': f'SUP-{i % 100:03d}',
                    'month': f'2024-{(i % 12) + 1:02d}',
                    'type': ['finding', 'insight', 'scenario'][i % 3]
                }
            })
        
        return documents
    
    async def test_large_scale_indexing(self, rag_service, large_dataset):
        """Test indexing performance with large dataset"""
        # WILL FAIL: Large-scale indexing not optimized
        
        start_time = time.perf_counter()
        
        # Index in batches
        batch_size = 1000
        for i in range(0, len(large_dataset), batch_size):
            batch = large_dataset[i:i+batch_size]
            await rag_service.index_documents(batch)
        
        elapsed = time.perf_counter() - start_time
        
        assert elapsed < 60, f"Indexing 10k documents should complete in <60s, took {elapsed:.2f}s"
        
        # Verify all documents indexed
        count = await rag_service.get_document_count()
        assert count == len(large_dataset), "All documents should be indexed"
    
    async def test_concurrent_queries(self, rag_service):
        """Test handling of concurrent RAG queries"""
        # WILL FAIL: Concurrency not properly handled
        
        queries = [
            "Find all budget overruns",
            "Show invoice anomalies",
            "List supplier compliance issues",
            "Identify cost saving opportunities",
            "Analyze payment delays"
        ]
        
        # Execute queries concurrently
        start_time = time.perf_counter()
        
        tasks = [rag_service.query(q) for q in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        elapsed = time.perf_counter() - start_time
        
        # Check results
        errors = [r for r in results if isinstance(r, Exception)]
        assert len(errors) == 0, f"No queries should fail: {errors}"
        
        # Concurrent execution should be faster than sequential
        assert elapsed < len(queries) * 0.5, \
            f"Concurrent queries should complete faster, took {elapsed:.2f}s"
        
        # All results should be valid
        for result in results:
            assert result.answer is not None
            assert len(result.sources) > 0
    
    async def test_memory_efficiency(self, rag_service, large_dataset):
        """Test memory efficiency with large result sets"""
        # WILL FAIL: Memory optimization not implemented
        
        # Query that could return many results
        query = "Find all documents"  # Broad query
        
        # Should handle gracefully without memory explosion
        result = await rag_service.query(
            text=query,
            limit=1000,  # Request many results
            stream_results=True  # Enable streaming for memory efficiency
        )
        
        # Results should be streamable
        assert hasattr(result, '__aiter__'), "Large results should be streamable"
        
        count = 0
        async for doc in result:
            count += 1
            if count > 100:
                break  # Don't need to process all
        
        assert count > 0, "Should be able to stream results"