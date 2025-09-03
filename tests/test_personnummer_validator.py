"""
Test suite for Swedish personnummer validation and redaction.
Following TDD principles - tests written before implementation.
"""
import unittest
from unittest.mock import Mock, patch
from datetime import datetime, date
import re

# Import modules to be tested (will fail initially)
from src.validators.personnummer_validator import (
    PersonnummerValidator,
    PersonnummerRedactor,
    InvalidPersonnummerError,
    RedactionError
)


class TestPersonnummerValidator(unittest.TestCase):
    """Test Swedish personnummer validation according to Skatteverket rules"""
    
    def setUp(self):
        self.validator = PersonnummerValidator()
        
    def test_validate_standard_12_digit_format(self):
        """Test validation of standard 12-digit personnummer (YYYYMMDD-XXXX)"""
        # Valid personnummer test cases (using Luhn algorithm)
        valid_numbers = [
            '199001012389',  # 12 digits without hyphen
            '19900101-2389',  # 12 digits with hyphen
            '200501012384',  # Born in 2005
            '19121212-9816',  # Over 100 years old
        ]
        
        for pnr in valid_numbers:
            with self.subTest(personnummer=pnr):
                result = self.validator.validate(pnr)
                self.assertTrue(result.is_valid)
                self.assertIsNotNone(result.birth_date)
                self.assertIsNotNone(result.gender)  # Odd=male, Even=female
                
    def test_validate_10_digit_format(self):
        """Test validation of 10-digit personnummer (YYMMDD-XXXX)"""
        valid_numbers = [
            '900101-2389',  # 10 digits with hyphen
            '9001012389',   # 10 digits without hyphen
            '000101-2384',  # Born in 2000
            '121212+9816',  # Century separator for 100+ years
        ]
        
        for pnr in valid_numbers:
            with self.subTest(personnummer=pnr):
                result = self.validator.validate(pnr)
                self.assertTrue(result.is_valid)
                
    def test_validate_coordination_number(self):
        """Test validation of coordination numbers (day + 60)"""
        valid_coordination = [
            '19900161-2385',  # Day 61 = coordination number
            '200501612380',   # Coordination number without hyphen
        ]
        
        for pnr in valid_coordination:
            with self.subTest(personnummer=pnr):
                result = self.validator.validate(pnr, allow_coordination=True)
                self.assertTrue(result.is_valid)
                self.assertTrue(result.is_coordination_number)
                
    def test_validate_invalid_luhn_checksum(self):
        """Test that invalid Luhn checksums are rejected"""
        invalid_numbers = [
            '19900101-2388',  # Wrong checksum
            '200501012383',   # Wrong checksum
            '900101-2388',    # Wrong checksum
        ]
        
        for pnr in invalid_numbers:
            with self.subTest(personnummer=pnr):
                with self.assertRaises(InvalidPersonnummerError) as ctx:
                    self.validator.validate(pnr)
                self.assertIn("Invalid checksum", str(ctx.exception))
                
    def test_validate_invalid_date(self):
        """Test that invalid dates are rejected"""
        invalid_dates = [
            '19901301-2389',  # Month 13
            '19900132-2385',  # Day 32
            '19900231-2381',  # Feb 31st
            '20230229-2384',  # Feb 29 in non-leap year
        ]
        
        for pnr in invalid_dates:
            with self.subTest(personnummer=pnr):
                with self.assertRaises(InvalidPersonnummerError) as ctx:
                    self.validator.validate(pnr)
                self.assertIn("Invalid date", str(ctx.exception))
                
    def test_extract_birth_date(self):
        """Test birth date extraction from personnummer"""
        test_cases = [
            ('19900101-2389', date(1990, 1, 1)),
            ('000101-2384', date(2000, 1, 1)),
            ('121212+9816', date(1912, 12, 12)),  # Century marker
        ]
        
        for pnr, expected_date in test_cases:
            with self.subTest(personnummer=pnr):
                result = self.validator.validate(pnr)
                self.assertEqual(result.birth_date, expected_date)
                
    def test_extract_gender(self):
        """Test gender extraction (odd=male, even=female)"""
        test_cases = [
            ('19900101-2389', 'female'),  # 8 is even
            ('19900101-2379', 'male'),    # 7 is odd
        ]
        
        for pnr, expected_gender in test_cases:
            with self.subTest(personnummer=pnr):
                result = self.validator.validate(pnr)
                self.assertEqual(result.gender, expected_gender)
                
    def test_validate_temporary_number(self):
        """Test validation of temporary personnummer (T-nummer)"""
        valid_t_numbers = [
            'T900101-2389',
            '19T00101-2385',
        ]
        
        for pnr in valid_t_numbers:
            with self.subTest(personnummer=pnr):
                result = self.validator.validate(pnr, allow_temporary=True)
                self.assertTrue(result.is_valid)
                self.assertTrue(result.is_temporary)
                
    def test_batch_validation(self):
        """Test batch validation of multiple personnummer"""
        numbers = [
            '19900101-2389',
            'invalid',
            '200501012384',
            '19901301-2389',  # Invalid date
        ]
        
        results = self.validator.validate_batch(numbers)
        
        self.assertEqual(len(results), 4)
        self.assertTrue(results[0].is_valid)
        self.assertFalse(results[1].is_valid)
        self.assertTrue(results[2].is_valid)
        self.assertFalse(results[3].is_valid)


class TestPersonnummerRedactor(unittest.TestCase):
    """Test GDPR-compliant personnummer redaction"""
    
    def setUp(self):
        self.redactor = PersonnummerRedactor()
        
    def test_redact_personnummer_in_text(self):
        """Test redaction of personnummer in free text"""
        text = """
        Kunden Sven Svensson (19900101-2389) har registrerat återvinning.
        Kontaktperson: Anna Andersson, pnr: 850615-2384.
        """
        
        redacted = self.redactor.redact_text(text)
        
        self.assertNotIn('19900101-2389', redacted)
        self.assertNotIn('850615-2384', redacted)
        self.assertIn('XXXX', redacted)
        self.assertIn('Sven Svensson', redacted)  # Names should remain
        
    def test_redact_with_partial_masking(self):
        """Test partial masking (show only birth year)"""
        text = "Personnummer: 19900101-2389"
        
        redacted = self.redactor.redact_text(text, mode='partial')
        
        self.assertIn('1990XXXX-XXXX', redacted)
        self.assertNotIn('0101', redacted)
        self.assertNotIn('2389', redacted)
        
    def test_redact_with_full_masking(self):
        """Test complete masking"""
        text = "Personnummer: 19900101-2389"
        
        redacted = self.redactor.redact_text(text, mode='full')
        
        self.assertIn('XXXXXXXXXX', redacted)
        self.assertNotIn('1990', redacted)
        
    def test_redact_multiple_formats(self):
        """Test redaction of various personnummer formats"""
        text = """
        Format 1: 19900101-2389
        Format 2: 900101-2389
        Format 3: 199001012389
        Format 4: 900101+2385 (century marker)
        """
        
        redacted = self.redactor.redact_text(text)
        
        self.assertEqual(redacted.count('XXXX'), 4)
        self.assertNotIn('2389', redacted)
        self.assertNotIn('2385', redacted)
        
    def test_redact_in_dataframe(self):
        """Test redaction in pandas DataFrame"""
        import pandas as pd
        
        df = pd.DataFrame({
            'namn': ['Sven Svensson', 'Anna Andersson'],
            'personnummer': ['19900101-2389', '850615-2384'],
            'adress': ['Storgatan 1', 'Lillgatan 2']
        })
        
        redacted_df = self.redactor.redact_dataframe(df, columns=['personnummer'])
        
        self.assertNotIn('19900101-2389', redacted_df['personnummer'].iloc[0])
        self.assertNotIn('850615-2384', redacted_df['personnummer'].iloc[1])
        self.assertEqual(redacted_df['namn'].iloc[0], 'Sven Svensson')
        
    def test_redact_with_allowlist(self):
        """Test redaction with allowlist for test data"""
        text = "Test: 19900101-0000, Real: 19900101-2389"
        
        redacted = self.redactor.redact_text(
            text,
            allowlist=['19900101-0000']  # Test personnummer
        )
        
        self.assertIn('19900101-0000', redacted)  # Test number preserved
        self.assertNotIn('19900101-2389', redacted)  # Real number redacted
        
    def test_redact_audit_log(self):
        """Test that redaction creates audit log"""
        text = "Personnummer: 19900101-2389"
        
        redacted = self.redactor.redact_text(text, create_audit_log=True)
        audit_log = self.redactor.get_audit_log()
        
        self.assertEqual(len(audit_log), 1)
        self.assertEqual(audit_log[0]['original_pattern'], '19900101-2389')
        self.assertEqual(audit_log[0]['redaction_type'], 'personnummer')
        self.assertIsNotNone(audit_log[0]['timestamp'])
        
    def test_redact_preserves_context(self):
        """Test that redaction preserves surrounding context"""
        text = "Återvinning registrerad för 19900101-2389 den 2024-01-15."
        
        redacted = self.redactor.redact_text(text, preserve_structure=True)
        
        self.assertIn('Återvinning registrerad för', redacted)
        self.assertIn('den 2024-01-15', redacted)
        self.assertRegex(redacted, r'för \S+ den')  # Structure preserved
        
    def test_redact_performance(self):
        """Test redaction performance on large text"""
        import time
        
        # Generate large text with many personnummer
        large_text = " ".join([f"User {i}: 1990010{i:04d}-2389" for i in range(1000)])
        
        start = time.perf_counter()
        redacted = self.redactor.redact_text(large_text)
        duration = time.perf_counter() - start
        
        self.assertLess(duration, 1.0)  # Should process 1000 numbers in < 1 second
        self.assertEqual(redacted.count('XXXX'), 1000)


class TestPersonnummerIntegration(unittest.TestCase):
    """Integration tests for personnummer validation and redaction"""
    
    def test_validate_and_redact_pipeline(self):
        """Test complete pipeline: validate then redact"""
        validator = PersonnummerValidator()
        redactor = PersonnummerRedactor()
        
        # Input data
        data = [
            {'id': 1, 'pnr': '19900101-2389', 'name': 'Sven'},
            {'id': 2, 'pnr': 'invalid-number', 'name': 'Anna'},
            {'id': 3, 'pnr': '850615-2384', 'name': 'Erik'},
        ]
        
        # Validate
        validated_data = []
        for record in data:
            try:
                result = validator.validate(record['pnr'])
                if result.is_valid:
                    validated_data.append(record)
            except InvalidPersonnummerError:
                continue
                
        # Redact valid records
        for record in validated_data:
            record['pnr'] = redactor.redact_text(record['pnr'])
            
        self.assertEqual(len(validated_data), 2)
        self.assertNotIn('19900101-2389', str(validated_data))
        self.assertNotIn('850615-2384', str(validated_data))


if __name__ == '__main__':
    unittest.main()