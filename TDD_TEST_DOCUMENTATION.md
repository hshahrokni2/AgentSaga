# Swedish Waste Management Data Validation - TDD Test Suite

## 🎯 Overview

This test suite demonstrates **Test-Driven Development (TDD)** principles for a Swedish waste management data validation system. All tests are written **before implementation**, following the Red-Green-Refactor cycle.

## 🔴 Current Status: RED Phase

All tests are currently **FAILING** as expected in TDD. This is intentional - we write tests first to define the expected behavior, then implement code to make them pass.

## 📋 Test Categories

### 1. XLSX Parser Tests (`test_xlsx_parser.py`)
**Purpose**: Validate Excel file parsing with Swedish character support

#### Test Coverage:
- **Swedish Character Handling** (15 tests)
  - Column headers with åäö/ÅÄÖ
  - Cell data with Swedish characters
  - Mixed encoding scenarios
  - UTF-8 validation

- **File Validation** (8 tests)
  - Invalid format detection
  - Corrupted file handling
  - Empty file processing
  - Large file streaming

- **Performance Requirements** (3 tests)
  - Small files: < 100ms parsing
  - Large files: < 5 seconds for 10k rows
  - Memory usage: < 100MB for large files

#### Key Features Tested:
```python
# Swedish character support
df = pd.DataFrame({'Återvinning': ['Plåtburkar'], 'Mängd': [100.5]})
result = parser.parse(test_file)
assert 'Återvinning' in result.columns

# Streaming for large files
for chunk in parser.parse_stream(large_file, chunksize=1000):
    assert len(chunk) <= 1000
```

### 2. Personnummer Validator Tests (`test_personnummer_validator.py`)
**Purpose**: GDPR-compliant Swedish personnummer validation and redaction

#### Test Coverage:
- **Validation Rules** (12 tests)
  - Luhn checksum algorithm
  - 10 and 12-digit formats
  - Century markers (+/-)
  - Coordination numbers (day + 60)
  - Temporary T-numbers

- **Data Extraction** (6 tests)
  - Birth date parsing
  - Gender determination (odd=male, even=female)
  - Age calculation
  - Invalid date detection

- **GDPR Redaction** (10 tests)
  - Complete masking: `XXXXXXXXXX`
  - Partial masking: `1990XXXX-XXXX`
  - Batch redaction in DataFrames
  - Audit log generation

#### Key Validation Examples:
```python
# Valid formats tested
'19900101-2389'  # 12-digit with hyphen
'900101+2385'    # Century marker for 100+ years
'19900161-2385'  # Coordination number

# Redaction modes
text = "Customer: 19900101-2389"
redacted = redactor.redact_text(text, mode='partial')
# Result: "Customer: 1990XXXX-XXXX"
```

### 3. EU Format Handler Tests (`test_eu_format_handler.py`)
**Purpose**: Handle EU date formats and decimal comma conversions

#### Test Coverage:
- **Date Format Support** (15 tests)
  - ISO: `2024-01-15`
  - European: `15/01/2024`, `15.01.2024`
  - Swedish text: `15 januari 2024`
  - Ambiguous format detection
  - Two-digit year handling

- **Decimal Conversion** (12 tests)
  - Swedish format: `1 234,56` → `1234.56`
  - US format: `1,234.56` → `1234.56`
  - Percentage parsing: `45,5%` → `0.455`
  - Currency handling: `1 234 kr` → `1234`

- **Auto-Detection** (5 tests)
  - Format detection confidence scoring
  - Mixed content analysis
  - Column type inference

#### Format Examples:
```python
# Swedish decimal with space thousands separator
converter.to_decimal('1 234,56', locale='sv_SE')  # → Decimal('1234.56')

# Swedish month names
parser.parse('15 januari 2024', locale='sv_SE')  # → date(2024, 1, 15)

# Ambiguous dates with hints
parser.parse('01/02/2024', format_hint='DMY')  # → Feb 1, 2024
```

### 4. Claude Code Hooks Tests (`test_claude_code_hooks.py`)
**Purpose**: Integration with Claude Code's hook system and MCP tools

#### Test Coverage:
- **File Validation Hooks** (8 tests)
  - Pre-read validation
  - Pre-write validation
  - GDPR compliance checks
  - File size limits
  - Extension validation

- **MCP Tool Integration** (6 tests)
  - Tool registration
  - Async tool execution
  - Resource access
  - Error handling

- **Hook Management** (10 tests)
  - Hook chain execution
  - Priority ordering
  - Context mutation
  - Conditional execution
  - Metrics collection

#### Hook Examples:
```python
# Pre-read validation hook
@PreProcessHook
def validate_file(context):
    if context.file_path.endswith('.xlsx'):
        # Check for personnummer
        # Validate encoding
        # Check file size
        return ValidationResult(is_valid=True)

# MCP tool registration
mcp.register_tool({
    'name': 'validate_swedish_data',
    'handler': swedish_validator,
    'parameters': {...}
})
```

## 🔨 TDD Implementation Strategy

### Phase 1: Red (Current State)
✅ **COMPLETED** - All tests written and failing
- 90+ test cases defined
- Clear specifications for each component
- Performance benchmarks established

### Phase 2: Green (Next Steps)
🔜 **TODO** - Implement minimal code to pass tests

1. **Start with simplest tests**
   - Basic file reading
   - Simple validation rules
   - Basic format detection

2. **Incremental Implementation**
   ```python
   # Step 1: Make simple test pass
   class SwedishXLSXParser:
       def parse(self, file_path):
           return pd.read_excel(file_path)
   
   # Step 2: Add Swedish character support
   # Step 3: Add validation
   # Step 4: Add streaming
   ```

3. **Run tests after each change**
   ```bash
   python run_tests.py
   ```

### Phase 3: Refactor
🔜 **TODO** - Optimize and clean up code
- Extract common patterns
- Improve performance
- Add documentation

## 📊 Test Metrics

### Coverage Goals
- **Line Coverage**: Target 95%+
- **Branch Coverage**: Target 90%+
- **Test Execution**: All tests < 10 seconds
- **Individual Test**: < 1 second each

### Current Statistics
```
Total Tests: 90+
Categories: 4
Test Files: 4
Status: 🔴 All Failing (TDD Phase 1)
```

## 🚀 Running the Tests

### Setup Environment
```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
python run_tests.py

# Run specific test file
python -m pytest tests/test_xlsx_parser.py -v

# Run with coverage
python -m pytest --cov=src tests/
```

### Expected Output (TDD Phase 1)
```
======================================================================
SWEDISH WASTE MANAGEMENT DATA VALIDATION TEST SUITE
======================================================================
🔍 Discovered 90+ tests

Running tests...
[Multiple 'E' for errors - this is expected!]

❌ All tests failing - Ready for implementation!
```

## 🏗️ Implementation Order

Recommended order for implementing components:

1. **Basic Infrastructure**
   - Exception classes
   - Base validator classes
   - Utility functions

2. **XLSX Parser**
   - Basic pandas integration
   - Character encoding
   - Error handling

3. **EU Format Handler**
   - Date parsing
   - Decimal conversion
   - Format detection

4. **Personnummer Validator**
   - Luhn algorithm
   - Date extraction
   - Redaction logic

5. **Claude Code Hooks**
   - Hook manager
   - MCP integration
   - Async support

## 📝 Test Quality Checklist

Each test follows these principles:

- [x] **Isolated**: No dependencies between tests
- [x] **Repeatable**: Same result every run
- [x] **Self-Validating**: Clear pass/fail
- [x] **Timely**: Written before code
- [x] **Fast**: Sub-second execution
- [x] **Comprehensive**: Edge cases covered
- [x] **Documented**: Clear test names and comments

## 🔍 Test Patterns Used

### AAA Pattern (Arrange-Act-Assert)
```python
def test_parse_swedish_characters(self):
    # Arrange
    test_file = create_test_file_with_swedish_chars()
    
    # Act
    result = parser.parse(test_file)
    
    # Assert
    self.assertIn('Återvinning', result.columns)
```

### Test Fixtures
```python
def setUp(self):
    self.parser = SwedishXLSXParser()
    self.test_dir = Path(tempfile.mkdtemp())
    
def tearDown(self):
    shutil.rmtree(self.test_dir)
```

### Parameterized Tests
```python
test_cases = [
    ('19900101-2389', True),
    ('invalid', False),
]
for pnr, expected in test_cases:
    with self.subTest(pnr=pnr):
        self.assertEqual(validator.is_valid(pnr), expected)
```

## 🎓 TDD Benefits Demonstrated

1. **Clear Specifications**: Tests define exact behavior
2. **Design First**: API designed through test writing
3. **Safety Net**: Refactoring protected by tests
4. **Documentation**: Tests serve as usage examples
5. **Quality Gates**: Performance requirements enforced
6. **GDPR Compliance**: Privacy requirements tested

## 🔗 Integration with Claude Code

The test suite specifically validates:

1. **File Operations**: Compatible with Claude Code's file handling
2. **Hook System**: Integrates with Claude Code's hook architecture
3. **MCP Tools**: Validates as MCP-compatible tools
4. **Async Support**: Works with Claude Code's async operations
5. **Error Handling**: Proper exception propagation

## 📚 Resources

- [TDD Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Swedish Personnummer Specification](https://www.skatteverket.se/privat/personnummer)
- [EU Data Formats](https://ec.europa.eu/eurostat/data/metadata/date-and-time-formats)
- [Claude Code Documentation](/docs)

---

**Remember**: In TDD, failing tests are a sign of progress! They define what needs to be built. 🚀