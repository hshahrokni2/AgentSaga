"""
TDD RED Phase Tests for Insights Registry with Evidence Linking
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, patch
import hashlib
import json

# These imports will fail in RED phase - that's expected!
try:
    from src.services.insights_registry import (
        InsightsRegistry,
        InsightClusteringEngine,
        InsightIDGenerator,
        EvidenceLinker,
        InsightMerger,
        InsightData,
        EvidenceLink,
        ClusteringResult
    )
except ImportError:
    # Expected during RED phase
    pass


class TestInsightIDGeneration:
    """Test human-friendly ID generation in INS-YYYY-MM-NNN format"""
    
    @pytest.fixture
    def id_generator(self):
        """Create ID generator instance"""
        # This will fail in RED phase as the class doesn't exist yet
        try:
            from src.services.insights_registry import InsightIDGenerator
            return InsightIDGenerator()
        except ImportError:
            pytest.skip("InsightIDGenerator not implemented yet")
    
    @pytest.mark.asyncio
    async def test_generate_id_format(self, id_generator):
        """Test that generated IDs follow INS-YYYY-MM-NNN format"""
        insight_id = await id_generator.generate_id(
            month="2024-03",
            supplier="test-supplier"
        )
        
        assert insight_id.startswith("INS-")
        parts = insight_id.split("-")
        assert len(parts) == 4
        assert parts[1] == "2024"
        assert parts[2] == "03"
        assert parts[3].isdigit() and len(parts[3]) == 3
    
    @pytest.mark.asyncio
    async def test_sequential_id_generation(self, id_generator):
        """Test that IDs increment sequentially within same month"""
        ids = []
        for i in range(5):
            insight_id = await id_generator.generate_id(
                month="2024-03",
                supplier="test-supplier"
            )
            ids.append(insight_id)
        
        # Extract sequence numbers
        sequences = [int(id.split("-")[3]) for id in ids]
        
        # Should be sequential
        for i in range(1, len(sequences)):
            assert sequences[i] == sequences[i-1] + 1
    
    @pytest.mark.asyncio
    async def test_month_rollover(self, id_generator):
        """Test that sequence resets for new month"""
        # Generate ID for March
        march_id = await id_generator.generate_id(
            month="2024-03",
            supplier="test-supplier"
        )
        
        # Generate ID for April
        april_id = await id_generator.generate_id(
            month="2024-04",
            supplier="test-supplier"
        )
        
        march_seq = int(march_id.split("-")[3])
        april_seq = int(april_id.split("-")[3])
        
        # April should start from 001
        assert april_seq == 1
    
    @pytest.mark.asyncio
    async def test_concurrent_id_generation(self, id_generator):
        """Test that concurrent requests don't generate duplicate IDs"""
        async def generate_id():
            return await id_generator.generate_id(
                month="2024-03",
                supplier="test-supplier"
            )
        
        # Generate 10 IDs concurrently
        tasks = [generate_id() for _ in range(10)]
        ids = await asyncio.gather(*tasks)
        
        # All IDs should be unique
        assert len(set(ids)) == 10


class TestInsightClustering:
    """Test insight clustering algorithm"""
    
    @pytest.fixture
    def clustering_engine(self):
        """Create clustering engine instance"""
        from src.services.insights_registry import InsightClusteringEngine
        return InsightClusteringEngine()
    
    @pytest.mark.asyncio
    async def test_cluster_similar_insights(self, clustering_engine):
        """Test that similar insights are clustered together"""
        insights = [
            {
                "id": "INS-2024-03-001",
                "title": "High waste volume on weekends",
                "embedding": [1.0, 0.0, 0.0],  # Mock embedding
                "supplier": "supplier-1",
                "month": "2024-03"
            },
            {
                "id": "INS-2024-03-002",
                "title": "Elevated waste amounts during weekends",
                "embedding": [0.95, 0.05, 0.0],  # Similar embedding
                "supplier": "supplier-1",
                "month": "2024-03"
            },
            {
                "id": "INS-2024-03-003",
                "title": "Missing invoice data",
                "embedding": [0.0, 1.0, 0.0],  # Different embedding
                "supplier": "supplier-1",
                "month": "2024-03"
            }
        ]
        
        clusters = await clustering_engine.cluster_insights(
            insights,
            similarity_threshold=0.85
        )
        
        # Should create 2 clusters
        assert len(clusters) == 2
        
        # Find the cluster with similar insights
        for cluster in clusters:
            if len(cluster["members"]) == 2:
                member_ids = [m["id"] for m in cluster["members"]]
                assert "INS-2024-03-001" in member_ids
                assert "INS-2024-03-002" in member_ids
    
    @pytest.mark.asyncio
    async def test_cross_supplier_clustering(self, clustering_engine):
        """Test clustering across multiple suppliers"""
        insights = [
            {
                "id": "INS-2024-03-001",
                "title": "Duplicate invoicing detected",
                "supplier": "supplier-1",
                "month": "2024-03",
                "embedding": [0.5, 0.5, 0.5]
            },
            {
                "id": "INS-2024-03-002",
                "title": "Duplicate billing found",
                "supplier": "supplier-2",
                "month": "2024-03",
                "embedding": [0.51, 0.49, 0.52]
            }
        ]
        
        clusters = await clustering_engine.cluster_insights(
            insights,
            cross_supplier=True,
            similarity_threshold=0.9
        )
        
        # Should cluster across suppliers
        assert len(clusters) == 1
        assert len(clusters[0]["members"]) == 2
        assert clusters[0]["cross_supplier"] == True
    
    @pytest.mark.asyncio
    async def test_clustering_confidence_scores(self, clustering_engine):
        """Test that clustering produces confidence scores"""
        insights = [
            {"id": f"INS-2024-03-{i:03d}", "embedding": [0.1 * i] * 3}
            for i in range(1, 6)
        ]
        
        clusters = await clustering_engine.cluster_insights(insights)
        
        for cluster in clusters:
            assert "confidence" in cluster
            assert 0.0 <= cluster["confidence"] <= 1.0
            assert "centroid" in cluster
            assert "radius" in cluster


class TestEvidenceLinking:
    """Test evidence linking to insights"""
    
    @pytest.fixture
    async def evidence_linker(self):
        """Create evidence linker instance"""
        from src.services.insights_registry import EvidenceLinker
        return EvidenceLinker()
    
    @pytest.mark.asyncio
    async def test_link_rows_to_insight(self, evidence_linker):
        """Test linking raw data rows to insights"""
        insight_id = "INS-2024-03-001"
        row_ids = ["row-1", "row-2", "row-3"]
        
        result = await evidence_linker.link_rows(
            insight_id=insight_id,
            row_ids=row_ids,
            confidence=0.95
        )
        
        assert result["success"] == True
        assert result["linked_count"] == 3
        assert result["insight_id"] == insight_id
        
        # Verify links were created
        links = await evidence_linker.get_evidence_links(insight_id)
        assert len(links) == 3
        for link in links:
            assert link["link_type"] == "row"
            assert link["confidence"] == 0.95
    
    @pytest.mark.asyncio
    async def test_link_files_to_insight(self, evidence_linker):
        """Test linking files/documents to insights"""
        insight_id = "INS-2024-03-002"
        file_links = [
            {"file_id": "file-1", "page": 3, "bbox": [100, 200, 300, 400]},
            {"file_id": "file-2", "page": None, "bbox": None}
        ]
        
        result = await evidence_linker.link_files(
            insight_id=insight_id,
            file_links=file_links
        )
        
        assert result["success"] == True
        assert result["linked_count"] == 2
        
        # Verify file links with metadata
        links = await evidence_linker.get_evidence_links(
            insight_id,
            link_type="file"
        )
        assert links[0]["metadata"]["page"] == 3
        assert links[0]["metadata"]["bbox"] == [100, 200, 300, 400]
    
    @pytest.mark.asyncio
    async def test_link_charts_to_insight(self, evidence_linker):
        """Test linking visualizations/charts to insights"""
        insight_id = "INS-2024-03-003"
        chart_configs = [
            {
                "type": "line",
                "data": {"x": "date", "y": "volume"},
                "title": "Volume Trend"
            },
            {
                "type": "bar",
                "data": {"categories": ["A", "B"], "values": [10, 20]},
                "title": "Category Distribution"
            }
        ]
        
        result = await evidence_linker.link_charts(
            insight_id=insight_id,
            charts=chart_configs
        )
        
        assert result["success"] == True
        assert result["chart_ids"] is not None
        assert len(result["chart_ids"]) == 2
    
    @pytest.mark.asyncio
    async def test_evidence_integrity_validation(self, evidence_linker):
        """Test that evidence links maintain referential integrity"""
        insight_id = "INS-2024-03-004"
        
        # Link to non-existent row should fail
        with pytest.raises(ValueError, match="Row not found"):
            await evidence_linker.link_rows(
                insight_id=insight_id,
                row_ids=["non-existent-row"],
                validate=True
            )
        
        # Link to deleted insight should fail
        deleted_insight_id = "INS-2024-03-999"
        with pytest.raises(ValueError, match="Insight not found"):
            await evidence_linker.link_rows(
                insight_id=deleted_insight_id,
                row_ids=["row-1"]
            )


class TestInsightMergeSplit:
    """Test merge and split operations for insights"""
    
    @pytest.fixture
    async def insight_merger(self):
        """Create insight merger instance"""
        from src.services.insights_registry import InsightMerger
        return InsightMerger()
    
    @pytest.mark.asyncio
    async def test_merge_insights(self, insight_merger):
        """Test merging multiple insights into one"""
        source_insights = [
            {
                "id": "INS-2024-03-001",
                "title": "High weekend waste",
                "evidence_links": ["row-1", "row-2"],
                "status": "reviewing"
            },
            {
                "id": "INS-2024-03-002", 
                "title": "Elevated weekend volumes",
                "evidence_links": ["row-3", "row-4"],
                "status": "validated"
            }
        ]
        
        merged = await insight_merger.merge_insights(
            source_ids=["INS-2024-03-001", "INS-2024-03-002"],
            merged_title="Consistent weekend waste anomaly",
            preserve_evidence=True
        )
        
        assert merged["id"] is not None
        assert merged["id"].startswith("INS-")
        assert merged["title"] == "Consistent weekend waste anomaly"
        assert len(merged["evidence_links"]) == 4
        assert merged["merged_from"] == ["INS-2024-03-001", "INS-2024-03-002"]
        assert merged["status"] == "reviewing"  # Most conservative status
    
    @pytest.mark.asyncio
    async def test_split_insight(self, insight_merger):
        """Test splitting one insight into multiple"""
        original_insight = {
            "id": "INS-2024-03-010",
            "title": "Multiple anomalies detected",
            "evidence_links": ["row-1", "row-2", "row-3", "row-4", "row-5"],
            "details": "Contains both volume and pricing anomalies"
        }
        
        split_config = [
            {
                "title": "Volume anomaly",
                "evidence_links": ["row-1", "row-2", "row-3"]
            },
            {
                "title": "Pricing anomaly",
                "evidence_links": ["row-4", "row-5"]
            }
        ]
        
        split_results = await insight_merger.split_insight(
            source_id="INS-2024-03-010",
            split_config=split_config,
            preserve_original=False
        )
        
        assert len(split_results) == 2
        assert split_results[0]["title"] == "Volume anomaly"
        assert len(split_results[0]["evidence_links"]) == 3
        assert split_results[0]["split_from"] == "INS-2024-03-010"
        
        # Original should be marked as split
        original = await insight_merger.get_insight("INS-2024-03-010")
        assert original["status"] == "split"
    
    @pytest.mark.asyncio
    async def test_merge_preserves_audit_trail(self, insight_merger):
        """Test that merge operations preserve full audit trail"""
        result = await insight_merger.merge_insights(
            source_ids=["INS-2024-03-001", "INS-2024-03-002"],
            merged_title="Merged insight",
            user="test-user",
            reason="Duplicate detection"
        )
        
        # Check audit log
        audit_entries = await insight_merger.get_audit_trail(result["id"])
        
        assert len(audit_entries) > 0
        merge_entry = audit_entries[0]
        assert merge_entry["action"] == "merge"
        assert merge_entry["user"] == "test-user"
        assert merge_entry["reason"] == "Duplicate detection"
        assert merge_entry["source_insights"] == ["INS-2024-03-001", "INS-2024-03-002"]


class TestStatusAndAuditTrail:
    """Test status tracking and audit trail generation"""
    
    @pytest.fixture
    async def insights_registry(self):
        """Create insights registry instance"""
        from src.services.insights_registry import InsightsRegistry
        return InsightsRegistry()
    
    @pytest.mark.asyncio
    async def test_status_transitions(self, insights_registry):
        """Test valid status transitions"""
        insight_id = "INS-2024-03-001"
        
        # Create insight in 'new' status
        await insights_registry.create_insight({
            "title": "Test insight",
            "status": "new"
        })
        
        # Valid transitions
        transitions = [
            ("new", "reviewing"),
            ("reviewing", "validated"),
            ("validated", "resolved")
        ]
        
        for from_status, to_status in transitions:
            result = await insights_registry.update_status(
                insight_id=insight_id,
                new_status=to_status,
                user="test-user"
            )
            assert result["success"] == True
            assert result["new_status"] == to_status
    
    @pytest.mark.asyncio
    async def test_invalid_status_transition(self, insights_registry):
        """Test that invalid status transitions are rejected"""
        insight_id = "INS-2024-03-002"
        
        await insights_registry.create_insight({
            "id": insight_id,
            "title": "Test insight",
            "status": "resolved"
        })
        
        # Cannot go from resolved back to new
        with pytest.raises(ValueError, match="Invalid status transition"):
            await insights_registry.update_status(
                insight_id=insight_id,
                new_status="new"
            )
    
    @pytest.mark.asyncio
    async def test_audit_trail_generation(self, insights_registry):
        """Test that all operations generate audit trail entries"""
        insight_id = "INS-2024-03-003"
        
        # Create
        await insights_registry.create_insight({
            "id": insight_id,
            "title": "Audit test insight",
            "user": "creator"
        })
        
        # Update
        await insights_registry.update_insight(
            insight_id=insight_id,
            updates={"severity": "high"},
            user="updater"
        )
        
        # Status change
        await insights_registry.update_status(
            insight_id=insight_id,
            new_status="reviewing",
            user="reviewer"
        )
        
        # Get audit trail
        audit_trail = await insights_registry.get_audit_trail(insight_id)
        
        assert len(audit_trail) >= 3
        
        # Verify audit entries
        actions = [entry["action"] for entry in audit_trail]
        assert "create" in actions
        assert "update" in actions
        assert "status_change" in actions
        
        # Each entry should have timestamp
        for entry in audit_trail:
            assert "timestamp" in entry
            assert "user" in entry


class TestSourceAttribution:
    """Test source attribution for insights (rule/ml/human/scenario)"""
    
    @pytest.fixture
    async def insights_registry(self):
        """Create insights registry instance"""
        from src.services.insights_registry import InsightsRegistry
        return InsightsRegistry()
    
    @pytest.mark.asyncio
    async def test_rule_based_insight_attribution(self, insights_registry):
        """Test attribution for rule-based insights"""
        result = await insights_registry.create_insight({
            "title": "Weekend spike detected",
            "source": "rule",
            "rule_id": "RULE-WEEKEND-001",
            "confidence": 0.95
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert insight["source"] == "rule"
        assert insight["source_metadata"]["rule_id"] == "RULE-WEEKEND-001"
        assert insight["confidence"] == 0.95
    
    @pytest.mark.asyncio
    async def test_ml_model_insight_attribution(self, insights_registry):
        """Test attribution for ML-generated insights"""
        result = await insights_registry.create_insight({
            "title": "Anomalous pattern detected",
            "source": "ml",
            "model": "anomaly-detector-v2",
            "model_version": "2.1.0",
            "confidence": 0.87,
            "features_used": ["volume", "timing", "cost"]
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert insight["source"] == "ml"
        assert insight["source_metadata"]["model"] == "anomaly-detector-v2"
        assert insight["source_metadata"]["features_used"] == ["volume", "timing", "cost"]
    
    @pytest.mark.asyncio
    async def test_human_generated_insight(self, insights_registry):
        """Test attribution for human-generated insights"""
        result = await insights_registry.create_insight({
            "title": "Manual observation of irregularity",
            "source": "human",
            "created_by": "analyst@example.com",
            "confidence": 1.0
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert insight["source"] == "human"
        assert insight["source_metadata"]["created_by"] == "analyst@example.com"
    
    @pytest.mark.asyncio
    async def test_scenario_based_insight(self, insights_registry):
        """Test attribution for scenario/what-if insights"""
        result = await insights_registry.create_insight({
            "title": "Impact of 20% volume increase",
            "source": "scenario",
            "scenario_id": "SCN-2024-03-001",
            "parameters": {"volume_change": 0.2},
            "confidence": 0.75
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert insight["source"] == "scenario"
        assert insight["source_metadata"]["scenario_id"] == "SCN-2024-03-001"


class TestMarkdownDetailsStorage:
    """Test Markdown details rendering and storage"""
    
    @pytest.fixture
    async def insights_registry(self):
        """Create insights registry instance"""
        from src.services.insights_registry import InsightsRegistry
        return InsightsRegistry()
    
    @pytest.mark.asyncio
    async def test_store_markdown_details(self, insights_registry):
        """Test storing and retrieving Markdown details"""
        markdown_content = """
## Insight Details
        
**Severity**: High  
**Confidence**: 87%
        
### Summary
Detected anomalous waste disposal patterns during weekends.
        
### Evidence
- 15 transactions flagged
- Average deviation: +45%
- Affected dates: 2024-03-02, 2024-03-09, 2024-03-16
        
### Recommended Actions
1. Review weekend operations
2. Verify with supplier
3. Check for special events
        """
        
        result = await insights_registry.create_insight({
            "title": "Weekend anomaly",
            "details_md": markdown_content
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert insight["details_md"] == markdown_content
    
    @pytest.mark.asyncio
    async def test_markdown_with_swedish_characters(self, insights_registry):
        """Test Markdown with Swedish characters (åäö)"""
        swedish_markdown = """
### Sammanfattning
Höga avfallsvolymer upptäckta på helger.
        
### Påverkade leverantörer
- Återvinning AB
- Miljöföretaget
- Städtjänst ÖÄÅ
        """
        
        result = await insights_registry.create_insight({
            "title": "Helgavvikelse",
            "details_md": swedish_markdown
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert "Höga" in insight["details_md"]
        assert "Återvinning" in insight["details_md"]
        assert "ÖÄÅ" in insight["details_md"]
    
    @pytest.mark.asyncio
    async def test_markdown_with_tables_and_code(self, insights_registry):
        """Test complex Markdown with tables and code blocks"""
        complex_markdown = """
### Analysis Results
        
| Date | Volume (kg) | Deviation |
|------|------------|-----------|
| 2024-03-01 | 1500 | +0% |
| 2024-03-02 | 2175 | +45% |
| 2024-03-03 | 2250 | +50% |
        
```python
# Detection algorithm
threshold = mean + 2 * std
anomalies = data[data['volume'] > threshold]
```
        """
        
        result = await insights_registry.create_insight({
            "title": "Analysis results",
            "details_md": complex_markdown
        })
        
        insight = await insights_registry.get_insight(result["id"])
        assert "| Date | Volume (kg) | Deviation |" in insight["details_md"]
        assert "```python" in insight["details_md"]


class TestSearchAndFilteringPerformance:
    """Test search and filtering performance"""
    
    @pytest.fixture
    async def insights_registry(self):
        """Create insights registry instance with test data"""
        from src.services.insights_registry import InsightsRegistry
        registry = InsightsRegistry()
        
        # Create 1000 test insights
        for i in range(1000):
            await registry.create_insight({
                "title": f"Insight {i}",
                "severity": ["low", "medium", "high", "critical"][i % 4],
                "status": ["new", "reviewing", "validated", "resolved"][i % 4],
                "source": ["rule", "ml", "human", "scenario"][i % 4],
                "supplier": f"supplier-{i % 10}",
                "month": f"2024-{(i % 12) + 1:02d}"
            })
        
        return registry
    
    @pytest.mark.asyncio
    async def test_search_by_text_performance(self, insights_registry):
        """Test text search performance"""
        import time
        
        start = time.time()
        results = await insights_registry.search_insights(
            query="Insight",
            limit=50
        )
        duration = time.time() - start
        
        assert len(results) <= 50
        assert duration < 0.5  # Should complete within 500ms
    
    @pytest.mark.asyncio
    async def test_filter_by_multiple_criteria(self, insights_registry):
        """Test filtering by multiple criteria"""
        import time
        
        start = time.time()
        results = await insights_registry.filter_insights(
            severity=["high", "critical"],
            status=["new", "reviewing"],
            source=["ml"],
            supplier="supplier-5",
            month_range=("2024-01", "2024-06")
        )
        duration = time.time() - start
        
        assert duration < 1.0  # Should complete within 1 second
        
        # Verify filters are applied correctly
        for insight in results:
            assert insight["severity"] in ["high", "critical"]
            assert insight["status"] in ["new", "reviewing"]
            assert insight["source"] == "ml"
            assert insight["supplier"] == "supplier-5"
    
    @pytest.mark.asyncio
    async def test_pagination_performance(self, insights_registry):
        """Test pagination performance for large result sets"""
        import time
        
        # First page
        start = time.time()
        page1 = await insights_registry.get_insights(
            page=1,
            page_size=50
        )
        duration1 = time.time() - start
        
        # Middle page
        start = time.time()
        page10 = await insights_registry.get_insights(
            page=10,
            page_size=50
        )
        duration10 = time.time() - start
        
        assert duration1 < 0.5
        assert duration10 < 0.5  # Later pages should be just as fast
        assert len(page1["items"]) == 50
        assert page1["total"] == 1000
    
    @pytest.mark.asyncio
    async def test_sorting_performance(self, insights_registry):
        """Test sorting performance on various fields"""
        import time
        
        sort_fields = ["created_at", "severity", "confidence", "title"]
        
        for field in sort_fields:
            start = time.time()
            results = await insights_registry.get_insights(
                sort_by=field,
                sort_order="desc",
                limit=100
            )
            duration = time.time() - start
            
            assert duration < 0.5  # Each sort should be fast
            assert len(results) <= 100