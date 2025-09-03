"""
Test Suite: Security Configuration - Encryption at Rest/Transit
Target: Infrastructure security validation for SVOA Lea platform
Status: All tests should FAIL initially (TDD approach)
"""

import pytest
import boto3
import ssl
import socket
import subprocess
import json
import hashlib
from typing import Dict, List, Any, Optional
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from datetime import datetime, timedelta
import requests
from OpenSSL import SSL
import base64


class TestSecurityConfiguration:
    """
    Comprehensive security configuration tests for encryption standards,
    certificate management, and security hardening.
    """

    @pytest.fixture
    def encryption_standards(self) -> Dict[str, Any]:
        """Required encryption standards"""
        return {
            "symmetric": {
                "algorithm": "AES",
                "key_size": 256,
                "mode": "GCM"
            },
            "asymmetric": {
                "algorithm": "RSA",
                "key_size": 4096,
                "signature": "SHA256"
            },
            "tls": {
                "min_version": "1.3",
                "cipher_suites": [
                    "TLS_AES_256_GCM_SHA384",
                    "TLS_AES_128_GCM_SHA256",
                    "TLS_CHACHA20_POLY1305_SHA256"
                ]
            },
            "hashing": {
                "algorithm": "SHA-256",
                "iterations": 100000,
                "salt_length": 32
            }
        }

    def test_s3_encryption_at_rest(self):
        """Test that all S3 buckets have encryption at rest enabled"""
        s3 = boto3.client('s3')
        buckets = s3.list_buckets()
        
        for bucket in buckets['Buckets']:
            bucket_name = bucket['Name']
            
            # Check default encryption
            try:
                encryption = s3.get_bucket_encryption(Bucket=bucket_name)
                rules = encryption['ServerSideEncryptionConfiguration']['Rules']
                
                assert len(rules) > 0, f"No encryption rules for bucket {bucket_name}"
                
                for rule in rules:
                    sse = rule['ApplyServerSideEncryptionByDefault']
                    assert sse['SSEAlgorithm'] in ['AES256', 'aws:kms'], \
                        f"Bucket {bucket_name} uses weak encryption {sse['SSEAlgorithm']}"
                    
                    if sse['SSEAlgorithm'] == 'aws:kms':
                        assert sse.get('KMSMasterKeyID'), \
                            f"KMS key not specified for bucket {bucket_name}"
                            
            except s3.exceptions.ServerSideEncryptionConfigurationNotFoundError:
                pytest.fail(f"Bucket {bucket_name} has no encryption configuration")
            
            # Check bucket policy enforces encryption
            try:
                policy = s3.get_bucket_policy(Bucket=bucket_name)
                policy_doc = json.loads(policy['Policy'])
                
                has_encryption_enforcement = False
                for statement in policy_doc['Statement']:
                    if statement.get('Effect') == 'Deny':
                        condition = statement.get('Condition', {})
                        if 'StringNotEquals' in condition:
                            if 's3:x-amz-server-side-encryption' in condition['StringNotEquals']:
                                has_encryption_enforcement = True
                                
                assert has_encryption_enforcement, \
                    f"Bucket {bucket_name} policy doesn't enforce encryption"
                    
            except s3.exceptions.NoSuchBucketPolicy:
                pytest.fail(f"Bucket {bucket_name} has no policy enforcing encryption")

    def test_rds_encryption_at_rest(self):
        """Test that all RDS instances have encryption at rest enabled"""
        rds = boto3.client('rds')
        
        # Check DB instances
        db_instances = rds.describe_db_instances()
        for db in db_instances['DBInstances']:
            assert db['StorageEncrypted'], \
                f"RDS instance {db['DBInstanceIdentifier']} not encrypted"
            
            if db['StorageEncrypted']:
                assert db.get('KmsKeyId'), \
                    f"RDS instance {db['DBInstanceIdentifier']} not using KMS key"
        
        # Check DB snapshots
        snapshots = rds.describe_db_snapshots()
        for snapshot in snapshots['DBSnapshots']:
            assert snapshot.get('Encrypted'), \
                f"Snapshot {snapshot['DBSnapshotIdentifier']} not encrypted"

    def test_ebs_volume_encryption(self):
        """Test that all EBS volumes are encrypted"""
        ec2 = boto3.client('ec2')
        
        # Check EBS default encryption
        response = ec2.get_ebs_encryption_by_default()
        assert response['EbsEncryptionByDefault'], \
            "EBS encryption by default is not enabled"
        
        # Check existing volumes
        volumes = ec2.describe_volumes()
        for volume in volumes['Volumes']:
            assert volume['Encrypted'], \
                f"Volume {volume['VolumeId']} is not encrypted"
            
            if volume['Encrypted']:
                assert volume.get('KmsKeyId'), \
                    f"Volume {volume['VolumeId']} not using KMS key"
                
            # Check volume snapshots
            if volume.get('SnapshotId'):
                snapshot = ec2.describe_snapshots(SnapshotIds=[volume['SnapshotId']])
                assert snapshot['Snapshots'][0]['Encrypted'], \
                    f"Source snapshot for volume {volume['VolumeId']} not encrypted"

    def test_kms_key_configuration(self):
        """Test KMS key configuration and rotation"""
        kms = boto3.client('kms')
        
        # List all customer managed keys
        keys = kms.list_keys()
        
        for key_entry in keys['Keys']:
            key_id = key_entry['KeyId']
            
            # Get key metadata
            key_metadata = kms.describe_key(KeyId=key_id)
            key_info = key_metadata['KeyMetadata']
            
            # Skip AWS managed keys
            if key_info['KeyManager'] == 'AWS':
                continue
                
            # Check key is enabled
            assert key_info['KeyState'] == 'Enabled', \
                f"KMS key {key_id} is not enabled"
            
            # Check key rotation
            try:
                rotation_status = kms.get_key_rotation_status(KeyId=key_id)
                assert rotation_status['KeyRotationEnabled'], \
                    f"Key rotation not enabled for {key_id}"
            except kms.exceptions.UnsupportedOperationException:
                # Some key types don't support rotation
                pass
            
            # Check key policy
            key_policy = kms.get_key_policy(KeyId=key_id, PolicyName='default')
            policy_doc = json.loads(key_policy['Policy'])
            
            # Verify principle of least privilege
            for statement in policy_doc['Statement']:
                if statement.get('Effect') == 'Allow':
                    principal = statement.get('Principal', {})
                    assert principal != {"AWS": "*"}, \
                        f"KMS key {key_id} has overly permissive policy"

    def test_tls_configuration(self, encryption_standards: Dict[str, Any]):
        """Test TLS configuration for all endpoints"""
        endpoints = self._get_application_endpoints()
        
        for endpoint in endpoints:
            hostname = endpoint['hostname']
            port = endpoint.get('port', 443)
            
            # Create SSL context
            context = ssl.create_default_context()
            
            # Test connection
            with socket.create_connection((hostname, port), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    # Check TLS version
                    version = ssock.version()
                    min_version = encryption_standards['tls']['min_version']
                    
                    assert version >= min_version, \
                        f"Endpoint {hostname} using outdated TLS {version}"
                    
                    # Check cipher suite
                    cipher = ssock.cipher()
                    cipher_name = cipher[0] if cipher else None
                    
                    approved_ciphers = encryption_standards['tls']['cipher_suites']
                    assert cipher_name in approved_ciphers, \
                        f"Endpoint {hostname} using unapproved cipher {cipher_name}"
                    
                    # Get certificate
                    cert_bin = ssock.getpeercert(binary_form=True)
                    cert = x509.load_der_x509_certificate(cert_bin, default_backend())
                    
                    # Check certificate validity
                    now = datetime.utcnow()
                    assert cert.not_valid_before <= now <= cert.not_valid_after, \
                        f"Certificate for {hostname} is not valid"
                    
                    # Check certificate expiry warning (30 days)
                    days_until_expiry = (cert.not_valid_after - now).days
                    assert days_until_expiry > 30, \
                        f"Certificate for {hostname} expires in {days_until_expiry} days"

    def test_secrets_manager_configuration(self):
        """Test AWS Secrets Manager configuration"""
        sm = boto3.client('secretsmanager')
        
        # List all secrets
        secrets = sm.list_secrets()
        
        for secret in secrets['SecretList']:
            secret_id = secret['Name']
            
            # Check rotation configuration
            assert secret.get('RotationEnabled'), \
                f"Secret {secret_id} rotation not enabled"
            
            if secret.get('RotationEnabled'):
                assert secret.get('RotationLambdaARN'), \
                    f"Secret {secret_id} missing rotation Lambda"
                
                # Check rotation schedule
                rules = secret.get('RotationRules', {})
                rotation_days = rules.get('AutomaticallyAfterDays', 0)
                assert 0 < rotation_days <= 90, \
                    f"Secret {secret_id} rotation interval {rotation_days} days is too long"
            
            # Check encryption
            assert secret.get('KmsKeyId'), \
                f"Secret {secret_id} not using KMS encryption"
            
            # Check versioning
            versions = sm.list_secret_version_ids(SecretId=secret_id)
            assert len(versions['Versions']) > 0, \
                f"Secret {secret_id} has no versions"

    def test_parameter_store_encryption(self):
        """Test SSM Parameter Store encryption"""
        ssm = boto3.client('ssm')
        
        # Get all parameters
        paginator = ssm.get_paginator('describe_parameters')
        
        for page in paginator.paginate():
            for param in page['Parameters']:
                param_name = param['Name']
                
                # Check parameter type
                if param['Type'] in ['SecureString']:
                    assert param.get('KeyId'), \
                        f"Parameter {param_name} not using KMS encryption"
                elif 'password' in param_name.lower() or 'secret' in param_name.lower():
                    pytest.fail(f"Sensitive parameter {param_name} not using SecureString type")

    def test_network_encryption_in_transit(self):
        """Test that all network traffic uses encryption in transit"""
        # Check ELB/ALB listeners
        elbv2 = boto3.client('elbv2')
        load_balancers = elbv2.describe_load_balancers()
        
        for lb in load_balancers['LoadBalancers']:
            lb_arn = lb['LoadBalancerArn']
            listeners = elbv2.describe_listeners(LoadBalancerArn=lb_arn)
            
            for listener in listeners['Listeners']:
                protocol = listener['Protocol']
                
                if protocol in ['HTTP']:
                    # Check for redirect to HTTPS
                    actions = listener['DefaultActions']
                    has_redirect = any(
                        action['Type'] == 'redirect' and 
                        action.get('RedirectConfig', {}).get('Protocol') == 'HTTPS'
                        for action in actions
                    )
                    assert has_redirect, \
                        f"Load balancer {lb['LoadBalancerName']} has unencrypted HTTP listener"
                
                elif protocol in ['HTTPS', 'TLS']:
                    # Check SSL policy
                    ssl_policy = listener.get('SslPolicy')
                    assert ssl_policy, \
                        f"Load balancer {lb['LoadBalancerName']} missing SSL policy"
                    
                    # Verify modern SSL policy
                    modern_policies = [
                        'ELBSecurityPolicy-TLS13-1-2-2021-06',
                        'ELBSecurityPolicy-TLS13-1-3-2021-06',
                        'ELBSecurityPolicy-FS-1-2-Res-2020-10'
                    ]
                    assert any(policy in ssl_policy for policy in modern_policies), \
                        f"Load balancer {lb['LoadBalancerName']} using outdated SSL policy {ssl_policy}"

    def test_certificate_validation(self):
        """Test certificate validation and management"""
        acm = boto3.client('acm')
        
        # List all certificates
        certificates = acm.list_certificates()
        
        for cert_summary in certificates['CertificateSummaryList']:
            cert_arn = cert_summary['CertificateArn']
            
            # Get certificate details
            cert_details = acm.describe_certificate(CertificateArn=cert_arn)
            cert = cert_details['Certificate']
            
            # Check certificate status
            assert cert['Status'] == 'ISSUED', \
                f"Certificate {cert['DomainName']} status is {cert['Status']}"
            
            # Check validation method
            assert cert.get('DomainValidationOptions'), \
                f"Certificate {cert['DomainName']} not validated"
            
            # Check renewal eligibility
            if cert.get('RenewalEligibility') == 'INELIGIBLE':
                pytest.fail(f"Certificate {cert['DomainName']} not eligible for renewal")
            
            # Check certificate transparency
            assert cert.get('Options', {}).get('CertificateTransparencyLoggingPreference') != 'DISABLED', \
                f"Certificate transparency disabled for {cert['DomainName']}"

    def test_waf_configuration(self):
        """Test Web Application Firewall configuration"""
        wafv2 = boto3.client('wafv2')
        
        # Check for Web ACLs
        for scope in ['CLOUDFRONT', 'REGIONAL']:
            try:
                web_acls = wafv2.list_web_acls(Scope=scope)
                
                assert len(web_acls['WebACLs']) > 0, \
                    f"No WAF Web ACLs configured for scope {scope}"
                
                for web_acl_summary in web_acls['WebACLs']:
                    web_acl = wafv2.get_web_acl(
                        Scope=scope,
                        Id=web_acl_summary['Id'],
                        Name=web_acl_summary['Name']
                    )
                    
                    acl = web_acl['WebACL']
                    
                    # Check for rules
                    assert len(acl['Rules']) > 0, \
                        f"Web ACL {acl['Name']} has no rules"
                    
                    # Check for managed rule groups
                    managed_rules = [
                        rule for rule in acl['Rules']
                        if 'ManagedRuleGroupStatement' in rule.get('Statement', {})
                    ]
                    
                    required_rule_groups = [
                        'AWSManagedRulesCommonRuleSet',
                        'AWSManagedRulesKnownBadInputsRuleSet',
                        'AWSManagedRulesSQLiRuleSet'
                    ]
                    
                    for required in required_rule_groups:
                        assert any(
                            required in str(rule.get('Statement', {}))
                            for rule in managed_rules
                        ), f"Web ACL {acl['Name']} missing {required} rule group"
                        
            except wafv2.exceptions.WAFInvalidParameterException:
                # Scope might not be available in region
                pass

    def test_security_group_rules(self):
        """Test security group configurations"""
        ec2 = boto3.client('ec2')
        security_groups = ec2.describe_security_groups()
        
        for sg in security_groups['SecurityGroups']:
            sg_id = sg['GroupId']
            sg_name = sg['GroupName']
            
            # Skip default security group
            if sg_name == 'default':
                continue
            
            # Check ingress rules
            for rule in sg['IpPermissions']:
                # Check for overly permissive rules
                for ip_range in rule.get('IpRanges', []):
                    cidr = ip_range.get('CidrIp')
                    
                    # Check for unrestricted access
                    if cidr == '0.0.0.0/0':
                        # Only allow for specific ports (80, 443)
                        from_port = rule.get('FromPort')
                        assert from_port in [80, 443], \
                            f"Security group {sg_name} allows unrestricted access on port {from_port}"
                
                # Check for SSH access
                if rule.get('FromPort') == 22:
                    # SSH should be restricted
                    ip_ranges = [r['CidrIp'] for r in rule.get('IpRanges', [])]
                    assert '0.0.0.0/0' not in ip_ranges, \
                        f"Security group {sg_name} allows unrestricted SSH access"
            
            # Check egress rules
            for rule in sg['IpPermissionsEgress']:
                # Verify egress is controlled
                if not rule.get('IpProtocol') == '-1':  # Not all protocols
                    continue
                    
                for ip_range in rule.get('IpRanges', []):
                    if ip_range.get('CidrIp') == '0.0.0.0/0':
                        # Log warning but don't fail (might be necessary)
                        print(f"Warning: Security group {sg_name} has unrestricted egress")

    def test_iam_password_policy(self):
        """Test IAM password policy configuration"""
        iam = boto3.client('iam')
        
        try:
            policy = iam.get_account_password_policy()['PasswordPolicy']
            
            # Check minimum requirements
            assert policy.get('MinimumPasswordLength', 0) >= 14, \
                "Password minimum length less than 14 characters"
            assert policy.get('RequireSymbols'), "Password policy doesn't require symbols"
            assert policy.get('RequireNumbers'), "Password policy doesn't require numbers"
            assert policy.get('RequireUppercaseCharacters'), \
                "Password policy doesn't require uppercase"
            assert policy.get('RequireLowercaseCharacters'), \
                "Password policy doesn't require lowercase"
            assert policy.get('MaxPasswordAge', 0) <= 90, \
                "Password maximum age exceeds 90 days"
            assert policy.get('PasswordReusePrevention', 0) >= 5, \
                "Password reuse prevention less than 5"
            
        except iam.exceptions.NoSuchEntityException:
            pytest.fail("No IAM password policy configured")

    def test_cloudtrail_encryption(self):
        """Test CloudTrail encryption configuration"""
        cloudtrail = boto3.client('cloudtrail')
        
        trails = cloudtrail.describe_trails()
        
        assert len(trails['trailList']) > 0, "No CloudTrail configured"
        
        for trail in trails['trailList']:
            trail_name = trail['Name']
            
            # Check encryption
            assert trail.get('KmsKeyId'), \
                f"CloudTrail {trail_name} not using KMS encryption"
            
            # Check log file validation
            assert trail.get('LogFileValidationEnabled'), \
                f"CloudTrail {trail_name} log file validation not enabled"
            
            # Get trail status
            status = cloudtrail.get_trail_status(Name=trail_name)
            assert status.get('IsLogging'), \
                f"CloudTrail {trail_name} is not logging"

    def test_guardduty_configuration(self):
        """Test GuardDuty threat detection configuration"""
        guardduty = boto3.client('guardduty')
        
        # List detectors
        detectors = guardduty.list_detectors()
        
        assert len(detectors['DetectorIds']) > 0, "GuardDuty not enabled"
        
        for detector_id in detectors['DetectorIds']:
            # Get detector details
            detector = guardduty.get_detector(DetectorId=detector_id)
            
            assert detector['Status'] == 'ENABLED', \
                f"GuardDuty detector {detector_id} not enabled"
            
            # Check data sources
            data_sources = detector.get('DataSources', {})
            
            # Check S3 logs
            s3_logs = data_sources.get('S3Logs', {})
            assert s3_logs.get('Status') == 'ENABLED', \
                "GuardDuty S3 log monitoring not enabled"
            
            # Check Kubernetes audit logs (if EKS is used)
            k8s_logs = data_sources.get('Kubernetes', {})
            if k8s_logs:
                assert k8s_logs.get('AuditLogs', {}).get('Status') == 'ENABLED', \
                    "GuardDuty Kubernetes audit log monitoring not enabled"

    def test_encryption_key_hierarchy(self, encryption_standards: Dict[str, Any]):
        """Test encryption key hierarchy and management"""
        kms = boto3.client('kms')
        
        # Get all aliases to identify key purposes
        aliases = kms.list_aliases()
        
        required_key_types = [
            'master',
            'data',
            'secrets',
            'logs',
            'backup'
        ]
        
        key_hierarchy = {}
        
        for alias in aliases['Aliases']:
            alias_name = alias['AliasName']
            
            # Skip AWS managed aliases
            if alias_name.startswith('alias/aws/'):
                continue
            
            # Check key type from alias
            for key_type in required_key_types:
                if key_type in alias_name.lower():
                    key_hierarchy[key_type] = alias.get('TargetKeyId')
        
        # Verify all required key types exist
        for key_type in required_key_types:
            assert key_type in key_hierarchy, \
                f"Missing KMS key for {key_type} encryption"

    # Helper methods
    def _get_application_endpoints(self) -> List[Dict[str, Any]]:
        """Get list of application endpoints to test"""
        raise NotImplementedError("Application endpoints not configured")