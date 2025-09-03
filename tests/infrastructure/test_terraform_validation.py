"""
Test Suite: Terraform/Terragrunt Infrastructure as Code Validation
Target Coverage: 95% of infrastructure components
Status: All tests should FAIL initially (TDD approach)
"""

import pytest
import json
import subprocess
import os
from pathlib import Path
from typing import Dict, List, Any
import hcl2
import yaml


class TestTerraformInfrastructureValidation:
    """
    Tests for Terraform/Terragrunt configuration validation.
    These tests verify that IaC definitions meet EU/EES compliance requirements.
    """

    @pytest.fixture
    def terraform_root(self) -> Path:
        """Path to Terraform configuration root"""
        return Path("infrastructure/terraform")

    @pytest.fixture
    def terragrunt_root(self) -> Path:
        """Path to Terragrunt configuration root"""
        return Path("infrastructure/terragrunt")

    def test_terraform_modules_exist(self, terraform_root: Path):
        """Test that all required Terraform modules are present"""
        required_modules = [
            "vpc",
            "compute",
            "storage",
            "networking",
            "security",
            "monitoring",
            "compliance",
            "data_residency"
        ]
        
        for module in required_modules:
            module_path = terraform_root / "modules" / module
            assert module_path.exists(), f"Required Terraform module '{module}' not found"
            assert (module_path / "main.tf").exists(), f"main.tf missing in module '{module}'"
            assert (module_path / "variables.tf").exists(), f"variables.tf missing in module '{module}'"
            assert (module_path / "outputs.tf").exists(), f"outputs.tf missing in module '{module}'"

    def test_terraform_backend_configuration(self, terraform_root: Path):
        """Test that Terraform backend is configured for EU region"""
        backend_config = terraform_root / "backend.tf"
        assert backend_config.exists(), "Backend configuration file missing"
        
        with open(backend_config, 'r') as f:
            content = f.read()
            config = hcl2.loads(content)
            
        backend = config.get("terraform", [{}])[0].get("backend", {})
        assert "s3" in backend, "S3 backend not configured"
        
        s3_config = backend["s3"][0]
        assert s3_config.get("region") in ["eu-north-1", "eu-west-1", "eu-central-1"], \
            "Backend must be in EU region"
        assert s3_config.get("encrypt") is True, "Backend encryption not enabled"
        assert "dynamodb_table" in s3_config, "State locking not configured"

    def test_terraform_providers_configuration(self, terraform_root: Path):
        """Test that all providers are configured for EU regions"""
        providers_file = terraform_root / "providers.tf"
        assert providers_file.exists(), "Providers configuration missing"
        
        with open(providers_file, 'r') as f:
            content = f.read()
            config = hcl2.loads(content)
        
        # Check AWS provider
        aws_provider = config.get("provider", {}).get("aws", [{}])[0]
        assert aws_provider.get("region") in ["eu-north-1", "eu-west-1", "eu-central-1"], \
            "AWS provider not configured for EU region"
        
        # Check required provider features
        assert "default_tags" in aws_provider, "Default tags not configured"
        tags = aws_provider["default_tags"][0].get("tags", {})
        assert "Environment" in tags, "Environment tag missing"
        assert "DataClassification" in tags, "Data classification tag missing"
        assert "Compliance" in tags, "Compliance tag missing"
        assert tags.get("Compliance") == "EU-EES-GDPR", "Incorrect compliance tag"

    def test_terraform_validation_passes(self, terraform_root: Path):
        """Test that terraform validate passes for all modules"""
        modules_dir = terraform_root / "modules"
        
        for module_dir in modules_dir.iterdir():
            if module_dir.is_dir():
                result = subprocess.run(
                    ["terraform", "validate"],
                    cwd=module_dir,
                    capture_output=True,
                    text=True
                )
                assert result.returncode == 0, \
                    f"Terraform validation failed for module {module_dir.name}: {result.stderr}"

    def test_terraform_fmt_compliance(self, terraform_root: Path):
        """Test that all Terraform files are properly formatted"""
        result = subprocess.run(
            ["terraform", "fmt", "-check", "-recursive"],
            cwd=terraform_root,
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"Terraform formatting issues found: {result.stdout}"

    def test_terragrunt_configuration_hierarchy(self, terragrunt_root: Path):
        """Test Terragrunt configuration hierarchy for multi-environment setup"""
        required_envs = ["dev", "staging", "prod"]
        
        for env in required_envs:
            env_path = terragrunt_root / env
            assert env_path.exists(), f"Environment '{env}' configuration missing"
            
            # Check for terragrunt.hcl in each environment
            terragrunt_config = env_path / "terragrunt.hcl"
            assert terragrunt_config.exists(), f"terragrunt.hcl missing for {env}"
            
            # Check for required components
            components = ["vpc", "eks", "rds", "s3", "monitoring"]
            for component in components:
                component_path = env_path / component / "terragrunt.hcl"
                assert component_path.exists(), \
                    f"Component '{component}' missing in {env} environment"

    def test_terraform_security_scanning(self, terraform_root: Path):
        """Test that Terraform configurations pass security scanning"""
        # Using tfsec for security scanning
        result = subprocess.run(
            ["tfsec", str(terraform_root), "--format", "json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            issues = json.loads(result.stdout)
            critical_issues = [i for i in issues.get("results", []) 
                             if i.get("severity") in ["CRITICAL", "HIGH"]]
            assert len(critical_issues) == 0, \
                f"Critical security issues found: {critical_issues}"

    def test_terraform_cost_estimation(self, terraform_root: Path):
        """Test that infrastructure costs are within budget constraints"""
        # Using infracost for cost estimation
        result = subprocess.run(
            ["infracost", "breakdown", "--path", str(terraform_root), "--format", "json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            cost_data = json.loads(result.stdout)
            monthly_cost = float(cost_data.get("totalMonthlyCost", "0"))
            
            # Define budget limits per environment
            budget_limits = {
                "dev": 1000,
                "staging": 2000,
                "prod": 5000
            }
            
            for env, limit in budget_limits.items():
                assert monthly_cost <= limit, \
                    f"Infrastructure cost ${monthly_cost} exceeds {env} budget ${limit}"

    def test_terraform_dependency_graph(self, terraform_root: Path):
        """Test that resource dependencies are properly defined"""
        result = subprocess.run(
            ["terraform", "graph"],
            cwd=terraform_root,
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0, "Failed to generate dependency graph"
        
        graph = result.stdout
        # Check for circular dependencies
        assert "cycle" not in graph.lower(), "Circular dependency detected in Terraform configuration"
        
        # Verify critical dependencies
        assert "aws_vpc" in graph, "VPC resource missing from dependency graph"
        assert "aws_security_group" in graph, "Security groups missing from dependency graph"

    def test_terraform_state_encryption(self, terraform_root: Path):
        """Test that Terraform state is encrypted and locked"""
        backend_config = terraform_root / ".terraform" / "terraform.tfstate"
        
        if backend_config.exists():
            with open(backend_config, 'r') as f:
                state = json.load(f)
                
            backend = state.get("backend", {})
            assert backend.get("config", {}).get("encrypt") is True, \
                "State encryption not enabled"
            assert backend.get("config", {}).get("dynamodb_table"), \
                "State locking table not configured"

    def test_terraform_module_versioning(self, terraform_root: Path):
        """Test that all modules use semantic versioning"""
        modules_dir = terraform_root / "modules"
        
        for module_dir in modules_dir.iterdir():
            if module_dir.is_dir():
                version_file = module_dir / "version.tf"
                assert version_file.exists(), f"Version file missing for module {module_dir.name}"
                
                with open(version_file, 'r') as f:
                    content = f.read()
                    
                assert "terraform {" in content, "Terraform version constraint missing"
                assert "required_version" in content, "Required version not specified"
                assert "required_providers" in content, "Required providers not specified"

    def test_terraform_output_validation(self, terraform_root: Path):
        """Test that required outputs are defined"""
        required_outputs = [
            "vpc_id",
            "subnet_ids",
            "security_group_ids",
            "cluster_endpoint",
            "database_endpoint",
            "s3_bucket_names",
            "monitoring_dashboard_url"
        ]
        
        outputs_file = terraform_root / "outputs.tf"
        assert outputs_file.exists(), "Outputs file missing"
        
        with open(outputs_file, 'r') as f:
            content = f.read()
            
        for output in required_outputs:
            assert f'output "{output}"' in content, f"Required output '{output}' not defined"

    def test_terraform_remote_state_references(self, terraform_root: Path):
        """Test that remote state data sources are properly configured"""
        data_file = terraform_root / "data.tf"
        
        if data_file.exists():
            with open(data_file, 'r') as f:
                content = f.read()
                config = hcl2.loads(content)
                
            data_sources = config.get("data", {}).get("terraform_remote_state", {})
            
            for name, config in data_sources.items():
                backend = config[0].get("backend")
                assert backend == "s3", f"Remote state {name} not using S3 backend"
                
                config_block = config[0].get("config", {})
                assert config_block.get("region") in ["eu-north-1", "eu-west-1", "eu-central-1"], \
                    f"Remote state {name} not in EU region"
                assert config_block.get("encrypt") is True, \
                    f"Remote state {name} encryption not enabled"

    def test_terragrunt_dependency_resolution(self, terragrunt_root: Path):
        """Test that Terragrunt dependencies are properly resolved"""
        result = subprocess.run(
            ["terragrunt", "graph-dependencies"],
            cwd=terragrunt_root,
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0, f"Dependency resolution failed: {result.stderr}"
        
        dependencies = result.stdout
        # Verify no circular dependencies
        assert "circular" not in dependencies.lower(), "Circular dependency detected"
        
        # Verify critical dependency order
        lines = dependencies.split('\n')
        vpc_index = next((i for i, line in enumerate(lines) if 'vpc' in line.lower()), -1)
        eks_index = next((i for i, line in enumerate(lines) if 'eks' in line.lower()), -1)
        
        assert vpc_index < eks_index, "VPC must be created before EKS cluster"

    def test_terraform_compliance_policies(self, terraform_root: Path):
        """Test that Terraform configurations comply with organizational policies"""
        # Using terraform-compliance for policy testing
        policies_dir = terraform_root / "policies"
        assert policies_dir.exists(), "Compliance policies directory missing"
        
        policy_files = list(policies_dir.glob("*.feature"))
        assert len(policy_files) > 0, "No compliance policy files found"
        
        for policy_file in policy_files:
            result = subprocess.run(
                ["terraform-compliance", "-f", str(policy_file), "-p", str(terraform_root)],
                capture_output=True,
                text=True
            )
            assert result.returncode == 0, \
                f"Compliance policy {policy_file.name} failed: {result.stdout}"