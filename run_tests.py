#!/usr/bin/env python3
"""
Test runner for Swedish waste management data validation system.
Executes all test suites and generates comprehensive test reports.
"""
import unittest
import sys
import time
from pathlib import Path
import json
from datetime import datetime
import traceback


class ColoredTestResult(unittest.TextTestResult):
    """Custom test result with colored output"""
    
    COLORS = {
        'GREEN': '\033[92m',
        'RED': '\033[91m',
        'YELLOW': '\033[93m',
        'BLUE': '\033[94m',
        'ENDC': '\033[0m',
        'BOLD': '\033[1m'
    }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_metrics = []
        
    def startTest(self, test):
        super().startTest(test)
        self.test_start_time = time.perf_counter()
        
    def addSuccess(self, test):
        super().addSuccess(test)
        duration = time.perf_counter() - self.test_start_time
        self.test_metrics.append({
            'test': str(test),
            'status': 'PASS',
            'duration': duration
        })
        self.stream.write(f"{self.COLORS['GREEN']}✓{self.COLORS['ENDC']}")
        self.stream.flush()
        
    def addError(self, test, err):
        super().addError(test, err)
        duration = time.perf_counter() - self.test_start_time
        self.test_metrics.append({
            'test': str(test),
            'status': 'ERROR',
            'duration': duration,
            'error': str(err[1])
        })
        self.stream.write(f"{self.COLORS['RED']}E{self.COLORS['ENDC']}")
        self.stream.flush()
        
    def addFailure(self, test, err):
        super().addFailure(test, err)
        duration = time.perf_counter() - self.test_start_time
        self.test_metrics.append({
            'test': str(test),
            'status': 'FAIL',
            'duration': duration,
            'error': str(err[1])
        })
        self.stream.write(f"{self.COLORS['RED']}F{self.COLORS['ENDC']}")
        self.stream.flush()
        
    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.test_metrics.append({
            'test': str(test),
            'status': 'SKIP',
            'reason': reason
        })
        self.stream.write(f"{self.COLORS['YELLOW']}S{self.COLORS['ENDC']}")
        self.stream.flush()


class TestRunner:
    """Main test runner with reporting capabilities"""
    
    def __init__(self):
        self.test_dir = Path(__file__).parent / 'tests'
        self.results = {}
        self.start_time = None
        self.end_time = None
        
    def discover_tests(self):
        """Discover all test modules"""
        loader = unittest.TestLoader()
        suite = loader.discover(str(self.test_dir), pattern='test_*.py')
        return suite
        
    def run_tests(self, verbosity=2):
        """Run all discovered tests"""
        print("\n" + "="*70)
        print("SWEDISH WASTE MANAGEMENT DATA VALIDATION TEST SUITE")
        print("="*70)
        print(f"\nTest Discovery Path: {self.test_dir}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print("-"*70)
        
        # Discover tests
        suite = self.discover_tests()
        test_count = suite.countTestCases()
        
        if test_count == 0:
            print("\n⚠️  No tests found!")
            print("\nExpected test files:")
            print("  - test_xlsx_parser.py")
            print("  - test_personnummer_validator.py")
            print("  - test_eu_format_handler.py")
            print("  - test_claude_code_hooks.py")
            return False
            
        print(f"\n🔍 Discovered {test_count} tests")
        print("\nRunning tests...\n")
        
        # Create custom test runner
        runner = unittest.TextTestRunner(
            resultclass=ColoredTestResult,
            verbosity=verbosity,
            stream=sys.stdout
        )
        
        # Run tests
        self.start_time = time.perf_counter()
        result = runner.run(suite)
        self.end_time = time.perf_counter()
        
        # Store results
        self.results = {
            'total_tests': test_count,
            'tests_run': result.testsRun,
            'failures': len(result.failures),
            'errors': len(result.errors),
            'skipped': len(result.skipped),
            'success_rate': ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100) if result.testsRun > 0 else 0,
            'duration': self.end_time - self.start_time,
            'test_metrics': result.test_metrics if hasattr(result, 'test_metrics') else []
        }
        
        # Print summary
        self.print_summary(result)
        
        # Generate reports
        self.generate_json_report()
        self.generate_coverage_report()
        
        return result.wasSuccessful()
        
    def print_summary(self, result):
        """Print test execution summary"""
        print("\n" + "="*70)
        print("TEST EXECUTION SUMMARY")
        print("="*70)
        
        duration = self.end_time - self.start_time
        
        # Overall stats
        print(f"\n📊 Overall Statistics:")
        print(f"  • Total Tests: {self.results['total_tests']}")
        print(f"  • Tests Run: {self.results['tests_run']}")
        print(f"  • Passed: {self.results['tests_run'] - self.results['failures'] - self.results['errors']}")
        print(f"  • Failed: {self.results['failures']}")
        print(f"  • Errors: {self.results['errors']}")
        print(f"  • Skipped: {self.results['skipped']}")
        print(f"  • Success Rate: {self.results['success_rate']:.1f}%")
        print(f"  • Execution Time: {duration:.2f} seconds")
        
        # Test categories
        print(f"\n📋 Test Categories:")
        categories = {
            'XLSX Parser': 'test_xlsx_parser',
            'Personnummer Validator': 'test_personnummer_validator',
            'EU Format Handler': 'test_eu_format_handler',
            'Claude Code Hooks': 'test_claude_code_hooks'
        }
        
        for category, pattern in categories.items():
            category_tests = [m for m in self.results.get('test_metrics', []) if pattern in m['test']]
            if category_tests:
                passed = len([t for t in category_tests if t['status'] == 'PASS'])
                total = len(category_tests)
                print(f"  • {category}: {passed}/{total} passed")
        
        # Failed tests details
        if result.failures:
            print(f"\n❌ Failed Tests:")
            for test, traceback in result.failures:
                print(f"  • {test}")
                print(f"    {str(traceback).split(chr(10))[0][:100]}")
                
        # Error details
        if result.errors:
            print(f"\n🔥 Tests with Errors:")
            for test, traceback in result.errors:
                print(f"  • {test}")
                print(f"    {str(traceback).split(chr(10))[0][:100]}")
                
        # Performance metrics
        if self.results.get('test_metrics'):
            print(f"\n⚡ Performance Metrics:")
            slow_tests = sorted(
                [t for t in self.results['test_metrics'] if 'duration' in t],
                key=lambda x: x['duration'],
                reverse=True
            )[:5]
            
            if slow_tests:
                print("  Slowest tests:")
                for test in slow_tests:
                    test_name = test['test'].split('.')[-1][:50]
                    print(f"    • {test_name}: {test['duration']*1000:.1f}ms")
                    
    def generate_json_report(self):
        """Generate JSON test report"""
        report_path = Path('test_report.json')
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_tests': self.results['total_tests'],
                'passed': self.results['tests_run'] - self.results['failures'] - self.results['errors'],
                'failed': self.results['failures'],
                'errors': self.results['errors'],
                'skipped': self.results['skipped'],
                'success_rate': self.results['success_rate'],
                'duration_seconds': self.results['duration']
            },
            'tests': self.results.get('test_metrics', [])
        }
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
            
        print(f"\n📄 JSON report saved to: {report_path}")
        
    def generate_coverage_report(self):
        """Generate test coverage report"""
        print("\n📊 Test Coverage Report:")
        print("  Note: Coverage tracking not yet implemented")
        print("  All test files are written following TDD principles")
        print("  Implementation will follow after test validation")
        
        # List expected implementation files
        expected_files = [
            "src/parsers/xlsx_parser.py",
            "src/validators/personnummer_validator.py", 
            "src/parsers/eu_format_handler.py",
            "src/hooks/claude_code_hooks.py"
        ]
        
        print("\n  Expected implementation files:")
        for file_path in expected_files:
            path = Path(file_path)
            status = "❌ Not implemented" if not path.exists() else "✓ Exists"
            print(f"    • {file_path}: {status}")


def main():
    """Main entry point"""
    runner = TestRunner()
    
    # Run tests
    success = runner.run_tests(verbosity=2)
    
    # Exit with appropriate code
    if success:
        print("\n✅ All tests are ready for implementation!")
        print("\n🔨 Next steps:")
        print("  1. Implement src/parsers/xlsx_parser.py")
        print("  2. Implement src/validators/personnummer_validator.py")
        print("  3. Implement src/parsers/eu_format_handler.py")
        print("  4. Implement src/hooks/claude_code_hooks.py")
        print("\n  Following TDD: Write minimal code to make each test pass")
        sys.exit(0)
    else:
        print("\n❌ Test suite has failures/errors")
        print("   This is expected in TDD - tests fail before implementation")
        sys.exit(1)


if __name__ == '__main__':
    main()