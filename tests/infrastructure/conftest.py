"""
Pytest configuration for infrastructure tests
Shared fixtures and test configuration for SVOA Lea platform
"""

import pytest
import os
import boto3
import yaml
from pathlib import Path
from typing import Dict, Any, List
from unittest.mock import Mock, MagicMock
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.fixture(scope="session")
def aws_region() -> str:
    """AWS EU region for testing"""
    return os.getenv("AWS_DEFAULT_REGION", "eu-north-1")


@pytest.fixture(scope="session")
def aws_account_id() -> str:
    """AWS account ID"""
    try:
        sts = boto3.client("sts")
        return sts.get_caller_identity()["Account"]
    except Exception:
        return "123456789012"  # Mock account for local testing


@pytest.fixture(scope="session")
def environment() -> str:
    """Current environment (dev/staging/prod)"""
    return os.getenv("ENVIRONMENT", "test")


@pytest.fixture(scope="session")
def eu_regions() -> List[str]:
    """List of EU AWS regions"""
    return [
        "eu-north-1",      # Stockholm
        "eu-west-1",       # Ireland
        "eu-west-2",       # London
        "eu-west-3",       # Paris
        "eu-central-1",    # Frankfurt
        "eu-south-1"       # Milan
    ]


@pytest.fixture(scope="session")
def swedish_compliance_requirements() -> Dict[str, Any]:
    """Swedish regulatory compliance requirements"""
    return {
        "data_residency": "EU",
        "gdpr_compliant": True,
        "retention_years": 7,
        "encryption_standard": "AES-256",
        "audit_logging": True,
        "language_support": ["sv", "en"],
        "accessibility_standard": "WCAG 2.1 AA",
        "privacy_by_design": True,
        "data_minimization": True,
        "right_to_erasure": True,
        "breach_notification_hours": 72,
        "consent_required": True,
        "consent_age_limit": 13
    }


@pytest.fixture(scope="session")
def waste_data_schema() -> Dict[str, Any]:
    """Swedish waste management data schema"""
    return {
        "facility_id": {"type": "string", "required": True, "pii": False},
        "organization_number": {"type": "string", "required": True, "pii": True},
        "waste_categories": {
            "type": "array",
            "items": {
                "code": {"type": "string", "pattern": "^\\d{6}$"},
                "description": {"type": "string"},
                "quantity_kg": {"type": "number", "min": 0},
                "hazardous": {"type": "boolean"}
            }
        },
        "collection_date": {"type": "date", "required": True},
        "processing_method": {
            "type": "enum",
            "values": ["recycling", "energy_recovery", "landfill", "composting", "special_treatment"]
        },
        "co2_emissions_kg": {"type": "number", "min": 0},
        "municipality_code": {"type": "string", "pattern": "^\\d{4}$"},
        "transport_distance_km": {"type": "number", "min": 0}
    }


@pytest.fixture(scope="function")
def mock_aws_services():
    """Mock AWS services for local testing"""
    with pytest.MonkeyPatch.context() as mp:
        # Mock boto3 clients
        mock_ec2 = MagicMock()
        mock_s3 = MagicMock()
        mock_rds = MagicMock()
        mock_eks = MagicMock()
        mock_secrets_manager = MagicMock()
        mock_kms = MagicMock()
        
        def mock_client(service_name, **kwargs):
            services = {
                'ec2': mock_ec2,
                's3': mock_s3,
                'rds': mock_rds,
                'eks': mock_eks,
                'secretsmanager': mock_secrets_manager,
                'kms': mock_kms
            }
            return services.get(service_name, MagicMock())
        
        mp.setattr(boto3, 'client', mock_client)
        
        yield {
            'ec2': mock_ec2,
            's3': mock_s3,
            'rds': mock_rds,
            'eks': mock_eks,
            'secretsmanager': mock_secrets_manager,
            'kms': mock_kms
        }


@pytest.fixture(scope="session")
def terraform_modules_path() -> Path:
    """Path to Terraform modules"""
    return Path("infrastructure/terraform/modules")


@pytest.fixture(scope="session")
def kubernetes_manifests_path() -> Path:
    """Path to Kubernetes manifests"""
    k8s_dir = Path("kubernetes")
    if not k8s_dir.exists():
        k8s_dir = Path("k8s")
    return k8s_dir


@pytest.fixture(scope="session")
def ci_pipeline_path() -> Path:
    """Path to CI/CD pipeline configurations"""
    return Path(".github/workflows")


@pytest.fixture
def performance_thresholds() -> Dict[str, Any]:
    """Performance thresholds for infrastructure"""
    return {
        "deployment_time_seconds": 600,     # 10 minutes
        "pod_startup_seconds": 30,
        "api_latency_p99_ms": 100,
        "database_query_p99_ms": 50,
        "autoscaling_reaction_seconds": 60,
        "rollback_time_seconds": 120,
        "backup_time_minutes": 30,
        "recovery_time_minutes": 15,
        "tls_handshake_ms": 50,
        "dns_resolution_ms": 20
    }


@pytest.fixture
def security_baselines() -> Dict[str, Any]:
    """Security baseline requirements"""
    return {
        "tls_min_version": "1.3",
        "cipher_suites": [
            "TLS_AES_256_GCM_SHA384",
            "TLS_AES_128_GCM_SHA256",
            "TLS_CHACHA20_POLY1305_SHA256"
        ],
        "ssh_key_bits": 4096,
        "password_min_length": 32,
        "mfa_required": True,
        "session_timeout_minutes": 30,
        "max_login_attempts": 3,
        "audit_retention_days": 365,
        "vulnerability_scan_frequency_hours": 24,
        "patch_window_days": 30
    }


@pytest.fixture
def cost_limits() -> Dict[str, float]:
    """Monthly cost limits per environment (EUR)"""
    return {
        "dev": 1000.0,
        "staging": 2000.0,
        "prod": 5000.0,
        "total": 8000.0
    }


@pytest.fixture(autouse=True)
def test_environment_setup(request):
    """Setup test environment before each test"""
    # Set environment variables for testing
    os.environ["TESTING"] = "true"
    os.environ["AWS_REGION"] = "eu-north-1"
    
    # Create temporary directories if needed
    temp_dirs = [
        Path("/tmp/svoa-lea-test"),
        Path("/tmp/svoa-lea-test/terraform"),
        Path("/tmp/svoa-lea-test/kubernetes")
    ]
    
    for dir_path in temp_dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
    
    yield
    
    # Cleanup after test
    if not request.config.getoption("--keep-test-data", default=False):
        import shutil
        shutil.rmtree("/tmp/svoa-lea-test", ignore_errors=True)


def pytest_addoption(parser):
    """Add custom command line options"""
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="Run integration tests against real AWS resources"
    )
    parser.addoption(
        "--performance",
        action="store_true",
        default=False,
        help="Run performance tests"
    )
    parser.addoption(
        "--security",
        action="store_true",
        default=False,
        help="Run security scanning tests"
    )
    parser.addoption(
        "--compliance",
        action="store_true",
        default=False,
        help="Run compliance verification tests"
    )
    parser.addoption(
        "--keep-test-data",
        action="store_true",
        default=False,
        help="Keep test data after test completion"
    )


def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "security: mark test as security test"
    )
    config.addinivalue_line(
        "markers", "compliance: mark test as compliance test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "critical: mark test as critical for production"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection based on markers"""
    if not config.getoption("--integration"):
        skip_integration = pytest.mark.skip(reason="need --integration option to run")
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip_integration)
    
    if not config.getoption("--performance"):
        skip_performance = pytest.mark.skip(reason="need --performance option to run")
        for item in items:
            if "performance" in item.keywords:
                item.add_marker(skip_performance)
    
    if not config.getoption("--security"):
        skip_security = pytest.mark.skip(reason="need --security option to run")
        for item in items:
            if "security" in item.keywords:
                item.add_marker(skip_security)
    
    if not config.getoption("--compliance"):
        skip_compliance = pytest.mark.skip(reason="need --compliance option to run")
        for item in items:
            if "compliance" in item.keywords:
                item.add_marker(skip_compliance)


@pytest.fixture
def assert_infrastructure_ready():
    """Assert that infrastructure is ready for testing"""
    def _assert_ready(component: str) -> bool:
        """Check if infrastructure component is ready"""
        readiness_checks = {
            "vpc": lambda: _check_vpc_ready(),
            "eks": lambda: _check_eks_ready(),
            "rds": lambda: _check_rds_ready(),
            "s3": lambda: _check_s3_ready(),
            "secrets": lambda: _check_secrets_ready()
        }
        
        if component in readiness_checks:
            return readiness_checks[component]()
        
        raise ValueError(f"Unknown component: {component}")
    
    return _assert_ready


def _check_vpc_ready() -> bool:
    """Check if VPC is ready"""
    try:
        ec2 = boto3.client('ec2')
        vpcs = ec2.describe_vpcs()
        return len(vpcs['Vpcs']) > 0
    except Exception:
        return False


def _check_eks_ready() -> bool:
    """Check if EKS cluster is ready"""
    try:
        eks = boto3.client('eks')
        clusters = eks.list_clusters()
        if clusters['clusters']:
            cluster = eks.describe_cluster(name=clusters['clusters'][0])
            return cluster['cluster']['status'] == 'ACTIVE'
        return False
    except Exception:
        return False


def _check_rds_ready() -> bool:
    """Check if RDS is ready"""
    try:
        rds = boto3.client('rds')
        instances = rds.describe_db_instances()
        if instances['DBInstances']:
            return instances['DBInstances'][0]['DBInstanceStatus'] == 'available'
        return False
    except Exception:
        return False


def _check_s3_ready() -> bool:
    """Check if S3 buckets are ready"""
    try:
        s3 = boto3.client('s3')
        buckets = s3.list_buckets()
        return len(buckets['Buckets']) > 0
    except Exception:
        return False


def _check_secrets_ready() -> bool:
    """Check if Secrets Manager is ready"""
    try:
        sm = boto3.client('secretsmanager')
        secrets = sm.list_secrets(MaxResults=1)
        return True
    except Exception:
        return False