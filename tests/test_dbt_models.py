"""
Test dbt Model Building and Dependencies
========================================
Tests for dbt data transformation models, dependencies, and incremental builds.
Ensures data quality, model performance, and correct dependency resolution.

These tests follow TDD principles - defining transformation requirements before implementation.
"""

import pytest
import asyncio
import subprocess
import json
import yaml
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any
import pandas as pd
import duckdb
import asyncpg
from dbt.cli.main import dbtRunner, dbtRunnerResult


class TestDbtModelConfiguration:
    """Test dbt project configuration and structure"""
    
    @pytest.fixture
    def dbt_project_dir(self):
        """Get dbt project directory"""
        # WILL FAIL: dbt project not initialized
        return Path("/Users/hosseins/Dev/AgentSaga/dbt_svoa")
    
    @pytest.fixture
    def dbt_runner(self, dbt_project_dir):
        """Create dbt runner instance"""
        # WILL FAIL: dbt not configured
        os.chdir(dbt_project_dir)
        return dbtRunner()
    
    def test_dbt_project_yml_exists(self, dbt_project_dir):
        """Test that dbt_project.yml is properly configured"""
        # WILL FAIL: Project file not created
        project_file = dbt_project_dir / "dbt_project.yml"
        assert project_file.exists(), "dbt_project.yml must exist"
        
        with open(project_file) as f:
            config = yaml.safe_load(f)
        
        # Verify required configuration
        assert 'name' in config
        assert config['name'] == 'svoa_analytics'
        assert 'version' in config
        assert 'profile' in config
        assert config['profile'] == 'svoa'
        
        # Verify model paths
        assert 'model-paths' in config
        assert 'models' in config['model-paths']
        
        # Verify materializations
        assert 'models' in config
        assert 'svoa_analytics' in config['models']
        assert '+materialized' in config['models']['svoa_analytics']
    
    def test_profiles_yml_configuration(self, dbt_project_dir):
        """Test that profiles.yml has correct database connections"""
        # WILL FAIL: Profiles not configured
        profiles_file = Path.home() / ".dbt" / "profiles.yml"
        assert profiles_file.exists(), "profiles.yml must exist"
        
        with open(profiles_file) as f:
            profiles = yaml.safe_load(f)
        
        assert 'svoa' in profiles
        svoa_profile = profiles['svoa']
        
        # Check outputs
        assert 'outputs' in svoa_profile
        assert 'dev' in svoa_profile['outputs']
        assert 'prod' in svoa_profile['outputs']
        
        # Verify PostgreSQL configuration
        dev_config = svoa_profile['outputs']['dev']
        assert dev_config['type'] == 'postgres'
        assert dev_config['host'] == 'localhost'
        assert dev_config['port'] == 5432
        assert dev_config['database'] == 'svoa_dev'
        assert 'user' in dev_config
        assert 'password' in dev_config
        assert dev_config['schema'] == 'analytics'
    
    def test_dbt_source_definitions(self, dbt_project_dir):
        """Test that source tables are properly defined"""
        # WILL FAIL: Sources not defined
        sources_file = dbt_project_dir / "models" / "sources.yml"
        assert sources_file.exists(), "sources.yml must exist"
        
        with open(sources_file) as f:
            sources = yaml.safe_load(f)
        
        assert 'version' in sources
        assert sources['version'] == 2
        assert 'sources' in sources
        
        # Find PostgreSQL source
        pg_source = next((s for s in sources['sources'] if s['name'] == 'postgres_raw'), None)
        assert pg_source is not None, "PostgreSQL source must be defined"
        
        # Verify required tables
        table_names = {t['name'] for t in pg_source['tables']}
        required_tables = {'load', 'row', 'finding', 'insight', 'scenario'}
        assert required_tables.issubset(table_names), f"Missing tables: {required_tables - table_names}"
        
        # Check table configurations
        load_table = next(t for t in pg_source['tables'] if t['name'] == 'load')
        assert 'columns' in load_table
        assert any(c['name'] == 'supplier_id' for c in load_table['columns'])
        assert any(c['name'] == 'month' for c in load_table['columns'])


class TestDbtModels:
    """Test dbt transformation models"""
    
    @pytest.fixture
    def dbt_runner(self):
        """Create dbt runner for testing"""
        # WILL FAIL: dbt not setup
        return dbtRunner()
    
    def test_staging_models(self, dbt_runner, dbt_project_dir):
        """Test staging layer models"""
        # WILL FAIL: Staging models not created
        
        # Check staging models exist
        staging_dir = dbt_project_dir / "models" / "staging"
        assert staging_dir.exists(), "Staging directory must exist"
        
        expected_models = [
            'stg_loads.sql',
            'stg_rows.sql',
            'stg_findings.sql',
            'stg_insights.sql'
        ]
        
        for model in expected_models:
            model_file = staging_dir / model
            assert model_file.exists(), f"Staging model {model} must exist"
            
            # Verify model content
            content = model_file.read_text()
            assert '{{ config(' in content, "Model must have config block"
            assert 'materialized' in content, "Must specify materialization"
            assert 'SELECT' in content.upper(), "Must have SELECT statement"
    
    def test_intermediate_models(self, dbt_project_dir):
        """Test intermediate transformation models"""
        # WILL FAIL: Intermediate models not created
        
        intermediate_dir = dbt_project_dir / "models" / "intermediate"
        assert intermediate_dir.exists()
        
        # Check for required intermediate models
        expected_models = [
            'int_supplier_monthly_summary.sql',
            'int_invoice_categorization.sql',
            'int_anomaly_detection.sql',
            'int_finding_aggregation.sql'
        ]
        
        for model in expected_models:
            model_file = intermediate_dir / model
            assert model_file.exists(), f"Intermediate model {model} must exist"
            
            content = model_file.read_text()
            # Verify references to staging models
            assert 'ref(' in content, "Must reference other models"
            assert 'stg_' in content, "Should reference staging models"
    
    def test_mart_models(self, dbt_project_dir):
        """Test data mart models for analytics"""
        # WILL FAIL: Mart models not created
        
        marts_dir = dbt_project_dir / "models" / "marts"
        assert marts_dir.exists()
        
        # Finance mart
        finance_dir = marts_dir / "finance"
        assert finance_dir.exists(), "Finance mart must exist"
        
        finance_models = [
            'fct_monthly_spending.sql',
            'fct_supplier_performance.sql',
            'dim_suppliers.sql',
            'dim_categories.sql'
        ]
        
        for model in finance_models:
            model_file = finance_dir / model
            assert model_file.exists(), f"Finance model {model} must exist"
            
            content = model_file.read_text()
            if model.startswith('fct_'):
                assert 'materialized' in content and 'table' in content, "Facts should be tables"
            elif model.startswith('dim_'):
                assert 'materialized' in content and 'view' in content, "Dimensions can be views"
    
    def test_incremental_models(self, dbt_project_dir):
        """Test incremental model configuration"""
        # WILL FAIL: Incremental models not configured
        
        # Find incremental models
        models_dir = dbt_project_dir / "models"
        incremental_model = models_dir / "intermediate" / "int_daily_load_summary.sql"
        
        assert incremental_model.exists(), "Incremental model must exist"
        
        content = incremental_model.read_text()
        
        # Verify incremental configuration
        assert "materialized='incremental'" in content.replace(' ', '')
        assert 'unique_key' in content, "Must specify unique key"
        assert 'on_schema_change' in content, "Must handle schema changes"
        
        # Check for incremental logic
        assert '{% if is_incremental() %}' in content
        assert 'WHERE' in content.upper() and 'created_at >' in content.lower()
    
    def test_model_documentation(self, dbt_project_dir):
        """Test that models have proper documentation"""
        # WILL FAIL: Documentation not created
        
        schema_file = dbt_project_dir / "models" / "schema.yml"
        assert schema_file.exists(), "schema.yml must exist"
        
        with open(schema_file) as f:
            schema = yaml.safe_load(f)
        
        assert 'models' in schema
        
        # Check documentation for each model
        for model in schema['models']:
            assert 'name' in model
            assert 'description' in model, f"Model {model['name']} must have description"
            assert len(model['description']) > 20, f"Description for {model['name']} too short"
            
            # Check column documentation
            assert 'columns' in model, f"Model {model['name']} must document columns"
            for column in model['columns']:
                assert 'name' in column
                assert 'description' in column, f"Column {column['name']} must have description"


class TestDbtTests:
    """Test dbt data quality tests"""
    
    def test_schema_tests(self, dbt_project_dir):
        """Test that schema tests are defined"""
        # WILL FAIL: Schema tests not defined
        
        schema_file = dbt_project_dir / "models" / "schema.yml"
        with open(schema_file) as f:
            schema = yaml.safe_load(f)
        
        # Check tests on models
        for model in schema['models']:
            if 'columns' in model:
                for column in model['columns']:
                    column_name = column['name']
                    
                    # Primary keys should have unique and not_null tests
                    if column_name == 'id' or column_name.endswith('_id'):
                        tests = column.get('tests', [])
                        assert 'unique' in tests or any('unique' in str(t) for t in tests)
                        assert 'not_null' in tests or any('not_null' in str(t) for t in tests)
                    
                    # Foreign keys should have relationship tests
                    if column_name.startswith('fk_') or column_name in ['load_id', 'row_id']:
                        tests = column.get('tests', [])
                        assert any('relationships' in str(t) for t in tests)
    
    def test_custom_tests(self, dbt_project_dir):
        """Test custom data quality tests"""
        # WILL FAIL: Custom tests not created
        
        tests_dir = dbt_project_dir / "tests"
        assert tests_dir.exists(), "Tests directory must exist"
        
        expected_tests = [
            'assert_positive_amounts.sql',
            'assert_valid_supplier_ids.sql',
            'assert_monthly_completeness.sql',
            'assert_no_duplicate_invoices.sql'
        ]
        
        for test_file in expected_tests:
            test_path = tests_dir / test_file
            assert test_path.exists(), f"Test {test_file} must exist"
            
            content = test_path.read_text()
            assert 'SELECT' in content.upper()
            # Tests should return rows that fail the condition
            assert 'WHERE' in content.upper()
    
    def test_freshness_checks(self, dbt_project_dir):
        """Test source data freshness configuration"""
        # WILL FAIL: Freshness not configured
        
        sources_file = dbt_project_dir / "models" / "sources.yml"
        with open(sources_file) as f:
            sources = yaml.safe_load(f)
        
        pg_source = next(s for s in sources['sources'] if s['name'] == 'postgres_raw')
        
        # Check freshness configuration
        assert 'freshness' in pg_source, "Source must have freshness config"
        freshness = pg_source['freshness']
        assert 'warn_after' in freshness
        assert 'error_after' in freshness
        
        # Tables should have loaded_at_field
        for table in pg_source['tables']:
            if table['name'] in ['load', 'row']:
                assert 'loaded_at_field' in table
                assert table['loaded_at_field'] == 'created_at'


class TestDbtExecution:
    """Test dbt execution and performance"""
    
    @pytest.fixture
    def dbt_runner(self):
        """Create dbt runner"""
        return dbtRunner()
    
    def test_dbt_deps(self, dbt_runner):
        """Test dbt package dependencies"""
        # WILL FAIL: Dependencies not configured
        
        result = dbt_runner.invoke(['deps'])
        assert result.success, "dbt deps must succeed"
        
        # Check packages are installed
        packages_dir = Path("dbt_packages")
        assert packages_dir.exists(), "dbt_packages directory must exist"
        
        # Verify expected packages
        expected_packages = ['dbt_utils', 'dbt_expectations']
        for package in expected_packages:
            package_dir = packages_dir / package
            assert package_dir.exists(), f"Package {package} must be installed"
    
    def test_dbt_compile(self, dbt_runner):
        """Test that all models compile successfully"""
        # WILL FAIL: Models don't compile
        
        result = dbt_runner.invoke(['compile'])
        assert result.success, "dbt compile must succeed"
        
        # Check compiled models exist
        target_dir = Path("target")
        assert target_dir.exists()
        
        compiled_dir = target_dir / "compiled" / "svoa_analytics" / "models"
        assert compiled_dir.exists()
        
        # Verify SQL files are generated
        sql_files = list(compiled_dir.rglob("*.sql"))
        assert len(sql_files) > 0, "Compiled SQL files must exist"
    
    def test_dbt_run(self, dbt_runner):
        """Test that models run successfully"""
        # WILL FAIL: Models don't run
        
        # Run only staging models first
        result = dbt_runner.invoke(['run', '--models', 'staging.*'])
        assert result.success, "Staging models must run successfully"
        
        # Then run intermediate models
        result = dbt_runner.invoke(['run', '--models', 'intermediate.*'])
        assert result.success, "Intermediate models must run successfully"
        
        # Finally run mart models
        result = dbt_runner.invoke(['run', '--models', 'marts.*'])
        assert result.success, "Mart models must run successfully"
    
    def test_dbt_test_execution(self, dbt_runner):
        """Test that data quality tests pass"""
        # WILL FAIL: Tests don't pass
        
        result = dbt_runner.invoke(['test'])
        
        # Tests should pass
        assert result.success, "dbt tests must pass"
        
        # Check test results
        if hasattr(result, 'result'):
            for test_result in result.result:
                assert test_result.status == 'pass', f"Test {test_result.node.name} failed"
    
    def test_dbt_snapshot(self, dbt_runner, dbt_project_dir):
        """Test snapshot models for slowly changing dimensions"""
        # WILL FAIL: Snapshots not configured
        
        snapshots_dir = dbt_project_dir / "snapshots"
        assert snapshots_dir.exists(), "Snapshots directory must exist"
        
        # Check snapshot configuration
        snapshot_file = snapshots_dir / "suppliers_snapshot.sql"
        assert snapshot_file.exists()
        
        content = snapshot_file.read_text()
        assert '{% snapshot' in content
        assert 'strategy' in content
        assert 'updated_at' in content or 'check_cols' in content
        
        # Run snapshots
        result = dbt_runner.invoke(['snapshot'])
        assert result.success, "Snapshots must run successfully"
    
    def test_model_performance(self, dbt_runner):
        """Test that models execute within performance thresholds"""
        # WILL FAIL: Performance not measured
        
        import time
        
        # Run models and measure time
        start_time = time.perf_counter()
        result = dbt_runner.invoke(['run', '--models', 'marts.finance.fct_monthly_spending'])
        elapsed = time.perf_counter() - start_time
        
        assert result.success
        assert elapsed < 30, f"Model must build in < 30s, took {elapsed:.2f}s"
        
        # Check model timing in artifacts
        run_results_file = Path("target") / "run_results.json"
        assert run_results_file.exists()
        
        with open(run_results_file) as f:
            run_results = json.load(f)
        
        for result in run_results['results']:
            execution_time = result['execution_time']
            assert execution_time < 10, f"Model {result['unique_id']} took {execution_time}s"
    
    def test_incremental_run_performance(self, dbt_runner):
        """Test that incremental models are faster on subsequent runs"""
        # WILL FAIL: Incremental performance not optimized
        
        import time
        
        # First full run
        start_time = time.perf_counter()
        result = dbt_runner.invoke(['run', '--models', 'intermediate.int_daily_load_summary', '--full-refresh'])
        full_run_time = time.perf_counter() - start_time
        assert result.success
        
        # Incremental run
        start_time = time.perf_counter()
        result = dbt_runner.invoke(['run', '--models', 'intermediate.int_daily_load_summary'])
        incremental_time = time.perf_counter() - start_time
        assert result.success
        
        # Incremental should be significantly faster
        assert incremental_time < full_run_time * 0.3, "Incremental run should be >70% faster"


class TestDbtDocumentation:
    """Test dbt documentation generation"""
    
    def test_generate_docs(self, dbt_runner):
        """Test documentation generation"""
        # WILL FAIL: Documentation not configured
        
        result = dbt_runner.invoke(['docs', 'generate'])
        assert result.success, "Documentation generation must succeed"
        
        # Check that catalog.json is created
        catalog_file = Path("target") / "catalog.json"
        assert catalog_file.exists(), "catalog.json must be generated"
        
        with open(catalog_file) as f:
            catalog = json.load(f)
        
        assert 'metadata' in catalog
        assert 'nodes' in catalog
        assert len(catalog['nodes']) > 0, "Catalog must contain nodes"
    
    def test_model_lineage(self, dbt_runner):
        """Test that model lineage is properly documented"""
        # WILL FAIL: Lineage not tracked
        
        manifest_file = Path("target") / "manifest.json"
        assert manifest_file.exists(), "manifest.json must exist"
        
        with open(manifest_file) as f:
            manifest = json.load(f)
        
        # Check model dependencies
        nodes = manifest['nodes']
        
        # Find a mart model
        mart_model = next(
            (n for n in nodes.values() if 'marts' in n['path'] and n['resource_type'] == 'model'),
            None
        )
        assert mart_model is not None, "Must have mart models"
        
        # Mart models should depend on intermediate/staging
        depends_on = mart_model['depends_on']['nodes']
        assert len(depends_on) > 0, "Mart models must have dependencies"
        
        # Verify dependency chain
        assert any('staging' in dep or 'intermediate' in dep for dep in depends_on)


class TestDbtMacros:
    """Test custom dbt macros"""
    
    def test_custom_macros_exist(self, dbt_project_dir):
        """Test that custom macros are defined"""
        # WILL FAIL: Macros not created
        
        macros_dir = dbt_project_dir / "macros"
        assert macros_dir.exists(), "Macros directory must exist"
        
        expected_macros = [
            'get_supplier_filter.sql',
            'generate_date_series.sql',
            'calculate_percentile.sql',
            'swedish_fiscal_year.sql'
        ]
        
        for macro_file in expected_macros:
            macro_path = macros_dir / macro_file
            assert macro_path.exists(), f"Macro {macro_file} must exist"
            
            content = macro_path.read_text()
            assert '{% macro' in content
            assert '{% endmacro %}' in content
    
    def test_macro_usage_in_models(self, dbt_project_dir):
        """Test that custom macros are used in models"""
        # WILL FAIL: Macros not used
        
        models_dir = dbt_project_dir / "models"
        
        # Find models using custom macros
        macro_usage = False
        for sql_file in models_dir.rglob("*.sql"):
            content = sql_file.read_text()
            if '{{ get_supplier_filter(' in content or '{{ swedish_fiscal_year(' in content:
                macro_usage = True
                break
        
        assert macro_usage, "Custom macros must be used in models"