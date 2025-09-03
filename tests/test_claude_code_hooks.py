"""
Test suite for Claude Code hooks integration with MCP tools.
Following TDD principles - tests written before implementation.
"""
import unittest
from unittest.mock import Mock, patch, MagicMock, AsyncMock, call
import asyncio
import json
from pathlib import Path
import tempfile
from typing import Dict, Any, List

# Import modules to be tested (will fail initially)
from src.hooks.claude_code_hooks import (
    ClaudeCodeHookManager,
    FileValidationHook,
    MCPToolIntegration,
    HookExecutionError,
    ValidationResult,
    HookContext,
    PreProcessHook,
    PostProcessHook,
    ErrorHook
)


class TestFileValidationHook(unittest.TestCase):
    """Test file validation hooks for Claude Code integration"""
    
    def setUp(self):
        self.hook = FileValidationHook()
        self.test_dir = Path(tempfile.mkdtemp())
        
    def tearDown(self):
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
        
    def test_pre_read_validation_hook(self):
        """Test hook that validates files before Claude Code reads them"""
        # Create test file
        test_file = self.test_dir / "waste_data.xlsx"
        test_file.write_text("test content")
        
        # Configure validation rules
        self.hook.configure({
            'allowed_extensions': ['.xlsx', '.csv', '.json'],
            'max_file_size_mb': 100,
            'require_swedish_locale': True,
            'check_gdpr_compliance': True
        })
        
        # Execute pre-read hook
        context = HookContext(
            file_path=str(test_file),
            operation='read',
            metadata={'user': 'test'}
        )
        
        result = self.hook.on_pre_read(context)
        
        self.assertIsInstance(result, ValidationResult)
        self.assertTrue(result.is_valid)
        self.assertIn('file_size', result.metadata)
        self.assertIn('extension', result.metadata)
        
    def test_validate_swedish_content(self):
        """Test validation of Swedish characters in file content"""
        test_file = self.test_dir / "swedish_data.csv"
        content = "Återvinning,Mängd\nPlåtburkar,100"
        test_file.write_text(content, encoding='utf-8')
        
        context = HookContext(
            file_path=str(test_file),
            operation='read'
        )
        
        result = self.hook.validate_swedish_content(context)
        
        self.assertTrue(result.is_valid)
        self.assertTrue(result.metadata['has_swedish_chars'])
        self.assertEqual(result.metadata['encoding'], 'utf-8')
        
    def test_validate_personnummer_compliance(self):
        """Test GDPR compliance check for personnummer"""
        test_file = self.test_dir / "customer_data.csv"
        content = "Namn,Personnummer\nSven,19900101-2389"
        test_file.write_text(content)
        
        context = HookContext(
            file_path=str(test_file),
            operation='read'
        )
        
        result = self.hook.check_gdpr_compliance(context)
        
        self.assertFalse(result.is_valid)
        self.assertIn('personnummer_found', result.warnings)
        self.assertEqual(result.metadata['sensitive_data_count'], 1)
        
    def test_pre_write_validation_hook(self):
        """Test hook that validates data before Claude Code writes files"""
        output_file = self.test_dir / "output.xlsx"
        
        context = HookContext(
            file_path=str(output_file),
            operation='write',
            content={
                'data': [['Återvinning', 100]],
                'headers': ['Typ', 'Mängd']
            }
        )
        
        # Configure write validation
        self.hook.configure({
            'require_headers': True,
            'validate_encoding': True,
            'check_output_format': True
        })
        
        result = self.hook.on_pre_write(context)
        
        self.assertTrue(result.is_valid)
        self.assertTrue(result.metadata['has_headers'])
        
    def test_file_size_validation(self):
        """Test file size validation limits"""
        large_file = self.test_dir / "large.xlsx"
        # Create a mock large file
        large_file.write_bytes(b'x' * (101 * 1024 * 1024))  # 101 MB
        
        self.hook.configure({'max_file_size_mb': 100})
        
        context = HookContext(
            file_path=str(large_file),
            operation='read'
        )
        
        result = self.hook.validate_file_size(context)
        
        self.assertFalse(result.is_valid)
        self.assertIn('exceeds maximum size', result.error)
        
    def test_batch_file_validation(self):
        """Test validation of multiple files in batch"""
        files = []
        for i in range(5):
            file_path = self.test_dir / f"data_{i}.csv"
            file_path.write_text(f"data,{i}")
            files.append(str(file_path))
            
        results = self.hook.validate_batch(files)
        
        self.assertEqual(len(results), 5)
        self.assertTrue(all(r.is_valid for r in results))
        
    def test_validation_caching(self):
        """Test that validation results are cached for performance"""
        test_file = self.test_dir / "cached.xlsx"
        test_file.write_text("content")
        
        context = HookContext(file_path=str(test_file), operation='read')
        
        # First validation
        result1 = self.hook.on_pre_read(context)
        
        # Second validation (should be cached)
        result2 = self.hook.on_pre_read(context)
        
        self.assertEqual(result1.cache_key, result2.cache_key)
        self.assertTrue(result2.from_cache)


class TestMCPToolIntegration(unittest.TestCase):
    """Test integration with MCP tools"""
    
    def setUp(self):
        self.mcp = MCPToolIntegration()
        
    def test_register_validation_tool(self):
        """Test registration of validation as MCP tool"""
        tool_config = {
            'name': 'validate_swedish_data',
            'description': 'Validates Swedish waste management data',
            'parameters': {
                'file_path': {'type': 'string', 'required': True},
                'validation_type': {'type': 'string', 'enum': ['full', 'quick']}
            }
        }
        
        tool = self.mcp.register_tool(tool_config)
        
        self.assertIsNotNone(tool)
        self.assertEqual(tool.name, 'validate_swedish_data')
        self.assertTrue(callable(tool.execute))
        
    def test_execute_mcp_validation_tool(self):
        """Test execution of validation through MCP tool interface"""
        # Register tool
        self.mcp.register_tool({
            'name': 'validate_data',
            'handler': lambda params: {'valid': True, 'score': 0.95}
        })
        
        # Execute tool
        result = self.mcp.execute_tool('validate_data', {
            'file_path': '/path/to/data.xlsx',
            'validation_type': 'full'
        })
        
        self.assertTrue(result['valid'])
        self.assertEqual(result['score'], 0.95)
        
    def test_mcp_tool_error_handling(self):
        """Test error handling in MCP tool execution"""
        # Register tool that raises error
        def failing_handler(params):
            raise ValueError("Validation failed")
            
        self.mcp.register_tool({
            'name': 'failing_tool',
            'handler': failing_handler
        })
        
        with self.assertRaises(HookExecutionError) as ctx:
            self.mcp.execute_tool('failing_tool', {})
        self.assertIn("Validation failed", str(ctx.exception))
        
    def test_mcp_tool_async_execution(self):
        """Test async execution of MCP tools"""
        async def async_validator(params):
            await asyncio.sleep(0.01)  # Simulate async work
            return {'valid': True, 'async': True}
            
        self.mcp.register_async_tool({
            'name': 'async_validate',
            'handler': async_validator
        })
        
        # Run async tool
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            self.mcp.execute_async_tool('async_validate', {})
        )
        loop.close()
        
        self.assertTrue(result['valid'])
        self.assertTrue(result['async'])
        
    def test_mcp_resource_access(self):
        """Test accessing MCP resources for validation rules"""
        # Mock MCP resource
        self.mcp.add_resource({
            'uri': 'validation://swedish-rules',
            'content': {
                'date_formats': ['YYYY-MM-DD', 'DD/MM/YYYY'],
                'decimal_separator': ',',
                'thousand_separator': ' '
            }
        })
        
        rules = self.mcp.get_resource('validation://swedish-rules')
        
        self.assertIsNotNone(rules)
        self.assertEqual(rules['content']['decimal_separator'], ',')
        self.assertIn('YYYY-MM-DD', rules['content']['date_formats'])


class TestClaudeCodeHookManager(unittest.TestCase):
    """Test the main hook manager for Claude Code integration"""
    
    def setUp(self):
        self.manager = ClaudeCodeHookManager()
        
    def test_register_hooks(self):
        """Test registration of multiple hook types"""
        # Register pre-process hook
        pre_hook = PreProcessHook(
            name='validate_input',
            handler=lambda ctx: ValidationResult(True)
        )
        self.manager.register_hook(pre_hook)
        
        # Register post-process hook  
        post_hook = PostProcessHook(
            name='format_output',
            handler=lambda ctx: ctx
        )
        self.manager.register_hook(post_hook)
        
        # Register error hook
        error_hook = ErrorHook(
            name='handle_error',
            handler=lambda ctx: {'handled': True}
        )
        self.manager.register_hook(error_hook)
        
        self.assertEqual(len(self.manager.hooks['pre_process']), 1)
        self.assertEqual(len(self.manager.hooks['post_process']), 1)
        self.assertEqual(len(self.manager.hooks['error']), 1)
        
    def test_execute_hook_chain(self):
        """Test execution of hook chain in order"""
        execution_order = []
        
        # Register hooks with order tracking
        self.manager.register_hook(PreProcessHook(
            name='hook1',
            priority=1,
            handler=lambda ctx: execution_order.append('hook1') or ValidationResult(True)
        ))
        
        self.manager.register_hook(PreProcessHook(
            name='hook2',
            priority=2,
            handler=lambda ctx: execution_order.append('hook2') or ValidationResult(True)
        ))
        
        self.manager.register_hook(PreProcessHook(
            name='hook3',
            priority=0,  # Should execute first
            handler=lambda ctx: execution_order.append('hook3') or ValidationResult(True)
        ))
        
        # Execute hooks
        context = HookContext(operation='process')
        self.manager.execute_hooks('pre_process', context)
        
        # Check execution order
        self.assertEqual(execution_order, ['hook3', 'hook1', 'hook2'])
        
    def test_hook_interruption_on_failure(self):
        """Test that hook chain stops on validation failure"""
        execution_tracker = []
        
        self.manager.register_hook(PreProcessHook(
            name='passing_hook',
            handler=lambda ctx: execution_tracker.append('pass') or ValidationResult(True)
        ))
        
        self.manager.register_hook(PreProcessHook(
            name='failing_hook',
            handler=lambda ctx: execution_tracker.append('fail') or ValidationResult(False, error='Failed')
        ))
        
        self.manager.register_hook(PreProcessHook(
            name='never_reached',
            handler=lambda ctx: execution_tracker.append('never') or ValidationResult(True)
        ))
        
        context = HookContext(operation='test')
        result = self.manager.execute_hooks('pre_process', context, stop_on_failure=True)
        
        self.assertFalse(result.is_valid)
        self.assertEqual(execution_tracker, ['pass', 'fail'])  # 'never' not executed
        
    def test_hook_context_mutation(self):
        """Test that hooks can mutate context for subsequent hooks"""
        def add_metadata(ctx):
            ctx.metadata['added'] = 'value1'
            return ValidationResult(True)
            
        def check_metadata(ctx):
            ctx.metadata['found'] = ctx.metadata.get('added') == 'value1'
            return ValidationResult(True)
            
        self.manager.register_hook(PreProcessHook('add', handler=add_metadata))
        self.manager.register_hook(PreProcessHook('check', handler=check_metadata))
        
        context = HookContext(operation='test', metadata={})
        self.manager.execute_hooks('pre_process', context)
        
        self.assertEqual(context.metadata['added'], 'value1')
        self.assertTrue(context.metadata['found'])
        
    def test_conditional_hook_execution(self):
        """Test conditional execution based on context"""
        executed = []
        
        def xlsx_only_hook(ctx):
            if ctx.file_path and ctx.file_path.endswith('.xlsx'):
                executed.append('xlsx')
            return ValidationResult(True)
            
        def csv_only_hook(ctx):
            if ctx.file_path and ctx.file_path.endswith('.csv'):
                executed.append('csv')
            return ValidationResult(True)
            
        self.manager.register_hook(PreProcessHook('xlsx', handler=xlsx_only_hook))
        self.manager.register_hook(PreProcessHook('csv', handler=csv_only_hook))
        
        # Test with XLSX file
        context_xlsx = HookContext(file_path='data.xlsx', operation='read')
        self.manager.execute_hooks('pre_process', context_xlsx)
        
        # Test with CSV file
        context_csv = HookContext(file_path='data.csv', operation='read')
        self.manager.execute_hooks('pre_process', context_csv)
        
        self.assertEqual(executed, ['xlsx', 'csv'])
        
    def test_hook_metrics_collection(self):
        """Test collection of hook execution metrics"""
        import time
        
        def slow_hook(ctx):
            time.sleep(0.05)
            return ValidationResult(True)
            
        self.manager.register_hook(PreProcessHook('slow', handler=slow_hook))
        self.manager.enable_metrics()
        
        context = HookContext(operation='test')
        self.manager.execute_hooks('pre_process', context)
        
        metrics = self.manager.get_metrics()
        
        self.assertIn('slow', metrics['hooks'])
        self.assertGreater(metrics['hooks']['slow']['execution_time'], 0.04)
        self.assertEqual(metrics['hooks']['slow']['execution_count'], 1)
        
    def test_hook_exception_handling(self):
        """Test proper exception handling in hooks"""
        def failing_hook(ctx):
            raise ValueError("Hook failed")
            
        def error_handler(error, context):
            return {
                'handled': True,
                'error_type': type(error).__name__,
                'message': str(error)
            }
            
        self.manager.register_hook(PreProcessHook('failing', handler=failing_hook))
        self.manager.register_hook(ErrorHook('handler', handler=error_handler))
        
        context = HookContext(operation='test')
        result = self.manager.execute_hooks('pre_process', context)
        
        self.assertFalse(result.is_valid)
        self.assertIn('Hook failed', result.error)
        
    def test_hook_configuration_validation(self):
        """Test validation of hook configuration"""
        invalid_configs = [
            {'name': None},  # Missing name
            {'name': 'test', 'priority': 'invalid'},  # Invalid priority type
            {'name': 'test', 'handler': 'not_callable'},  # Invalid handler
        ]
        
        for config in invalid_configs:
            with self.subTest(config=config):
                with self.assertRaises(ValueError):
                    self.manager.validate_hook_config(config)


class TestClaudeCodeIntegrationScenarios(unittest.TestCase):
    """Integration tests for complete Claude Code scenarios"""
    
    def test_full_validation_pipeline(self):
        """Test complete validation pipeline with Claude Code"""
        manager = ClaudeCodeHookManager()
        
        # Setup hooks
        file_validator = FileValidationHook()
        file_validator.configure({
            'allowed_extensions': ['.xlsx', '.csv'],
            'check_gdpr_compliance': True
        })
        
        mcp_integration = MCPToolIntegration()
        
        # Register hooks
        manager.register_hook(PreProcessHook(
            'validate_file',
            handler=file_validator.on_pre_read
        ))
        
        manager.register_hook(PostProcessHook(
            'format_output',
            handler=lambda ctx: ctx
        ))
        
        # Create test context
        test_dir = Path(tempfile.mkdtemp())
        test_file = test_dir / "waste_data.xlsx"
        test_file.write_text("Återvinning,Mängd\nPlast,100")
        
        context = HookContext(
            file_path=str(test_file),
            operation='read',
            metadata={}
        )
        
        # Execute pipeline
        result = manager.execute_hooks('pre_process', context)
        
        self.assertTrue(result.is_valid)
        
        # Cleanup
        import shutil
        shutil.rmtree(test_dir)
        
    def test_async_hook_pipeline(self):
        """Test async hook execution pipeline"""
        manager = ClaudeCodeHookManager()
        
        async def async_validation(ctx):
            await asyncio.sleep(0.01)
            return ValidationResult(True, metadata={'async': True})
            
        manager.register_async_hook(PreProcessHook(
            'async_validate',
            handler=async_validation
        ))
        
        context = HookContext(operation='async_test')
        
        # Execute async pipeline
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            manager.execute_async_hooks('pre_process', context)
        )
        loop.close()
        
        self.assertTrue(result.is_valid)
        self.assertTrue(result.metadata['async'])


if __name__ == '__main__':
    unittest.main()