# SVOA Lea Platform - Infrastructure Test Suite

## Overview

Comprehensive Test-Driven Development (TDD) test suite for the SVOA Lea platform infrastructure. This suite ensures EU/EES compliance, security, and performance requirements for Swedish waste management data QA system.

## Test Coverage Areas

### 1. Infrastructure as Code (IaC)
- **File**: `test_terraform_validation.py`
- **Coverage**: Terraform/Terragrunt configurations
- **Key Tests**:
  - Module structure validation
  - Backend configuration (EU regions)
  - Provider configuration
  - Security scanning with tfsec
  - Cost estimation with infracost
  - Dependency graph analysis

### 2. EU/EES Compliance
- **File**: `test_eu_ees_compliance.py`
- **Coverage**: GDPR and Swedish regulatory compliance
- **Key Tests**:
  - Data residency in EU regions
  - GDPR requirements (retention, erasure, portability)
  - Swedish Data Protection Authority requirements
  - Consent management
  - Breach detection and notification

### 3. Security Configuration
- **File**: `test_security_configuration.py`
- **Coverage**: Encryption at rest and in transit
- **Key Tests**:
  - S3, RDS, EBS encryption
  - KMS key management and rotation
  - TLS 1.3 configuration
  - Certificate management
  - WAF configuration
  - GuardDuty setup

### 4. Network Segmentation
- **File**: `test_network_segmentation.py`
- **Coverage**: Network isolation and firewall rules
- **Key Tests**:
  - VPC configuration
  - Subnet segmentation (public, private, data, management)
  - Security groups and NACLs
  - Route tables and NAT gateways
  - VPC Flow Logs
  - DNS Firewall

### 5. Secrets Management
- **File**: `test_secrets_management.py`
- **Coverage**: Secure secrets handling and rotation
- **Key Tests**:
  - AWS Secrets Manager configuration
  - Rotation schedules and Lambda functions
  - Parameter Store encryption
  - Kubernetes secrets
  - API key and database credential rotation

### 6. CI/CD Pipeline
- **File**: `test_cicd_pipeline.py`
- **Coverage**: Continuous Integration and Deployment
- **Key Tests**:
  - GitHub Actions/GitLab CI configuration
  - Security scanning integration
  - Deployment strategies (rolling, blue-green, canary)
  - Artifact management
  - Rollback mechanisms
  - Performance metrics (<10 min deployment)

### 7. Container Orchestration
- **File**: `test_container_orchestration.py`
- **Coverage**: Kubernetes/EKS and autoscaling
- **Key Tests**:
  - EKS cluster configuration
  - Horizontal Pod Autoscaler (HPA)
  - Vertical Pod Autoscaler (VPA)
  - Cluster Autoscaler
  - Resource quotas and limits
  - StatefulSet configuration
  - Service mesh (Istio/Linkerd)

## Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r tests/infrastructure/requirements.txt
```

## Running Tests

### Run All Tests (Will Fail Initially - TDD)
```bash
pytest tests/infrastructure/
```

### Run Specific Test Categories
```bash
# Terraform/IaC tests only
pytest tests/infrastructure/test_terraform_validation.py

# EU/GDPR compliance tests
pytest tests/infrastructure/test_eu_ees_compliance.py

# Security tests
pytest tests/infrastructure/test_security_configuration.py

# Network tests
pytest tests/infrastructure/test_network_segmentation.py

# Secrets management tests
pytest tests/infrastructure/test_secrets_management.py

# CI/CD tests
pytest tests/infrastructure/test_cicd_pipeline.py

# Container orchestration tests
pytest tests/infrastructure/test_container_orchestration.py
```

### Run with Specific Markers
```bash
# Critical tests only
pytest -m critical

# Swedish compliance tests
pytest -m swedish

# Security scanning tests
pytest -m security --security

# Performance tests
pytest -m performance --performance

# Integration tests (requires AWS)
pytest -m integration --integration
```

### Generate Coverage Report
```bash
# Generate HTML coverage report
pytest --cov=infrastructure --cov-report=html

# View report
open htmlcov/index.html
```

## TDD Workflow

1. **Run Tests (Red Phase)**
   ```bash
   pytest tests/infrastructure/test_terraform_validation.py -v
   ```
   All tests will fail initially - this is expected!

2. **Implement Infrastructure (Green Phase)**
   - Create Terraform modules
   - Configure AWS resources
   - Set up Kubernetes manifests
   - Implement security controls

3. **Refactor**
   - Optimize configurations
   - Improve security posture
   - Enhance performance

4. **Verify Compliance**
   ```bash
   pytest -m compliance --compliance
   ```

## Test Configuration

### Environment Variables
```bash
export AWS_REGION=eu-north-1
export ENVIRONMENT=test
export VAULT_ADDR=https://vault.svoa-lea.io
export TERRAFORM_VERSION=1.6.0
```

### Custom Configuration
Edit `pytest.ini` to modify:
- Test discovery patterns
- Coverage thresholds (default: 95%)
- Logging levels
- Timeout values

## Swedish/EU Specific Requirements

### Data Residency
- All resources MUST be in EU regions
- Primary region: `eu-north-1` (Stockholm)
- Backup regions: `eu-west-1`, `eu-central-1`

### GDPR Compliance
- Data retention: 7 years (financial data)
- Encryption: AES-256 minimum
- TLS: Version 1.3 required
- Breach notification: Within 72 hours

### Swedish Regulations
- Language support: Swedish (sv) and English (en)
- Personal number handling: Using `personnummer` library
- Municipality codes: 4-digit format
- Waste codes: 6-digit EWC format

## Performance Requirements

| Metric | Target | Test Coverage |
|--------|--------|---------------|
| Infrastructure Provisioning | < 10 minutes | ✅ |
| Pod Startup Time | < 30 seconds | ✅ |
| Autoscaling Reaction | < 60 seconds | ✅ |
| Rollback Time | < 2 minutes | ✅ |
| API Latency (p99) | < 100ms | ✅ |
| TLS Handshake | < 50ms | ✅ |

## Security Requirements

| Control | Requirement | Test Coverage |
|---------|------------|---------------|
| Encryption at Rest | AES-256 | ✅ |
| Encryption in Transit | TLS 1.3 | ✅ |
| Secret Rotation | 30-90 days | ✅ |
| MFA | Required | ✅ |
| Network Segmentation | 4 zones | ✅ |
| Audit Logging | 365 days retention | ✅ |

## CI/CD Integration

### GitHub Actions
```yaml
name: Infrastructure Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - run: |
          pip install -r tests/infrastructure/requirements.txt
          pytest tests/infrastructure/ --cov-fail-under=95
```

### Pre-commit Hooks
```yaml
repos:
  - repo: local
    hooks:
      - id: infrastructure-tests
        name: Infrastructure Tests
        entry: pytest tests/infrastructure/ -m "not slow"
        language: system
        pass_filenames: false
```

## Troubleshooting

### Common Issues

1. **AWS Credentials Error**
   ```bash
   export AWS_PROFILE=svoa-lea-test
   aws configure list
   ```

2. **Kubernetes Connection Failed**
   ```bash
   kubectl config current-context
   aws eks update-kubeconfig --name svoa-lea-cluster --region eu-north-1
   ```

3. **Test Timeout**
   Increase timeout in `pytest.ini`:
   ```ini
   timeout = 600  # 10 minutes
   ```

## Contributing

1. Write failing tests first (TDD)
2. Implement minimal code to pass tests
3. Refactor for optimization
4. Ensure 95% coverage minimum
5. Document Swedish/EU specific requirements

## License

© 2024 SVOA Lea Platform - Infrastructure Test Suite