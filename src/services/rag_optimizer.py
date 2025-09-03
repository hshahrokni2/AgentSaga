"""
RAG Optimizer Module
====================
Performance optimizations and enhancements for the RAG system.
Includes connection pooling, query optimization, caching strategies, and monitoring.
"""

import asyncio
import hashlib
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Dict, List, Optional, Any, AsyncIterator
import logging

import asyncpg
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge
import numpy as np


# Metrics for monitoring
embedding_generation_time = Histogram(
    'rag_embedding_generation_seconds',
    'Time spent generating embeddings',
    ['model', 'batch_size']
)

vector_search_time = Histogram(
    'rag_vector_search_seconds',
    'Time spent on vector similarity search',
    ['index_type', 'result_count']
)

cache_hits = Counter(
    'rag_cache_hits_total',
    'Number of cache hits',
    ['cache_type']
)

cache_misses = Counter(
    'rag_cache_misses_total',
    'Number of cache misses',
    ['cache_type']
)

active_connections = Gauge(
    'rag_active_db_connections',
    'Number of active database connections'
)


@dataclass
class PerformanceConfig:
    """Performance tuning configuration"""
    # Connection pooling
    min_pool_size: int = 10
    max_pool_size: int = 50
    connection_timeout: float = 10.0
    
    # Caching
    redis_url: Optional[str] = None
    embedding_cache_ttl: int = 3600
    search_cache_ttl: int = 300
    max_cache_size: int = 10000
    
    # Query optimization
    enable_parallel_search: bool = True
    max_parallel_queries: int = 5
    enable_query_planning: bool = True
    
    # Index optimization
    auto_vacuum: bool = True
    auto_analyze: bool = True
    index_refresh_interval: int = 3600


class LRUCache:
    """Thread-safe LRU cache implementation"""
    
    def __init__(self, max_size: int = 1000):
        self.cache: OrderedDict = OrderedDict()
        self.max_size = max_size
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get item from cache"""
        async with self._lock:
            if key in self.cache:
                # Move to end (most recently used)
                self.cache.move_to_end(key)
                cache_hits.labels(cache_type='lru').inc()
                return self.cache[key]
            cache_misses.labels(cache_type='lru').inc()
            return None
    
    async def set(self, key: str, value: Any):
        """Set item in cache"""
        async with self._lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            else:
                if len(self.cache) >= self.max_size:
                    # Remove least recently used
                    self.cache.popitem(last=False)
            self.cache[key] = value


class ConnectionPool:
    """Database connection pool with health checking"""
    
    def __init__(self, config: PerformanceConfig, connection_string: str):
        self.config = config
        self.connection_string = connection_string
        self.pool: Optional[asyncpg.Pool] = None
        self._health_check_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        """Initialize connection pool"""
        self.pool = await asyncpg.create_pool(
            self.connection_string,
            min_size=self.config.min_pool_size,
            max_size=self.config.max_pool_size,
            timeout=self.config.connection_timeout,
            command_timeout=60
        )
        
        # Start health check task
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        
        # Update metrics
        active_connections.set(self.config.min_pool_size)
    
    async def _health_check_loop(self):
        """Periodic health check of connections"""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                async with self.pool.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                
                # Update connection count
                pool_size = self.pool._holders.__len__() if self.pool else 0
                active_connections.set(pool_size)
                
            except Exception as e:
                logging.error(f"Health check failed: {e}")
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire connection from pool"""
        async with self.pool.acquire() as conn:
            yield conn
    
    async def close(self):
        """Close connection pool"""
        if self._health_check_task:
            self._health_check_task.cancel()
        if self.pool:
            await self.pool.close()
            active_connections.set(0)


class RedisCache:
    """Redis-based distributed cache"""
    
    def __init__(self, redis_url: str, ttl: int = 300):
        self.redis_url = redis_url
        self.ttl = ttl
        self.client: Optional[redis.Redis] = None
    
    async def initialize(self):
        """Initialize Redis connection"""
        self.client = redis.from_url(self.redis_url)
    
    async def get(self, key: str) -> Optional[bytes]:
        """Get from Redis cache"""
        if not self.client:
            return None
        
        try:
            value = await self.client.get(key)
            if value:
                cache_hits.labels(cache_type='redis').inc()
            else:
                cache_misses.labels(cache_type='redis').inc()
            return value
        except Exception as e:
            logging.error(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: bytes, ttl: Optional[int] = None):
        """Set in Redis cache"""
        if not self.client:
            return
        
        try:
            await self.client.setex(
                key,
                ttl or self.ttl,
                value
            )
        except Exception as e:
            logging.error(f"Redis set error: {e}")
    
    async def delete(self, key: str):
        """Delete from Redis cache"""
        if not self.client:
            return
        
        try:
            await self.client.delete(key)
        except Exception as e:
            logging.error(f"Redis delete error: {e}")
    
    async def close(self):
        """Close Redis connection"""
        if self.client:
            await self.client.close()


class QueryOptimizer:
    """Optimizes vector search queries"""
    
    def __init__(self, connection_pool: ConnectionPool):
        self.pool = connection_pool
        self.query_stats: Dict[str, Dict[str, Any]] = {}
    
    async def analyze_query_plan(self, query: str, params: List[Any]) -> Dict[str, Any]:
        """Analyze query execution plan"""
        async with self.pool.acquire() as conn:
            # Get query plan
            plan = await conn.fetch(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}", *params)
            plan_json = plan[0]['QUERY PLAN'][0]
            
            # Extract key metrics
            return {
                'execution_time': plan_json.get('Execution Time'),
                'planning_time': plan_json.get('Planning Time'),
                'total_cost': plan_json.get('Plan', {}).get('Total Cost'),
                'uses_index': self._check_index_usage(plan_json),
                'parallel_workers': plan_json.get('Plan', {}).get('Workers Planned', 0)
            }
    
    def _check_index_usage(self, plan: Dict[str, Any]) -> bool:
        """Check if query uses indexes"""
        plan_str = str(plan)
        return 'Index Scan' in plan_str or 'Bitmap Index Scan' in plan_str
    
    async def optimize_search_query(
        self,
        embedding: List[float],
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> str:
        """Generate optimized search query"""
        
        # Base query with CTE for better optimization
        query_parts = ["""
        WITH filtered_docs AS (
            SELECT id, content, embedding, metadata, source_type
            FROM embeddings
        """]
        
        # Apply filters in CTE for better performance
        if filters:
            where_conditions = []
            for key, value in filters.items():
                if key == 'supplier_id':
                    where_conditions.append("metadata->>'supplier_id' = %s")
                elif key == 'month':
                    where_conditions.append("metadata->>'month' = %s")
                # Add more filter conditions as needed
            
            if where_conditions:
                query_parts.append("WHERE " + " AND ".join(where_conditions))
        
        query_parts.append("""
        )
        SELECT 
            id, content, metadata, source_type,
            1 - (embedding <=> %s::vector) as similarity
        FROM filtered_docs
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """)
        
        return " ".join(query_parts)
    
    async def parallel_search(
        self,
        queries: List[Dict[str, Any]],
        max_parallel: int = 5
    ) -> List[List[Any]]:
        """Execute multiple searches in parallel"""
        
        results = []
        
        # Process in batches to avoid overwhelming the database
        for i in range(0, len(queries), max_parallel):
            batch = queries[i:i + max_parallel]
            
            tasks = []
            for query_params in batch:
                task = self._execute_single_search(query_params)
                tasks.append(task)
            
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)
        
        return results
    
    async def _execute_single_search(self, query_params: Dict[str, Any]) -> List[Any]:
        """Execute a single search query"""
        async with self.pool.acquire() as conn:
            with vector_search_time.labels(
                index_type='hnsw',
                result_count=query_params.get('limit', 10)
            ).time():
                return await conn.fetch(
                    query_params['query'],
                    *query_params['params']
                )


class IndexManager:
    """Manages vector index maintenance and optimization"""
    
    def __init__(self, connection_pool: ConnectionPool, config: PerformanceConfig):
        self.pool = connection_pool
        self.config = config
        self._maintenance_task: Optional[asyncio.Task] = None
    
    async def start_maintenance(self):
        """Start background maintenance tasks"""
        if self.config.auto_vacuum or self.config.auto_analyze:
            self._maintenance_task = asyncio.create_task(self._maintenance_loop())
    
    async def _maintenance_loop(self):
        """Periodic index maintenance"""
        while True:
            try:
                await asyncio.sleep(self.config.index_refresh_interval)
                
                async with self.pool.acquire() as conn:
                    # Run VACUUM to reclaim space
                    if self.config.auto_vacuum:
                        await conn.execute("VACUUM ANALYZE embeddings")
                        logging.info("Ran VACUUM ANALYZE on embeddings table")
                    
                    # Update statistics
                    if self.config.auto_analyze:
                        await conn.execute("ANALYZE embeddings")
                        logging.info("Updated statistics for embeddings table")
                    
                    # Check index bloat
                    bloat_info = await self._check_index_bloat(conn)
                    if bloat_info['bloat_ratio'] > 0.3:  # 30% bloat
                        logging.warning(f"Index bloat detected: {bloat_info}")
                        await self._rebuild_index(conn)
                
            except Exception as e:
                logging.error(f"Maintenance error: {e}")
    
    async def _check_index_bloat(self, conn: asyncpg.Connection) -> Dict[str, float]:
        """Check for index bloat"""
        result = await conn.fetchrow("""
            SELECT 
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                pg_size_pretty(pg_relation_size(indrelid)) as table_size,
                pg_relation_size(indexrelid)::float / NULLIF(pg_relation_size(indrelid), 0) as ratio
            FROM pg_index idx
            JOIN pg_class cls ON idx.indexrelid = cls.oid
            WHERE cls.relname = 'embeddings_hnsw_idx'
        """)
        
        return {
            'index_size': result['index_size'] if result else '0',
            'table_size': result['table_size'] if result else '0',
            'bloat_ratio': result['ratio'] if result else 0
        }
    
    async def _rebuild_index(self, conn: asyncpg.Connection):
        """Rebuild vector index"""
        logging.info("Rebuilding vector index...")
        
        # Create new index concurrently
        await conn.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS embeddings_hnsw_idx_new
            ON embeddings USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 200)
        """)
        
        # Swap indexes
        await conn.execute("DROP INDEX IF EXISTS embeddings_hnsw_idx")
        await conn.execute("ALTER INDEX embeddings_hnsw_idx_new RENAME TO embeddings_hnsw_idx")
        
        logging.info("Vector index rebuilt successfully")
    
    async def optimize_for_recall(self, target_recall: float = 0.95):
        """Optimize index parameters for target recall"""
        async with self.pool.acquire() as conn:
            # Adjust HNSW parameters
            ef_search = int(32 * (1 + target_recall))  # Heuristic
            await conn.execute(f"SET hnsw.ef_search = {ef_search}")
            logging.info(f"Optimized index for {target_recall} recall (ef_search={ef_search})")
    
    async def stop_maintenance(self):
        """Stop maintenance tasks"""
        if self._maintenance_task:
            self._maintenance_task.cancel()


class BatchProcessor:
    """Efficient batch processing for embeddings and indexing"""
    
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.pending_items: List[Dict[str, Any]] = []
        self._process_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
    
    async def add_item(self, item: Dict[str, Any]):
        """Add item to batch queue"""
        async with self._lock:
            self.pending_items.append(item)
            
            if len(self.pending_items) >= self.batch_size:
                await self._process_batch()
    
    async def _process_batch(self):
        """Process a batch of items"""
        if not self.pending_items:
            return
        
        batch = self.pending_items[:self.batch_size]
        self.pending_items = self.pending_items[self.batch_size:]
        
        # Process batch (override in subclass)
        await self._execute_batch(batch)
    
    async def _execute_batch(self, batch: List[Dict[str, Any]]):
        """Execute batch processing (to be overridden)"""
        raise NotImplementedError
    
    async def flush(self):
        """Process all pending items"""
        async with self._lock:
            while self.pending_items:
                await self._process_batch()


class OptimizedRAGService:
    """Optimized RAG service with all performance enhancements"""
    
    def __init__(
        self,
        config: PerformanceConfig,
        connection_string: str
    ):
        self.config = config
        self.connection_string = connection_string
        
        # Initialize components
        self.connection_pool = ConnectionPool(config, connection_string)
        self.query_optimizer = QueryOptimizer(self.connection_pool)
        self.index_manager = IndexManager(self.connection_pool, config)
        
        # Caching
        self.lru_cache = LRUCache(max_size=config.max_cache_size)
        self.redis_cache: Optional[RedisCache] = None
        if config.redis_url:
            self.redis_cache = RedisCache(config.redis_url)
    
    async def initialize(self):
        """Initialize all components"""
        await self.connection_pool.initialize()
        await self.index_manager.start_maintenance()
        
        if self.redis_cache:
            await self.redis_cache.initialize()
        
        logging.info("Optimized RAG service initialized")
    
    async def search_with_optimization(
        self,
        embedding: List[float],
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Optimized vector search with caching"""
        
        # Generate cache key
        cache_key = self._generate_cache_key(embedding, filters, limit)
        
        # Check cache
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return cached_result
        
        # Generate optimized query
        query = await self.query_optimizer.optimize_search_query(
            embedding, filters, limit
        )
        
        # Execute search
        async with self.connection_pool.acquire() as conn:
            with vector_search_time.labels(
                index_type='hnsw',
                result_count=limit
            ).time():
                results = await conn.fetch(query, *self._build_query_params(filters, embedding, limit))
        
        # Convert results
        formatted_results = [
            {
                'id': r['id'],
                'content': r['content'],
                'similarity': r['similarity'],
                'metadata': r['metadata']
            }
            for r in results
        ]
        
        # Cache results
        await self._cache_result(cache_key, formatted_results)
        
        return formatted_results
    
    def _generate_cache_key(
        self,
        embedding: List[float],
        filters: Optional[Dict[str, Any]],
        limit: int
    ) -> str:
        """Generate cache key for search"""
        # Use first few dimensions of embedding for key
        embedding_key = hashlib.md5(
            str(embedding[:10]).encode()
        ).hexdigest()[:8]
        
        filter_key = hashlib.md5(
            str(sorted(filters.items()) if filters else []).encode()
        ).hexdigest()[:8]
        
        return f"search:{embedding_key}:{filter_key}:{limit}"
    
    async def _get_cached_result(self, key: str) -> Optional[List[Dict[str, Any]]]:
        """Get result from cache"""
        # Try LRU cache first
        result = await self.lru_cache.get(key)
        if result:
            return result
        
        # Try Redis cache
        if self.redis_cache:
            cached_bytes = await self.redis_cache.get(key)
            if cached_bytes:
                import json
                return json.loads(cached_bytes)
        
        return None
    
    async def _cache_result(self, key: str, result: List[Dict[str, Any]]):
        """Cache search result"""
        # Add to LRU cache
        await self.lru_cache.set(key, result)
        
        # Add to Redis cache
        if self.redis_cache:
            import json
            await self.redis_cache.set(
                key,
                json.dumps(result).encode(),
                ttl=self.config.search_cache_ttl
            )
    
    def _build_query_params(
        self,
        filters: Optional[Dict[str, Any]],
        embedding: List[float],
        limit: int
    ) -> List[Any]:
        """Build query parameters"""
        params = []
        
        if filters:
            for key, value in filters.items():
                if key in ['supplier_id', 'month']:
                    params.append(value)
        
        params.extend([embedding, embedding, limit])
        return params
    
    async def close(self):
        """Clean up resources"""
        await self.index_manager.stop_maintenance()
        await self.connection_pool.close()
        
        if self.redis_cache:
            await self.redis_cache.close()
        
        logging.info("Optimized RAG service closed")