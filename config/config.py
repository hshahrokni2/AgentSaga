"""
SVOA Lea Configuration Management

Handles loading and validation of JSON configuration files for EU Email Infrastructure
and Object Storage, with Swedish compliance requirements.

Supports environment-specific overrides (dev/staging/prod) and schema validation.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, Union
import jsonschema
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class ConfigPaths:
    """Configuration file paths"""
    base: Path = Path(__file__).parent
    base_config: Path = base / "base.json"
    email_config: Path = base / "email-infrastructure.json"
    storage_config: Path = base / "object-storage.json"
    compliance_config: Path = base / "compliance.json"
    schemas: Path = base / "schemas"

class ConfigLoader:
    """
    Configuration loader with JSON schema validation and environment overrides.
    
    Follows the Archon workflow principle of research-driven development
    with comprehensive validation for EU/EES compliance.
    """
    
    def __init__(self, environment: str = None):
        self.environment = environment or os.getenv("SVOA_ENVIRONMENT", "dev")
        self.paths = ConfigPaths()
        self.config_cache = {}
        
    def load_config(self, config_name: str, validate_schema: bool = True) -> Dict[str, Any]:
        """
        Load configuration with environment overrides and optional schema validation.
        
        Args:
            config_name: Configuration name (e.g., 'email-infrastructure')
            validate_schema: Whether to validate against JSON schema
            
        Returns:
            Merged configuration dictionary
            
        Raises:
            FileNotFoundError: If configuration file doesn't exist
            jsonschema.ValidationError: If schema validation fails
            ValueError: If configuration format is invalid
        """
        cache_key = f"{config_name}_{self.environment}"
        if cache_key in self.config_cache:
            return self.config_cache[cache_key]
            
        # Load base configuration
        config_path = self.paths.base / f"{config_name}.json"
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
            
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            
        # Apply environment overrides
        env_config_path = self.paths.base / f"{self.environment}.json"
        if env_config_path.exists():
            with open(env_config_path, 'r', encoding='utf-8') as f:
                env_overrides = json.load(f)
                config = self._deep_merge(config, env_overrides)
                
        # Schema validation
        if validate_schema:
            self._validate_schema(config, config_name)
            
        # Resolve environment variables
        config = self._resolve_env_vars(config)
        
        self.config_cache[cache_key] = config
        logger.info(f"Loaded configuration: {config_name} for environment: {self.environment}")
        
        return config
    
    def load_email_config(self) -> Dict[str, Any]:
        """Load EU email infrastructure configuration"""
        return self.load_config("email-infrastructure")
    
    def load_storage_config(self) -> Dict[str, Any]:
        """Load object storage configuration"""
        return self.load_config("object-storage")
    
    def load_compliance_config(self) -> Dict[str, Any]:
        """Load Swedish compliance configuration"""
        return self.load_config("compliance")
        
    def load_all_configs(self) -> Dict[str, Dict[str, Any]]:
        """Load all configurations for the current environment"""
        return {
            "email": self.load_email_config(),
            "storage": self.load_storage_config(), 
            "compliance": self.load_compliance_config()
        }
    
    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """Deep merge configuration dictionaries"""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
                
        return result
    
    def _validate_schema(self, config: Dict[str, Any], config_name: str) -> None:
        """Validate configuration against JSON schema if available"""
        schema_path = self.paths.schemas / f"{config_name}.schema.json"
        
        if not schema_path.exists():
            logger.warning(f"No schema found for {config_name} at {schema_path}")
            return
            
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
                
            jsonschema.validate(config, schema)
            logger.debug(f"Schema validation passed for {config_name}")
            
        except jsonschema.ValidationError as e:
            logger.error(f"Schema validation failed for {config_name}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Schema validation error for {config_name}: {str(e)}")
            raise
    
    def _resolve_env_vars(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve environment variable placeholders in configuration"""
        def resolve_value(value):
            if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                env_var = value[2:-1]
                env_value = os.getenv(env_var)
                if env_value is None:
                    logger.warning(f"Environment variable not found: {env_var}")
                    return value
                return env_value
            elif isinstance(value, dict):
                return {k: resolve_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [resolve_value(item) for item in value]
            return value
        
        return resolve_value(config)

class ConfigValidator:
    """Validates configuration values for Swedish compliance and EU requirements"""
    
    @staticmethod
    def validate_eu_region(region: str) -> bool:
        """Validate that region is within EU/EES"""
        eu_regions = [
            "eu-north-1", "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3",
            "eu-south-1", "eu-south-2"
        ]
        return region in eu_regions
    
    @staticmethod
    def validate_retention_policy(years: int) -> bool:
        """Validate retention policy meets Swedish requirements (minimum 5 years)"""
        return years >= 5
    
    @staticmethod
    def validate_encryption_algorithm(algorithm: str) -> bool:
        """Validate encryption algorithm meets security standards"""
        approved_algorithms = ["AES-256", "ChaCha20-Poly1305"]
        return algorithm in approved_algorithms
    
    @staticmethod
    def validate_language_code(lang: str) -> bool:
        """Validate language codes for Swedish/English support"""
        return lang in ["sv", "en"]

# Global configuration loader instance
config_loader = ConfigLoader()

def get_config(config_name: str) -> Dict[str, Any]:
    """Convenience function to get configuration"""
    return config_loader.load_config(config_name)

def get_email_config() -> Dict[str, Any]:
    """Get email infrastructure configuration"""
    return config_loader.load_email_config()

def get_storage_config() -> Dict[str, Any]:
    """Get object storage configuration"""
    return config_loader.load_storage_config()

def get_compliance_config() -> Dict[str, Any]:
    """Get compliance configuration"""
    return config_loader.load_compliance_config()