"""
TDD RED Phase Tests for Insight Clustering Algorithm
Focus on similarity computation, threshold tuning, and cross-supplier scenarios
"""

import pytest
import numpy as np
from typing import List, Dict, Any
import asyncio
from unittest.mock import Mock, AsyncMock

# Import the (not yet implemented) clustering components
# from src.services.insights_clustering import (
#     SimilarityCalculator,
#     HierarchicalClustering,
#     ClusterValidator,
#     CrossSupplierAnalyzer
# )


class TestSimilarityCalculation:
    """Test similarity metrics for insight clustering"""
    
    @pytest.fixture
    def similarity_calculator(self):
        """Create similarity calculator instance"""
        from src.services.insights_clustering import SimilarityCalculator
        return SimilarityCalculator()
    
    def test_cosine_similarity(self, similarity_calculator):
        """Test cosine similarity between embeddings"""
        embedding1 = np.array([1.0, 0.0, 0.0])
        embedding2 = np.array([1.0, 0.0, 0.0])
        embedding3 = np.array([0.0, 1.0, 0.0])
        
        # Identical embeddings
        sim_identical = similarity_calculator.cosine_similarity(embedding1, embedding2)
        assert sim_identical == pytest.approx(1.0)
        
        # Orthogonal embeddings
        sim_orthogonal = similarity_calculator.cosine_similarity(embedding1, embedding3)
        assert sim_orthogonal == pytest.approx(0.0)
    
    def test_semantic_similarity_with_context(self, similarity_calculator):
        """Test semantic similarity considering context"""
        insight1 = {
            "embedding": [0.5, 0.5, 0.5],
            "supplier": "supplier-1",
            "month": "2024-03",
            "severity": "high"
        }
        
        insight2 = {
            "embedding": [0.51, 0.49, 0.52],
            "supplier": "supplier-1",
            "month": "2024-03",
            "severity": "high"
        }
        
        insight3 = {
            "embedding": [0.51, 0.49, 0.52],
            "supplier": "supplier-2",
            "month": "2024-04",
            "severity": "low"
        }
        
        # Similar embeddings, same context
        sim_same_context = similarity_calculator.calculate_similarity(
            insight1, insight2,
            weights={"embedding": 0.7, "context": 0.3}
        )
        
        # Similar embeddings, different context
        sim_diff_context = similarity_calculator.calculate_similarity(
            insight1, insight3,
            weights={"embedding": 0.7, "context": 0.3}
        )
        
        assert sim_same_context > sim_diff_context
    
    def test_jaccard_similarity_for_categories(self, similarity_calculator):
        """Test Jaccard similarity for categorical attributes"""
        tags1 = {"waste", "volume", "weekend", "anomaly"}
        tags2 = {"waste", "volume", "weekday", "anomaly"}
        tags3 = {"invoice", "duplicate", "error"}
        
        # High overlap
        sim_high = similarity_calculator.jaccard_similarity(tags1, tags2)
        assert sim_high == pytest.approx(0.6, rel=0.01)  # 3 common / 5 total
        
        # No overlap
        sim_none = similarity_calculator.jaccard_similarity(tags1, tags3)
        assert sim_none == 0.0
    
    def test_weighted_ensemble_similarity(self, similarity_calculator):
        """Test ensemble of multiple similarity metrics"""
        insight1 = {
            "embedding": [0.5, 0.5],
            "title": "High waste volume on weekends",
            "tags": {"waste", "volume", "weekend"},
            "severity": "high"
        }
        
        insight2 = {
            "embedding": [0.52, 0.48],
            "title": "Elevated waste amounts during weekends",
            "tags": {"waste", "volume", "weekend"},
            "severity": "high"
        }
        
        similarity = similarity_calculator.ensemble_similarity(
            insight1, insight2,
            metrics={
                "embedding": {"weight": 0.4, "method": "cosine"},
                "text": {"weight": 0.3, "method": "levenshtein"},
                "tags": {"weight": 0.2, "method": "jaccard"},
                "metadata": {"weight": 0.1, "method": "exact"}
            }
        )
        
        assert 0.7 < similarity < 1.0  # Should be high but not perfect


class TestHierarchicalClustering:
    """Test hierarchical clustering implementation"""
    
    @pytest.fixture
    async def clustering_engine(self):
        """Create hierarchical clustering engine"""
        from src.services.insights_clustering import HierarchicalClustering
        return HierarchicalClustering()
    
    @pytest.mark.asyncio
    async def test_single_linkage_clustering(self, clustering_engine):
        """Test single linkage hierarchical clustering"""
        insights = [
            {"id": f"INS-{i}", "embedding": [i * 0.1, i * 0.1]}
            for i in range(10)
        ]
        
        clusters = await clustering_engine.cluster(
            insights,
            method="single",
            threshold=0.15
        )
        
        # Should create reasonable number of clusters
        assert 3 <= len(clusters) <= 7
        
        # Each insight should be in exactly one cluster
        all_ids = []
        for cluster in clusters:
            all_ids.extend([m["id"] for m in cluster["members"]])
        assert len(all_ids) == 10
        assert len(set(all_ids)) == 10
    
    @pytest.mark.asyncio
    async def test_complete_linkage_clustering(self, clustering_engine):
        """Test complete linkage hierarchical clustering"""
        insights = [
            {"id": "INS-001", "embedding": [0.0, 0.0]},
            {"id": "INS-002", "embedding": [0.1, 0.1]},
            {"id": "INS-003", "embedding": [0.11, 0.09]},
            {"id": "INS-004", "embedding": [1.0, 1.0]},
            {"id": "INS-005", "embedding": [0.99, 1.01]}
        ]
        
        clusters = await clustering_engine.cluster(
            insights,
            method="complete",
            threshold=0.2
        )
        
        # Should create 2-3 clusters
        assert 2 <= len(clusters) <= 3
    
    @pytest.mark.asyncio
    async def test_dynamic_threshold_adjustment(self, clustering_engine):
        """Test dynamic threshold based on data distribution"""
        # Sparse data
        sparse_insights = [
            {"id": f"INS-{i}", "embedding": [i, i]}
            for i in range(0, 10, 2)
        ]
        
        # Dense data
        dense_insights = [
            {"id": f"INS-{i}", "embedding": [i * 0.01, i * 0.01]}
            for i in range(10)
        ]
        
        sparse_threshold = await clustering_engine.compute_adaptive_threshold(
            sparse_insights
        )
        dense_threshold = await clustering_engine.compute_adaptive_threshold(
            dense_insights
        )
        
        # Sparse data should have higher threshold
        assert sparse_threshold > dense_threshold
    
    @pytest.mark.asyncio
    async def test_cluster_stability(self, clustering_engine):
        """Test cluster stability with small perturbations"""
        base_insights = [
            {"id": f"INS-{i}", "embedding": [i * 0.2, (10-i) * 0.2]}
            for i in range(10)
        ]
        
        # Original clustering
        original_clusters = await clustering_engine.cluster(
            base_insights,
            threshold=0.3
        )
        
        # Add small noise
        noisy_insights = [
            {
                "id": insight["id"],
                "embedding": [
                    insight["embedding"][0] + np.random.normal(0, 0.01),
                    insight["embedding"][1] + np.random.normal(0, 0.01)
                ]
            }
            for insight in base_insights
        ]
        
        noisy_clusters = await clustering_engine.cluster(
            noisy_insights,
            threshold=0.3
        )
        
        # Clusters should be mostly stable
        stability_score = await clustering_engine.calculate_stability(
            original_clusters,
            noisy_clusters
        )
        assert stability_score > 0.8  # 80% stability


class TestClusterValidation:
    """Test cluster quality validation"""
    
    @pytest.fixture
    def cluster_validator(self):
        """Create cluster validator instance"""
        from src.services.insights_clustering import ClusterValidator
        return ClusterValidator()
    
    @pytest.mark.asyncio
    async def test_silhouette_score(self, cluster_validator):
        """Test silhouette coefficient for cluster quality"""
        # Good clustering
        good_clusters = [
            {
                "members": [
                    {"id": "INS-001", "embedding": [0.0, 0.0]},
                    {"id": "INS-002", "embedding": [0.1, 0.1]}
                ]
            },
            {
                "members": [
                    {"id": "INS-003", "embedding": [1.0, 1.0]},
                    {"id": "INS-004", "embedding": [0.9, 0.9]}
                ]
            }
        ]
        
        good_score = await cluster_validator.silhouette_score(good_clusters)
        assert good_score > 0.5
        
        # Bad clustering
        bad_clusters = [
            {
                "members": [
                    {"id": "INS-001", "embedding": [0.0, 0.0]},
                    {"id": "INS-002", "embedding": [1.0, 1.0]}
                ]
            },
            {
                "members": [
                    {"id": "INS-003", "embedding": [0.1, 0.1]},
                    {"id": "INS-004", "embedding": [0.9, 0.9]}
                ]
            }
        ]
        
        bad_score = await cluster_validator.silhouette_score(bad_clusters)
        assert bad_score < good_score
    
    @pytest.mark.asyncio
    async def test_davies_bouldin_index(self, cluster_validator):
        """Test Davies-Bouldin index for cluster separation"""
        clusters = [
            {
                "members": [
                    {"id": f"INS-{i}", "embedding": [j, j]}
                    for i in range(3)
                ],
                "centroid": [j, j]
            }
            for j in range(3)
        ]
        
        db_index = await cluster_validator.davies_bouldin_index(clusters)
        
        # Lower is better
        assert db_index < 1.0
    
    @pytest.mark.asyncio
    async def test_cluster_coherence(self, cluster_validator):
        """Test semantic coherence within clusters"""
        coherent_cluster = {
            "members": [
                {
                    "id": "INS-001",
                    "title": "High waste volume on weekends",
                    "tags": ["waste", "volume", "weekend"]
                },
                {
                    "id": "INS-002",
                    "title": "Elevated waste during weekends",
                    "tags": ["waste", "weekend", "anomaly"]
                }
            ]
        }
        
        incoherent_cluster = {
            "members": [
                {
                    "id": "INS-003",
                    "title": "High waste volume",
                    "tags": ["waste", "volume"]
                },
                {
                    "id": "INS-004",
                    "title": "Missing invoice data",
                    "tags": ["invoice", "missing", "error"]
                }
            ]
        }
        
        coherent_score = await cluster_validator.coherence_score(coherent_cluster)
        incoherent_score = await cluster_validator.coherence_score(incoherent_cluster)
        
        assert coherent_score > incoherent_score
        assert coherent_score > 0.7
        assert incoherent_score < 0.5


class TestCrossSupplierClustering:
    """Test clustering across multiple suppliers"""
    
    @pytest.fixture
    async def cross_supplier_analyzer(self):
        """Create cross-supplier analyzer"""
        from src.services.insights_clustering import CrossSupplierAnalyzer
        return CrossSupplierAnalyzer()
    
    @pytest.mark.asyncio
    async def test_identify_cross_supplier_patterns(self, cross_supplier_analyzer):
        """Test identification of patterns across suppliers"""
        insights = [
            # Pattern 1: Weekend anomalies across suppliers
            {
                "id": "INS-001",
                "supplier": "supplier-1",
                "title": "Weekend volume spike",
                "embedding": [0.8, 0.2]
            },
            {
                "id": "INS-002",
                "supplier": "supplier-2",
                "title": "Weekend anomaly detected",
                "embedding": [0.79, 0.21]
            },
            {
                "id": "INS-003",
                "supplier": "supplier-3",
                "title": "High weekend waste",
                "embedding": [0.81, 0.19]
            },
            # Pattern 2: Supplier-specific issue
            {
                "id": "INS-004",
                "supplier": "supplier-1",
                "title": "Invoice error",
                "embedding": [0.2, 0.8]
            }
        ]
        
        patterns = await cross_supplier_analyzer.identify_patterns(
            insights,
            min_suppliers=2
        )
        
        assert len(patterns) == 1  # Only weekend pattern is cross-supplier
        weekend_pattern = patterns[0]
        assert len(weekend_pattern["suppliers"]) == 3
        assert weekend_pattern["confidence"] > 0.8
    
    @pytest.mark.asyncio
    async def test_supplier_specific_vs_systemic(self, cross_supplier_analyzer):
        """Test classification of issues as supplier-specific or systemic"""
        insights = [
            # Systemic issue
            {"id": f"INS-{i:03d}", "supplier": f"supplier-{i}", 
             "title": "Data quality issue", "embedding": [0.5, 0.5]}
            for i in range(5)
        ] + [
            # Supplier-specific issue
            {"id": "INS-100", "supplier": "supplier-1",
             "title": "Unique problem", "embedding": [0.9, 0.1]}
        ]
        
        classification = await cross_supplier_analyzer.classify_issues(insights)
        
        assert len(classification["systemic"]) == 5
        assert len(classification["supplier_specific"]) == 1
        assert classification["supplier_specific"][0]["id"] == "INS-100"
    
    @pytest.mark.asyncio
    async def test_temporal_pattern_detection(self, cross_supplier_analyzer):
        """Test detection of temporal patterns across suppliers"""
        insights = []
        
        # Create monthly pattern across suppliers
        for month in range(1, 4):
            for supplier in range(1, 4):
                insights.append({
                    "id": f"INS-{month:02d}-{supplier:02d}",
                    "supplier": f"supplier-{supplier}",
                    "month": f"2024-{month:02d}",
                    "title": "Month-end spike" if month == 3 else "Normal",
                    "embedding": [0.9, 0.1] if month == 3 else [0.1, 0.9]
                })
        
        temporal_patterns = await cross_supplier_analyzer.detect_temporal_patterns(
            insights,
            time_window="month"
        )
        
        assert len(temporal_patterns) > 0
        march_pattern = [p for p in temporal_patterns if p["period"] == "2024-03"][0]
        assert march_pattern["pattern_type"] == "spike"
        assert len(march_pattern["affected_suppliers"]) == 3