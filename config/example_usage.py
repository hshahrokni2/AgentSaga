#!/usr/bin/env python3
"""
Example usage of SVOA Lea JSON Configuration System

Demonstrates how to load and use the EU Email Infrastructure and Object Storage
configurations for the current Archon task.
"""

import sys
import os
from pathlib import Path

# Add config directory to Python path
sys.path.append(str(Path(__file__).parent))

from config import ConfigLoader, ConfigValidator

def main():
    """Demonstrate configuration loading for EU infrastructure setup"""
    
    print("🇪🇺 SVOA Lea EU Infrastructure Configuration Demo")
    print("=" * 60)
    
    # Initialize configuration loader for development environment
    config_loader = ConfigLoader(environment="dev")
    
    try:
        # Load email infrastructure configuration
        print("\n📧 Email Infrastructure Configuration:")
        email_config = config_loader.load_email_config()
        
        email_infra = email_config['email_infrastructure']
        print(f"  Provider: {email_infra['provider']}")
        print(f"  Primary Region: {email_infra['regions']['primary']}")
        print(f"  DKIM Enabled: {email_infra['inbound']['dkim_validation']['enabled']}")
        print(f"  Max Attachment Size: {email_infra['inbound']['max_attachment_size_mb']}MB")
        
        # Validate EU region compliance
        primary_region = email_infra['regions']['primary']
        if ConfigValidator.validate_eu_region(primary_region):
            print(f"  ✅ Region {primary_region} is EU compliant")
        else:
            print(f"  ❌ Region {primary_region} is NOT EU compliant")
        
        # Load object storage configuration
        print("\n🗄️  Object Storage Configuration:")
        storage_config = config_loader.load_storage_config()
        
        obj_storage = storage_config['object_storage']
        print(f"  Provider: {obj_storage['provider']}")
        print(f"  Primary Region: {obj_storage['regions']['primary']}")
        print(f"  Encryption: {obj_storage['encryption']['at_rest']['algorithm']}")
        print(f"  Cross-Region Replication: {obj_storage['regions']['cross_region_replication']}")
        
        # Validate encryption and retention
        encryption_alg = obj_storage['encryption']['at_rest']['algorithm']
        if ConfigValidator.validate_encryption_algorithm(encryption_alg):
            print(f"  ✅ Encryption algorithm {encryption_alg} is approved")
        else:
            print(f"  ❌ Encryption algorithm {encryption_alg} is NOT approved")
            
        # Load compliance configuration
        print("\n🇸🇪 Swedish Compliance Configuration:")
        compliance_config = config_loader.load_compliance_config()
        
        gdpr = compliance_config['compliance']['gdpr']
        swedish = compliance_config['compliance']['swedish_specific']
        
        print(f"  GDPR Data Residency: {gdpr['data_residency']['requirement']}")
        print(f"  Retention Years: {gdpr['retention']['default_years']}")
        print(f"  Primary Language: {swedish['language_support']['primary']}")
        print(f"  Accessibility Standard: {swedish['accessibility']['standard']}")
        
        # Validate retention policy
        retention_years = gdpr['retention']['default_years']
        if ConfigValidator.validate_retention_policy(retention_years):
            print(f"  ✅ Retention policy ({retention_years} years) meets Swedish requirements")
        else:
            print(f"  ❌ Retention policy ({retention_years} years) does NOT meet Swedish requirements")
        
        # Show bucket configuration
        print("\n📦 Storage Buckets Configuration:")
        buckets = obj_storage['buckets']
        for bucket_name, bucket_config in buckets.items():
            print(f"  {bucket_name}:")
            print(f"    Name: {bucket_config['name']}")
            print(f"    Lifecycle: {bucket_config['lifecycle_days']} days")
            print(f"    Versioning: {bucket_config['versioning']}")
            if 'immutable' in bucket_config:
                print(f"    Immutable: {bucket_config['immutable']}")
        
        # Show monitoring configuration
        print("\n📊 Monitoring Configuration:")
        email_monitoring = email_infra['monitoring']
        storage_monitoring = obj_storage['monitoring']
        
        print(f"  Email Alerts:")
        for metric, threshold in email_monitoring['alerts'].items():
            print(f"    {metric}: {threshold}")
            
        print(f"  Storage Alerts:")
        for metric, threshold in storage_monitoring['alerts'].items():
            print(f"    {metric}: {threshold}")
        
        print("\n✅ Configuration loading successful!")
        print("Ready for TDD implementation of EU Email Infrastructure & Object Storage")
        
    except Exception as e:
        print(f"\n❌ Configuration loading failed: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)