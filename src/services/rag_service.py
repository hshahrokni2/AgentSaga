"""
RAG Service with pgvector Integration
======================================
Retrieval-Augmented Generation system for semantic search over insights, scenarios, and comments.
Implements embedding generation, vector similarity search, and scoped retrieval.
"""

import asyncio
import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple, Set, AsyncIterator
import numpy as np
from functools import lru_cache

import asyncpg
from sentence_transformers import SentenceTransformer
import torch


class EmbeddingModel(Enum):
    """Available embedding models"""
    SWEDISH_BERT = "KBLab/sentence-bert-swedish-cased"
    MULTILINGUAL_E5 = "intfloat/multilingual-e5-base"
    OPENAI_ADA = "text-embedding-ada-002"


@dataclass
class RAGConfig:
    """Configuration for RAG system"""
    model_name: str = EmbeddingModel.SWEDISH_BERT.value
    dimension: int = 768
    batch_size: int = 32
    cache_embeddings: bool = True
    cache_ttl: int = 3600
    connection_string: Optional[str] = None
    search_limit: int = 20
    similarity_threshold: float = 0.7


@dataclass
class SearchScope:
    """Search scope for hierarchical retrieval"""
    supplier: Optional[str] = None
    month: Optional[str] = None
    month_range: Optional[Tuple[str, str]] = None
    global_search: bool = False
    
    def to_filter(self) -> Dict[str, Any]:
        """Convert scope to database filter"""
        filters = {}
        if self.supplier:
            filters['supplier_id'] = self.supplier
        if self.month:
            filters['month'] = self.month
        elif self.month_range:
            filters['month_range'] = self.month_range
        return filters


@dataclass
class SearchResult:
    """Individual search result"""
    id: str
    content: str
    similarity: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    source_type: Optional[str] = None
    scope: Optional[Dict[str, Any]] = None
    weighted_score: Optional[float] = None
    relevance_score: Optional[float] = None


@dataclass
class RAGQueryResult:
    """Complete RAG query result"""
    query_id: str
    answer: str
    sources: List[SearchResult]
    confidence: float
    detected_language: Optional[str] = None
    processing_time: Optional[float] = None
    
    async def __aiter__(self):
        """Enable async iteration over sources for streaming"""
        for source in self.sources:
            yield source


class EmbeddingGenerator:
    """Generates embeddings for text using various models"""
    
    def __init__(self, config: RAGConfig):
        self.config = config
        self.model = self._load_model()
        self.cache = {} if config.cache_embeddings else None
        self.cache_timestamps = {}
        
    def _load_model(self) -> SentenceTransformer:
        """Load the embedding model"""
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        model = SentenceTransformer(self.config.model_name)
        model.to(device)
        return model
    
    def _cache_key(self, text: str, language: str) -> str:
        """Generate cache key for text"""
        return hashlib.md5(f"{text}:{language}".encode()).hexdigest()
    
    async def generate_embeddings(
        self, 
        texts: List[str], 
        language: str = 'sv'
    ) -> List[List[float]]:
        """Generate embeddings for texts with caching"""
        embeddings = []
        uncached_texts = []
        uncached_indices = []
        
        # Check cache
        if self.cache is not None:
            for i, text in enumerate(texts):
                cache_key = self._cache_key(text, language)
                if cache_key in self.cache:
                    # Check if cache entry is still valid
                    if time.time() - self.cache_timestamps.get(cache_key, 0) < self.config.cache_ttl:
                        embeddings.append(self.cache[cache_key])
                    else:
                        uncached_texts.append(text)
                        uncached_indices.append(i)
                        embeddings.append(None)
                else:
                    uncached_texts.append(text)
                    uncached_indices.append(i)
                    embeddings.append(None)
        else:
            uncached_texts = texts
            uncached_indices = list(range(len(texts)))
            embeddings = [None] * len(texts)
        
        # Generate embeddings for uncached texts
        if uncached_texts:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            new_embeddings = await loop.run_in_executor(
                None,
                self._encode_batch,
                uncached_texts
            )
            
            # Update cache and results
            for i, idx in enumerate(uncached_indices):
                embedding = new_embeddings[i]
                embeddings[idx] = embedding
                
                if self.cache is not None:
                    cache_key = self._cache_key(uncached_texts[i], language)
                    self.cache[cache_key] = embedding
                    self.cache_timestamps[cache_key] = time.time()
        
        return embeddings
    
    def _encode_batch(self, texts: List[str]) -> List[List[float]]:
        """Encode texts in batches"""
        all_embeddings = []
        
        for i in range(0, len(texts), self.config.batch_size):
            batch = texts[i:i + self.config.batch_size]
            embeddings = self.model.encode(
                batch,
                normalize_embeddings=True,
                batch_size=self.config.batch_size,
                show_progress_bar=False
            )
            all_embeddings.extend(embeddings.tolist())
        
        return all_embeddings


class VectorStore:
    """Vector store using pgvector for similarity search"""
    
    def __init__(
        self, 
        connection_string: str,
        dimension: int = 768,
        index_type: str = "hnsw",
        index_params: Optional[Dict[str, Any]] = None
    ):
        self.connection_string = connection_string
        self.dimension = dimension
        self.index_type = index_type
        self.index_params = index_params or {"m": 16, "ef_construction": 200}
        self.conn: Optional[asyncpg.Connection] = None
        
    async def initialize(self):
        """Initialize database connection and create necessary structures"""
        self.conn = await asyncpg.connect(self.connection_string)
        
        # Register pgvector extension
        await self.conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        
        # Create tables if they don't exist
        await self._create_tables()
        
        # Create indexes
        await self._create_indexes()
    
    async def _create_tables(self):
        """Create necessary tables for vector storage"""
        # This is a simplified schema - adjust based on actual database structure
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding vector($1),
                metadata JSONB,
                source_type TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """, self.dimension)
    
    async def _create_indexes(self):
        """Create vector and metadata indexes"""
        # Create HNSW index for vector similarity
        await self.conn.execute(f"""
            CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx 
            ON embeddings USING hnsw (embedding vector_cosine_ops)
            WITH (m = {self.index_params['m']}, ef_construction = {self.index_params['ef_construction']})
        """)
        
        # Create indexes for metadata filtering
        await self.conn.execute("""
            CREATE INDEX IF NOT EXISTS embeddings_metadata_idx 
            ON embeddings USING gin (metadata)
        """)
        
        await self.conn.execute("""
            CREATE INDEX IF NOT EXISTS embeddings_source_type_idx 
            ON embeddings (source_type)
        """)
    
    async def upsert(self, documents: List[Dict[str, Any]]):
        """Insert or update documents with embeddings"""
        if not documents:
            return
        
        # Prepare batch insert
        values = []
        for doc in documents:
            values.append((
                doc['id'],
                doc['content'],
                doc['embedding'],
                json.dumps(doc.get('metadata', {})),
                doc.get('type', doc.get('source_type', 'unknown'))
            ))
        
        # Use ON CONFLICT for upsert
        await self.conn.executemany("""
            INSERT INTO embeddings (id, content, embedding, metadata, source_type)
            VALUES ($1, $2, $3::vector, $4::jsonb, $5)
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata,
                source_type = EXCLUDED.source_type,
                updated_at = NOW()
        """, values)
    
    async def search(
        self,
        embedding: List[float],
        limit: int = 10,
        threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None,
        source_types: Optional[List[str]] = None
    ) -> List[SearchResult]:
        """Search for similar vectors with optional filtering"""
        
        # Build query
        query_parts = ["SELECT id, content, embedding, metadata, source_type,"]
        query_parts.append("1 - (embedding <=> $1::vector) as similarity")
        query_parts.append("FROM embeddings")
        
        # Build WHERE clause
        where_conditions = []
        params = [embedding]
        param_counter = 2
        
        if threshold is not None:
            where_conditions.append(f"1 - (embedding <=> $1::vector) >= ${param_counter}")
            params.append(threshold)
            param_counter += 1
        
        if filters:
            for key, value in filters.items():
                if key == 'supplier_id':
                    where_conditions.append(f"metadata->>'supplier_id' = ${param_counter}")
                    params.append(value)
                    param_counter += 1
                elif key == 'month':
                    where_conditions.append(f"metadata->>'month' = ${param_counter}")
                    params.append(value)
                    param_counter += 1
                elif key == 'month_range':
                    where_conditions.append(
                        f"metadata->>'month' >= ${param_counter} AND "
                        f"metadata->>'month' <= ${param_counter + 1}"
                    )
                    params.extend(value)
                    param_counter += 2
                elif key == 'severity':
                    if isinstance(value, list):
                        placeholders = ','.join([f"${i}" for i in range(param_counter, param_counter + len(value))])
                        where_conditions.append(f"metadata->>'severity' IN ({placeholders})")
                        params.extend(value)
                        param_counter += len(value)
                    else:
                        where_conditions.append(f"metadata->>'severity' = ${param_counter}")
                        params.append(value)
                        param_counter += 1
        
        if source_types:
            placeholders = ','.join([f"${i}" for i in range(param_counter, param_counter + len(source_types))])
            where_conditions.append(f"source_type IN ({placeholders})")
            params.extend(source_types)
        
        if where_conditions:
            query_parts.append("WHERE " + " AND ".join(where_conditions))
        
        # Add ordering and limit
        query_parts.append("ORDER BY embedding <=> $1::vector")
        query_parts.append(f"LIMIT {limit}")
        
        query = " ".join(query_parts)
        
        # Execute search
        rows = await self.conn.fetch(query, *params)
        
        # Convert to SearchResult objects
        results = []
        for row in rows:
            results.append(SearchResult(
                id=row['id'],
                content=row['content'],
                similarity=row['similarity'],
                metadata=json.loads(row['metadata']) if row['metadata'] else {},
                source_type=row['source_type'],
                relevance_score=row['similarity']  # Use similarity as relevance initially
            ))
        
        return results
    
    async def hybrid_search(
        self,
        embedding: List[float],
        keywords: List[str],
        limit: int = 10,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3
    ) -> List[SearchResult]:
        """Hybrid search combining vector similarity and keyword matching"""
        
        # Vector search
        vector_results = await self.search(embedding, limit=limit * 2)
        
        # Keyword search using PostgreSQL full-text search
        keyword_query = " & ".join(keywords)  # AND search
        keyword_rows = await self.conn.fetch("""
            SELECT id, content, metadata, source_type,
                   ts_rank(to_tsvector('english', content), to_tsquery($1)) as rank
            FROM embeddings
            WHERE to_tsvector('english', content) @@ to_tsquery($1)
            ORDER BY rank DESC
            LIMIT $2
        """, keyword_query, limit * 2)
        
        # Combine and re-rank results
        combined_scores = {}
        all_results = {}
        
        # Add vector search results
        for result in vector_results:
            combined_scores[result.id] = result.similarity * vector_weight
            all_results[result.id] = result
        
        # Add keyword search results
        max_rank = max([row['rank'] for row in keyword_rows]) if keyword_rows else 1.0
        for row in keyword_rows:
            normalized_rank = row['rank'] / max_rank if max_rank > 0 else 0
            result_id = row['id']
            
            if result_id in combined_scores:
                combined_scores[result_id] += normalized_rank * keyword_weight
            else:
                combined_scores[result_id] = normalized_rank * keyword_weight
                all_results[result_id] = SearchResult(
                    id=result_id,
                    content=row['content'],
                    similarity=0,  # No vector similarity
                    metadata=json.loads(row['metadata']) if row['metadata'] else {},
                    source_type=row['source_type']
                )
        
        # Sort by combined score and return top results
        sorted_ids = sorted(combined_scores.keys(), key=lambda x: combined_scores[x], reverse=True)
        
        results = []
        for result_id in sorted_ids[:limit]:
            result = all_results[result_id]
            result.weighted_score = combined_scores[result_id]
            results.append(result)
        
        return results
    
    async def close(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()


class ScopedRetriever:
    """Handles hierarchical scoped retrieval"""
    
    def __init__(
        self,
        vector_store: VectorStore,
        embedding_generator: EmbeddingGenerator,
        scope_hierarchy: List[str] = None
    ):
        self.vector_store = vector_store
        self.embedding_generator = embedding_generator
        self.scope_hierarchy = scope_hierarchy or ['supplier', 'month', 'global']
    
    async def retrieve(
        self,
        query: str,
        scope: SearchScope,
        limit: int = 10,
        fallback: bool = True,
        scope_weights: Optional[Dict[str, float]] = None
    ) -> List[SearchResult]:
        """Retrieve documents with hierarchical scope fallback"""
        
        # Generate query embedding
        embeddings = await self.embedding_generator.generate_embeddings([query])
        query_embedding = embeddings[0]
        
        results = []
        remaining_limit = limit
        
        # Default scope weights
        if scope_weights is None:
            scope_weights = {
                'exact_match': 1.5,
                'partial_match': 1.2,
                'global': 1.0
            }
        
        # Try each scope level
        scope_levels = self._build_scope_levels(scope)
        
        for level_name, level_filters in scope_levels:
            if remaining_limit <= 0:
                break
            
            # Search at this scope level
            level_results = await self.vector_store.search(
                embedding=query_embedding,
                limit=remaining_limit,
                filters=level_filters
            )
            
            # Apply scope weighting
            weight = scope_weights.get(level_name, 1.0)
            for result in level_results:
                result.weighted_score = result.similarity * weight
                result.scope = level_filters
            
            results.extend(level_results)
            remaining_limit -= len(level_results)
            
            # Stop if we have enough results and fallback is disabled
            if not fallback and len(results) >= limit:
                break
        
        # Sort by weighted score and return top results
        results.sort(key=lambda x: x.weighted_score or x.similarity, reverse=True)
        return results[:limit]
    
    def _build_scope_levels(self, scope: SearchScope) -> List[Tuple[str, Dict[str, Any]]]:
        """Build scope levels for hierarchical search"""
        levels = []
        
        # Most specific: supplier + month
        if scope.supplier and (scope.month or scope.month_range):
            filters = {'supplier_id': scope.supplier}
            if scope.month:
                filters['month'] = scope.month
            elif scope.month_range:
                filters['month_range'] = scope.month_range
            levels.append(('exact_match', filters))
        
        # Partial match: just supplier or just month
        if scope.supplier:
            levels.append(('partial_match', {'supplier_id': scope.supplier}))
        
        if scope.month or scope.month_range:
            filters = {}
            if scope.month:
                filters['month'] = scope.month
            elif scope.month_range:
                filters['month_range'] = scope.month_range
            levels.append(('partial_match', filters))
        
        # Global scope
        levels.append(('global', {}))
        
        return levels


class HumanFriendlyIDResolver:
    """Resolves human-friendly IDs (INS-YYYY-MM-NNN, SCN-YYYY-MM-NNN)"""
    
    ID_PATTERN = re.compile(r'^(INS|SCN)-(\d{4})-(\d{2})-(\d{3})$')
    
    def __init__(self):
        self.embedding_store: Dict[str, List[float]] = {}
    
    def set_embedding_store(self, store: Dict[str, List[float]]):
        """Set the embedding store for ID resolution"""
        self.embedding_store = store
    
    async def parse_id(self, id_str: str) -> Optional[Dict[str, Any]]:
        """Parse and validate a human-friendly ID"""
        match = self.ID_PATTERN.match(id_str)
        if not match:
            raise ValueError(f"Invalid ID format: {id_str}")
        
        prefix, year, month, sequence = match.groups()
        year = int(year)
        month = int(month)
        sequence = int(sequence)
        
        # Validate components
        if month < 1 or month > 12:
            raise ValueError(f"Invalid month in ID: {id_str}")
        
        if sequence < 1 or sequence > 999:
            raise ValueError(f"Invalid sequence in ID: {id_str}")
        
        return {
            'id': id_str,
            'type': 'insight' if prefix == 'INS' else 'scenario',
            'year': year,
            'month': month,
            'sequence': sequence
        }
    
    async def resolve_to_embedding(self, id_str: str) -> Optional[List[float]]:
        """Resolve an ID to its embedding"""
        # Validate ID format
        await self.parse_id(id_str)
        
        # Look up embedding
        return self.embedding_store.get(id_str)
    
    async def batch_resolve(self, ids: List[str]) -> List[Dict[str, Any]]:
        """Batch resolve multiple IDs"""
        results = []
        
        for id_str in ids:
            try:
                parsed = await self.parse_id(id_str)
                embedding = self.embedding_store.get(id_str)
                parsed['embedding'] = embedding
                results.append(parsed)
            except ValueError:
                results.append({'id': id_str, 'error': 'Invalid format'})
        
        return results
    
    async def extract_and_resolve_ids(self, content: str) -> List[Dict[str, Any]]:
        """Extract and resolve IDs mentioned in text"""
        # Find all potential IDs
        pattern = re.compile(r'\b(INS|SCN)-\d{4}-\d{2}-\d{3}\b')
        matches = pattern.findall(content)
        
        # Reconstruct full IDs
        found_ids = []
        for match in pattern.finditer(content):
            id_str = match.group(0)
            try:
                parsed = await self.parse_id(id_str)
                found_ids.append(parsed)
            except ValueError:
                # Skip invalid IDs
                pass
        
        return found_ids


class RAGService:
    """Main RAG service coordinating all components"""
    
    def __init__(self, config: Optional[RAGConfig] = None):
        self.config = config or RAGConfig()
        self.embedding_generator = EmbeddingGenerator(self.config)
        self.vector_store: Optional[VectorStore] = None
        self.scoped_retriever: Optional[ScopedRetriever] = None
        self.id_resolver = HumanFriendlyIDResolver()
        self._initialized = False
        self._document_count = 0
        self._feedback_store: Dict[str, Dict[str, float]] = {}
    
    async def initialize(self):
        """Initialize RAG service components"""
        if self._initialized:
            return
        
        # Initialize vector store
        if self.config.connection_string:
            self.vector_store = VectorStore(
                connection_string=self.config.connection_string,
                dimension=self.config.dimension
            )
            await self.vector_store.initialize()
        else:
            # Use mock for testing
            self.vector_store = VectorStore(
                connection_string="postgresql://test:test@localhost/test",
                dimension=self.config.dimension
            )
        
        # Initialize scoped retriever
        self.scoped_retriever = ScopedRetriever(
            vector_store=self.vector_store,
            embedding_generator=self.embedding_generator
        )
        
        self._initialized = True
    
    async def query(
        self,
        text: str,
        scope: Optional[SearchScope] = None,
        include_sources: bool = True,
        max_tokens: int = 2000,
        max_context_tokens: Optional[int] = None,
        prioritize_recent: bool = False,
        response_language: str = "auto",
        limit: Optional[int] = None,
        stream_results: bool = False
    ) -> RAGQueryResult:
        """Execute a RAG query"""
        
        if not self._initialized:
            await self.initialize()
        
        start_time = time.perf_counter()
        
        # Detect language
        detected_language = self._detect_language(text)
        
        # Use response language if specified
        if response_language == "auto":
            response_language = detected_language
        
        # Retrieve relevant documents
        if scope:
            sources = await self.scoped_retriever.retrieve(
                query=text,
                scope=scope,
                limit=limit or self.config.search_limit
            )
        else:
            # Direct vector search
            embeddings = await self.embedding_generator.generate_embeddings([text])
            sources = await self.vector_store.search(
                embedding=embeddings[0],
                limit=limit or self.config.search_limit
            )
        
        # Apply feedback if available
        query_hash = hashlib.md5(text.encode()).hexdigest()
        if query_hash in self._feedback_store:
            feedback = self._feedback_store[query_hash]
            for source in sources:
                if source.id in feedback:
                    source.relevance_score = feedback[source.id]
        
        # Sort by relevance
        sources.sort(key=lambda x: x.relevance_score or x.similarity, reverse=True)
        
        # Manage context window
        if max_context_tokens:
            sources = self._truncate_to_token_limit(sources, max_context_tokens)
        
        # Sort by recency if requested
        if prioritize_recent and sources:
            sources.sort(
                key=lambda x: x.metadata.get('created_at', ''),
                reverse=True
            )
        
        # Generate answer (simplified - would use LLM in production)
        context = "\n".join([s.content for s in sources[:5]])
        answer = self._generate_answer(text, context, response_language)
        
        # Calculate confidence
        confidence = self._calculate_confidence(sources)
        
        processing_time = time.perf_counter() - start_time
        
        result = RAGQueryResult(
            query_id=hashlib.md5(f"{text}:{time.time()}".encode()).hexdigest(),
            answer=answer,
            sources=sources,
            confidence=confidence,
            detected_language=detected_language,
            processing_time=processing_time
        )
        
        if stream_results:
            # Return async iterable result
            return result
        
        return result
    
    async def index_documents(self, documents: List[Dict[str, Any]]):
        """Index documents into vector store"""
        if not self._initialized:
            await self.initialize()
        
        # Generate embeddings for documents
        texts = [doc.get('content', '') for doc in documents]
        embeddings = await self.embedding_generator.generate_embeddings(texts)
        
        # Add embeddings to documents
        for doc, embedding in zip(documents, embeddings):
            doc['embedding'] = embedding
        
        # Upsert to vector store
        await self.vector_store.upsert(documents)
        
        self._document_count += len(documents)
    
    async def get_document_count(self) -> int:
        """Get count of indexed documents"""
        return self._document_count
    
    async def provide_feedback(
        self,
        query_id: str,
        relevance_scores: Dict[str, float]
    ):
        """Provide relevance feedback for improving future results"""
        # Store feedback for future queries
        # In production, this would be more sophisticated
        self._feedback_store[query_id] = relevance_scores
    
    def _detect_language(self, text: str) -> str:
        """Detect language of text"""
        # Simplified language detection
        swedish_indicators = ['å', 'ä', 'ö', 'leverantör', 'faktura', 'avvikelse']
        english_indicators = ['the', 'and', 'or', 'supplier', 'invoice', 'deviation']
        
        text_lower = text.lower()
        
        swedish_score = sum(1 for ind in swedish_indicators if ind in text_lower)
        english_score = sum(1 for ind in english_indicators if ind in text_lower)
        
        if swedish_score > english_score:
            return 'sv'
        elif english_score > swedish_score:
            return 'en'
        else:
            return 'mixed'
    
    def _truncate_to_token_limit(
        self,
        sources: List[SearchResult],
        max_tokens: int
    ) -> List[SearchResult]:
        """Truncate sources to fit within token limit"""
        # Rough approximation: 4 characters per token
        total_chars = 0
        max_chars = max_tokens * 4
        truncated = []
        
        for source in sources:
            source_chars = len(source.content)
            if total_chars + source_chars <= max_chars:
                truncated.append(source)
                total_chars += source_chars
            else:
                # Truncate this source to fit
                remaining_chars = max_chars - total_chars
                if remaining_chars > 100:  # Only include if meaningful
                    source.content = source.content[:remaining_chars]
                    truncated.append(source)
                break
        
        return truncated
    
    def _generate_answer(
        self,
        query: str,
        context: str,
        language: str
    ) -> str:
        """Generate answer based on query and context"""
        # In production, this would use an LLM
        # For now, return a simple response
        if not context:
            if language == 'sv':
                return "Inga relevanta dokument hittades för din fråga."
            else:
                return "No relevant documents found for your query."
        
        if language == 'sv':
            return f"Baserat på tillgänglig information: {context[:200]}..."
        else:
            return f"Based on available information: {context[:200]}..."
    
    def _calculate_confidence(self, sources: List[SearchResult]) -> float:
        """Calculate confidence score based on search results"""
        if not sources:
            return 0.0
        
        # Average similarity of top results
        top_sources = sources[:5]
        if not top_sources:
            return 0.0
        
        avg_similarity = sum(s.similarity for s in top_sources) / len(top_sources)
        return avg_similarity
    
    async def close(self):
        """Clean up resources"""
        if self.vector_store:
            await self.vector_store.close()