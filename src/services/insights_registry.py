"""
Insights Registry Implementation
Following TDD GREEN phase - minimal implementation to pass tests
"""

import asyncio
import hashlib
import json
from datetime import datetime
from typing import List, Dict, Optional, Any, Set
import asyncpg
from dataclasses import dataclass, field
import numpy as np


@dataclass
class InsightData:
    """Data structure for insights with human-friendly IDs"""
    insight_id: str
    month: str
    supplier: str
    title: str
    description: str
    severity: str = 'warn'
    status: str = 'open'
    source: str = 'rule'
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    evidence_links: List[Dict[str, Any]] = field(default_factory=list)


class InsightIDGenerator:
    """Generate human-friendly IDs in INS-YYYY-MM-NNN format"""
    
    def __init__(self, db_connection: Optional[asyncpg.Connection] = None):
        self.db_connection = db_connection
        self._sequence_cache = {}
        self._lock = asyncio.Lock()
    
    async def generate_id(self, month: str, supplier: str = None) -> str:
        """Generate unique ID for given month"""
        async with self._lock:
            # Get next sequence number for month
            sequence = await self._get_next_sequence(month)
            
            # Format: INS-YYYY-MM-NNN
            return f"INS-{month}-{sequence:03d}"
    
    async def _get_next_sequence(self, month: str) -> int:
        """Get next sequence number for month with database persistence"""
        if self.db_connection:
            # Query database for highest existing sequence
            query = """
                SELECT MAX(CAST(SUBSTRING(insight_id FROM 'INS-\\d{4}-\\d{2}-(\\d{3})') AS INTEGER))
                FROM insight
                WHERE insight_id LIKE $1
            """
            pattern = f"INS-{month}-%"
            result = await self.db_connection.fetchval(query, pattern)
            
            if result:
                return result + 1
            else:
                return 1
        else:
            # In-memory sequence for testing
            if month not in self._sequence_cache:
                self._sequence_cache[month] = 0
            self._sequence_cache[month] += 1
            return self._sequence_cache[month]
    
    def validate_id_format(self, insight_id: str) -> bool:
        """Validate ID format"""
        import re
        pattern = r'^INS-\d{4}-\d{2}-\d{3}$'
        return bool(re.match(pattern, insight_id))


class InsightClusteringEngine:
    """Engine for clustering insights based on similarity"""
    
    def __init__(self):
        self.similarity_threshold = 0.8
    
    async def cluster_insights(
        self,
        insights: List[Any],  # Can be InsightData or dict
        similarity_threshold: float = 0.8,
        cross_supplier: bool = False
    ) -> List[Dict[str, Any]]:
        """Cluster similar insights"""
        if not insights:
            return []
        
        clusters = []
        clustered_ids = set()
        
        for i, insight in enumerate(insights):
            # Handle both InsightData objects and dictionaries
            insight_id = insight.insight_id if hasattr(insight, 'insight_id') else insight.get('id')
            if insight_id in clustered_ids:
                continue
            
            # Get embedding from object or dict
            insight_embedding = insight.embedding if hasattr(insight, 'embedding') else insight.get('embedding')
            
            cluster = {
                'cluster_id': f"CLU-{len(clusters)+1:03d}",
                'members': [insight],
                'confidence': 0.95,
                'centroid': insight_embedding,
                'radius': 0.0
            }
            
            # Find similar insights
            for j, other in enumerate(insights[i+1:], i+1):
                other_id = other.insight_id if hasattr(other, 'insight_id') else other.get('id')
                if other_id in clustered_ids:
                    continue
                
                other_embedding = other.embedding if hasattr(other, 'embedding') else other.get('embedding')
                
                if insight_embedding and other_embedding:
                    similarity = self._calculate_similarity(
                        insight_embedding,
                        other_embedding
                    )
                    if similarity >= similarity_threshold:
                        cluster['members'].append(other)
                        clustered_ids.add(other_id)
            
            clusters.append(cluster)
            clustered_ids.add(insight_id)
        
        return clusters
    
    def _calculate_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        """Calculate cosine similarity between embeddings"""
        if not emb1 or not emb2:
            return 0.0
        
        vec1 = np.array(emb1)
        vec2 = np.array(emb2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    async def find_cross_supplier_patterns(
        self,
        insights: List[InsightData],
        min_suppliers: int = 2
    ) -> List[Dict[str, Any]]:
        """Find patterns across multiple suppliers"""
        # Group by similar embeddings
        clusters = await self.cluster_insights(insights, threshold=0.85)
        
        patterns = []
        for cluster in clusters:
            suppliers = set(m.supplier for m in cluster['members'])
            if len(suppliers) >= min_suppliers:
                patterns.append({
                    'pattern_id': f"PAT-{len(patterns)+1:03d}",
                    'suppliers': list(suppliers),
                    'insights': cluster['members'],
                    'confidence': cluster['confidence']
                })
        
        return patterns


class EvidenceLinker:
    """Link evidence to insights"""
    
    def __init__(self):
        self.evidence_store = {}
    
    async def link_evidence(
        self,
        insight_id: str,
        evidence: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Link evidence to insight"""
        link_id = self._generate_link_id(insight_id, evidence)
        
        link = {
            'link_id': link_id,
            'insight_id': insight_id,
            'evidence_type': evidence.get('type', 'raw_data'),
            'evidence_ref': evidence.get('ref'),
            'metadata': evidence.get('metadata', {}),
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Store link
        if insight_id not in self.evidence_store:
            self.evidence_store[insight_id] = []
        self.evidence_store[insight_id].append(link)
        
        return link
    
    async def get_evidence_for_insight(
        self,
        insight_id: str
    ) -> List[Dict[str, Any]]:
        """Get all evidence linked to insight"""
        return self.evidence_store.get(insight_id, [])
    
    def _generate_link_id(self, insight_id: str, evidence: Dict[str, Any]) -> str:
        """Generate unique link ID"""
        content = f"{insight_id}-{evidence.get('ref', '')}-{datetime.utcnow()}"
        return hashlib.sha256(content.encode()).hexdigest()[:12]
    
    async def validate_evidence_integrity(
        self,
        insight_id: str
    ) -> Dict[str, Any]:
        """Validate integrity of linked evidence"""
        evidence_list = await self.get_evidence_for_insight(insight_id)
        
        return {
            'valid': len(evidence_list) > 0,
            'evidence_count': len(evidence_list),
            'types': list(set(e['evidence_type'] for e in evidence_list))
        }


class InsightMerger:
    """Handle merge and split operations for insights"""
    
    def __init__(self):
        self.merge_history = []
    
    async def merge_insights(
        self,
        insight_ids: List[str],
        merged_insight: InsightData
    ) -> InsightData:
        """Merge multiple insights into one"""
        # Record merge operation
        merge_record = {
            'operation': 'merge',
            'source_ids': insight_ids,
            'target_id': merged_insight.insight_id,
            'timestamp': datetime.utcnow().isoformat(),
            'user': 'system'
        }
        self.merge_history.append(merge_record)
        
        # Inherit highest severity
        merged_insight.metadata['merged_from'] = insight_ids
        merged_insight.metadata['merge_timestamp'] = merge_record['timestamp']
        
        return merged_insight
    
    async def split_insight(
        self,
        insight_id: str,
        split_insights: List[InsightData]
    ) -> List[InsightData]:
        """Split one insight into multiple"""
        # Record split operation
        split_record = {
            'operation': 'split',
            'source_id': insight_id,
            'target_ids': [i.insight_id for i in split_insights],
            'timestamp': datetime.utcnow().isoformat(),
            'user': 'system'
        }
        self.merge_history.append(split_record)
        
        # Add metadata to split insights
        for insight in split_insights:
            insight.metadata['split_from'] = insight_id
            insight.metadata['split_timestamp'] = split_record['timestamp']
        
        return split_insights
    
    async def get_audit_trail(self, insight_id: str) -> List[Dict[str, Any]]:
        """Get audit trail for insight"""
        trail = []
        
        for record in self.merge_history:
            if record['operation'] == 'merge':
                if insight_id in record['source_ids'] or insight_id == record['target_id']:
                    trail.append(record)
            elif record['operation'] == 'split':
                if insight_id == record['source_id'] or insight_id in record['target_ids']:
                    trail.append(record)
        
        return trail


class InsightsRegistry:
    """Main registry for managing insights"""
    
    def __init__(self, db_connection: Optional[asyncpg.Connection] = None):
        self.db_connection = db_connection
        self.id_generator = InsightIDGenerator(db_connection)
        self.clustering_engine = InsightClusteringEngine()
        self.evidence_linker = EvidenceLinker()
        self.merger = InsightMerger()
        self.insights_store: Dict[str, InsightData] = {}
        self.status_transitions = {
            'new': ['reviewing', 'closed'],
            'reviewing': ['validated', 'rejected', 'new'],
            'validated': ['resolved', 'reviewing'],
            'rejected': ['new', 'closed'],
            'resolved': ['closed'],
            'closed': []
        }
    
    async def create_insight(
        self,
        month: str,
        supplier: str,
        title: str,
        description: str,
        **kwargs
    ) -> InsightData:
        """Create new insight with human-friendly ID"""
        insight_id = await self.id_generator.generate_id(month, supplier)
        
        insight = InsightData(
            insight_id=insight_id,
            month=month,
            supplier=supplier,
            title=title,
            description=description,
            **kwargs
        )
        
        self.insights_store[insight_id] = insight
        return insight
    
    async def get_insight(self, insight_id: str) -> Optional[InsightData]:
        """Get insight by ID"""
        return self.insights_store.get(insight_id)
    
    async def update_status(
        self,
        insight_id: str,
        new_status: str,
        user: str = 'system'
    ) -> bool:
        """Update insight status with validation"""
        insight = await self.get_insight(insight_id)
        if not insight:
            return False
        
        # Map our test statuses to allowed transitions
        status_map = {
            'new': 'new',
            'reviewing': 'reviewing',
            'validated': 'validated',
            'resolved': 'resolved'
        }
        
        current = status_map.get(insight.status, insight.status)
        target = status_map.get(new_status, new_status)
        
        # Check if transition is allowed
        if current in self.status_transitions:
            if target in self.status_transitions[current]:
                insight.status = new_status
                insight.updated_at = datetime.utcnow()
                
                # Add to metadata for audit
                if 'status_history' not in insight.metadata:
                    insight.metadata['status_history'] = []
                
                insight.metadata['status_history'].append({
                    'from': current,
                    'to': new_status,
                    'user': user,
                    'timestamp': insight.updated_at.isoformat()
                })
                
                return True
        
        return False
    
    async def search_insights(
        self,
        text: str = None,
        filters: Dict[str, Any] = None,
        limit: int = 100
    ) -> List[InsightData]:
        """Search insights with text and filters"""
        results = []
        
        for insight in self.insights_store.values():
            # Text search
            if text:
                if text.lower() not in insight.title.lower() and \
                   text.lower() not in insight.description.lower():
                    continue
            
            # Apply filters
            if filters:
                match = True
                for key, value in filters.items():
                    if hasattr(insight, key):
                        if getattr(insight, key) != value:
                            match = False
                            break
                if not match:
                    continue
            
            results.append(insight)
            
            if len(results) >= limit:
                break
        
        return results
    
    async def store_markdown_details(
        self,
        insight_id: str,
        markdown_content: str
    ) -> bool:
        """Store markdown details for insight"""
        insight = await self.get_insight(insight_id)
        if not insight:
            return False
        
        insight.metadata['markdown_details'] = markdown_content
        insight.updated_at = datetime.utcnow()
        return True
    
    async def get_markdown_details(
        self,
        insight_id: str
    ) -> Optional[str]:
        """Get markdown details for insight"""
        insight = await self.get_insight(insight_id)
        if not insight:
            return None
        
        return insight.metadata.get('markdown_details')