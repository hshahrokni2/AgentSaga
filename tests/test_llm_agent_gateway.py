"""
Comprehensive test suite for Multi-Provider LLM Agent Gateway
Tests provider management, language routing, cost management, and compliance
Following TDD RED phase - all tests should fail initially
"""

import pytest
import pytest_asyncio
import asyncio
import json
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from dataclasses import dataclass
import aiohttp
from concurrent.futures import ThreadPoolExecutor

# Import the gateway module (to be implemented)
from src.services.llm_agent_gateway import (
    LLMAgentGateway,
    Provider,
    ProviderConfig,
    LanguageDetector,
    CostTracker,
    PromptOptimizer,
    RegionalComplianceManager,
    CircuitBreaker,
    ProviderHealthMonitor,
    GatewayError,
    ProviderUnavailableError,
    BudgetExceededError,
    ComplianceViolationError,
    RateLimitError,
    TokenCountError
)


@dataclass
class TestPrompt:
    """Test prompt with metadata"""
    text: str
    language: Optional[str] = None
    expected_provider: Optional[str] = None
    user_id: Optional[str] = None
    task_type: Optional[str] = None
    budget: Optional[Decimal] = None


class TestProviderManagement:
    """Test suite for provider management and failover"""
    
    @pytest_asyncio.fixture
    async def gateway(self):
        """Create gateway instance with mock providers"""
        config = {
            'providers': {
                'claude_sonnet_4': {
                    'api_key': 'test-claude-key',
                    'endpoint': 'https://api.anthropic.com/v1',
                    'cost_per_1k_tokens': Decimal('0.003'),
                    'max_tokens': 200000,
                    'priority': 1
                },
                'gpt_4o': {
                    'api_key': 'test-openai-key',
                    'endpoint': 'https://api.openai.com/v1',
                    'cost_per_1k_tokens': Decimal('0.005'),
                    'max_tokens': 128000,
                    'priority': 2
                },
                'gemini_15_pro': {
                    'api_key': 'test-gemini-key',
                    'endpoint': 'https://generativelanguage.googleapis.com/v1',
                    'cost_per_1k_tokens': Decimal('0.002'),
                    'max_tokens': 1000000,
                    'priority': 3
                },
                'gemini_15_flash': {
                    'api_key': 'test-gemini-flash-key',
                    'endpoint': 'https://generativelanguage.googleapis.com/v1',
                    'cost_per_1k_tokens': Decimal('0.0005'),
                    'max_tokens': 1000000,
                    'priority': 4
                }
            }
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_provider_initialization(self, gateway):
        """Test that all providers are properly initialized"""
        providers = await gateway.get_available_providers()
        
        assert len(providers) == 4
        assert 'claude_sonnet_4' in providers
        assert 'gpt_4o' in providers
        assert 'gemini_15_pro' in providers
        assert 'gemini_15_flash' in providers
        
        # Verify provider configurations
        claude_config = await gateway.get_provider_config('claude_sonnet_4')
        assert claude_config.max_tokens == 200000
        assert claude_config.cost_per_1k_tokens == Decimal('0.003')
    
    @pytest.mark.asyncio
    async def test_provider_fallback_chain(self, gateway):
        """Test automatic fallback when primary provider fails"""
        prompt = TestPrompt(
            text="Explain quantum computing",
            user_id="test-user-001"
        )
        
        # Mock Claude failure
        with patch.object(gateway, '_call_claude', side_effect=ProviderUnavailableError):
            response = await gateway.send_prompt(prompt)
            
            # Should fallback to GPT-4o
            assert response.provider_used == 'gpt_4o'
            assert response.fallback_count == 1
            assert 'claude_sonnet_4' in response.failed_providers
    
    @pytest.mark.asyncio
    async def test_complete_fallback_chain(self, gateway):
        """Test fallback through entire provider chain"""
        prompt = TestPrompt(text="Hello world")
        
        # Mock all providers except Gemini Flash
        with patch.object(gateway, '_call_claude', side_effect=ProviderUnavailableError):
            with patch.object(gateway, '_call_gpt4', side_effect=ProviderUnavailableError):
                with patch.object(gateway, '_call_gemini_pro', side_effect=ProviderUnavailableError):
                    response = await gateway.send_prompt(prompt)
                    
                    # Should end up using Gemini Flash
                    assert response.provider_used == 'gemini_15_flash'
                    assert response.fallback_count == 3
                    assert len(response.failed_providers) == 3
    
    @pytest.mark.asyncio
    async def test_all_providers_fail(self, gateway):
        """Test behavior when all providers fail"""
        prompt = TestPrompt(text="Test prompt")
        
        # Mock all providers to fail
        with patch.object(gateway, '_call_provider', side_effect=ProviderUnavailableError):
            with pytest.raises(GatewayError) as exc_info:
                await gateway.send_prompt(prompt)
            
            assert "All providers failed" in str(exc_info.value)
            assert exc_info.value.attempted_providers == 4
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_activation(self, gateway):
        """Test circuit breaker pattern with exponential backoff"""
        prompt = TestPrompt(text="Test prompt")
        
        # Trigger multiple failures for Claude
        for _ in range(5):
            with patch.object(gateway, '_call_claude', side_effect=ProviderUnavailableError):
                await gateway.send_prompt(prompt)
        
        # Circuit breaker should now be open for Claude
        circuit_state = await gateway.get_circuit_state('claude_sonnet_4')
        assert circuit_state.is_open
        assert circuit_state.failure_count >= 5
        assert circuit_state.next_retry_time > datetime.utcnow()
        
        # Exponential backoff calculation
        expected_backoff = 2 ** min(circuit_state.failure_count, 6)  # Cap at 64 seconds
        assert circuit_state.backoff_seconds == expected_backoff
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_recovery(self, gateway):
        """Test circuit breaker recovery after successful calls"""
        # Open circuit breaker
        await gateway.circuit_breaker.open('claude_sonnet_4')
        
        # Wait for half-open state
        await asyncio.sleep(2)
        
        # Successful call should close circuit
        with patch.object(gateway, '_call_claude', return_value={'response': 'success'}):
            prompt = TestPrompt(text="Test")
            response = await gateway.send_prompt(prompt)
            
            circuit_state = await gateway.get_circuit_state('claude_sonnet_4')
            assert circuit_state.is_closed
            assert circuit_state.failure_count == 0
    
    @pytest.mark.asyncio
    async def test_provider_health_monitoring(self, gateway):
        """Test continuous health monitoring of providers"""
        monitor = gateway.health_monitor
        
        # Start monitoring
        await monitor.start()
        
        # Simulate time passage
        await asyncio.sleep(5)
        
        # Check health metrics
        health_report = await monitor.get_health_report()
        
        assert 'claude_sonnet_4' in health_report
        assert health_report['claude_sonnet_4']['status'] in ['healthy', 'degraded', 'unhealthy']
        assert 'latency_ms' in health_report['claude_sonnet_4']
        assert 'success_rate' in health_report['claude_sonnet_4']
        assert 'last_check' in health_report['claude_sonnet_4']
        
        # Stop monitoring
        await monitor.stop()
    
    @pytest.mark.asyncio
    async def test_automatic_failover_on_degradation(self, gateway):
        """Test automatic failover when provider performance degrades"""
        # Simulate Claude degradation
        await gateway.health_monitor.report_degradation('claude_sonnet_4', {
            'latency_ms': 5000,  # High latency
            'error_rate': 0.3    # 30% error rate
        })
        
        prompt = TestPrompt(text="Test prompt")
        response = await gateway.send_prompt(prompt)
        
        # Should skip degraded Claude and use GPT-4o
        assert response.provider_used == 'gpt_4o'
        assert response.skip_reason == 'provider_degraded'


class TestLanguageDetectionAndRouting:
    """Test suite for language detection and routing logic"""
    
    @pytest_asyncio.fixture
    async def language_detector(self):
        """Create language detector instance"""
        return LanguageDetector()
    
    @pytest_asyncio.fixture
    async def gateway(self):
        """Gateway with language routing enabled"""
        config = {
            'language_routing': {
                'enabled': True,
                'swedish_specialized_models': ['claude_sonnet_4', 'gpt_4o'],
                'english_optimized_models': ['gemini_15_pro', 'gemini_15_flash']
            }
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_swedish_language_detection(self, language_detector):
        """Test detection of Swedish language in prompts"""
        swedish_prompts = [
            "Förklara hur återvinning fungerar i Sverige",
            "Vad är skillnaden mellan återvinning och återanvändning?",
            "Berätta om svenska avfallshanteringssystemet",
            "Hej, kan du hjälpa mig med något?",
            "Tack så mycket för hjälpen!"
        ]
        
        for prompt in swedish_prompts:
            result = await language_detector.detect(prompt)
            assert result.language == 'sv'
            assert result.confidence >= 0.8
    
    @pytest.mark.asyncio
    async def test_english_language_detection(self, language_detector):
        """Test detection of English language in prompts"""
        english_prompts = [
            "Explain how recycling works in Sweden",
            "What is the difference between recycling and reuse?",
            "Tell me about Swedish waste management",
            "Hello, can you help me with something?",
            "Thank you very much for the help!"
        ]
        
        for prompt in english_prompts:
            result = await language_detector.detect(prompt)
            assert result.language == 'en'
            assert result.confidence >= 0.8
    
    @pytest.mark.asyncio
    async def test_swedish_character_handling(self, language_detector):
        """Test correct handling of Swedish characters åäö"""
        prompts_with_swedish_chars = [
            "Återvinning är viktigt för miljön",
            "Källsortering påverkar vårt samhälle",
            "Förpackningar bör återvinnas rätt",
            "Miljöpåverkan från avfall är betydande",
            "Säkerställ korrekt hantering av farligt avfall"
        ]
        
        for prompt in prompts_with_swedish_chars:
            result = await language_detector.detect(prompt)
            assert result.language == 'sv'
            assert result.has_swedish_chars
            
            # Verify characters are preserved
            assert 'å' in prompt or 'ä' in prompt or 'ö' in prompt
            normalized = await language_detector.normalize(prompt)
            assert normalized == prompt  # Should not modify Swedish chars
    
    @pytest.mark.asyncio
    async def test_formal_informal_swedish_detection(self, language_detector):
        """Test detection of formal vs informal Swedish"""
        formal_prompts = [
            "Vänligen förklara processen för avfallshantering",
            "Kan Ni beskriva återvinningssystemet?",
            "Jag skulle vilja ha information om källsortering",
            "Med vänlig hälsning, behöver jag hjälp"
        ]
        
        informal_prompts = [
            "Hej! Hur funkar återvinning?",
            "Tjena, kan du förklara detta?",
            "Vad ska jag göra med plasten?",
            "Okej, fattar inte riktigt"
        ]
        
        for prompt in formal_prompts:
            result = await language_detector.detect_formality(prompt)
            assert result.formality == 'formal'
            assert result.confidence >= 0.7
        
        for prompt in informal_prompts:
            result = await language_detector.detect_formality(prompt)
            assert result.formality == 'informal'
            assert result.confidence >= 0.7
    
    @pytest.mark.asyncio
    async def test_swedish_technical_vocabulary(self, language_detector):
        """Test detection of Swedish technical waste management terms"""
        technical_terms = [
            "materialåtervinning",
            "energiåtervinning",
            "biologisk behandling",
            "farligt avfall",
            "producentansvar",
            "källsortering",
            "återvinningscentral",
            "miljöstation",
            "deponi",
            "kompostering"
        ]
        
        prompt = f"Förklara följande begrepp: {', '.join(technical_terms)}"
        result = await language_detector.analyze_technical_content(prompt)
        
        assert result.has_technical_terms
        assert len(result.technical_terms) >= 5
        assert result.domain == 'waste_management'
        assert result.complexity == 'high'
    
    @pytest.mark.asyncio
    async def test_language_based_provider_routing(self, gateway):
        """Test routing to appropriate providers based on language"""
        # Swedish prompt should route to Swedish-specialized models
        swedish_prompt = TestPrompt(
            text="Förklara Sveriges avfallshanteringssystem",
            language='sv'
        )
        
        response = await gateway.send_prompt(swedish_prompt)
        assert response.provider_used in ['claude_sonnet_4', 'gpt_4o']
        assert response.routing_reason == 'language_specialization'
        
        # English prompt should route to English-optimized models
        english_prompt = TestPrompt(
            text="Explain Sweden's waste management system",
            language='en'
        )
        
        response = await gateway.send_prompt(english_prompt)
        assert response.provider_used in ['gemini_15_pro', 'gemini_15_flash']
        assert response.routing_reason == 'language_optimization'
    
    @pytest.mark.asyncio
    async def test_mixed_language_handling(self, language_detector):
        """Test handling of mixed Swedish-English prompts"""
        mixed_prompt = "Please explain återvinning and källsortering in detail"
        
        result = await language_detector.detect(mixed_prompt)
        assert result.is_mixed
        assert result.primary_language in ['en', 'sv']
        assert result.languages == {'en', 'sv'}
        assert len(result.language_segments) > 1


class TestCostManagement:
    """Test suite for cost tracking and budget enforcement"""
    
    @pytest_asyncio.fixture
    async def cost_tracker(self):
        """Create cost tracker instance"""
        return CostTracker()
    
    @pytest_asyncio.fixture
    async def gateway(self):
        """Gateway with cost management enabled"""
        config = {
            'cost_management': {
                'enabled': True,
                'default_user_budget': Decimal('10.00'),
                'task_budgets': {
                    'simple_query': Decimal('0.10'),
                    'analysis': Decimal('1.00'),
                    'generation': Decimal('2.00')
                },
                'cost_based_routing': True
            }
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_real_time_cost_tracking(self, cost_tracker):
        """Test real-time tracking of API call costs"""
        # Track a Claude call
        await cost_tracker.track_call({
            'provider': 'claude_sonnet_4',
            'input_tokens': 1500,
            'output_tokens': 500,
            'cost_per_1k_tokens': Decimal('0.003'),
            'user_id': 'user-001',
            'task_id': 'task-001'
        })
        
        # Calculate expected cost: (1500 + 500) / 1000 * 0.003 = 0.006
        user_costs = await cost_tracker.get_user_costs('user-001')
        assert user_costs.total == Decimal('0.006')
        assert user_costs.by_provider['claude_sonnet_4'] == Decimal('0.006')
        assert user_costs.call_count == 1
    
    @pytest.mark.asyncio
    async def test_budget_enforcement_per_user(self, gateway):
        """Test budget enforcement at user level"""
        prompt = TestPrompt(
            text="Generate a long report",
            user_id="user-002",
            budget=Decimal('0.50')
        )
        
        # First call within budget
        response1 = await gateway.send_prompt(prompt)
        assert response1.success
        assert response1.cost <= Decimal('0.50')
        
        # Simulate multiple calls to exceed budget
        for _ in range(10):
            with patch.object(gateway.cost_tracker, 'get_user_costs', 
                            return_value={'total': Decimal('0.45')}):
                response = await gateway.send_prompt(prompt)
        
        # Next call should fail due to budget exceeded
        with patch.object(gateway.cost_tracker, 'get_user_costs',
                         return_value={'total': Decimal('0.55')}):
            with pytest.raises(BudgetExceededError) as exc_info:
                await gateway.send_prompt(prompt)
            
            assert exc_info.value.user_id == 'user-002'
            assert exc_info.value.budget == Decimal('0.50')
            assert exc_info.value.spent == Decimal('0.55')
    
    @pytest.mark.asyncio
    async def test_budget_enforcement_per_task_type(self, gateway):
        """Test budget enforcement at task type level"""
        # Simple query - low budget
        simple_prompt = TestPrompt(
            text="What is recycling?",
            user_id="user-003",
            task_type="simple_query"
        )
        
        response = await gateway.send_prompt(simple_prompt)
        assert response.cost <= Decimal('0.10')  # Task budget limit
        
        # Complex generation - higher budget
        complex_prompt = TestPrompt(
            text="Generate a comprehensive 5000 word report on waste management",
            user_id="user-003",
            task_type="generation"
        )
        
        response = await gateway.send_prompt(complex_prompt)
        assert response.cost <= Decimal('2.00')  # Task budget limit
    
    @pytest.mark.asyncio
    async def test_cost_based_routing(self, gateway):
        """Test routing simple tasks to cheaper models"""
        # Simple task should route to cheaper model
        simple_prompt = TestPrompt(
            text="Hello, how are you?",
            user_id="user-004",
            task_type="simple_query"
        )
        
        response = await gateway.send_prompt(simple_prompt)
        assert response.provider_used == 'gemini_15_flash'  # Cheapest model
        assert response.routing_reason == 'cost_optimization'
        
        # Complex task should route to more capable model
        complex_prompt = TestPrompt(
            text="Analyze this complex dataset and provide insights...",
            user_id="user-004",
            task_type="analysis"
        )
        
        response = await gateway.send_prompt(complex_prompt)
        assert response.provider_used in ['claude_sonnet_4', 'gpt_4o']
        assert response.routing_reason == 'capability_requirement'
    
    @pytest.mark.asyncio
    async def test_token_counting_before_api_call(self, gateway):
        """Test token counting and cost prediction before making API calls"""
        prompt = TestPrompt(
            text="This is a test prompt for token counting",
            user_id="user-005"
        )
        
        # Predict cost before call
        prediction = await gateway.predict_cost(prompt)
        assert prediction.estimated_input_tokens > 0
        assert prediction.estimated_output_tokens > 0
        assert prediction.estimated_cost > Decimal('0')
        assert prediction.provider == 'claude_sonnet_4'  # Default provider
        
        # Make actual call
        response = await gateway.send_prompt(prompt)
        
        # Compare prediction with actual
        assert abs(response.actual_input_tokens - prediction.estimated_input_tokens) < 50
        assert response.actual_cost >= Decimal('0')
    
    @pytest.mark.asyncio
    async def test_cost_aggregation_reporting(self, cost_tracker):
        """Test cost aggregation and reporting capabilities"""
        # Track multiple calls
        calls = [
            {'provider': 'claude_sonnet_4', 'cost': Decimal('0.05'), 'user_id': 'user-006'},
            {'provider': 'gpt_4o', 'cost': Decimal('0.08'), 'user_id': 'user-006'},
            {'provider': 'gemini_15_pro', 'cost': Decimal('0.03'), 'user_id': 'user-007'},
            {'provider': 'gemini_15_flash', 'cost': Decimal('0.01'), 'user_id': 'user-007'}
        ]
        
        for call in calls:
            await cost_tracker.track_call(call)
        
        # Get aggregated report
        report = await cost_tracker.generate_report({
            'start_date': datetime.utcnow() - timedelta(hours=1),
            'end_date': datetime.utcnow(),
            'group_by': ['user_id', 'provider']
        })
        
        assert report.total_cost == Decimal('0.17')
        assert report.user_costs['user-006'] == Decimal('0.13')
        assert report.user_costs['user-007'] == Decimal('0.04')
        assert report.provider_costs['claude_sonnet_4'] == Decimal('0.05')
    
    @pytest.mark.asyncio
    async def test_budget_alerts(self, gateway):
        """Test budget alert notifications"""
        prompt = TestPrompt(
            text="Test prompt",
            user_id="user-008",
            budget=Decimal('1.00')
        )
        
        # Set up alert thresholds
        alert_handler = Mock()
        gateway.set_budget_alert_handler(alert_handler)
        
        # Simulate spending near budget
        with patch.object(gateway.cost_tracker, 'get_user_costs',
                         return_value={'total': Decimal('0.75')}):
            await gateway.send_prompt(prompt)
            
            # Should trigger 75% budget alert
            alert_handler.assert_called_with({
                'type': 'budget_warning',
                'user_id': 'user-008',
                'percentage_used': 75,
                'remaining': Decimal('0.25')
            })


class TestPromptOptimization:
    """Test suite for prompt optimization and caching"""
    
    @pytest_asyncio.fixture
    async def optimizer(self):
        """Create prompt optimizer instance"""
        return PromptOptimizer()
    
    @pytest_asyncio.fixture
    async def gateway(self):
        """Gateway with optimization enabled"""
        config = {
            'optimization': {
                'cache_enabled': True,
                'cache_ttl_seconds': 3600,
                'batch_processing': True,
                'batch_timeout_ms': 100,
                'max_batch_size': 10,
                'context_window_management': True
            }
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_prompt_caching_identical_requests(self, optimizer):
        """Test caching for identical prompt requests"""
        prompt = "Explain waste sorting in Sweden"
        
        # First call - cache miss
        result1 = await optimizer.process(prompt)
        assert result1.cache_hit is False
        assert result1.processing_time_ms > 0
        
        # Second call - cache hit
        result2 = await optimizer.process(prompt)
        assert result2.cache_hit is True
        assert result2.processing_time_ms < result1.processing_time_ms
        assert result2.response == result1.response
        
        # Verify cache stats
        stats = await optimizer.get_cache_stats()
        assert stats.hits == 1
        assert stats.misses == 1
        assert stats.hit_rate == 0.5
    
    @pytest.mark.asyncio
    async def test_swedish_technical_terminology_caching(self, optimizer):
        """Test caching of Swedish technical terms and translations"""
        technical_terms = [
            "materialåtervinning",
            "energiåtervinning",
            "källsortering",
            "producentansvar"
        ]
        
        # First lookup - builds cache
        for term in technical_terms:
            definition = await optimizer.get_technical_term(term)
            assert definition is not None
        
        # Second lookup - from cache
        cached_lookups = []
        for term in technical_terms:
            start = time.time()
            definition = await optimizer.get_technical_term(term)
            elapsed = time.time() - start
            cached_lookups.append(elapsed)
            assert elapsed < 0.001  # Should be instant from cache
        
        # Verify terminology cache
        term_cache = await optimizer.get_terminology_cache()
        assert len(term_cache) >= 4
        assert all(term in term_cache for term in technical_terms)
    
    @pytest.mark.asyncio
    async def test_batch_processing_multiple_requests(self, gateway):
        """Test batch processing of multiple prompt requests"""
        prompts = [
            TestPrompt(text=f"Question {i}", user_id=f"user-{i:03d}")
            for i in range(5)
        ]
        
        # Submit prompts for batch processing
        batch_id = await gateway.submit_batch(prompts)
        assert batch_id is not None
        
        # Wait for batch completion
        results = await gateway.get_batch_results(batch_id, timeout=5)
        
        assert len(results) == 5
        assert all(r.success for r in results)
        assert results[0].batch_id == batch_id
        
        # Verify batch was processed efficiently
        batch_stats = await gateway.get_batch_stats(batch_id)
        assert batch_stats.total_api_calls <= 2  # Should batch into fewer API calls
        assert batch_stats.total_cost < sum(r.cost for r in results)  # Batch discount
    
    @pytest.mark.asyncio
    async def test_batch_processing_timeout(self, gateway):
        """Test batch timeout behavior"""
        # Configure short timeout
        gateway.config.optimization.batch_timeout_ms = 50
        
        # Submit single prompt
        prompt = TestPrompt(text="Single prompt", user_id="user-009")
        start = time.time()
        response = await gateway.send_prompt(prompt, batch_mode=True)
        elapsed = (time.time() - start) * 1000
        
        # Should process after timeout, not wait for full batch
        assert elapsed < 100  # Processed within timeout + margin
        assert response.batch_size == 1  # Processed alone
    
    @pytest.mark.asyncio
    async def test_context_window_management(self, optimizer):
        """Test management of context window sizes"""
        # Test with different providers' limits
        providers = {
            'claude_sonnet_4': 200000,
            'gpt_4o': 128000,
            'gemini_15_pro': 1000000,
            'gemini_15_flash': 1000000
        }
        
        for provider, max_tokens in providers.items():
            # Create prompt near limit
            large_context = "x" * (max_tokens - 1000)
            prompt = f"{large_context}\nQuestion: Summarize this"
            
            result = await optimizer.fit_context_window(prompt, provider)
            assert result.fits
            assert result.tokens_used < max_tokens
            assert result.tokens_available > 0
            
            # Create prompt exceeding limit
            oversized_context = "x" * (max_tokens + 1000)
            prompt = f"{oversized_context}\nQuestion: Summarize"
            
            result = await optimizer.fit_context_window(prompt, provider)
            assert not result.fits
            assert result.truncated
            assert result.tokens_used <= max_tokens
    
    @pytest.mark.asyncio
    async def test_context_truncation_strategies(self, optimizer):
        """Test different context truncation strategies"""
        large_prompt = "Important context. " * 10000 + "Question: What is the main topic?"
        
        # Test different truncation strategies
        strategies = ['beginning', 'middle', 'smart']
        
        for strategy in strategies:
            result = await optimizer.truncate_context(
                large_prompt,
                max_tokens=1000,
                strategy=strategy
            )
            
            assert result.tokens <= 1000
            assert "Question:" in result.text  # Preserve question
            
            if strategy == 'beginning':
                assert result.text.startswith("Important context")
            elif strategy == 'smart':
                assert result.preserved_sections == ['question', 'key_context']
    
    @pytest.mark.asyncio
    async def test_prompt_cache_invalidation(self, optimizer):
        """Test cache invalidation after TTL expiry"""
        prompt = "Test prompt for cache invalidation"
        
        # Set short TTL
        optimizer.cache_ttl_seconds = 1
        
        # First call - cache miss
        result1 = await optimizer.process(prompt)
        assert result1.cache_hit is False
        
        # Immediate second call - cache hit
        result2 = await optimizer.process(prompt)
        assert result2.cache_hit is True
        
        # Wait for TTL expiry
        await asyncio.sleep(1.5)
        
        # Third call - cache miss (invalidated)
        result3 = await optimizer.process(prompt)
        assert result3.cache_hit is False
    
    @pytest.mark.asyncio
    async def test_semantic_cache_matching(self, optimizer):
        """Test semantic similarity matching in cache"""
        # These prompts are semantically similar
        prompts = [
            "What is waste recycling?",
            "Explain waste recycling",
            "Tell me about recycling waste",
            "How does waste recycling work?"
        ]
        
        # Process first prompt
        result1 = await optimizer.process(prompts[0], semantic_cache=True)
        assert result1.cache_hit is False
        
        # Process similar prompts - should match semantically
        for prompt in prompts[1:]:
            result = await optimizer.process(prompt, semantic_cache=True)
            assert result.semantic_match is True
            assert result.similarity_score >= 0.85
            assert result.response == result1.response


class TestRegionalCompliance:
    """Test suite for EU/EES compliance and regional routing"""
    
    @pytest_asyncio.fixture
    async def compliance_manager(self):
        """Create compliance manager instance"""
        return RegionalComplianceManager({
            'regions': ['eu-north-1', 'eu-west-1', 'eu-central-1'],
            'data_residency': 'strict',
            'gdpr_logging': True
        })
    
    @pytest_asyncio.fixture
    async def gateway(self):
        """Gateway with compliance enabled"""
        config = {
            'compliance': {
                'enforce_eu_residency': True,
                'allowed_regions': ['eu-north-1', 'eu-west-1', 'eu-central-1'],
                'gdpr_compliant_logging': True,
                'pii_detection': True,
                'audit_trail': True
            }
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_eu_data_residency_enforcement(self, compliance_manager):
        """Test that data never leaves EU/EES regions"""
        # Test valid EU endpoints
        eu_endpoints = [
            'https://api.eu-north-1.anthropic.com',
            'https://eu-west-1.openai.azure.com',
            'https://europe-west1.googleapis.com'
        ]
        
        for endpoint in eu_endpoints:
            result = await compliance_manager.validate_endpoint(endpoint)
            assert result.is_compliant
            assert result.region in ['eu-north-1', 'eu-west-1', 'eu-central-1']
        
        # Test invalid non-EU endpoints
        non_eu_endpoints = [
            'https://api.anthropic.com',  # US endpoint
            'https://api.openai.com',      # US endpoint
            'https://asia-northeast1.googleapis.com'  # Asia endpoint
        ]
        
        for endpoint in non_eu_endpoints:
            with pytest.raises(ComplianceViolationError) as exc_info:
                await compliance_manager.validate_endpoint(endpoint)
            
            assert 'outside EU/EES' in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_regional_endpoint_routing(self, gateway):
        """Test automatic routing to regional endpoints"""
        prompt = TestPrompt(
            text="Test prompt",
            user_id="eu-user-001"
        )
        
        # Set user location
        await gateway.set_user_region('eu-user-001', 'eu-north-1')
        
        response = await gateway.send_prompt(prompt)
        
        # Verify regional endpoint was used
        assert response.endpoint_used.startswith('https://api.eu-')
        assert response.region == 'eu-north-1'
        assert response.latency_ms < 50  # Low latency for same region
    
    @pytest.mark.asyncio
    async def test_gdpr_compliant_prompt_logging(self, compliance_manager):
        """Test GDPR-compliant logging of prompts"""
        prompt_data = {
            'text': 'My name is Johan Andersson, personnummer 890315-1234',
            'user_id': 'user-010',
            'timestamp': datetime.utcnow()
        }
        
        # Log with PII detection
        logged_data = await compliance_manager.log_prompt(prompt_data)
        
        # PII should be masked
        assert '890315-1234' not in logged_data.text
        assert 'Johan Andersson' not in logged_data.text
        assert '[REDACTED]' in logged_data.text
        assert logged_data.pii_detected is True
        assert logged_data.pii_types == ['name', 'personnummer']
        
        # Verify audit trail
        audit_entry = await compliance_manager.get_audit_entry(logged_data.id)
        assert audit_entry.action == 'prompt_logged'
        assert audit_entry.pii_redacted is True
    
    @pytest.mark.asyncio
    async def test_user_consent_verification(self, compliance_manager):
        """Test verification of user consent for data processing"""
        user_id = 'user-011'
        
        # No consent - should fail
        with pytest.raises(ComplianceViolationError) as exc_info:
            await compliance_manager.verify_consent(user_id, 'ai_processing')
        
        assert 'consent not provided' in str(exc_info.value).lower()
        
        # Grant consent
        await compliance_manager.record_consent({
            'user_id': user_id,
            'purpose': 'ai_processing',
            'granted': True,
            'timestamp': datetime.utcnow()
        })
        
        # Should now pass
        result = await compliance_manager.verify_consent(user_id, 'ai_processing')
        assert result.has_consent
        assert result.purpose == 'ai_processing'
    
    @pytest.mark.asyncio
    async def test_data_retention_policies(self, compliance_manager):
        """Test enforcement of data retention policies"""
        # Create data with retention period
        data_id = await compliance_manager.store_data({
            'content': 'User prompt data',
            'retention_days': 30,
            'user_id': 'user-012'
        })
        
        # Data should be accessible within retention period
        data = await compliance_manager.get_data(data_id)
        assert data is not None
        
        # Simulate time passage beyond retention
        with patch('datetime.datetime') as mock_date:
            mock_date.utcnow.return_value = datetime.utcnow() + timedelta(days=31)
            
            # Data should be automatically deleted
            data = await compliance_manager.get_data(data_id)
            assert data is None
            
            # Verify deletion audit trail
            audit = await compliance_manager.get_deletion_audit(data_id)
            assert audit.reason == 'retention_expired'
            assert audit.retention_days == 30
    
    @pytest.mark.asyncio
    async def test_cross_border_transfer_restrictions(self, gateway):
        """Test restrictions on cross-border data transfers"""
        # EU to EU transfer - allowed
        prompt_eu = TestPrompt(
            text="Test prompt",
            user_id="eu-user",
            source_region="eu-north-1",
            target_region="eu-west-1"
        )
        
        response = await gateway.send_prompt(prompt_eu)
        assert response.success
        assert response.transfer_allowed
        
        # EU to US transfer - blocked
        prompt_non_eu = TestPrompt(
            text="Test prompt",
            user_id="eu-user",
            source_region="eu-north-1",
            target_region="us-east-1"
        )
        
        with pytest.raises(ComplianceViolationError) as exc_info:
            await gateway.send_prompt(prompt_non_eu)
        
        assert 'cross-border transfer' in str(exc_info.value).lower()
        assert exc_info.value.source_region == 'eu-north-1'
        assert exc_info.value.target_region == 'us-east-1'
    
    @pytest.mark.asyncio
    async def test_audit_trail_completeness(self, compliance_manager):
        """Test completeness of audit trail for compliance"""
        session_id = 'session-001'
        
        # Perform various operations
        operations = [
            {'type': 'prompt_received', 'user_id': 'user-013'},
            {'type': 'pii_detected', 'fields': ['name', 'email']},
            {'type': 'consent_verified', 'purpose': 'ai_processing'},
            {'type': 'endpoint_selected', 'endpoint': 'eu-north-1'},
            {'type': 'response_generated', 'tokens': 500},
            {'type': 'data_stored', 'retention_days': 30}
        ]
        
        for op in operations:
            await compliance_manager.audit_log(session_id, op)
        
        # Retrieve full audit trail
        trail = await compliance_manager.get_audit_trail(session_id)
        
        assert len(trail) == 6
        assert all(entry.session_id == session_id for entry in trail)
        assert trail[0].type == 'prompt_received'
        assert trail[-1].type == 'data_stored'
        
        # Verify immutability
        with pytest.raises(ComplianceViolationError):
            await compliance_manager.modify_audit_entry(trail[0].id)


class TestEdgeCasesAndErrorHandling:
    """Test suite for edge cases and error scenarios"""
    
    @pytest_asyncio.fixture
    async def gateway(self):
        """Gateway with error handling configured"""
        config = {
            'error_handling': {
                'max_retries': 3,
                'retry_delay_ms': 100,
                'timeout_seconds': 30,
                'concurrent_request_limit': 100
            }
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_api_timeout_handling(self, gateway):
        """Test handling of API timeouts"""
        prompt = TestPrompt(text="Test prompt")
        
        # Mock slow API response
        async def slow_response():
            await asyncio.sleep(35)  # Exceeds 30s timeout
            return {'response': 'too late'}
        
        with patch.object(gateway, '_call_provider', side_effect=slow_response):
            with pytest.raises(TimeoutError) as exc_info:
                await gateway.send_prompt(prompt, timeout=1)
            
            assert exc_info.value.timeout_seconds == 1
            assert exc_info.value.provider in ['claude_sonnet_4', 'gpt_4o']
    
    @pytest.mark.asyncio
    async def test_rate_limit_handling(self, gateway):
        """Test handling of API rate limits"""
        prompt = TestPrompt(text="Test prompt")
        
        # Mock rate limit response
        rate_limit_error = aiohttp.ClientResponseError(
            request_info=Mock(),
            history=(),
            status=429,
            message="Rate limit exceeded",
            headers={'Retry-After': '60'}
        )
        
        with patch.object(gateway, '_call_provider', side_effect=rate_limit_error):
            with pytest.raises(RateLimitError) as exc_info:
                await gateway.send_prompt(prompt)
            
            assert exc_info.value.retry_after == 60
            assert exc_info.value.provider is not None
    
    @pytest.mark.asyncio
    async def test_exponential_backoff_on_rate_limit(self, gateway):
        """Test exponential backoff when rate limited"""
        prompt = TestPrompt(text="Test prompt")
        
        call_times = []
        async def rate_limited_then_success():
            call_times.append(time.time())
            if len(call_times) < 3:
                raise RateLimitError("Rate limited", retry_after=1)
            return {'response': 'success'}
        
        with patch.object(gateway, '_call_provider', side_effect=rate_limited_then_success):
            response = await gateway.send_prompt(prompt)
            
            assert response.success
            assert len(call_times) == 3
            
            # Verify exponential backoff timing
            if len(call_times) >= 3:
                delay1 = call_times[1] - call_times[0]
                delay2 = call_times[2] - call_times[1]
                assert delay2 > delay1 * 1.5  # Exponential increase
    
    @pytest.mark.asyncio
    async def test_invalid_api_credentials(self, gateway):
        """Test handling of invalid API keys/credentials"""
        prompt = TestPrompt(text="Test prompt")
        
        # Mock authentication error
        auth_error = aiohttp.ClientResponseError(
            request_info=Mock(),
            history=(),
            status=401,
            message="Unauthorized"
        )
        
        with patch.object(gateway, '_call_provider', side_effect=auth_error):
            with pytest.raises(GatewayError) as exc_info:
                await gateway.send_prompt(prompt)
            
            assert 'authentication' in str(exc_info.value).lower()
            assert exc_info.value.provider is not None
            
            # Provider should be marked as unavailable
            provider_status = await gateway.get_provider_status(exc_info.value.provider)
            assert provider_status == 'unavailable'
    
    @pytest.mark.asyncio
    async def test_network_failure_and_retry(self, gateway):
        """Test handling of network failures with retry logic"""
        prompt = TestPrompt(text="Test prompt")
        
        attempt_count = 0
        async def network_failure_then_success():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise aiohttp.ClientConnectionError("Network unreachable")
            return {'response': 'success'}
        
        with patch.object(gateway, '_call_provider', side_effect=network_failure_then_success):
            response = await gateway.send_prompt(prompt)
            
            assert response.success
            assert attempt_count == 3
            assert response.retry_count == 2
    
    @pytest.mark.asyncio
    async def test_concurrent_request_handling(self, gateway):
        """Test handling of high concurrent request load"""
        # Create 200 concurrent requests
        prompts = [
            TestPrompt(text=f"Prompt {i}", user_id=f"user-{i:04d}")
            for i in range(200)
        ]
        
        # Submit all concurrently
        tasks = [gateway.send_prompt(p) for p in prompts]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Should handle max 100 concurrent (configured limit)
        successful = [r for r in responses if not isinstance(r, Exception)]
        rate_limited = [r for r in responses if isinstance(r, RateLimitError)]
        
        assert len(successful) <= 100
        assert len(rate_limited) > 0  # Some should be rate limited
        
        # Verify concurrency was limited
        concurrency_stats = await gateway.get_concurrency_stats()
        assert concurrency_stats.max_concurrent <= 100
        assert concurrency_stats.queued_requests > 0
    
    @pytest.mark.asyncio
    async def test_malformed_response_handling(self, gateway):
        """Test handling of malformed API responses"""
        prompt = TestPrompt(text="Test prompt")
        
        # Mock various malformed responses
        malformed_responses = [
            None,
            "",
            "not json",
            {"incomplete": True},  # Missing required fields
            {"response": None},
            {"response": "", "error": "internal"}
        ]
        
        for bad_response in malformed_responses:
            with patch.object(gateway, '_call_provider', return_value=bad_response):
                response = await gateway.send_prompt(prompt)
                
                # Should fallback to next provider or handle gracefully
                assert response.had_error or response.provider_used != 'claude_sonnet_4'
    
    @pytest.mark.asyncio
    async def test_provider_service_degradation(self, gateway):
        """Test handling of provider service degradation"""
        prompt = TestPrompt(text="Test prompt")
        
        # Simulate degraded performance
        async def degraded_response():
            await asyncio.sleep(5)  # Slow response
            if asyncio.get_event_loop().time() % 2 == 0:
                raise Exception("Random failure")
            return {'response': 'degraded'}
        
        with patch.object(gateway, '_call_claude', side_effect=degraded_response):
            # Make multiple calls to detect degradation
            responses = []
            for _ in range(5):
                try:
                    response = await gateway.send_prompt(prompt)
                    responses.append(response)
                except:
                    pass
            
            # Should detect degradation and switch providers
            providers_used = [r.provider_used for r in responses if r]
            assert 'gpt_4o' in providers_used or 'gemini_15_pro' in providers_used
            
            # Check degradation detection
            health = await gateway.health_monitor.get_provider_health('claude_sonnet_4')
            assert health.status == 'degraded'
    
    @pytest.mark.asyncio
    async def test_token_limit_exceeded(self, gateway):
        """Test handling when token limits are exceeded"""
        # Create prompt exceeding token limits
        huge_prompt = TestPrompt(
            text="x" * 500000,  # Way over any model's limit
            user_id="user-014"
        )
        
        with pytest.raises(TokenCountError) as exc_info:
            await gateway.send_prompt(huge_prompt)
        
        assert exc_info.value.token_count > 200000
        assert exc_info.value.max_allowed > 0
        assert 'exceeds maximum' in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_memory_pressure_handling(self, gateway):
        """Test behavior under memory pressure"""
        # Simulate low memory conditions
        with patch('psutil.virtual_memory') as mock_memory:
            mock_memory.return_value.percent = 95  # 95% memory usage
            
            prompt = TestPrompt(text="Test prompt")
            response = await gateway.send_prompt(prompt)
            
            # Should use streaming or reduce batch sizes
            assert response.streaming_used or response.batch_size == 1
            
            # Cache should be reduced
            cache_stats = await gateway.optimizer.get_cache_stats()
            assert cache_stats.size < cache_stats.max_size * 0.5


class TestIntegrationScenarios:
    """Integration tests for complete workflows"""
    
    @pytest_asyncio.fixture
    async def full_gateway(self):
        """Fully configured gateway for integration testing"""
        config = {
            'providers': {
                'claude_sonnet_4': {'api_key': 'test-key', 'priority': 1},
                'gpt_4o': {'api_key': 'test-key', 'priority': 2},
                'gemini_15_pro': {'api_key': 'test-key', 'priority': 3},
                'gemini_15_flash': {'api_key': 'test-key', 'priority': 4}
            },
            'language_routing': {'enabled': True},
            'cost_management': {'enabled': True},
            'optimization': {'cache_enabled': True},
            'compliance': {'enforce_eu_residency': True}
        }
        return LLMAgentGateway(config)
    
    @pytest.mark.asyncio
    async def test_swedish_technical_query_workflow(self, full_gateway):
        """Test complete workflow for Swedish technical query"""
        prompt = TestPrompt(
            text="Förklara hur materialåtervinning fungerar i Sverige",
            user_id="swedish-user-001",
            task_type="analysis",
            budget=Decimal('1.00')
        )
        
        response = await full_gateway.send_prompt(prompt)
        
        # Verify complete workflow
        assert response.language_detected == 'sv'
        assert response.provider_used in ['claude_sonnet_4', 'gpt_4o']  # Swedish-capable
        assert response.endpoint_region.startswith('eu-')  # EU endpoint
        assert response.cost <= Decimal('1.00')  # Within budget
        assert response.pii_checked is True
        assert response.cache_checked is True
    
    @pytest.mark.asyncio
    async def test_batch_multilingual_processing(self, full_gateway):
        """Test batch processing of mixed Swedish and English prompts"""
        prompts = [
            TestPrompt(text="What is recycling?", language='en'),
            TestPrompt(text="Vad är återvinning?", language='sv'),
            TestPrompt(text="How does composting work?", language='en'),
            TestPrompt(text="Hur fungerar kompostering?", language='sv')
        ]
        
        batch_id = await full_gateway.submit_batch(prompts)
        results = await full_gateway.get_batch_results(batch_id)
        
        # Verify language-appropriate routing
        english_results = [r for r in results if r.language == 'en']
        swedish_results = [r for r in results if r.language == 'sv']
        
        assert len(english_results) == 2
        assert len(swedish_results) == 2
        
        # Check provider selection based on language
        for result in swedish_results:
            assert result.provider_used in ['claude_sonnet_4', 'gpt_4o']
        
        for result in english_results:
            assert result.provider_used in ['gemini_15_pro', 'gemini_15_flash']
    
    @pytest.mark.asyncio
    async def test_cost_optimized_simple_queries(self, full_gateway):
        """Test cost optimization for simple queries"""
        simple_queries = [
            "Hello",
            "What day is it?",
            "Simple math: 2+2",
            "Yes or no?"
        ]
        
        total_cost = Decimal('0')
        for query in simple_queries:
            prompt = TestPrompt(text=query, task_type="simple_query")
            response = await full_gateway.send_prompt(prompt)
            
            # Should use cheapest provider
            assert response.provider_used == 'gemini_15_flash'
            assert response.cost <= Decimal('0.01')
            total_cost += response.cost
        
        # Total cost should be minimal
        assert total_cost <= Decimal('0.04')
    
    @pytest.mark.asyncio
    async def test_failover_with_compliance(self, full_gateway):
        """Test failover while maintaining EU compliance"""
        prompt = TestPrompt(
            text="Test query requiring failover",
            user_id="eu-user-015",
            source_region="eu-north-1"
        )
        
        # Mock Claude EU endpoint failure
        with patch.object(full_gateway, '_call_claude_eu', 
                         side_effect=ProviderUnavailableError):
            response = await full_gateway.send_prompt(prompt)
            
            # Should failover to another EU provider
            assert response.provider_used != 'claude_sonnet_4'
            assert response.endpoint_region.startswith('eu-')
            assert response.compliance_maintained is True
    
    @pytest.mark.asyncio
    async def test_high_load_performance(self, full_gateway):
        """Test gateway performance under high load"""
        # Generate 1000 varied prompts
        prompts = []
        for i in range(1000):
            language = 'sv' if i % 2 == 0 else 'en'
            text = f"Query {i}" if language == 'en' else f"Fråga {i}"
            prompts.append(TestPrompt(
                text=text,
                user_id=f"user-{i % 100:03d}",
                task_type="simple_query" if i % 3 == 0 else "analysis"
            ))
        
        start_time = time.time()
        
        # Process all prompts
        tasks = [full_gateway.send_prompt(p) for p in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        elapsed = time.time() - start_time
        
        # Performance assertions
        successful = [r for r in results if not isinstance(r, Exception)]
        assert len(successful) >= 900  # At least 90% success rate
        assert elapsed < 60  # Process 1000 requests in under 60 seconds
        
        # Verify caching helped
        cache_stats = await full_gateway.optimizer.get_cache_stats()
        assert cache_stats.hits > 0  # Some cache hits expected
        
        # Check cost optimization
        total_cost = sum(r.cost for r in successful if hasattr(r, 'cost'))
        avg_cost = total_cost / len(successful)
        assert avg_cost < Decimal('0.01')  # Efficient routing kept costs low


if __name__ == "__main__":
    # Run tests with coverage
    pytest.main([
        __file__,
        '-v',
        '--cov=src.services.llm_agent_gateway',
        '--cov-report=html',
        '--cov-report=term-missing',
        '--cov-fail-under=95',
        '-n', 'auto'  # Parallel execution
    ])