"""
Test Suite for Scenario Engine - What-If Analysis
Following TDD RED phase: All tests should fail initially

Coverage targets:
- 95% scenario paths
- 100% determinism validation
- Swedish context: Waste management KPIs, supplier naming patterns, seasonal variations
"""

import pytest
import asyncio
import json
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional
from unittest.mock import Mock, AsyncMock, patch
import numpy as np
import pandas as pd
from concurrent.futures import ThreadPoolExecutor

# Import the scenario engine (not yet implemented)
from src.services.scenario_engine import (
    ScenarioEngine,
    ScenarioConfig,
    ScenarioResult,
    KPICalculator,
    DiffGenerator,
    SnapshotManager,
    ScenarioValidationError,
    DeterminismError
)


class TestScenarioEngineCore:
    """Core scenario engine functionality tests"""
    
    @pytest.fixture
    async def engine(self):
        """Create scenario engine instance"""
        return ScenarioEngine()
    
    @pytest.fixture
    def valid_config(self):
        """Valid scenario configuration"""
        return ScenarioConfig(
            suppliers=["ABC-001", "DEF-002", "GHI-003"],
            month_range="2024-01-01:2024-03-31",
            parameters={
                "weight_threshold": 0.15,  # 15% deviation
                "reporting_threshold": 0.95,  # 95% completeness
                "start_time": "06:00",
                "end_time": "19:00"
            },
            insights=["INS-2024-01-001", "INS-2024-01-002"],
            baseline_snapshot_id="SCN-2024-01-001"
        )
    
    async def test_scenario_engine_initialization(self, engine):
        """Test that scenario engine initializes correctly"""
        assert engine is not None
        assert engine.kpi_calculator is not None
        assert engine.diff_generator is not None
        assert engine.snapshot_manager is not None
        assert engine.cache_ttl == 300  # 5 minutes default
    
    async def test_scenario_execution_basic(self, engine, valid_config):
        """Test basic scenario execution"""
        result = await engine.execute_scenario(valid_config)
        
        assert result is not None
        assert isinstance(result, ScenarioResult)
        assert result.id.startswith("SCN-")
        assert result.kpis is not None
        assert result.diff is not None
        assert result.execution_time_ms < 60000  # Under 60 seconds
    
    async def test_json_schema_validation(self, engine):
        """Test that input/output follows JSON schema"""
        invalid_config = {
            "suppliers": "not-a-list",  # Should be list
            "month_range": "invalid",
            "parameters": None  # Should be dict
        }
        
        with pytest.raises(ScenarioValidationError) as exc:
            await engine.execute_scenario(invalid_config)
        
        assert "Schema validation failed" in str(exc.value)
        assert exc.value.validation_errors is not None
    
    async def test_determinism_validation(self, engine, valid_config):
        """Test that same inputs produce identical outputs"""
        # Execute scenario 5 times with same config
        results = []
        for _ in range(5):
            result = await engine.execute_scenario(valid_config)
            results.append(result)
        
        # All results should be identical (excluding timestamps/IDs)
        first_result = results[0]
        for result in results[1:]:
            assert result.kpis == first_result.kpis
            assert result.diff == first_result.diff
            assert result.determinism_hash == first_result.determinism_hash


class TestKPICalculation:
    """KPI calculation tests"""
    
    @pytest.fixture
    def kpi_calculator(self):
        """Create KPI calculator instance"""
        return KPICalculator()
    
    @pytest.fixture
    def sample_data(self):
        """Sample Swedish waste management data"""
        return pd.DataFrame({
            'supplier_id': ['ABC-001'] * 30,
            'date': pd.date_range('2024-01-01', periods=30),
            'weight_kg': np.random.normal(1000, 50, 30),
            'facility': ['Stockholms Återvinning'] * 30,
            'waste_type': ['Hushållsavfall'] * 30,
            'reported': [True] * 28 + [False, False]  # 93% completeness
        })
    
    async def test_completeness_kpi_calculation(self, kpi_calculator, sample_data):
        """Test completeness KPI calculation"""
        completeness = await kpi_calculator.calculate_completeness(sample_data)
        
        assert completeness is not None
        assert 0 <= completeness <= 1
        assert completeness == pytest.approx(0.933, rel=0.01)  # 28/30
    
    async def test_anomaly_burden_calculation(self, kpi_calculator, sample_data):
        """Test anomaly burden KPI calculation"""
        # Add some anomalies
        sample_data.loc[5, 'weight_kg'] = 2000  # Outlier
        sample_data.loc[10, 'weight_kg'] = 100   # Outlier
        
        anomaly_burden = await kpi_calculator.calculate_anomaly_burden(
            sample_data,
            weight_threshold=0.15
        )
        
        assert anomaly_burden is not None
        assert anomaly_burden >= 0
        assert anomaly_burden == pytest.approx(2/30, rel=0.01)  # 2 anomalies
    
    async def test_review_progress_calculation(self, kpi_calculator):
        """Test review progress KPI calculation"""
        findings_data = pd.DataFrame({
            'finding_id': range(20),
            'status': ['new'] * 5 + ['triaged'] * 5 + ['explained'] * 5 + ['resolved'] * 5
        })
        
        review_progress = await kpi_calculator.calculate_review_progress(findings_data)
        
        assert review_progress is not None
        assert 0 <= review_progress <= 1
        assert review_progress == 0.75  # 15/20 are beyond 'new' status
    
    async def test_swedish_seasonal_adjustments(self, kpi_calculator):
        """Test Swedish seasonal adjustments (summer vacation, holidays)"""
        summer_data = pd.DataFrame({
            'date': pd.date_range('2024-07-01', '2024-07-31'),
            'weight_kg': np.random.normal(500, 25, 31)  # Lower in summer
        })
        
        winter_data = pd.DataFrame({
            'date': pd.date_range('2024-01-01', '2024-01-31'),
            'weight_kg': np.random.normal(1200, 60, 31)  # Higher in winter
        })
        
        summer_adjusted = await kpi_calculator.apply_seasonal_adjustment(summer_data)
        winter_adjusted = await kpi_calculator.apply_seasonal_adjustment(winter_data)
        
        assert summer_adjusted is not None
        assert winter_adjusted is not None
        # Summer should have higher adjustment factor
        assert summer_adjusted['adjustment_factor'].mean() > winter_adjusted['adjustment_factor'].mean()


class TestDiffGeneration:
    """Diff generation tests"""
    
    @pytest.fixture
    def diff_generator(self):
        """Create diff generator instance"""
        return DiffGenerator()
    
    @pytest.fixture
    def baseline_result(self):
        """Baseline scenario result"""
        return ScenarioResult(
            id="SCN-2024-01-001",
            kpis={
                "completeness": 0.95,
                "anomaly_burden": 0.02,
                "review_progress": 0.60
            },
            flag_counts={
                "ABC-001": {"critical": 2, "warning": 5, "info": 10},
                "DEF-002": {"critical": 0, "warning": 3, "info": 8}
            }
        )
    
    @pytest.fixture
    def modified_result(self):
        """Modified scenario result"""
        return ScenarioResult(
            id="SCN-2024-01-002",
            kpis={
                "completeness": 0.98,  # +3%
                "anomaly_burden": 0.01,  # -1%
                "review_progress": 0.75  # +15%
            },
            flag_counts={
                "ABC-001": {"critical": 1, "warning": 3, "info": 12},  # Changes
                "DEF-002": {"critical": 1, "warning": 4, "info": 7}    # Changes
            }
        )
    
    async def test_kpi_diff_generation(self, diff_generator, baseline_result, modified_result):
        """Test KPI diff generation"""
        diff = await diff_generator.generate_kpi_diff(baseline_result, modified_result)
        
        assert diff is not None
        assert diff['completeness']['change'] == pytest.approx(0.03, rel=0.001)
        assert diff['completeness']['percent_change'] == pytest.approx(3.16, rel=0.01)
        assert diff['anomaly_burden']['change'] == pytest.approx(-0.01, rel=0.001)
        assert diff['review_progress']['change'] == pytest.approx(0.15, rel=0.001)
    
    async def test_flag_changes_diff(self, diff_generator, baseline_result, modified_result):
        """Test flag changes diff generation"""
        diff = await diff_generator.generate_flag_diff(baseline_result, modified_result)
        
        assert diff is not None
        assert diff['ABC-001']['critical']['added'] == 0
        assert diff['ABC-001']['critical']['removed'] == 1
        assert diff['ABC-001']['warning']['removed'] == 2
        assert diff['DEF-002']['critical']['added'] == 1
    
    async def test_swedish_number_formatting_in_diff(self, diff_generator):
        """Test that diffs use Swedish number formatting"""
        diff_data = {
            "completeness": {
                "baseline": 0.954,
                "modified": 0.981,
                "change": 0.027
            }
        }
        
        formatted_diff = await diff_generator.format_diff_swedish(diff_data)
        
        assert "95,4%" in formatted_diff['completeness']['baseline_display']
        assert "98,1%" in formatted_diff['completeness']['modified_display']
        assert "+2,7%" in formatted_diff['completeness']['change_display']


class TestSnapshotManagement:
    """Snapshot management and immutability tests"""
    
    @pytest.fixture
    async def snapshot_manager(self):
        """Create snapshot manager instance"""
        return SnapshotManager()
    
    async def test_snapshot_creation(self, snapshot_manager):
        """Test snapshot creation with immutability"""
        scenario_result = ScenarioResult(
            id="SCN-2024-01-003",
            kpis={"completeness": 0.95},
            timestamp=datetime.now()
        )
        
        snapshot = await snapshot_manager.create_snapshot(scenario_result)
        
        assert snapshot is not None
        assert snapshot.id == scenario_result.id
        assert snapshot.is_immutable is True
        assert snapshot.checksum is not None
    
    async def test_snapshot_integrity_validation(self, snapshot_manager):
        """Test snapshot integrity validation"""
        # Create snapshot
        original_data = {"kpis": {"completeness": 0.95}}
        snapshot = await snapshot_manager.create_snapshot(original_data)
        
        # Verify integrity
        is_valid = await snapshot_manager.verify_integrity(snapshot.id)
        assert is_valid is True
        
        # Simulate corruption
        await snapshot_manager._corrupt_snapshot_for_testing(snapshot.id)
        
        # Should detect corruption
        is_valid = await snapshot_manager.verify_integrity(snapshot.id)
        assert is_valid is False
    
    async def test_snapshot_recovery_from_corruption(self, snapshot_manager):
        """Test snapshot recovery from corruption"""
        # Create snapshot with backup
        original_data = {"kpis": {"completeness": 0.95}}
        snapshot = await snapshot_manager.create_snapshot(original_data, create_backup=True)
        
        # Corrupt primary
        await snapshot_manager._corrupt_snapshot_for_testing(snapshot.id)
        
        # Attempt recovery
        recovered = await snapshot_manager.recover_snapshot(snapshot.id)
        
        assert recovered is not None
        assert recovered.data == original_data
    
    async def test_snapshot_versioning(self, snapshot_manager):
        """Test snapshot versioning system"""
        base_data = {"kpis": {"completeness": 0.90}}
        
        # Create version chain
        v1 = await snapshot_manager.create_snapshot(base_data, version="1.0.0")
        
        modified_data = {"kpis": {"completeness": 0.92}}
        v2 = await snapshot_manager.create_snapshot(
            modified_data, 
            version="1.1.0",
            parent_id=v1.id
        )
        
        # Get version history
        history = await snapshot_manager.get_version_history(v2.id)
        
        assert len(history) == 2
        assert history[0].version == "1.0.0"
        assert history[1].version == "1.1.0"


class TestInsightReferencing:
    """Insight referencing with human-friendly IDs"""
    
    @pytest.fixture
    def engine(self):
        """Create scenario engine instance"""
        return ScenarioEngine()
    
    async def test_insight_reference_by_id(self, engine):
        """Test referencing insights by INS-YYYY-MM-NNN format"""
        config = ScenarioConfig(
            suppliers=["ABC-001"],
            insights=["INS-2024-01-001", "INS-2024-01-002", "INS-2024-02-001"]
        )
        
        referenced_insights = await engine.resolve_insight_references(config.insights)
        
        assert len(referenced_insights) == 3
        assert all(insight.id.startswith("INS-") for insight in referenced_insights)
        assert referenced_insights[0].month == "2024-01"
        assert referenced_insights[2].month == "2024-02"
    
    async def test_invalid_insight_id_format(self, engine):
        """Test handling of invalid insight ID formats"""
        invalid_ids = ["INVALID-001", "INS-2024-13-001", "INS-2024-01"]
        
        with pytest.raises(ScenarioValidationError) as exc:
            await engine.resolve_insight_references(invalid_ids)
        
        assert "Invalid insight ID format" in str(exc.value)
    
    async def test_insight_impact_on_scenario(self, engine):
        """Test how insights affect scenario calculations"""
        # Scenario without insights
        config_no_insights = ScenarioConfig(
            suppliers=["ABC-001"],
            insights=[]
        )
        
        # Scenario with critical insights
        config_with_insights = ScenarioConfig(
            suppliers=["ABC-001"],
            insights=["INS-2024-01-001"]  # Critical insight
        )
        
        result_no_insights = await engine.execute_scenario(config_no_insights)
        result_with_insights = await engine.execute_scenario(config_with_insights)
        
        # Insights should affect anomaly burden
        assert result_with_insights.kpis['anomaly_burden'] > result_no_insights.kpis['anomaly_burden']


class TestPerformanceAndScaling:
    """Performance and scaling tests"""
    
    @pytest.fixture
    def engine(self):
        """Create scenario engine instance"""
        return ScenarioEngine()
    
    @pytest.fixture
    def large_dataset(self):
        """Generate large dataset for performance testing"""
        # 1000 suppliers, 12 months of data
        suppliers = [f"SUP-{i:04d}" for i in range(1000)]
        dates = pd.date_range('2023-01-01', '2023-12-31')
        
        data = []
        for supplier in suppliers[:100]:  # Use subset for testing
            for date in dates:
                data.append({
                    'supplier_id': supplier,
                    'date': date,
                    'weight_kg': np.random.normal(1000, 100),
                    'facility': f"Facility {supplier}"
                })
        
        return pd.DataFrame(data)
    
    @pytest.mark.performance
    async def test_median_execution_time(self, engine, large_dataset):
        """Test that median execution time is under 60 seconds"""
        execution_times = []
        
        for _ in range(10):
            config = ScenarioConfig(
                suppliers=large_dataset['supplier_id'].unique()[:50].tolist(),
                month_range="2023-01-01:2023-12-31"
            )
            
            start = datetime.now()
            await engine.execute_scenario(config, data=large_dataset)
            execution_time = (datetime.now() - start).total_seconds()
            
            execution_times.append(execution_time)
        
        median_time = np.median(execution_times)
        assert median_time < 60, f"Median execution time {median_time}s exceeds 60s target"
    
    @pytest.mark.performance
    async def test_p95_execution_time(self, engine, large_dataset):
        """Test that 95th percentile execution time is under 120 seconds"""
        execution_times = []
        
        for _ in range(20):
            config = ScenarioConfig(
                suppliers=large_dataset['supplier_id'].unique()[:100].tolist(),
                month_range="2023-01-01:2023-12-31"
            )
            
            start = datetime.now()
            await engine.execute_scenario(config, data=large_dataset)
            execution_time = (datetime.now() - start).total_seconds()
            
            execution_times.append(execution_time)
        
        p95_time = np.percentile(execution_times, 95)
        assert p95_time < 120, f"P95 execution time {p95_time}s exceeds 120s target"
    
    async def test_concurrent_execution(self, engine):
        """Test concurrent scenario execution with resource contention"""
        configs = [
            ScenarioConfig(suppliers=[f"SUP-{i:03d}"], month_range="2024-01-01:2024-01-31")
            for i in range(10)
        ]
        
        # Execute scenarios concurrently
        tasks = [engine.execute_scenario(config) for config in configs]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should complete without errors
        assert all(not isinstance(r, Exception) for r in results)
        
        # Check for determinism under concurrency
        duplicate_config = configs[0]
        concurrent_results = await asyncio.gather(*[
            engine.execute_scenario(duplicate_config) for _ in range(5)
        ])
        
        # All results should be identical
        first_hash = concurrent_results[0].determinism_hash
        assert all(r.determinism_hash == first_hash for r in concurrent_results)
    
    async def test_memory_optimization_large_cohorts(self, engine):
        """Test memory optimization for large supplier cohorts (>1000 facilities)"""
        # Generate 1500 suppliers
        large_cohort = [f"FAC-{i:04d}" for i in range(1500)]
        
        config = ScenarioConfig(
            suppliers=large_cohort,
            month_range="2024-01-01:2024-01-31"
        )
        
        # Monitor memory usage
        import tracemalloc
        tracemalloc.start()
        
        await engine.execute_scenario(config)
        
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        # Memory should stay under 2GB for 1500 suppliers
        assert peak / 1024 / 1024 / 1024 < 2, f"Peak memory {peak/1024/1024/1024:.2f}GB exceeds 2GB limit"


class TestEdgeCasesAndErrorHandling:
    """Edge cases and error handling tests"""
    
    @pytest.fixture
    def engine(self):
        """Create scenario engine instance"""
        return ScenarioEngine()
    
    async def test_empty_dataset_handling(self, engine):
        """Test handling of empty datasets"""
        config = ScenarioConfig(
            suppliers=["NONEXISTENT-001"],
            month_range="2024-01-01:2024-01-31"
        )
        
        result = await engine.execute_scenario(config)
        
        assert result is not None
        assert result.kpis['completeness'] == 0
        assert result.has_warnings is True
        assert "No data found" in result.warnings[0]
    
    async def test_invalid_parameter_validation(self, engine):
        """Test validation of invalid parameters"""
        invalid_configs = [
            # Weight threshold out of range
            ScenarioConfig(suppliers=["ABC-001"], parameters={"weight_threshold": 2.0}),
            # Invalid time format
            ScenarioConfig(suppliers=["ABC-001"], parameters={"start_time": "25:00"}),
            # Invalid month range
            ScenarioConfig(suppliers=["ABC-001"], month_range="2024-13-01:2024-14-31"),
        ]
        
        for config in invalid_configs:
            with pytest.raises(ScenarioValidationError):
                await engine.execute_scenario(config)
    
    async def test_partial_data_handling(self, engine):
        """Test handling of partial/incomplete data"""
        partial_data = pd.DataFrame({
            'supplier_id': ['ABC-001'] * 10,
            'date': pd.date_range('2024-01-01', periods=10),
            'weight_kg': [1000, None, 950, None, None, 1050, None, 980, 1010, None]
        })
        
        config = ScenarioConfig(suppliers=["ABC-001"])
        result = await engine.execute_scenario(config, data=partial_data)
        
        assert result is not None
        assert result.kpis['completeness'] < 1.0
        assert result.data_quality_score is not None
    
    async def test_swedish_character_handling(self, engine):
        """Test handling of Swedish characters (åäö) in supplier names"""
        config = ScenarioConfig(
            suppliers=["Östergötlands Återvinning", "Skåne Miljö AB", "Västra Götaland"],
            month_range="2024-01-01:2024-01-31"
        )
        
        result = await engine.execute_scenario(config)
        
        assert result is not None
        # Supplier names should be preserved correctly
        assert "Östergötlands Återvinning" in result.suppliers
        assert "Skåne Miljö AB" in result.suppliers
    
    async def test_circuit_breaker_activation(self, engine):
        """Test circuit breaker activation under failure conditions"""
        # Simulate failures
        with patch.object(engine, '_fetch_data', side_effect=Exception("Database error")):
            
            # First few attempts should try
            for i in range(3):
                with pytest.raises(Exception):
                    await engine.execute_scenario(ScenarioConfig(suppliers=["ABC-001"]))
            
            # Circuit breaker should open
            with pytest.raises(Exception) as exc:
                await engine.execute_scenario(ScenarioConfig(suppliers=["ABC-001"]))
            
            assert "Circuit breaker open" in str(exc.value)


class TestCloudProviderFailover:
    """Cloud provider failover tests"""
    
    @pytest.fixture
    def engine(self):
        """Create scenario engine with cloud providers"""
        return ScenarioEngine(
            cloud_providers=['claude-sonnet-4', 'gpt-4o', 'gemini-1.5-flash']
        )
    
    @pytest.mark.asyncio
    async def test_provider_failover_maintains_determinism(self, engine):
        """Test that failover between providers maintains determinism"""
        config = ScenarioConfig(
            suppliers=["ABC-001"],
            month_range="2024-01-01:2024-01-31"
        )
        
        # Execute with primary provider
        result_primary = await engine.execute_scenario(config, provider='claude-sonnet-4')
        
        # Simulate primary failure, fallback to GPT-4
        with patch.object(engine, '_claude_available', return_value=False):
            result_fallback = await engine.execute_scenario(config, provider='auto')
        
        # Results should be deterministic regardless of provider
        assert result_primary.determinism_hash == result_fallback.determinism_hash
        assert result_primary.kpis == result_fallback.kpis
    
    async def test_cascading_failover(self, engine):
        """Test cascading failover through all providers"""
        config = ScenarioConfig(suppliers=["ABC-001"])
        
        # Simulate all providers failing except the last
        with patch.object(engine, '_claude_available', return_value=False):
            with patch.object(engine, '_gpt4_available', return_value=False):
                result = await engine.execute_scenario(config, provider='auto')
        
        assert result is not None
        assert result.provider_used == 'gemini-1.5-flash'
        assert result.execution_time_ms < 120000  # Should still meet performance target


class TestSwedishContextSpecific:
    """Swedish waste management specific tests"""
    
    @pytest.fixture
    def engine(self):
        """Create scenario engine with Swedish configuration"""
        return ScenarioEngine(locale='sv-SE')
    
    async def test_swedish_holiday_handling(self, engine):
        """Test handling of Swedish holidays in calculations"""
        # Midsummer period (June)
        midsummer_config = ScenarioConfig(
            suppliers=["ABC-001"],
            month_range="2024-06-20:2024-06-26"
        )
        
        # Regular period
        regular_config = ScenarioConfig(
            suppliers=["ABC-001"],
            month_range="2024-03-01:2024-03-07"
        )
        
        midsummer_result = await engine.execute_scenario(midsummer_config)
        regular_result = await engine.execute_scenario(regular_config)
        
        # Expectations should be adjusted for holidays
        assert midsummer_result.expected_volume < regular_result.expected_volume
    
    async def test_swedish_supplier_naming_patterns(self, engine):
        """Test recognition of Swedish supplier naming patterns"""
        swedish_suppliers = [
            "AB Återvinning Stockholm",
            "Miljö & Återvinning i Skåne AB",
            "Göteborgs Kommunala Avfallshantering",
            "Återvinningscentralen Norr HB"
        ]
        
        config = ScenarioConfig(suppliers=swedish_suppliers)
        result = await engine.execute_scenario(config)
        
        # Should recognize organizational forms
        assert result.supplier_metadata['AB Återvinning Stockholm']['org_type'] == 'AB'
        assert result.supplier_metadata['Återvinningscentralen Norr HB']['org_type'] == 'HB'
    
    async def test_seasonal_waste_patterns(self, engine):
        """Test Swedish seasonal waste patterns"""
        # Christmas period - higher waste
        christmas_config = ScenarioConfig(
            suppliers=["ABC-001"],
            month_range="2023-12-20:2024-01-10"
        )
        
        # Summer vacation - lower waste  
        summer_config = ScenarioConfig(
            suppliers=["ABC-001"],
            month_range="2024-07-01:2024-07-31"
        )
        
        christmas_result = await engine.execute_scenario(christmas_config)
        summer_result = await engine.execute_scenario(summer_config)
        
        # Christmas should show higher baseline
        assert christmas_result.baseline_volume > summer_result.baseline_volume * 1.3


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, '-v', '--tb=short'])