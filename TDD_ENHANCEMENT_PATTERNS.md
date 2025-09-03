# TDD Enhancement Patterns for SVOA Lea Platform Tasks

## Executive Summary
This document provides specific enhancement patterns to apply across all 32 TDD-structured tasks for the SVOA Lea platform to ensure robust autonomous execution by AI IDE Agents in Archon.

## Core Enhancement Patterns

### 1. RED Phase Enhancements (Test First)

#### 1.1 TDD Agent Integration Pattern
```markdown
**RED Phase TDD Agent Protocol:**
1. **Initial Test Generation Call:**
   ```
   Call TDD Agent with parameters:
   - Context: [Feature area] + [Swedish regulatory requirements]
   - Test Framework: pytest/jest depending on stack
   - Coverage Target: 95% for critical paths, 80% minimum overall
   - Localization: Include Swedish test cases for all user-facing features
   ```

2. **Test Structure Requirements:**
   - Unit tests: Core logic isolation
   - Integration tests: Cross-component validation
   - Contract tests: API boundary validation
   - Property tests: Fuzzing with hypothesis/fast-check
   - Performance tests: Benchmarking with metrics
   - Resilience tests: Failure scenario coverage
```

#### 1.2 PII Detection Test Pattern
```python
# Example for every data-handling component
def test_pii_detection_swedish_personnummer():
    """Test Swedish personal identification number detection"""
    test_cases = [
        ("19900101-1234", True),  # Standard format
        ("900101-1234", True),     # Short format
        ("19900101+1234", True),   # 100+ years old format
        ("Data from 19900101-1234 user", True),  # Embedded
    ]
    
    for text, should_detect in test_cases:
        assert pii_detector.scan_swedish(text) == should_detect

def test_pii_masking_preserves_context():
    """Ensure PII masking maintains semantic meaning"""
    original = "User 19900101-1234 reported issue"
    masked = pii_masker.mask(original)
    assert "User [PERSONNUMMER] reported issue" == masked
    assert pii_masker.can_unmask(masked, authorized=True) == original
```

#### 1.3 Resilience Test Pattern for AI Components
```python
# Pattern for LLM Gateway, RAG, Scenario Engine
def test_llm_gateway_cascading_fallback():
    """Test multi-tier fallback strategy"""
    with mock_providers() as mocks:
        # Primary failure
        mocks.claude_sonnet.fail_with(ServiceUnavailable)
        # Secondary failure  
        mocks.gpt4o.fail_with(RateLimitError)
        # Tertiary succeeds
        mocks.gemini_pro.respond_normally()
        
        response = llm_gateway.complete(prompt)
        assert response.provider == "gemini-1.5-pro"
        assert response.fallback_count == 2
        
def test_local_llm_fallback_mode():
    """Test Ollama local model activation"""
    with simulate_cloud_outage():
        response = llm_gateway.complete(prompt, allow_local=True)
        assert response.provider == "ollama:mistral"
        assert response.quality_degradation_warning == True
```

### 2. GREEN Phase Enhancements (Implementation)

#### 2.1 Claude Code Project Index Integration Pattern
```markdown
**GREEN Phase Implementation Protocol:**

1. **Project Index Reference:**
   ```yaml
   # At start of implementation
   Project-Index-Query:
     - Search: "similar implementations in codebase"
     - Pattern: "existing [feature_type] components"
     - Context: "Swedish localization patterns"
   ```

2. **Reusable Component Discovery:**
   ```
   Before implementing:
   - Query: "existing validation utilities"
   - Query: "Swedish formatting helpers"
   - Query: "PII detection implementations"
   - Query: "error handling patterns"
   ```

3. **Import Optimization:**
   ```python
   # Discover and reuse existing utilities
   from src.utils.swedish import format_personnummer, validate_org_number
   from src.core.pii import PresidioSwedishAnalyzer
   from src.resilience import CircuitBreaker, RetryWithBackoff
   ```
```

#### 2.2 Hybrid Compute Pattern
```python
# Implementation pattern for resource-intensive AI operations
class HybridLLMProcessor:
    def __init__(self):
        self.local_models = OllamaPool(
            models=["mistral", "llama2"],
            max_workers=4
        )
        self.cloud_models = CloudGateway(
            providers=["claude", "gpt4", "gemini"],
            budget_tracker=BudgetManager()
        )
    
    async def process(self, task: Task) -> Result:
        # Intelligent routing based on task complexity
        if task.is_simple_classification():
            return await self.local_models.process(task)
        elif task.requires_high_accuracy():
            return await self.cloud_models.process(task)
        else:
            # Hybrid approach: local preprocessing + cloud refinement
            draft = await self.local_models.draft(task)
            return await self.cloud_models.refine(draft, task)
```

#### 2.3 Swedish Localization Pattern
```python
# Pattern for all user-facing components
class SwedishLocalizedComponent:
    def __init__(self):
        self.locale_detector = LocaleDetector()
        self.formatters = {
            'sv_SE': SwedishFormatter(),
            'en_US': EnglishFormatter()
        }
        
    def format_output(self, data: Any) -> str:
        locale = self.locale_detector.current()
        formatter = self.formatters[locale]
        
        # Apply Swedish-specific rules
        if locale == 'sv_SE':
            data = self._apply_swedish_rules(data)
            
        return formatter.format(data)
    
    def _apply_swedish_rules(self, data):
        # Swedish-specific transformations
        # - Decimal comma instead of point
        # - Date format: YYYY-MM-DD
        # - Week starts on Monday
        # - Currency: SEK formatting
        return swedish_transformer.apply(data)
```

### 3. REFACTOR Phase Enhancements

#### 3.1 Performance Optimization Pattern
```markdown
**REFACTOR Phase Optimization Protocol:**

1. **Query Claude Code Index for Optimizations:**
   ```
   - "Performance bottlenecks in similar features"
   - "Caching strategies used in project"
   - "Database query optimization patterns"
   ```

2. **Apply Standard Optimizations:**
   - Response caching with Redis
   - Query result memoization
   - Batch processing for bulk operations
   - Connection pooling for database
   - Lazy loading for heavy components
```

#### 3.2 Observability Enhancement Pattern
```python
# Standard observability wrapper for all components
@trace_performance
@log_errors
@emit_metrics
class ObservableComponent:
    def __init__(self):
        self.tracer = OpenTelemetryTracer()
        self.metrics = PrometheusCollector()
        
    @instrument(name="component.operation")
    async def operation(self, input: Input) -> Output:
        with self.tracer.span("operation") as span:
            span.set_attribute("input.size", len(input))
            span.set_attribute("locale", detect_locale())
            
            try:
                result = await self._process(input)
                self.metrics.increment("success")
                return result
            except Exception as e:
                self.metrics.increment("failure")
                span.record_exception(e)
                raise
```

### 4. Cross-Cutting Enhancement Patterns

#### 4.1 Compliance Validation Pattern
```python
# Apply to all data-handling components
class ComplianceValidator:
    def validate_eu_residency(self, data_location: str) -> bool:
        """Ensure data stays within EU/EES regions"""
        return data_location in EU_EES_REGIONS
    
    def validate_retention(self, timestamp: datetime) -> bool:
        """Ensure 5-year retention compliance"""
        age = datetime.now() - timestamp
        return age.days <= (5 * 365)
    
    def validate_gdpr_consent(self, operation: str) -> bool:
        """Verify GDPR consent for operation"""
        return consent_manager.has_valid_consent(operation)
```

#### 4.2 Swedish Edge Case Pattern
```python
# Swedish-specific edge cases for all components
SWEDISH_EDGE_CASES = {
    'dates': [
        '2024-02-29',  # Leap year
        '2024-06-06',  # National Day
        '2024-12-13',  # Lucia
        '2024-W52',    # Week numbering
    ],
    'text': [
        'Åsa Öström',   # Swedish characters
        'Räksmörgås',   # Special characters
        'AB & Co',      # Mixed entities
    ],
    'numbers': [
        '1 234,56',     # Swedish number format
        '12,5%',        # Percentage format
        'SEK 1.234,50', # Currency format
    ],
    'identifiers': [
        '556677-8899',  # Organization number
        '19121212-1212', # Personnummer (historic)
        'SE556677889901', # VAT number
    ]
}
```

#### 4.3 Resource Management Pattern
```python
# Pattern for compute-intensive operations
class ResourceManager:
    def __init__(self):
        self.budget = ComputeBudget(
            daily_limit_usd=100,
            alert_threshold=0.8
        )
        self.scheduler = AdaptiveScheduler()
        
    async def execute_with_budget(self, task: Task):
        cost_estimate = self.estimate_cost(task)
        
        if not self.budget.can_afford(cost_estimate):
            # Fallback to local processing
            return await self.execute_locally(task)
            
        # Track actual usage
        with self.budget.track(task):
            result = await self.execute_cloud(task)
            
        return result
```

### 5. Task-Specific Enhancement Templates

#### 5.1 For AI-Heavy Tasks (LLM Gateway, RAG, Agent Tools)
```markdown
**Enhanced RED Phase:**
- Test prompt injection resistance
- Test Swedish/English context switching
- Test token limit handling
- Test streaming response interruption
- Test concurrent request handling

**Enhanced GREEN Phase:**
- Implement prompt templates with version control
- Add request queuing and prioritization
- Include token counting pre-flight checks
- Add response caching with semantic similarity

**Enhanced REFACTOR Phase:**
- Optimize prompt length without quality loss
- Implement adaptive model selection
- Add performance profiling hooks
- Include cost tracking per request
```

#### 5.2 For Data Processing Tasks (Ingestion, Validation, Normalization)
```markdown
**Enhanced RED Phase:**
- Test Swedish CSV delimiter variations (semicolon)
- Test Excel sheets with Swedish formulas
- Test malformed date formats (Swedish holidays)
- Test large file streaming (>100MB)
- Test concurrent file processing

**Enhanced GREEN Phase:**
- Implement streaming parsers for memory efficiency
- Add Swedish dictionary for fuzzy matching
- Include holiday calendar for date validation
- Add checkpointing for resumable processing

**Enhanced REFACTOR Phase:**
- Optimize with parallel processing where applicable
- Add memory-mapped file handling
- Implement adaptive batch sizing
- Include progress reporting via SSE
```

#### 5.3 For UI/UX Tasks (Dashboard, Reporting, Visualization)
```markdown
**Enhanced RED Phase:**
- Test Swedish screen reader compatibility
- Test mobile touch interactions (swipe, pinch)
- Test offline-first functionality
- Test print stylesheets for reports
- Test keyboard navigation completeness

**Enhanced GREEN Phase:**
- Implement progressive enhancement
- Add Swedish date/number formatting
- Include loading skeletons for all async content
- Add error boundaries with Swedish messages

**Enhanced REFACTOR Phase:**
- Optimize bundle size with code splitting
- Implement virtual scrolling for large lists
- Add service worker for offline support
- Include lighthouse score optimization
```

### 6. Integration Test Enhancement Pattern

```python
# Standard integration test pattern for all components
class IntegrationTestPattern:
    @pytest.fixture
    def swedish_test_environment(self):
        """Setup Swedish-specific test environment"""
        return {
            'locale': 'sv_SE',
            'timezone': 'Europe/Stockholm',
            'currency': 'SEK',
            'date_format': '%Y-%m-%d',
            'number_format': {'decimal': ',', 'thousands': ' '}
        }
    
    def test_end_to_end_swedish_workflow(self, swedish_test_environment):
        """Test complete Swedish user journey"""
        # 1. Ingestion with Swedish Excel
        file = upload_swedish_excel('test_data_åäö.xlsx')
        
        # 2. Validation with Swedish rules
        validated = validate_with_rules(file, locale='sv_SE')
        
        # 3. Processing with PII detection
        processed = process_with_pii_scan(validated)
        
        # 4. Report generation in Swedish
        report = generate_report(processed, language='swedish')
        
        # Assert Swedish-specific outputs
        assert 'Sammanfattning' in report
        assert report.numbers_use_comma_decimal()
        assert report.dates_are_iso_format()
```

### 7. Performance Benchmark Pattern

```python
# Standard performance benchmark for all components
class PerformanceBenchmark:
    TARGETS = {
        'ingestion': 120,  # seconds for file parsing
        'scenario': 60,    # seconds for scenario execution
        'report': 10,      # seconds for report generation
        'ui_response': 1.5, # seconds for page load
    }
    
    @benchmark(max_time=TARGETS['ingestion'])
    def test_ingestion_performance(self):
        """Ensure ingestion meets <2min target"""
        large_file = generate_test_file(rows=50000)
        start = time.time()
        result = ingest_file(large_file)
        duration = time.time() - start
        
        assert duration < self.TARGETS['ingestion']
        assert result.rows_processed == 50000
```

### 8. Archon-Specific Task Enhancement

```markdown
## Task Enhancement Checklist for Archon

For each task, ensure:

### RED Phase Additions:
- [ ] TDD Agent call specified with exact parameters
- [ ] Swedish edge cases included in test data
- [ ] PII detection tests for Swedish formats
- [ ] Fallback strategy tests for AI components
- [ ] Performance benchmarks defined
- [ ] Compliance validation tests included

### GREEN Phase Additions:
- [ ] Claude Code Index queries documented
- [ ] Existing component reuse identified
- [ ] Hybrid compute strategy defined
- [ ] Swedish localization implemented
- [ ] Observability hooks added
- [ ] Error recovery mechanisms included

### REFACTOR Phase Additions:
- [ ] Performance profiling completed
- [ ] Caching strategy implemented
- [ ] Resource usage optimized
- [ ] Code splitting applied (frontend)
- [ ] Database queries optimized
- [ ] Documentation updated

### Integration Points:
- [ ] API contracts tested
- [ ] Database migrations verified
- [ ] UI components accessibility tested
- [ ] Security boundaries validated
- [ ] Audit trails confirmed
- [ ] Monitoring alerts configured
```

## Example Enhanced Task Structure

```markdown
### Task: Build LLM Agent Gateway with Model Router

**ENHANCED RED PHASE:**
1. **TDD Agent Integration:**
   ```
   Call TDD_Agent.generate_tests({
     feature: "LLM Gateway",
     frameworks: ["pytest", "hypothesis"],
     coverage_target: 95,
     special_cases: [
       "Swedish prompt handling",
       "Token limit edge cases",
       "Provider outage scenarios",
       "Budget exhaustion handling"
     ]
   })
   ```

2. **Core Test Suite:**
   - Provider fallback cascade tests
   - Swedish/English routing tests
   - Budget enforcement tests
   - Ollama local fallback tests
   - Concurrent request handling tests
   - Token counting accuracy tests
   - Response streaming tests
   - Cost tracking precision tests

3. **PII/Compliance Tests:**
   - Swedish personnummer detection in prompts
   - GDPR compliance for prompt logging
   - EU region enforcement tests

**ENHANCED GREEN PHASE:**
1. **Claude Code Index Queries:**
   - Query: "existing retry mechanisms"
   - Query: "current cache implementations"
   - Query: "Swedish text processors"

2. **Implementation with Reuse:**
   ```python
   from existing.resilience import CircuitBreaker
   from existing.swedish import TextNormalizer
   from existing.cache import SemanticCache
   
   class LLMGateway:
       def __init__(self):
           self.circuit_breaker = CircuitBreaker()
           self.text_normalizer = TextNormalizer('sv_SE')
           self.cache = SemanticCache(threshold=0.95)
   ```

3. **Hybrid Compute Strategy:**
   - Use Ollama for draft responses
   - Use Claude for final refinement
   - Implement cost-based routing

**ENHANCED REFACTOR PHASE:**
1. **Performance Optimizations:**
   - Implement request batching
   - Add predictive pre-caching
   - Optimize prompt templates

2. **Resource Management:**
   - Add adaptive rate limiting
   - Implement cost forecasting
   - Add usage analytics

3. **Observability:**
   - Add distributed tracing
   - Implement custom metrics
   - Add performance profiling
```

## Conclusion

These enhancement patterns ensure that all 32 tasks are:
1. **Testable**: With comprehensive TDD coverage including Swedish edge cases
2. **Resilient**: With fallback strategies and error recovery
3. **Compliant**: With EU/EES regulations and GDPR
4. **Performant**: With defined benchmarks and optimization strategies
5. **Observable**: With proper monitoring and tracing
6. **Autonomous-Ready**: With clear integration points for AI IDE agents

Apply these patterns consistently across all tasks to achieve a robust, production-ready SVOA Lea platform.