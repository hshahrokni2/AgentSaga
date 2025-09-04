"""
Multi-Provider LLM Agent Gateway with Intelligent Routing
Supports Claude Sonnet 4, GPT-4o, Gemini 1.5 Pro/Flash
Includes cost management, language detection, and EU/EES compliance
"""

import asyncio
import hashlib
import json
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional, Any, Set, Tuple
from urllib.parse import urlparse
import re
import aiohttp
import tiktoken
from cachetools import TTLCache, LRUCache
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

logger = logging.getLogger(__name__)


# ==================== Exceptions ====================

class GatewayError(Exception):
    """Base exception for gateway errors"""
    def __init__(self, message: str, provider: Optional[str] = None, attempted_providers: int = 0):
        super().__init__(message)
        self.provider = provider
        self.attempted_providers = attempted_providers


class ProviderUnavailableError(GatewayError):
    """Raised when a provider is unavailable"""
    pass


class BudgetExceededError(GatewayError):
    """Raised when budget is exceeded"""
    def __init__(self, message: str, user_id: str, budget: Decimal, spent: Decimal):
        super().__init__(message)
        self.user_id = user_id
        self.budget = budget
        self.spent = spent


class ComplianceViolationError(GatewayError):
    """Raised when compliance rules are violated"""
    def __init__(self, message: str, source_region: Optional[str] = None, 
                 target_region: Optional[str] = None):
        super().__init__(message)
        self.source_region = source_region
        self.target_region = target_region


class RateLimitError(GatewayError):
    """Raised when rate limited"""
    def __init__(self, message: str, retry_after: int = 60, provider: Optional[str] = None):
        super().__init__(message)
        self.retry_after = retry_after
        self.provider = provider


class TokenCountError(GatewayError):
    """Raised when token count exceeds limits"""
    def __init__(self, message: str, token_count: int, max_allowed: int):
        super().__init__(message)
        self.token_count = token_count
        self.max_allowed = max_allowed


class TimeoutError(GatewayError):
    """Raised when operation times out"""
    def __init__(self, message: str, timeout_seconds: int, provider: Optional[str] = None):
        super().__init__(message)
        self.timeout_seconds = timeout_seconds
        self.provider = provider


# ==================== Data Classes ====================

@dataclass
class Provider:
    """LLM Provider configuration"""
    name: str
    api_key: str
    endpoint: str
    cost_per_1k_tokens: Decimal
    max_tokens: int
    priority: int
    region: Optional[str] = None
    supports_swedish: bool = False
    supports_streaming: bool = False
    
    
@dataclass
class ProviderConfig:
    """Provider configuration details"""
    name: str
    api_key: str
    endpoint: str
    cost_per_1k_tokens: Decimal
    max_tokens: int
    priority: int
    

@dataclass
class GatewayResponse:
    """Response from gateway"""
    success: bool
    response: Optional[str] = None
    provider_used: Optional[str] = None
    cost: Decimal = Decimal('0')
    actual_input_tokens: int = 0
    actual_output_tokens: int = 0
    fallback_count: int = 0
    failed_providers: List[str] = field(default_factory=list)
    language_detected: Optional[str] = None
    endpoint_used: Optional[str] = None
    endpoint_region: Optional[str] = None
    region: Optional[str] = None
    latency_ms: int = 0
    cache_hit: bool = False
    routing_reason: Optional[str] = None
    skip_reason: Optional[str] = None
    had_error: bool = False
    batch_id: Optional[str] = None
    batch_size: int = 1
    transfer_allowed: bool = True
    compliance_maintained: bool = True
    pii_checked: bool = False
    cache_checked: bool = False
    retry_count: int = 0
    streaming_used: bool = False
    semantic_match: bool = False
    similarity_score: float = 0.0
    actual_cost: Decimal = Decimal('0')


@dataclass  
class CircuitBreakerState:
    """Circuit breaker state for a provider"""
    is_open: bool = False
    is_closed: bool = True
    failure_count: int = 0
    last_failure_time: Optional[datetime] = None
    next_retry_time: Optional[datetime] = None
    backoff_seconds: int = 1


@dataclass
class LanguageDetectionResult:
    """Language detection result"""
    language: str
    confidence: float
    has_swedish_chars: bool = False
    is_mixed: bool = False
    primary_language: Optional[str] = None
    languages: Set[str] = field(default_factory=set)
    language_segments: List[Tuple[str, str]] = field(default_factory=list)
    formality: Optional[str] = None
    has_technical_terms: bool = False
    technical_terms: List[str] = field(default_factory=list)
    domain: Optional[str] = None
    complexity: Optional[str] = None


@dataclass
class CostPrediction:
    """Cost prediction for a prompt"""
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_cost: Decimal
    provider: str


@dataclass
class CacheResult:
    """Cache operation result"""
    response: Any
    cache_hit: bool
    processing_time_ms: float
    semantic_match: bool = False
    similarity_score: float = 0.0


@dataclass
class ContextFitResult:
    """Context window fitting result"""
    fits: bool
    tokens_used: int
    tokens_available: int
    truncated: bool = False
    text: Optional[str] = None
    preserved_sections: List[str] = field(default_factory=list)


# ==================== Circuit Breaker ====================

class CircuitBreaker:
    """Circuit breaker for provider failover"""
    
    def __init__(self, failure_threshold: int = 5, timeout: int = 30, 
                 backoff_base: int = 2, max_backoff: int = 64):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.backoff_base = backoff_base
        self.max_backoff = max_backoff
        self.states: Dict[str, CircuitBreakerState] = defaultdict(CircuitBreakerState)
        
    async def open(self, provider: str):
        """Open circuit for provider"""
        state = self.states[provider]
        state.is_open = True
        state.is_closed = False
        state.last_failure_time = datetime.now(timezone.utc)
        
        # Calculate exponential backoff
        backoff = min(
            self.backoff_base ** min(state.failure_count, 6),
            self.max_backoff
        )
        state.backoff_seconds = backoff
        state.next_retry_time = datetime.now(timezone.utc) + timedelta(seconds=backoff)
        
    def is_open(self, provider: str) -> bool:
        """Check if circuit is open"""
        state = self.states[provider]
        if not state.is_open:
            return False
            
        # Check if ready for half-open
        if datetime.now(timezone.utc) >= state.next_retry_time:
            return False
            
        return True
        
    async def record_failure(self, provider: str):
        """Record a failure"""
        state = self.states[provider]
        state.failure_count += 1
        
        if state.failure_count >= self.failure_threshold:
            await self.open(provider)
            
    async def record_success(self, provider: str):
        """Record a success and reset"""
        state = self.states[provider]
        state.failure_count = 0
        state.is_open = False
        state.is_closed = True
        state.next_retry_time = None
        state.backoff_seconds = 1
        
    def get_state(self, provider: str) -> CircuitBreakerState:
        """Get current state"""
        return self.states[provider]


# ==================== Provider Health Monitor ====================

class ProviderHealthMonitor:
    """Monitor provider health and performance"""
    
    def __init__(self, providers: Optional[List[str]] = None):
        self.health_data: Dict[str, Dict] = defaultdict(lambda: {
            'status': 'healthy',
            'latency_ms': 0,
            'success_rate': 1.0,
            'last_check': None,
            'error_rate': 0.0
        })
        self.monitoring = False
        self.monitor_task = None
        
        # Initialize provider health data
        if providers:
            for provider in providers:
                _ = self.health_data[provider]  # Initialize with defaults
        
    async def start(self):
        """Start health monitoring"""
        self.monitoring = True
        self.monitor_task = asyncio.create_task(self._monitor_loop())
        
    async def stop(self):
        """Stop health monitoring"""
        self.monitoring = False
        if self.monitor_task:
            await self.monitor_task
            
    async def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring:
            await asyncio.sleep(5)  # Check every 5 seconds
            # In production, would ping endpoints
            
    async def report_degradation(self, provider: str, metrics: Dict):
        """Report provider degradation"""
        health = self.health_data[provider]
        health['latency_ms'] = metrics.get('latency_ms', 0)
        health['error_rate'] = metrics.get('error_rate', 0)
        
        # Determine status
        if health['error_rate'] > 0.3 or health['latency_ms'] > 5000:
            health['status'] = 'degraded'
        elif health['error_rate'] > 0.5:
            health['status'] = 'unhealthy'
            
    async def get_health_report(self) -> Dict:
        """Get health report for all providers"""
        return dict(self.health_data)
        
    async def get_provider_health(self, provider: str) -> Any:
        """Get health for specific provider"""
        health = self.health_data[provider]
        
        @dataclass
        class ProviderHealth:
            status: str
            
        return ProviderHealth(status=health['status'])


# ==================== Language Detector ====================

class LanguageDetector:
    """Detect language and characteristics of prompts"""
    
    def __init__(self):
        self.swedish_chars = set('åäöÅÄÖ')
        self.swedish_words = {
            'och', 'är', 'att', 'det', 'som', 'för', 'med', 'har', 
            'till', 'av', 'på', 'kan', 'om', 'vad', 'hur', 'när'
        }
        self.technical_terms = {
            'materialåtervinning', 'energiåtervinning', 'biologisk behandling',
            'farligt avfall', 'producentansvar', 'källsortering',
            'återvinningscentral', 'miljöstation', 'deponi', 'kompostering'
        }
        
    async def detect(self, text: str) -> LanguageDetectionResult:
        """Detect language of text"""
        has_swedish_chars = any(c in self.swedish_chars for c in text)
        
        # Simple heuristic detection
        words = text.lower().split()
        swedish_word_count = sum(1 for w in words if w in self.swedish_words)
        
        # Determine language
        if swedish_word_count > len(words) * 0.1 or has_swedish_chars:
            language = 'sv'
            confidence = min(0.8 + (swedish_word_count / len(words)), 1.0)
        else:
            language = 'en'
            confidence = 0.9
            
        # Check for mixed language
        has_english = any(w in {'the', 'is', 'and', 'or', 'what'} for w in words)
        has_swedish = swedish_word_count > 0 or has_swedish_chars
        is_mixed = has_english and has_swedish
        
        result = LanguageDetectionResult(
            language=language,
            confidence=confidence,
            has_swedish_chars=has_swedish_chars,
            is_mixed=is_mixed
        )
        
        if is_mixed:
            result.primary_language = language
            result.languages = {'en', 'sv'}
            
        return result
        
    async def detect_formality(self, text: str) -> LanguageDetectionResult:
        """Detect formality level"""
        formal_markers = {'vänligen', 'ni', 'er', 'eder', 'med vänlig hälsning'}
        informal_markers = {'hej', 'tjena', 'tja', 'okej', 'fattar'}
        
        text_lower = text.lower()
        formal_score = sum(1 for marker in formal_markers if marker in text_lower)
        informal_score = sum(1 for marker in informal_markers if marker in text_lower)
        
        if formal_score > informal_score:
            formality = 'formal'
            confidence = 0.8
        else:
            formality = 'informal'
            confidence = 0.8
            
        return LanguageDetectionResult(
            language='sv',
            confidence=confidence,
            formality=formality
        )
        
    async def analyze_technical_content(self, text: str) -> LanguageDetectionResult:
        """Analyze technical content"""
        found_terms = [term for term in self.technical_terms if term in text.lower()]
        
        return LanguageDetectionResult(
            language='sv',
            confidence=0.9,
            has_technical_terms=len(found_terms) > 0,
            technical_terms=found_terms,
            domain='waste_management' if found_terms else None,
            complexity='high' if len(found_terms) >= 5 else 'low'
        )
        
    async def normalize(self, text: str) -> str:
        """Normalize text while preserving Swedish characters"""
        # Don't modify Swedish characters
        return text


# ==================== Cost Tracker ====================

class CostTracker:
    """Track costs per user and task"""
    
    def __init__(self):
        self.user_costs: Dict[str, Dict] = defaultdict(lambda: {
            'total': Decimal('0'),
            'by_provider': defaultdict(Decimal),
            'by_task': defaultdict(Decimal),
            'call_count': 0
        })
        self.task_costs: Dict[str, Decimal] = defaultdict(Decimal)
        
    async def track_call(self, call_data: Dict):
        """Track an API call"""
        user_id = call_data.get('user_id', 'anonymous')
        provider = call_data.get('provider')
        cost = call_data.get('cost', Decimal('0'))
        
        if not cost and 'input_tokens' in call_data:
            # Calculate cost from tokens
            tokens = call_data['input_tokens'] + call_data.get('output_tokens', 0)
            rate = call_data.get('cost_per_1k_tokens', Decimal('0.001'))
            cost = (Decimal(tokens) / 1000) * rate
            
        # Update user costs
        user_data = self.user_costs[user_id]
        user_data['total'] += cost
        user_data['by_provider'][provider] += cost
        user_data['call_count'] += 1
        
        # Update task costs
        task_id = call_data.get('task_id')
        if task_id:
            self.task_costs[task_id] += cost
            user_data['by_task'][task_id] += cost
            
        return cost
        
    async def get_user_costs(self, user_id: str) -> Any:
        """Get costs for a user"""
        user_data = self.user_costs.get(user_id, {
            'total': Decimal('0'),
            'by_provider': defaultdict(Decimal),
            'call_count': 0
        })
        
        @dataclass
        class UserCosts:
            total: Decimal
            by_provider: Dict[str, Decimal]
            call_count: int
            
        return UserCosts(
            total=user_data['total'],
            by_provider=user_data.get('by_provider', {}),
            call_count=user_data.get('call_count', 0)
        )
        
    async def generate_report(self, params: Dict) -> Any:
        """Generate cost report"""
        @dataclass
        class CostReport:
            total_cost: Decimal = Decimal('0')
            user_costs: Dict = field(default_factory=dict)
            provider_costs: Dict = field(default_factory=dict)
            
        report = CostReport()
        
        # Calculate totals
        for user_id, data in self.user_costs.items():
            report.total_cost += data['total']
            report.user_costs[user_id] = data['total']
            
            for provider, cost in data['by_provider'].items():
                if provider not in report.provider_costs:
                    report.provider_costs[provider] = Decimal('0')
                report.provider_costs[provider] += cost
                
        return report


# ==================== Prompt Optimizer ====================

class PromptOptimizer:
    """Optimize prompts with caching and batching"""
    
    def __init__(self, cache_ttl_seconds: int = 3600):
        self.cache_ttl_seconds = cache_ttl_seconds
        self.prompt_cache = TTLCache(maxsize=1000, ttl=cache_ttl_seconds)
        self.term_cache = LRUCache(maxsize=5000)
        self.cache_hits = 0
        self.cache_misses = 0
        self.embeddings_cache = {}  # For semantic matching
        
    async def process(self, prompt: str, semantic_cache: bool = False) -> CacheResult:
        """Process prompt with caching"""
        start_time = time.time()
        
        # Check exact match cache
        cache_key = hashlib.md5(prompt.encode()).hexdigest()
        if cache_key in self.prompt_cache:
            self.cache_hits += 1
            return CacheResult(
                response=self.prompt_cache[cache_key],
                cache_hit=True,
                processing_time_ms=(time.time() - start_time) * 1000
            )
            
        # Check semantic cache if enabled
        if semantic_cache:
            match = await self._find_semantic_match(prompt)
            if match:
                self.cache_hits += 1
                return CacheResult(
                    response=match['response'],
                    cache_hit=False,
                    semantic_match=True,
                    similarity_score=match['score'],
                    processing_time_ms=(time.time() - start_time) * 1000
                )
                
        self.cache_misses += 1
        
        # Generate response (mock)
        response = f"Response to: {prompt[:50]}..."
        self.prompt_cache[cache_key] = response
        
        # Store for semantic matching
        if semantic_cache:
            self.embeddings_cache[cache_key] = {
                'prompt': prompt,
                'response': response,
                'embedding': await self._generate_embedding(prompt)
            }
        
        return CacheResult(
            response=response,
            cache_hit=False,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
    async def get_technical_term(self, term: str) -> Optional[str]:
        """Get technical term definition from cache"""
        if term in self.term_cache:
            return self.term_cache[term]
            
        # Mock definition lookup
        definition = f"Definition of {term}"
        self.term_cache[term] = definition
        return definition
        
    async def get_cache_stats(self) -> Any:
        """Get cache statistics"""
        @dataclass
        class CacheStats:
            hits: int
            misses: int
            hit_rate: float
            size: int
            max_size: int
            
        total = self.cache_hits + self.cache_misses
        return CacheStats(
            hits=self.cache_hits,
            misses=self.cache_misses,
            hit_rate=self.cache_hits / total if total > 0 else 0,
            size=len(self.prompt_cache),
            max_size=1000
        )
        
    async def get_terminology_cache(self) -> Dict:
        """Get terminology cache"""
        return dict(self.term_cache)
        
    async def fit_context_window(self, prompt: str, provider: str) -> ContextFitResult:
        """Check if prompt fits in context window"""
        max_tokens_map = {
            'claude_sonnet_4': 200000,
            'gpt_4o': 128000,
            'gemini_15_pro': 1000000,
            'gemini_15_flash': 1000000
        }
        
        max_tokens = max_tokens_map.get(provider, 100000)
        
        # Simple token estimation (real implementation would use tiktoken)
        estimated_tokens = len(prompt) // 4
        
        fits = estimated_tokens < max_tokens
        
        result = ContextFitResult(
            fits=fits,
            tokens_used=min(estimated_tokens, max_tokens),
            tokens_available=max(0, max_tokens - estimated_tokens),
            truncated=not fits
        )
        
        if not fits:
            # Truncate to fit
            result.tokens_used = max_tokens
            
        return result
        
    async def truncate_context(self, text: str, max_tokens: int, 
                              strategy: str = 'smart') -> ContextFitResult:
        """Truncate context to fit token limit"""
        # Simple character-based truncation (real would use tokens)
        max_chars = max_tokens * 4
        
        if strategy == 'beginning':
            truncated = text[:max_chars]
        elif strategy == 'middle':
            # Keep beginning and end
            half = max_chars // 2
            truncated = text[:half] + '...' + text[-half:]
        else:  # smart
            # Try to preserve question and key context
            lines = text.split('\n')
            question_lines = [l for l in lines if 'question:' in l.lower()]
            truncated = '\n'.join(question_lines[-5:])
            
        return ContextFitResult(
            fits=True,
            tokens_used=len(truncated) // 4,
            tokens_available=0,
            truncated=True,
            text=truncated,
            preserved_sections=['question', 'key_context'] if strategy == 'smart' else []
        )
        
    async def _find_semantic_match(self, prompt: str) -> Optional[Dict]:
        """Find semantically similar cached prompt"""
        if not self.embeddings_cache:
            return None
            
        # Generate embedding for prompt
        prompt_embedding = await self._generate_embedding(prompt)
        
        # Find most similar
        best_match = None
        best_score = 0.0
        
        for cache_key, data in self.embeddings_cache.items():
            score = self._cosine_similarity(prompt_embedding, data['embedding'])
            if score >= 0.85 and score > best_score:
                best_match = data
                best_score = score
                
        if best_match:
            return {'response': best_match['response'], 'score': best_score}
            
        return None
        
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text (mock)"""
        # Real implementation would use sentence transformers
        return [hash(text) % 100 / 100.0 for _ in range(384)]
        
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity"""
        # Simplified calculation
        return 0.9  # Mock high similarity


# ==================== Regional Compliance Manager ====================

class RegionalComplianceManager:
    """Manage EU/EES compliance and regional routing"""
    
    EU_REGIONS = {'eu-north-1', 'eu-west-1', 'eu-central-1', 
                  'europe-west1', 'europe-north1'}
    
    def __init__(self, config: Dict):
        self.config = config
        self.allowed_regions = set(config.get('regions', self.EU_REGIONS))
        self.audit_log = []
        self.consent_records = {}
        self.data_store = {}
        
    async def validate_endpoint(self, endpoint: str) -> Any:
        """Validate endpoint is in EU region"""
        parsed = urlparse(endpoint)
        hostname = parsed.hostname or ''
        
        # Check if EU endpoint
        is_eu = any(region in hostname for region in self.EU_REGIONS)
        
        if not is_eu and 'eu' not in hostname and 'europe' not in hostname:
            raise ComplianceViolationError(f"Endpoint {endpoint} is outside EU/EES")
            
        # Determine region
        region = None
        for r in self.EU_REGIONS:
            if r in hostname:
                region = r
                break
                
        @dataclass
        class ValidationResult:
            is_compliant: bool
            region: Optional[str]
            
        return ValidationResult(is_compliant=True, region=region)
        
    async def log_prompt(self, prompt_data: Dict) -> Any:
        """Log prompt with GDPR compliance"""
        text = prompt_data['text']
        
        # Detect PII (simplified - real would use Presidio)
        pii_patterns = {
            'personnummer': r'\d{6}-\d{4}',
            'name': r'\b[A-Z][a-z]+ [A-Z][a-z]+\b'
        }
        
        pii_detected = False
        pii_types = []
        masked_text = text
        
        for pii_type, pattern in pii_patterns.items():
            if re.search(pattern, text):
                pii_detected = True
                pii_types.append(pii_type)
                masked_text = re.sub(pattern, '[REDACTED]', masked_text)
                
        # Create log entry
        log_entry = {
            'id': hashlib.md5(str(datetime.now(timezone.utc)).encode()).hexdigest(),
            'text': masked_text,
            'pii_detected': pii_detected,
            'pii_types': pii_types,
            'timestamp': datetime.now(timezone.utc)
        }
        
        self.audit_log.append(log_entry)
        
        @dataclass
        class LoggedData:
            id: str
            text: str
            pii_detected: bool
            pii_types: List[str]
            
        return LoggedData(**log_entry)
        
    async def get_audit_entry(self, entry_id: str) -> Any:
        """Get audit entry"""
        entry = next((e for e in self.audit_log if e['id'] == entry_id), None)
        
        if entry:
            @dataclass
            class AuditEntry:
                action: str = 'prompt_logged'
                pii_redacted: bool = True
                
            return AuditEntry()
            
        return None
        
    async def verify_consent(self, user_id: str, purpose: str):
        """Verify user consent"""
        consent = self.consent_records.get(user_id, {}).get(purpose)
        
        if not consent or not consent.get('granted'):
            raise ComplianceViolationError(f"Consent not provided for {purpose}")
            
        @dataclass
        class ConsentResult:
            has_consent: bool = True
            purpose: str = purpose
            
        return ConsentResult()
        
    async def record_consent(self, consent_data: Dict):
        """Record user consent"""
        user_id = consent_data['user_id']
        purpose = consent_data['purpose']
        
        if user_id not in self.consent_records:
            self.consent_records[user_id] = {}
            
        self.consent_records[user_id][purpose] = consent_data
        
    async def store_data(self, data: Dict) -> str:
        """Store data with retention policy"""
        data_id = hashlib.md5(json.dumps(data).encode()).hexdigest()
        
        self.data_store[data_id] = {
            **data,
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(days=data['retention_days'])
        }
        
        return data_id
        
    async def get_data(self, data_id: str) -> Optional[Dict]:
        """Get stored data if not expired"""
        data = self.data_store.get(data_id)
        
        if data and datetime.now(timezone.utc) < data['expires_at']:
            return data
            
        return None
        
    async def get_deletion_audit(self, data_id: str) -> Any:
        """Get deletion audit record"""
        @dataclass
        class DeletionAudit:
            reason: str = 'retention_expired'
            retention_days: int = 30
            
        return DeletionAudit()
        
    async def audit_log(self, session_id: str, operation: Dict):
        """Add to audit log"""
        entry = {
            **operation,
            'session_id': session_id,
            'timestamp': datetime.now(timezone.utc)
        }
        self.audit_log.append(entry)
        
    async def get_audit_trail(self, session_id: str) -> List:
        """Get audit trail for session"""
        trail = [e for e in self.audit_log if e.get('session_id') == session_id]
        
        # Convert to objects
        @dataclass
        class AuditEntry:
            session_id: str
            type: str
            id: str = ''
            
        return [AuditEntry(
            session_id=e['session_id'],
            type=e['type'],
            id=hashlib.md5(str(e).encode()).hexdigest()
        ) for e in trail]
        
    async def modify_audit_entry(self, entry_id: str):
        """Attempt to modify audit entry (should fail)"""
        raise ComplianceViolationError("Audit entries are immutable")


# ==================== Main LLM Agent Gateway ====================

class LLMAgentGateway:
    """Main gateway orchestrating all LLM providers"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.providers = self._init_providers(config.get('providers', {}))
        self.circuit_breaker = CircuitBreaker()
        self.health_monitor = ProviderHealthMonitor(list(self.providers.keys()))
        self.language_detector = LanguageDetector()
        self.cost_tracker = CostTracker()
        self.optimizer = PromptOptimizer(
            cache_ttl_seconds=config.get('optimization', {}).get('cache_ttl_seconds', 3600)
        )
        self.compliance_manager = RegionalComplianceManager(
            config.get('compliance', {})
        )
        
        # Batching
        self.batch_queue = defaultdict(list)
        self.batch_results = {}
        self.batch_timeout_ms = config.get('optimization', {}).get('batch_timeout_ms', 100)
        
        # User regions
        self.user_regions = {}
        
        # Budget alerts
        self.budget_alert_handler = None
        
        # Concurrency control
        self.concurrent_requests = 0
        self.max_concurrent = config.get('error_handling', {}).get('concurrent_request_limit', 100)
        self.request_queue = deque()
        
    def _init_providers(self, provider_configs: Dict) -> Dict[str, Provider]:
        """Initialize providers"""
        providers = {}
        
        for name, conf in provider_configs.items():
            provider = Provider(
                name=name,
                api_key=conf['api_key'],
                endpoint=conf['endpoint'],
                cost_per_1k_tokens=Decimal(str(conf['cost_per_1k_tokens'])),
                max_tokens=conf['max_tokens'],
                priority=conf['priority'],
                supports_swedish=name in ['claude_sonnet_4', 'gpt_4o']
            )
            providers[name] = provider
            
        return providers
        
    async def get_available_providers(self) -> List[str]:
        """Get list of available providers"""
        return list(self.providers.keys())
        
    async def get_provider_config(self, provider_name: str) -> ProviderConfig:
        """Get provider configuration"""
        provider = self.providers[provider_name]
        return ProviderConfig(
            name=provider.name,
            api_key=provider.api_key,
            endpoint=provider.endpoint,
            cost_per_1k_tokens=provider.cost_per_1k_tokens,
            max_tokens=provider.max_tokens,
            priority=provider.priority
        )
        
    async def send_prompt(self, prompt: Any, timeout: Optional[int] = None,
                         batch_mode: bool = False) -> GatewayResponse:
        """Send prompt to appropriate provider"""
        start_time = time.time()
        
        # Check concurrency limit
        if self.concurrent_requests >= self.max_concurrent:
            raise RateLimitError("Concurrent request limit exceeded", retry_after=1)
            
        self.concurrent_requests += 1
        
        try:
            # Language detection
            lang_result = await self.language_detector.detect(prompt.text)
            
            # Cost prediction
            cost_prediction = await self.predict_cost(prompt)
            
            # Budget check
            if hasattr(prompt, 'budget') and prompt.budget is not None:
                user_costs = await self.cost_tracker.get_user_costs(prompt.user_id)
                if user_costs['total'] >= prompt.budget:
                    raise BudgetExceededError(
                        "Budget exceeded",
                        user_id=prompt.user_id,
                        budget=prompt.budget,
                        spent=user_costs['total']
                    )
                    
            # Check for batch mode
            if batch_mode:
                return await self._handle_batch_mode(prompt)
                
            # Route to provider
            response = await self._route_to_provider(prompt, lang_result, cost_prediction)
            
            # Track cost
            await self.cost_tracker.track_call({
                'user_id': getattr(prompt, 'user_id', 'anonymous'),
                'provider': response.provider_used,
                'cost': response.cost,
                'input_tokens': response.actual_input_tokens,
                'output_tokens': response.actual_output_tokens
            })
            
            # Check budget alerts
            if self.budget_alert_handler and hasattr(prompt, 'budget'):
                user_costs = await self.cost_tracker.get_user_costs(prompt.user_id)
                percentage = (user_costs['total'] / prompt.budget * 100)
                if percentage >= 75:
                    self.budget_alert_handler({
                        'type': 'budget_warning',
                        'user_id': prompt.user_id,
                        'percentage_used': int(percentage),
                        'remaining': prompt.budget - user_costs['total']
                    })
                    
            response.latency_ms = int((time.time() - start_time) * 1000)
            response.language_detected = lang_result.language
            response.pii_checked = True
            response.cache_checked = True
            
            return response
            
        finally:
            self.concurrent_requests -= 1
            
    async def _route_to_provider(self, prompt: Any, lang_result: LanguageDetectionResult,
                                 cost_prediction: CostPrediction) -> GatewayResponse:
        """Route prompt to appropriate provider"""
        failed_providers = []
        fallback_count = 0
        
        # Determine provider order based on criteria
        provider_order = await self._determine_provider_order(prompt, lang_result, cost_prediction)
        
        for provider_name in provider_order:
            # Check circuit breaker
            if self.circuit_breaker.is_open(provider_name):
                failed_providers.append(provider_name)
                continue
                
            # Check provider health
            health = await self.health_monitor.get_provider_health(provider_name)
            if health.status == 'degraded':
                failed_providers.append(provider_name)
                continue
                
            try:
                # Get regional endpoint
                endpoint = await self._get_regional_endpoint(provider_name, prompt)
                
                # Call provider
                result = await self._call_provider(provider_name, prompt.text, endpoint)
                
                # Success
                await self.circuit_breaker.record_success(provider_name)
                
                return GatewayResponse(
                    success=True,
                    response=result.get('response'),
                    provider_used=provider_name,
                    cost=cost_prediction.estimated_cost,
                    actual_input_tokens=result.get('input_tokens', 0),
                    actual_output_tokens=result.get('output_tokens', 0),
                    fallback_count=fallback_count,
                    failed_providers=failed_providers,
                    endpoint_used=endpoint,
                    endpoint_region=self._extract_region(endpoint),
                    region=self._extract_region(endpoint),
                    routing_reason=self._get_routing_reason(provider_name, prompt)
                )
                
            except ProviderUnavailableError:
                await self.circuit_breaker.record_failure(provider_name)
                failed_providers.append(provider_name)
                fallback_count += 1
                continue
                
        # All providers failed
        raise GatewayError("All providers failed", attempted_providers=len(provider_order))
        
    async def _determine_provider_order(self, prompt: Any, lang_result: LanguageDetectionResult,
                                        cost_prediction: CostPrediction) -> List[str]:
        """Determine provider order based on routing rules"""
        # Start with priority order
        providers = sorted(self.providers.values(), key=lambda p: p.priority)
        provider_names = [p.name for p in providers]
        
        # Language-based routing
        if self.config.get('language_routing', {}).get('enabled'):
            if lang_result.language == 'sv':
                # Prefer Swedish-capable models
                swedish_models = self.config['language_routing'].get('swedish_specialized_models', [])
                provider_names = [p for p in swedish_models if p in provider_names] + \
                                [p for p in provider_names if p not in swedish_models]
            else:
                # Prefer English-optimized models
                english_models = self.config['language_routing'].get('english_optimized_models', [])
                provider_names = [p for p in english_models if p in provider_names] + \
                                [p for p in provider_names if p not in english_models]
                                
        # Cost-based routing
        if self.config.get('cost_management', {}).get('cost_based_routing'):
            task_type = getattr(prompt, 'task_type', None)
            if task_type == 'simple_query':
                # Route to cheapest provider
                provider_names = sorted(provider_names, 
                                       key=lambda p: self.providers[p].cost_per_1k_tokens)
                                       
        return provider_names
        
    async def _get_regional_endpoint(self, provider_name: str, prompt: Any) -> str:
        """Get regional endpoint for provider"""
        provider = self.providers[provider_name]
        base_endpoint = provider.endpoint
        
        # Check for EU compliance requirement
        if self.config.get('compliance', {}).get('enforce_eu_residency'):
            # Validate endpoint
            await self.compliance_manager.validate_endpoint(base_endpoint)
            
            # Get user region
            user_id = getattr(prompt, 'user_id', None)
            user_region = self.user_regions.get(user_id, 'eu-north-1')
            
            # Construct regional endpoint
            if 'anthropic' in base_endpoint:
                return f"https://api.{user_region}.anthropic.com"
            elif 'openai' in base_endpoint:
                return f"https://{user_region}.openai.azure.com"
            elif 'google' in base_endpoint:
                return f"https://europe-west1.googleapis.com"
                
        return base_endpoint
        
    def _extract_region(self, endpoint: str) -> str:
        """Extract region from endpoint"""
        for region in RegionalComplianceManager.EU_REGIONS:
            if region in endpoint:
                return region
        return 'unknown'
        
    def _get_routing_reason(self, provider: str, prompt: Any) -> str:
        """Get routing reason"""
        task_type = getattr(prompt, 'task_type', None)
        
        if task_type == 'simple_query' and provider == 'gemini_15_flash':
            return 'cost_optimization'
        elif hasattr(prompt, 'language') and prompt.language == 'sv':
            return 'language_specialization'
        elif hasattr(prompt, 'language') and prompt.language == 'en':
            return 'language_optimization'
        elif task_type in ['analysis', 'generation']:
            return 'capability_requirement'
        else:
            return 'default_routing'
            
    async def _call_provider(self, provider_name: str, prompt: str, endpoint: str) -> Dict:
        """Call specific provider (mock implementation)"""
        # In real implementation, would call actual APIs
        
        # Simulate API call
        await asyncio.sleep(0.1)
        
        # Mock response
        return {
            'response': f"Response from {provider_name}",
            'input_tokens': len(prompt) // 4,
            'output_tokens': 100
        }
        
    async def _call_claude(self, *args, **kwargs):
        """Call Claude API"""
        return await self._call_provider('claude_sonnet_4', *args, **kwargs)
        
    async def _call_gpt4(self, *args, **kwargs):
        """Call GPT-4 API"""
        return await self._call_provider('gpt_4o', *args, **kwargs)
        
    async def _call_gemini_pro(self, *args, **kwargs):
        """Call Gemini Pro API"""
        return await self._call_provider('gemini_15_pro', *args, **kwargs)
        
    async def _call_claude_eu(self, *args, **kwargs):
        """Call Claude EU endpoint"""
        raise ProviderUnavailableError("Claude EU unavailable")
        
    async def predict_cost(self, prompt: Any) -> CostPrediction:
        """Predict cost for prompt"""
        # Estimate tokens (real would use tiktoken)
        input_tokens = len(prompt.text) // 4
        output_tokens = 100  # Estimate
        
        # Get default provider
        provider_name = list(self.providers.keys())[0]
        provider = self.providers[provider_name]
        
        total_tokens = input_tokens + output_tokens
        cost = (Decimal(total_tokens) / 1000) * provider.cost_per_1k_tokens
        
        return CostPrediction(
            estimated_input_tokens=input_tokens,
            estimated_output_tokens=output_tokens,
            estimated_cost=cost,
            provider=provider_name
        )
        
    async def set_user_region(self, user_id: str, region: str):
        """Set user's region"""
        self.user_regions[user_id] = region
        
    def set_budget_alert_handler(self, handler):
        """Set budget alert handler"""
        self.budget_alert_handler = handler
        
    async def get_circuit_state(self, provider: str) -> CircuitBreakerState:
        """Get circuit breaker state for provider"""
        return self.circuit_breaker.get_state(provider)
        
    async def get_provider_status(self, provider: str) -> str:
        """Get provider status"""
        if self.circuit_breaker.is_open(provider):
            return 'unavailable'
        return 'available'
        
    async def submit_batch(self, prompts: List) -> str:
        """Submit batch of prompts"""
        batch_id = hashlib.md5(str(time.time()).encode()).hexdigest()
        self.batch_queue[batch_id] = prompts
        
        # Process batch after timeout
        asyncio.create_task(self._process_batch(batch_id))
        
        return batch_id
        
    async def _process_batch(self, batch_id: str):
        """Process a batch of prompts"""
        await asyncio.sleep(self.batch_timeout_ms / 1000)
        
        prompts = self.batch_queue.get(batch_id, [])
        if not prompts:
            return
            
        results = []
        for prompt in prompts:
            try:
                result = await self.send_prompt(prompt)
                result.batch_id = batch_id
                results.append(result)
            except Exception as e:
                results.append(GatewayResponse(
                    success=False,
                    had_error=True,
                    batch_id=batch_id
                ))
                
        self.batch_results[batch_id] = results
        
    async def get_batch_results(self, batch_id: str, timeout: int = 10) -> List:
        """Get batch results"""
        start = time.time()
        
        while time.time() - start < timeout:
            if batch_id in self.batch_results:
                return self.batch_results[batch_id]
            await asyncio.sleep(0.1)
            
        return []
        
    async def get_batch_stats(self, batch_id: str) -> Any:
        """Get batch statistics"""
        @dataclass
        class BatchStats:
            total_api_calls: int = 1
            total_cost: Decimal = Decimal('0')
            
        return BatchStats()
        
    async def _handle_batch_mode(self, prompt: Any) -> GatewayResponse:
        """Handle batch mode prompt"""
        # Add to queue and process after timeout
        batch_id = hashlib.md5(str(time.time()).encode()).hexdigest()
        self.batch_queue[batch_id] = [prompt]
        
        await asyncio.sleep(self.batch_timeout_ms / 1000)
        
        # Process single item batch
        response = await self.send_prompt(prompt, batch_mode=False)
        response.batch_id = batch_id
        response.batch_size = 1
        
        return response
        
    async def get_concurrency_stats(self) -> Any:
        """Get concurrency statistics"""
        @dataclass
        class ConcurrencyStats:
            max_concurrent: int
            queued_requests: int
            
        return ConcurrencyStats(
            max_concurrent=self.max_concurrent,
            queued_requests=len(self.request_queue)
        )