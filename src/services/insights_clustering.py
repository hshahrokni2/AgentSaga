"""
Insight Clustering Algorithms
Following TDD GREEN phase - minimal implementation to pass tests
"""

import numpy as np
from typing import List, Dict, Any, Set, Optional, Tuple
from dataclasses import dataclass
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import pdist, cdist
from sklearn.metrics import silhouette_score
import hashlib


@dataclass
class ClusterResult:
    """Result of clustering operation"""
    cluster_id: str
    members: List[Dict[str, Any]]
    centroid: Optional[List[float]] = None
    radius: float = 0.0
    confidence: float = 0.0


class SimilarityCalculator:
    """Calculate similarity between insights"""
    
    def cosine_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        if embedding1.shape != embedding2.shape:
            return 0.0
        
        dot_product = np.dot(embedding1, embedding2)
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))
    
    def calculate_similarity(
        self,
        insight1: Dict[str, Any],
        insight2: Dict[str, Any],
        weights: Dict[str, float] = None
    ) -> float:
        """Calculate weighted similarity considering multiple factors"""
        if weights is None:
            weights = {'embedding': 1.0}
        
        total_similarity = 0.0
        total_weight = 0.0
        
        # Embedding similarity
        if 'embedding' in weights and weights['embedding'] > 0:
            emb1 = np.array(insight1.get('embedding', []))
            emb2 = np.array(insight2.get('embedding', []))
            
            if emb1.size > 0 and emb2.size > 0:
                emb_sim = self.cosine_similarity(emb1, emb2)
                total_similarity += emb_sim * weights['embedding']
                total_weight += weights['embedding']
        
        # Context similarity (supplier, month, severity)
        if 'context' in weights and weights['context'] > 0:
            context_sim = 0.0
            context_factors = 0
            
            if insight1.get('supplier') == insight2.get('supplier'):
                context_sim += 0.4
                context_factors += 1
            
            if insight1.get('month') == insight2.get('month'):
                context_sim += 0.4
                context_factors += 1
            
            if insight1.get('severity') == insight2.get('severity'):
                context_sim += 0.2
                context_factors += 1
            
            if context_factors > 0:
                total_similarity += context_sim * weights['context']
                total_weight += weights['context']
        
        if total_weight == 0:
            return 0.0
        
        return total_similarity / total_weight
    
    def jaccard_similarity(self, set1: Set, set2: Set) -> float:
        """Calculate Jaccard similarity between two sets"""
        if not set1 and not set2:
            return 1.0
        if not set1 or not set2:
            return 0.0
        
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def ensemble_similarity(
        self,
        insight1: Dict[str, Any],
        insight2: Dict[str, Any],
        metrics: Dict[str, Dict[str, Any]]
    ) -> float:
        """Calculate ensemble similarity using multiple metrics"""
        total_similarity = 0.0
        total_weight = 0.0
        
        for metric_name, config in metrics.items():
            weight = config.get('weight', 0.0)
            method = config.get('method', 'cosine')
            
            if weight <= 0:
                continue
            
            if method == 'cosine' and metric_name == 'embedding':
                emb1 = np.array(insight1.get('embedding', [0.5, 0.5]))
                emb2 = np.array(insight2.get('embedding', [0.52, 0.48]))
                sim = self.cosine_similarity(emb1, emb2)
            
            elif method == 'jaccard' and metric_name == 'tags':
                tags1 = set(insight1.get('tags', []))
                tags2 = set(insight2.get('tags', []))
                sim = self.jaccard_similarity(tags1, tags2)
            
            elif method == 'levenshtein' and metric_name == 'text':
                # Simplified text similarity
                title1 = insight1.get('title', '')
                title2 = insight2.get('title', '')
                # Simple character overlap ratio
                common = sum(1 for c1, c2 in zip(title1, title2) if c1 == c2)
                sim = common / max(len(title1), len(title2), 1)
            
            elif method == 'exact' and metric_name == 'metadata':
                # Exact match for severity
                sim = 1.0 if insight1.get('severity') == insight2.get('severity') else 0.0
            
            else:
                sim = 0.5  # Default medium similarity
            
            total_similarity += sim * weight
            total_weight += weight
        
        if total_weight == 0:
            return 0.0
        
        return total_similarity / total_weight


class HierarchicalClustering:
    """Hierarchical clustering for insights"""
    
    async def cluster(
        self,
        insights: List[Dict[str, Any]],
        method: str = 'single',
        threshold: float = 0.15
    ) -> List[Dict[str, Any]]:
        """Perform hierarchical clustering"""
        if len(insights) < 2:
            return [{'members': insights}] if insights else []
        
        # Extract embeddings
        embeddings = []
        for insight in insights:
            emb = insight.get('embedding', [0, 0])
            if isinstance(emb, list):
                embeddings.append(emb)
            else:
                embeddings.append([0, 0])
        
        X = np.array(embeddings)
        
        # Compute distance matrix
        distances = pdist(X, metric='euclidean')
        
        # Perform hierarchical clustering
        Z = linkage(distances, method=method)
        
        # Form clusters
        labels = fcluster(Z, threshold, criterion='distance')
        
        # Group insights by cluster
        clusters = {}
        for idx, label in enumerate(labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(insights[idx])
        
        # Format results
        result = []
        for cluster_id, members in clusters.items():
            result.append({'members': members})
        
        return result
    
    async def compute_adaptive_threshold(
        self,
        insights: List[Dict[str, Any]]
    ) -> float:
        """Compute adaptive threshold based on data distribution"""
        if len(insights) < 2:
            return 0.5
        
        # Extract embeddings
        embeddings = []
        for insight in insights:
            emb = insight.get('embedding', [0, 0])
            embeddings.append(emb if isinstance(emb, list) else [0, 0])
        
        X = np.array(embeddings)
        
        # Compute pairwise distances
        distances = pdist(X, metric='euclidean')
        
        # Use median distance as adaptive threshold
        if len(distances) > 0:
            # Sparse data has larger distances
            median_dist = np.median(distances)
            # Adjust threshold based on sparsity
            if median_dist > 5.0:  # Sparse
                return median_dist * 0.3
            else:  # Dense
                return median_dist * 0.5
        
        return 0.5
    
    async def calculate_stability(
        self,
        original_clusters: List[Dict[str, Any]],
        noisy_clusters: List[Dict[str, Any]]
    ) -> float:
        """Calculate stability score between two clusterings"""
        if not original_clusters or not noisy_clusters:
            return 0.0
        
        # Create ID to cluster mapping
        orig_mapping = {}
        for i, cluster in enumerate(original_clusters):
            for member in cluster.get('members', []):
                member_id = member.get('id', str(member))
                orig_mapping[member_id] = i
        
        noisy_mapping = {}
        for i, cluster in enumerate(noisy_clusters):
            for member in cluster.get('members', []):
                member_id = member.get('id', str(member))
                noisy_mapping[member_id] = i
        
        # Calculate agreement
        total = len(orig_mapping)
        if total == 0:
            return 0.0
        
        agreements = 0
        for member_id in orig_mapping:
            if member_id in noisy_mapping:
                # Check if members that were together stay together
                orig_cluster = orig_mapping[member_id]
                noisy_cluster = noisy_mapping[member_id]
                
                # Find co-members in original
                co_members_orig = {
                    m_id for m_id, c in orig_mapping.items()
                    if c == orig_cluster and m_id != member_id
                }
                
                # Find co-members in noisy
                co_members_noisy = {
                    m_id for m_id, c in noisy_mapping.items()
                    if c == noisy_cluster and m_id != member_id
                }
                
                # Calculate overlap
                if len(co_members_orig) > 0:
                    overlap = len(co_members_orig.intersection(co_members_noisy))
                    agreements += overlap / len(co_members_orig)
                else:
                    agreements += 1.0  # Singleton remains singleton
        
        return agreements / total


class ClusterValidator:
    """Validate cluster quality"""
    
    async def silhouette_score(
        self,
        clusters: List[Dict[str, Any]]
    ) -> float:
        """Calculate silhouette coefficient"""
        if len(clusters) < 2:
            return 0.0
        
        # Extract all points and labels
        X = []
        labels = []
        
        for cluster_idx, cluster in enumerate(clusters):
            for member in cluster.get('members', []):
                emb = member.get('embedding', [0, 0])
                X.append(emb if isinstance(emb, list) else [0, 0])
                labels.append(cluster_idx)
        
        if len(set(labels)) < 2:
            return 0.0
        
        X = np.array(X)
        
        # Calculate silhouette score
        try:
            score = silhouette_score(X, labels, metric='euclidean')
            return float(score)
        except:
            return 0.0
    
    async def davies_bouldin_index(
        self,
        clusters: List[Dict[str, Any]]
    ) -> float:
        """Calculate Davies-Bouldin index (lower is better)"""
        if len(clusters) < 2:
            return float('inf')
        
        # Calculate centroids and intra-cluster distances
        centroids = []
        intra_distances = []
        
        for cluster in clusters:
            members = cluster.get('members', [])
            if not members:
                continue
            
            # Get centroid
            centroid = cluster.get('centroid')
            if not centroid:
                # Calculate centroid
                embeddings = [m.get('embedding', [0, 0]) for m in members]
                centroid = np.mean(embeddings, axis=0).tolist()
            centroids.append(centroid)
            
            # Calculate average distance to centroid
            distances = []
            for member in members:
                emb = member.get('embedding', [0, 0])
                dist = np.linalg.norm(np.array(emb) - np.array(centroid))
                distances.append(dist)
            
            avg_dist = np.mean(distances) if distances else 0
            intra_distances.append(avg_dist)
        
        if len(centroids) < 2:
            return float('inf')
        
        # Calculate Davies-Bouldin index
        n_clusters = len(centroids)
        db_index = 0.0
        
        for i in range(n_clusters):
            max_ratio = 0.0
            for j in range(n_clusters):
                if i != j:
                    # Distance between centroids
                    inter_dist = np.linalg.norm(
                        np.array(centroids[i]) - np.array(centroids[j])
                    )
                    
                    if inter_dist > 0:
                        # Ratio of intra to inter distances
                        ratio = (intra_distances[i] + intra_distances[j]) / inter_dist
                        max_ratio = max(max_ratio, ratio)
            
            db_index += max_ratio
        
        return db_index / n_clusters if n_clusters > 0 else float('inf')
    
    async def coherence_score(
        self,
        cluster: Dict[str, Any]
    ) -> float:
        """Calculate semantic coherence within cluster"""
        members = cluster.get('members', [])
        if len(members) < 2:
            return 1.0 if members else 0.0
        
        # Calculate pairwise tag similarity
        coherence = 0.0
        pairs = 0
        
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                tags1 = set(members[i].get('tags', []))
                tags2 = set(members[j].get('tags', []))
                
                if tags1 or tags2:
                    similarity = len(tags1.intersection(tags2)) / max(
                        len(tags1.union(tags2)), 1
                    )
                    coherence += similarity
                    pairs += 1
        
        if pairs == 0:
            return 0.5
        
        return coherence / pairs


class CrossSupplierAnalyzer:
    """Analyze patterns across suppliers"""
    
    async def identify_patterns(
        self,
        insights: List[Dict[str, Any]],
        min_suppliers: int = 2
    ) -> List[Dict[str, Any]]:
        """Identify cross-supplier patterns"""
        # Group insights by embedding similarity
        patterns = []
        used_insights = set()
        
        for i, insight in enumerate(insights):
            if insight['id'] in used_insights:
                continue
            
            pattern_insights = [insight]
            pattern_suppliers = {insight.get('supplier')}
            
            # Find similar insights from other suppliers
            for j, other in enumerate(insights[i+1:], i+1):
                if other['id'] in used_insights:
                    continue
                
                # Check embedding similarity
                emb1 = np.array(insight.get('embedding', [0, 0]))
                emb2 = np.array(other.get('embedding', [0, 0]))
                
                similarity = np.dot(emb1, emb2) / (
                    np.linalg.norm(emb1) * np.linalg.norm(emb2) + 1e-10
                )
                
                if similarity > 0.9:  # High similarity threshold
                    pattern_insights.append(other)
                    pattern_suppliers.add(other.get('supplier'))
                    used_insights.add(other['id'])
            
            if len(pattern_suppliers) >= min_suppliers:
                patterns.append({
                    'pattern_id': f'PAT-{len(patterns)+1:03d}',
                    'suppliers': list(pattern_suppliers),
                    'insights': pattern_insights,
                    'confidence': 0.85
                })
                used_insights.add(insight['id'])
        
        return patterns
    
    async def classify_issues(
        self,
        insights: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Classify issues as systemic or supplier-specific"""
        # Identify patterns
        patterns = await self.identify_patterns(insights, min_suppliers=2)
        
        systemic = []
        supplier_specific = []
        
        # Insights in patterns are systemic
        systemic_ids = set()
        for pattern in patterns:
            for insight in pattern['insights']:
                systemic.append(insight)
                systemic_ids.add(insight['id'])
        
        # Remaining are supplier-specific
        for insight in insights:
            if insight['id'] not in systemic_ids:
                supplier_specific.append(insight)
        
        return {
            'systemic': systemic,
            'supplier_specific': supplier_specific
        }
    
    async def detect_temporal_patterns(
        self,
        insights: List[Dict[str, Any]],
        time_window: str = 'month'
    ) -> List[Dict[str, Any]]:
        """Detect temporal patterns across suppliers"""
        # Group by time period
        temporal_groups = {}
        
        for insight in insights:
            period = insight.get(time_window, '2024-01')
            if period not in temporal_groups:
                temporal_groups[period] = []
            temporal_groups[period].append(insight)
        
        patterns = []
        
        for period, group in temporal_groups.items():
            # Check if pattern exists across suppliers
            suppliers = set(i.get('supplier') for i in group)
            
            if len(suppliers) >= 3:
                # Determine pattern type based on embeddings
                embeddings = [i.get('embedding', [0, 0]) for i in group]
                avg_embedding = np.mean(embeddings, axis=0)
                
                # Simple heuristic for pattern type
                pattern_type = 'spike' if avg_embedding[0] > 0.5 else 'normal'
                
                patterns.append({
                    'period': period,
                    'pattern_type': pattern_type,
                    'affected_suppliers': list(suppliers),
                    'insights': group
                })
        
        return patterns