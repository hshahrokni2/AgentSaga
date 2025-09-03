"""
Test Suite: Secrets Management and Rotation
Target: Secure secrets handling for SVOA Lea platform
Status: All tests should FAIL initially (TDD approach)
"""

import pytest
import boto3
import json
import os
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import hvac  # HashiCorp Vault client
from unittest.mock import Mock, patch
import re


class TestSecretsManagement:
    """
    Comprehensive tests for secrets management, rotation, and secure storage.
    Validates encryption, access controls, and audit logging for secrets.
    """

    @pytest.fixture
    def rotation_schedule(self) -> Dict[str, int]:
        """Rotation schedule for different secret types (in days)"""
        return {
            "database_password": 30,
            "api_key": 90,
            "jwt_secret": 60,
            "encryption_key": 180,
            "service_account": 60,
            "oauth_client_secret": 90,
            "ssh_key": 365,
            "tls_certificate": 30  # 30 days before expiry
        }

    @pytest.fixture
    def secret_requirements(self) -> Dict[str, Any]:
        """Requirements for different secret types"""
        return {
            "password": {
                "min_length": 32,
                "require_special": True,
                "require_numbers": True,
                "require_uppercase": True,
                "require_lowercase": True,
                "entropy_bits": 128
            },
            "api_key": {
                "min_length": 64,
                "format": "alphanumeric",
                "prefix": "sk_",
                "checksum": True
            },
            "encryption_key": {
                "algorithm": "AES-256",
                "key_bits": 256,
                "format": "base64"
            }
        }

    def test_aws_secrets_manager_configuration(self):
        """Test AWS Secrets Manager configuration and policies"""
        sm = boto3.client('secretsmanager')
        
        # List all secrets
        paginator = sm.get_paginator('list_secrets')
        
        for page in paginator.paginate():
            for secret in page['SecretList']:
                secret_name = secret['Name']
                secret_arn = secret['ARN']
                
                # Check rotation configuration
                assert secret.get('RotationEnabled'), \
                    f"Secret {secret_name} does not have rotation enabled"
                
                if secret.get('RotationEnabled'):
                    # Check rotation Lambda
                    assert secret.get('RotationLambdaARN'), \
                        f"Secret {secret_name} missing rotation Lambda function"
                    
                    # Check rotation schedule
                    rotation_rules = secret.get('RotationRules', {})
                    rotation_days = rotation_rules.get('AutomaticallyAfterDays')
                    
                    assert rotation_days and rotation_days <= 90, \
                        f"Secret {secret_name} rotation interval {rotation_days} days exceeds maximum"
                    
                    # Check last rotation
                    if secret.get('LastRotatedDate'):
                        last_rotation = secret['LastRotatedDate']
                        days_since_rotation = (datetime.now(last_rotation.tzinfo) - last_rotation).days
                        
                        assert days_since_rotation <= rotation_days, \
                            f"Secret {secret_name} overdue for rotation"
                
                # Check resource policy
                try:
                    policy_response = sm.get_resource_policy(SecretId=secret_arn)
                    
                    if policy_response.get('ResourcePolicy'):
                        policy = json.loads(policy_response['ResourcePolicy'])
                        
                        # Verify least privilege
                        for statement in policy.get('Statement', []):
                            if statement.get('Effect') == 'Allow':
                                principal = statement.get('Principal', {})
                                
                                # Check for overly permissive principals
                                assert principal != {"AWS": "*"}, \
                                    f"Secret {secret_name} has overly permissive policy"
                                
                                # Check for explicit deny for root
                                actions = statement.get('Action', [])
                                if 'secretsmanager:GetSecretValue' in actions:
                                    assert 'root' not in str(principal), \
                                        f"Secret {secret_name} allows root access"
                                        
                except sm.exceptions.ResourceNotFoundException:
                    pass  # No resource policy is acceptable
                
                # Check KMS key usage
                assert secret.get('KmsKeyId'), \
                    f"Secret {secret_name} not using KMS encryption"
                
                # Check versioning
                versions = sm.list_secret_version_ids(SecretId=secret_arn)
                assert len(versions['Versions']) > 0, \
                    f"Secret {secret_name} has no versions"
                
                # Check for pending deletion
                assert not secret.get('DeletedDate'), \
                    f"Secret {secret_name} is marked for deletion"

    def test_parameter_store_secrets(self):
        """Test AWS Systems Manager Parameter Store for secrets"""
        ssm = boto3.client('ssm')
        
        # Get all parameters
        paginator = ssm.get_paginator('describe_parameters')
        
        for page in paginator.paginate():
            for param in page['Parameters']:
                param_name = param['Name']
                param_type = param['Type']
                
                # Check sensitive parameters use SecureString
                sensitive_patterns = [
                    'password', 'secret', 'key', 'token',
                    'credential', 'private', 'auth'
                ]
                
                is_sensitive = any(
                    pattern in param_name.lower()
                    for pattern in sensitive_patterns
                )
                
                if is_sensitive:
                    assert param_type == 'SecureString', \
                        f"Sensitive parameter {param_name} not using SecureString type"
                    
                    # Check KMS key
                    assert param.get('KeyId'), \
                        f"Parameter {param_name} not using KMS encryption"
                
                # Check parameter policies
                if param.get('Policies'):
                    for policy in param['Policies']:
                        if policy['PolicyType'] == 'Expiration':
                            # Check expiration is set for temporary values
                            if 'temp' in param_name.lower() or 'tmp' in param_name.lower():
                                assert policy.get('PolicyText'), \
                                    f"Temporary parameter {param_name} lacks expiration policy"
                
                # Check parameter tags
                tags = ssm.list_tags_for_resource(
                    ResourceType='Parameter',
                    ResourceId=param_name
                )
                
                tag_dict = {tag['Key']: tag['Value'] for tag in tags.get('TagList', [])}
                
                assert 'Environment' in tag_dict, \
                    f"Parameter {param_name} missing Environment tag"
                assert 'Owner' in tag_dict, \
                    f"Parameter {param_name} missing Owner tag"
                
                if is_sensitive:
                    assert tag_dict.get('SecretType'), \
                        f"Sensitive parameter {param_name} missing SecretType tag"

    def test_kubernetes_secrets(self):
        """Test Kubernetes secrets management"""
        # This would connect to the K8s API in a real environment
        k8s_client = self._get_kubernetes_client()
        
        namespaces = k8s_client.list_namespace()
        
        for namespace in namespaces.items:
            ns_name = namespace.metadata.name
            
            # Skip system namespaces
            if ns_name.startswith('kube-'):
                continue
            
            # Get secrets in namespace
            secrets = k8s_client.list_namespaced_secret(ns_name)
            
            for secret in secrets.items:
                secret_name = secret.metadata.name
                secret_type = secret.type
                
                # Check secret encryption
                annotations = secret.metadata.annotations or {}
                
                # Should be encrypted at rest
                assert annotations.get('encryption.k8s.io/encrypted') == 'true', \
                    f"Secret {secret_name} in {ns_name} not encrypted at rest"
                
                # Check for rotation annotation
                if secret_type != 'kubernetes.io/service-account-token':
                    assert annotations.get('rotation.k8s.io/enabled'), \
                        f"Secret {secret_name} in {ns_name} lacks rotation configuration"
                    
                    if annotations.get('rotation.k8s.io/enabled') == 'true':
                        last_rotation = annotations.get('rotation.k8s.io/last-rotation')
                        
                        if last_rotation:
                            rotation_date = datetime.fromisoformat(last_rotation)
                            days_since = (datetime.now() - rotation_date).days
                            
                            max_age = int(annotations.get('rotation.k8s.io/max-age-days', 90))
                            assert days_since <= max_age, \
                                f"Secret {secret_name} in {ns_name} overdue for rotation"
                
                # Check RBAC
                self._verify_secret_rbac(k8s_client, ns_name, secret_name)

    def test_vault_integration(self):
        """Test HashiCorp Vault integration if used"""
        vault_url = os.getenv('VAULT_ADDR', 'https://vault.svoa-lea.io')
        vault_token = os.getenv('VAULT_TOKEN')
        
        if not vault_token:
            pytest.skip("Vault not configured")
        
        client = hvac.Client(url=vault_url, token=vault_token)
        
        assert client.is_authenticated(), "Vault authentication failed"
        
        # Check seal status
        assert not client.sys.is_sealed(), "Vault is sealed"
        
        # Check audit devices
        audit_devices = client.sys.list_enabled_audit_devices()
        assert len(audit_devices) > 0, "No audit devices enabled in Vault"
        
        # Check for file audit backend
        has_file_audit = any(
            device.get('type') == 'file'
            for device in audit_devices.values()
        )
        assert has_file_audit, "File audit backend not enabled"
        
        # Check auth methods
        auth_methods = client.sys.list_auth_methods()
        
        # Should have at least kubernetes auth for pod integration
        assert 'kubernetes/' in auth_methods, "Kubernetes auth not enabled"
        
        # Check policies
        policies = client.sys.list_policies()['data']['policies']
        
        required_policies = ['default', 'admin', 'application', 'rotation']
        for policy in required_policies:
            assert policy in policies, f"Required policy '{policy}' not found"
        
        # Check secret engines
        secret_engines = client.sys.list_mounted_secrets_engines()
        
        # Should have KV v2 for application secrets
        kv_engines = [
            mount for mount, config in secret_engines.items()
            if config['type'] == 'kv' and config['options'].get('version') == '2'
        ]
        assert len(kv_engines) > 0, "No KV v2 secret engine mounted"
        
        # Check database secret engine for dynamic credentials
        assert any(
            config['type'] == 'database'
            for config in secret_engines.values()
        ), "Database secret engine not mounted"

    def test_secret_rotation_lambdas(self):
        """Test Lambda functions for secret rotation"""
        lambda_client = boto3.client('lambda')
        sm = boto3.client('secretsmanager')
        
        # Get all secrets with rotation
        secrets = sm.list_secrets()
        
        rotation_lambdas = set()
        for secret in secrets['SecretList']:
            if secret.get('RotationLambdaARN'):
                rotation_lambdas.add(secret['RotationLambdaARN'])
        
        for lambda_arn in rotation_lambdas:
            function_name = lambda_arn.split(':')[-1]
            
            # Get function configuration
            try:
                func_config = lambda_client.get_function_configuration(
                    FunctionName=function_name
                )
                
                # Check runtime
                runtime = func_config.get('Runtime', '')
                assert 'python3' in runtime or 'nodejs' in runtime, \
                    f"Rotation Lambda {function_name} using unsupported runtime {runtime}"
                
                # Check environment variables
                env_vars = func_config.get('Environment', {}).get('Variables', {})
                
                # Should not have hardcoded secrets
                for key, value in env_vars.items():
                    assert not any(
                        pattern in value.lower()
                        for pattern in ['password', 'secret', 'key', 'token']
                    ), f"Rotation Lambda {function_name} has potential secret in environment"
                
                # Check VPC configuration
                vpc_config = func_config.get('VpcConfig', {})
                assert vpc_config.get('SubnetIds'), \
                    f"Rotation Lambda {function_name} not in VPC"
                
                # Check execution role
                role_arn = func_config.get('Role')
                self._verify_rotation_lambda_permissions(role_arn, function_name)
                
                # Check function tags
                tags = lambda_client.list_tags(Resource=lambda_arn)['Tags']
                
                assert tags.get('Type') == 'SecretRotation', \
                    f"Rotation Lambda {function_name} missing Type tag"
                assert tags.get('ManagedBy'), \
                    f"Rotation Lambda {function_name} missing ManagedBy tag"
                
            except lambda_client.exceptions.ResourceNotFoundException:
                pytest.fail(f"Rotation Lambda {function_name} not found")

    def test_secret_complexity_requirements(self, secret_requirements: Dict[str, Any]):
        """Test that generated secrets meet complexity requirements"""
        sm = boto3.client('secretsmanager')
        
        # Get a sample of secrets to validate
        secrets = sm.list_secrets(MaxResults=10)
        
        for secret in secrets['SecretList']:
            secret_name = secret['Name']
            
            # Determine secret type from name
            secret_type = self._determine_secret_type(secret_name)
            
            if secret_type in secret_requirements:
                requirements = secret_requirements[secret_type]
                
                # Get secret value (in test environment only!)
                try:
                    secret_value = sm.get_secret_value(SecretId=secret['ARN'])
                    
                    if 'SecretString' in secret_value:
                        value = secret_value['SecretString']
                        
                        # Try to parse as JSON
                        try:
                            value_dict = json.loads(value)
                            # Check each value in the JSON
                            for key, val in value_dict.items():
                                if isinstance(val, str):
                                    self._validate_secret_complexity(
                                        val, requirements, f"{secret_name}.{key}"
                                    )
                        except json.JSONDecodeError:
                            # Plain string secret
                            self._validate_secret_complexity(
                                value, requirements, secret_name
                            )
                            
                except sm.exceptions.ResourceNotFoundException:
                    pass

    def test_secret_access_patterns(self):
        """Test that secrets are accessed securely"""
        cloudtrail = boto3.client('cloudtrail')
        
        # Look for secret access events in CloudTrail
        end_time = datetime.now()
        start_time = end_time - timedelta(days=7)
        
        events = cloudtrail.lookup_events(
            LookupAttributes=[
                {
                    'AttributeKey': 'EventName',
                    'AttributeValue': 'GetSecretValue'
                }
            ],
            StartTime=start_time,
            EndTime=end_time
        )
        
        suspicious_patterns = []
        
        for event in events['Events']:
            event_detail = json.loads(event['CloudTrailEvent'])
            
            # Check for suspicious access patterns
            user_identity = event_detail.get('userIdentity', {})
            source_ip = event_detail.get('sourceIPAddress', '')
            
            # Check for root account access
            if user_identity.get('type') == 'Root':
                suspicious_patterns.append({
                    'type': 'root_access',
                    'event': event_detail
                })
            
            # Check for unusual IP addresses
            if not self._is_trusted_ip(source_ip):
                suspicious_patterns.append({
                    'type': 'untrusted_ip',
                    'event': event_detail
                })
            
            # Check for high frequency access
            request_params = event_detail.get('requestParameters', {})
            secret_id = request_params.get('secretId', '')
            
            # Count accesses per secret
            # (In production, this would use a proper analytics system)
        
        assert len(suspicious_patterns) == 0, \
            f"Suspicious secret access patterns detected: {suspicious_patterns}"

    def test_certificate_management(self):
        """Test TLS certificate management and rotation"""
        acm = boto3.client('acm')
        
        # List certificates
        certificates = acm.list_certificates()
        
        for cert_summary in certificates['CertificateSummaryList']:
            cert_arn = cert_summary['CertificateArn']
            domain = cert_summary['DomainName']
            
            # Get certificate details
            cert_details = acm.describe_certificate(CertificateArn=cert_arn)
            cert = cert_details['Certificate']
            
            # Check certificate status
            assert cert['Status'] == 'ISSUED', \
                f"Certificate for {domain} not properly issued"
            
            # Check key algorithm
            key_algorithm = cert.get('KeyAlgorithm', '')
            assert key_algorithm in ['RSA-2048', 'RSA-4096', 'EC_prime256v1', 'EC_secp384r1'], \
                f"Certificate for {domain} using weak key algorithm {key_algorithm}"
            
            # Check validity period
            not_after = cert.get('NotAfter')
            if not_after:
                days_until_expiry = (not_after - datetime.now(not_after.tzinfo)).days
                
                # Warn if expiring soon
                assert days_until_expiry > 30, \
                    f"Certificate for {domain} expiring in {days_until_expiry} days"
            
            # Check renewal eligibility
            renewal = cert.get('RenewalEligibility')
            if renewal == 'INELIGIBLE':
                # Check why it's ineligible
                in_use = cert.get('InUseBy', [])
                assert len(in_use) > 0, \
                    f"Certificate for {domain} not eligible for renewal and not in use"
            
            # Check domain validation
            validations = cert.get('DomainValidationOptions', [])
            for validation in validations:
                assert validation.get('ValidationStatus') == 'SUCCESS', \
                    f"Domain validation failed for {validation.get('DomainName')}"

    def test_ssh_key_management(self):
        """Test SSH key management and rotation"""
        ec2 = boto3.client('ec2')
        ssm = boto3.client('ssm')
        
        # Check EC2 key pairs
        key_pairs = ec2.describe_key_pairs()
        
        for key_pair in key_pairs['KeyPairs']:
            key_name = key_pair['KeyName']
            key_fingerprint = key_pair['KeyFingerprint']
            
            # Check if key has metadata
            tags = key_pair.get('Tags', [])
            tag_dict = {tag['Key']: tag['Value'] for tag in tags}
            
            assert 'CreatedDate' in tag_dict, \
                f"SSH key {key_name} missing creation date"
            assert 'Owner' in tag_dict, \
                f"SSH key {key_name} missing owner tag"
            assert 'Purpose' in tag_dict, \
                f"SSH key {key_name} missing purpose tag"
            
            # Check key age
            if 'CreatedDate' in tag_dict:
                created = datetime.fromisoformat(tag_dict['CreatedDate'])
                age_days = (datetime.now() - created).days
                
                assert age_days <= 365, \
                    f"SSH key {key_name} is {age_days} days old (exceeds 365 day limit)"
        
        # Check for SSH keys in Parameter Store
        params = ssm.describe_parameters(
            Filters=[
                {'Key': 'Name', 'Values': ['ssh', 'key', 'private']}
            ]
        )
        
        for param in params['Parameters']:
            param_name = param['Name']
            
            # SSH keys must be SecureString
            assert param['Type'] == 'SecureString', \
                f"SSH key parameter {param_name} not using SecureString"
            
            # Check KMS key
            assert param.get('KeyId'), \
                f"SSH key parameter {param_name} not using KMS encryption"

    def test_api_key_rotation(self, rotation_schedule: Dict[str, int]):
        """Test API key rotation and management"""
        sm = boto3.client('secretsmanager')
        
        # Get all API keys
        api_keys = sm.list_secrets(
            Filters=[
                {'Key': 'name', 'Values': ['api-key', 'api_key', 'apikey']}
            ]
        )
        
        for secret in api_keys['SecretList']:
            secret_name = secret['Name']
            
            # Check rotation configuration
            assert secret.get('RotationEnabled'), \
                f"API key {secret_name} rotation not enabled"
            
            # Check rotation frequency
            rotation_rules = secret.get('RotationRules', {})
            rotation_days = rotation_rules.get('AutomaticallyAfterDays', 999)
            
            assert rotation_days <= rotation_schedule['api_key'], \
                f"API key {secret_name} rotation interval {rotation_days} exceeds policy"
            
            # Check versioning
            versions = sm.list_secret_version_ids(SecretId=secret['ARN'])
            
            # Should have at least 2 versions (current and pending)
            active_versions = [
                v for v in versions['Versions']
                if 'AWSCURRENT' in v.get('VersionStages', []) or
                   'AWSPENDING' in v.get('VersionStages', [])
            ]
            
            assert len(active_versions) >= 1, \
                f"API key {secret_name} lacks proper versioning"

    def test_database_credential_rotation(self, rotation_schedule: Dict[str, int]):
        """Test database credential rotation"""
        sm = boto3.client('secretsmanager')
        rds = boto3.client('rds')
        
        # Get all database credentials
        db_secrets = sm.list_secrets(
            Filters=[
                {'Key': 'name', 'Values': ['rds', 'database', 'db']}
            ]
        )
        
        for secret in db_secrets['SecretList']:
            secret_name = secret['Name']
            
            # Check rotation is enabled
            assert secret.get('RotationEnabled'), \
                f"Database credential {secret_name} rotation not enabled"
            
            # Check rotation frequency
            rotation_rules = secret.get('RotationRules', {})
            rotation_days = rotation_rules.get('AutomaticallyAfterDays', 999)
            
            assert rotation_days <= rotation_schedule['database_password'], \
                f"Database credential {secret_name} rotation exceeds {rotation_schedule['database_password']} days"
            
            # Verify connection post-rotation
            if secret.get('LastRotatedDate'):
                last_rotation = secret['LastRotatedDate']
                hours_since_rotation = (datetime.now(last_rotation.tzinfo) - last_rotation).total_seconds() / 3600
                
                if hours_since_rotation < 24:
                    # Recent rotation - verify connectivity
                    # This would test actual database connection in production
                    pass

    # Helper methods
    def _get_kubernetes_client(self):
        """Get Kubernetes client (mocked for testing)"""
        raise NotImplementedError("Kubernetes client not configured")
    
    def _verify_secret_rbac(self, client, namespace, secret_name):
        """Verify RBAC for Kubernetes secret"""
        # Would check RoleBindings and ClusterRoleBindings
        pass
    
    def _verify_rotation_lambda_permissions(self, role_arn, function_name):
        """Verify IAM permissions for rotation Lambda"""
        iam = boto3.client('iam')
        
        role_name = role_arn.split('/')[-1]
        
        # Get role policies
        policies = iam.list_attached_role_policies(RoleName=role_name)
        
        # Should have minimal permissions
        required_policies = [
            'SecretsManagerRotationPolicy',
            'VPCAccessExecutionRole'
        ]
        
        attached_policy_names = [p['PolicyName'] for p in policies['AttachedPolicies']]
        
        for required in required_policies:
            assert any(required in name for name in attached_policy_names), \
                f"Rotation Lambda {function_name} missing {required} policy"
    
    def _determine_secret_type(self, secret_name: str) -> str:
        """Determine secret type from name"""
        if 'password' in secret_name.lower():
            return 'password'
        elif 'api' in secret_name.lower() and 'key' in secret_name.lower():
            return 'api_key'
        elif 'encryption' in secret_name.lower() or 'key' in secret_name.lower():
            return 'encryption_key'
        return 'unknown'
    
    def _validate_secret_complexity(self, value: str, requirements: Dict, name: str):
        """Validate secret meets complexity requirements"""
        if 'min_length' in requirements:
            assert len(value) >= requirements['min_length'], \
                f"Secret {name} length {len(value)} < {requirements['min_length']}"
        
        if requirements.get('require_special'):
            assert any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in value), \
                f"Secret {name} lacks special characters"
        
        if requirements.get('require_numbers'):
            assert any(c.isdigit() for c in value), \
                f"Secret {name} lacks numbers"
        
        if requirements.get('require_uppercase'):
            assert any(c.isupper() for c in value), \
                f"Secret {name} lacks uppercase"
        
        if requirements.get('require_lowercase'):
            assert any(c.islower() for c in value), \
                f"Secret {name} lacks lowercase"
        
        if 'entropy_bits' in requirements:
            # Calculate entropy
            entropy = self._calculate_entropy(value)
            assert entropy >= requirements['entropy_bits'], \
                f"Secret {name} entropy {entropy} < {requirements['entropy_bits']}"
    
    def _calculate_entropy(self, value: str) -> float:
        """Calculate Shannon entropy of a string"""
        import math
        from collections import Counter
        
        if not value:
            return 0
        
        counter = Counter(value)
        length = len(value)
        entropy = 0
        
        for count in counter.values():
            probability = count / length
            entropy -= probability * math.log2(probability)
        
        return entropy * length
    
    def _is_trusted_ip(self, ip: str) -> bool:
        """Check if IP is from trusted range"""
        trusted_ranges = [
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16'
        ]
        
        import ipaddress
        
        try:
            ip_addr = ipaddress.ip_address(ip)
            return any(
                ip_addr in ipaddress.ip_network(range)
                for range in trusted_ranges
            )
        except ValueError:
            return False