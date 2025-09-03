"""
Test suite for EU date formats and decimal comma/dot conversion.
Following TDD principles - tests written before implementation.
"""
import unittest
from unittest.mock import Mock, patch
from datetime import datetime, date
from decimal import Decimal
import locale

# Import modules to be tested (will fail initially)
from src.parsers.eu_format_handler import (
    EUDateParser,
    DecimalConverter,
    FormatDetector,
    InvalidDateFormatError,
    InvalidDecimalFormatError,
    AmbiguousFormatError
)


class TestEUDateParser(unittest.TestCase):
    """Test EU date format parsing and conversion"""
    
    def setUp(self):
        self.parser = EUDateParser()
        
    def test_parse_swedish_date_formats(self):
        """Test parsing of common Swedish date formats"""
        test_cases = [
            ('2024-01-15', date(2024, 1, 15)),      # ISO format
            ('15/01/2024', date(2024, 1, 15)),      # DD/MM/YYYY
            ('15.01.2024', date(2024, 1, 15)),      # DD.MM.YYYY
            ('15-01-2024', date(2024, 1, 15)),      # DD-MM-YYYY
            ('20240115', date(2024, 1, 15)),        # YYYYMMDD
            ('15 jan 2024', date(2024, 1, 15)),     # DD MMM YYYY
            ('15 januari 2024', date(2024, 1, 15)), # Swedish month name
        ]
        
        for date_str, expected in test_cases:
            with self.subTest(date_string=date_str):
                result = self.parser.parse(date_str)
                self.assertEqual(result, expected)
                
    def test_parse_swedish_month_names(self):
        """Test parsing with Swedish month names"""
        swedish_months = [
            ('15 januari 2024', date(2024, 1, 15)),
            ('28 februari 2024', date(2024, 2, 28)),
            ('31 mars 2024', date(2024, 3, 31)),
            ('30 april 2024', date(2024, 4, 30)),
            ('15 maj 2024', date(2024, 5, 15)),
            ('30 juni 2024', date(2024, 6, 30)),
            ('31 juli 2024', date(2024, 7, 31)),
            ('31 augusti 2024', date(2024, 8, 31)),
            ('30 september 2024', date(2024, 9, 30)),
            ('31 oktober 2024', date(2024, 10, 31)),
            ('30 november 2024', date(2024, 11, 30)),
            ('31 december 2024', date(2024, 12, 31)),
        ]
        
        for date_str, expected in swedish_months:
            with self.subTest(month=date_str):
                result = self.parser.parse(date_str, locale='sv_SE')
                self.assertEqual(result, expected)
                
    def test_parse_ambiguous_dates(self):
        """Test handling of ambiguous date formats"""
        # 01/02/2024 could be Jan 2 or Feb 1
        ambiguous = '01/02/2024'
        
        # Should raise error without hint
        with self.assertRaises(AmbiguousFormatError):
            self.parser.parse(ambiguous)
            
        # Should parse with format hint
        result_dmy = self.parser.parse(ambiguous, format_hint='DMY')
        self.assertEqual(result_dmy, date(2024, 2, 1))
        
        result_mdy = self.parser.parse(ambiguous, format_hint='MDY')
        self.assertEqual(result_mdy, date(2024, 1, 2))
        
    def test_parse_two_digit_years(self):
        """Test handling of two-digit years"""
        test_cases = [
            ('15/01/24', date(2024, 1, 15)),   # Recent year
            ('15/01/89', date(1989, 1, 15)),   # Older year
            ('15/01/50', date(1950, 1, 15)),   # Cutoff handling
        ]
        
        for date_str, expected in test_cases:
            with self.subTest(date_string=date_str):
                result = self.parser.parse(date_str, century_cutoff=50)
                self.assertEqual(result, expected)
                
    def test_parse_datetime_with_time(self):
        """Test parsing dates with time components"""
        test_cases = [
            ('2024-01-15 14:30:00', datetime(2024, 1, 15, 14, 30, 0)),
            ('15/01/2024 14:30', datetime(2024, 1, 15, 14, 30)),
            ('15.01.2024 14.30.00', datetime(2024, 1, 15, 14, 30, 0)),
        ]
        
        for datetime_str, expected in test_cases:
            with self.subTest(datetime_string=datetime_str):
                result = self.parser.parse_datetime(datetime_str)
                self.assertEqual(result, expected)
                
    def test_parse_invalid_dates(self):
        """Test that invalid dates raise appropriate errors"""
        invalid_dates = [
            '2024-13-01',      # Invalid month
            '2024-02-30',      # Invalid day for February
            '32/01/2024',      # Invalid day
            'not-a-date',      # Completely invalid
            '',                # Empty string
        ]
        
        for invalid_date in invalid_dates:
            with self.subTest(invalid=invalid_date):
                with self.assertRaises(InvalidDateFormatError):
                    self.parser.parse(invalid_date)
                    
    def test_batch_parse_dates(self):
        """Test batch parsing of multiple date formats"""
        dates = [
            '2024-01-15',
            '15/01/2024',
            'invalid',
            '15.01.2024',
        ]
        
        results = self.parser.parse_batch(dates, skip_errors=True)
        
        self.assertEqual(len(results), 4)
        self.assertEqual(results[0], date(2024, 1, 15))
        self.assertEqual(results[1], date(2024, 1, 15))
        self.assertIsNone(results[2])  # Invalid date
        self.assertEqual(results[3], date(2024, 1, 15))
        
    def test_normalize_to_iso(self):
        """Test normalization to ISO 8601 format"""
        test_cases = [
            '15/01/2024',
            '15.01.2024',
            '15-01-2024',
            '15 januari 2024',
        ]
        
        for date_str in test_cases:
            with self.subTest(input=date_str):
                normalized = self.parser.normalize_to_iso(date_str)
                self.assertEqual(normalized, '2024-01-15')
                
    def test_detect_date_format(self):
        """Test automatic date format detection"""
        test_cases = [
            ('2024-01-15', 'ISO'),
            ('15/01/2024', 'DMY'),
            ('15.01.2024', 'DMY_DOT'),
            ('20240115', 'COMPACT'),
            ('15 januari 2024', 'SWEDISH_TEXT'),
        ]
        
        for date_str, expected_format in test_cases:
            with self.subTest(date=date_str):
                detected = self.parser.detect_format(date_str)
                self.assertEqual(detected, expected_format)


class TestDecimalConverter(unittest.TestCase):
    """Test decimal comma/dot conversion for Swedish/EU formats"""
    
    def setUp(self):
        self.converter = DecimalConverter()
        
    def test_convert_swedish_decimal_comma(self):
        """Test conversion of Swedish decimal comma to dot"""
        test_cases = [
            ('123,45', Decimal('123.45')),
            ('1 234,56', Decimal('1234.56')),      # Space thousands separator
            ('1.234,56', Decimal('1234.56')),      # Dot thousands separator
            ('1 234 567,89', Decimal('1234567.89')), # Multiple spaces
            ('-123,45', Decimal('-123.45')),       # Negative number
            ('0,05', Decimal('0.05')),             # Small decimal
        ]
        
        for swedish, expected in test_cases:
            with self.subTest(input=swedish):
                result = self.converter.to_decimal(swedish, locale='sv_SE')
                self.assertEqual(result, expected)
                
    def test_convert_us_decimal_dot(self):
        """Test handling of US/UK decimal dot format"""
        test_cases = [
            ('123.45', Decimal('123.45')),
            ('1,234.56', Decimal('1234.56')),      # Comma thousands separator
            ('1,234,567.89', Decimal('1234567.89')), # Multiple commas
            ('-123.45', Decimal('-123.45')),       # Negative
        ]
        
        for us_format, expected in test_cases:
            with self.subTest(input=us_format):
                result = self.converter.to_decimal(us_format, locale='en_US')
                self.assertEqual(result, expected)
                
    def test_auto_detect_decimal_format(self):
        """Test automatic detection of decimal format"""
        test_cases = [
            ('123,45', 'EU'),           # Comma decimal
            ('123.45', 'US'),           # Dot decimal
            ('1 234,56', 'EU'),         # Space thousands, comma decimal
            ('1,234.56', 'US'),         # Comma thousands, dot decimal
            ('1.234,56', 'EU'),         # Dot thousands, comma decimal
        ]
        
        for number_str, expected_format in test_cases:
            with self.subTest(input=number_str):
                detected = self.converter.detect_format(number_str)
                self.assertEqual(detected, expected_format)
                
    def test_convert_percentages(self):
        """Test conversion of percentage values"""
        test_cases = [
            ('45,5%', Decimal('0.455')),
            ('45,5 %', Decimal('0.455')),
            ('100%', Decimal('1.0')),
            ('0,5%', Decimal('0.005')),
            ('-5,25%', Decimal('-0.0525')),
        ]
        
        for percent_str, expected in test_cases:
            with self.subTest(input=percent_str):
                result = self.converter.parse_percentage(percent_str)
                self.assertEqual(result, expected)
                
    def test_convert_currency_amounts(self):
        """Test conversion of currency amounts"""
        test_cases = [
            ('1 234,56 kr', Decimal('1234.56')),
            ('SEK 1.234,56', Decimal('1234.56')),
            ('€ 1 234,56', Decimal('1234.56')),
            ('1234,56 SEK', Decimal('1234.56')),
            ('-1 234,56 kr', Decimal('-1234.56')),
        ]
        
        for currency_str, expected in test_cases:
            with self.subTest(input=currency_str):
                result = self.converter.parse_currency(currency_str)
                self.assertEqual(result, expected)
                
    def test_batch_conversion(self):
        """Test batch conversion of mixed formats"""
        values = [
            '123,45',
            '1 234.56',
            'invalid',
            '45,5%',
            '1 234 kr',
        ]
        
        results = self.converter.convert_batch(values, skip_errors=True)
        
        self.assertEqual(len(results), 5)
        self.assertEqual(results[0], Decimal('123.45'))
        self.assertEqual(results[1], Decimal('1234.56'))
        self.assertIsNone(results[2])  # Invalid
        self.assertEqual(results[3], Decimal('0.455'))
        self.assertEqual(results[4], Decimal('1234'))
        
    def test_format_output(self):
        """Test formatting decimals back to Swedish format"""
        test_cases = [
            (Decimal('1234.56'), '1 234,56'),
            (Decimal('1234567.89'), '1 234 567,89'),
            (Decimal('-123.45'), '-123,45'),
            (Decimal('0.05'), '0,05'),
        ]
        
        for decimal_val, expected in test_cases:
            with self.subTest(decimal=decimal_val):
                formatted = self.converter.format_swedish(decimal_val)
                self.assertEqual(formatted, expected)
                
    def test_preserve_precision(self):
        """Test that precision is preserved during conversion"""
        test_cases = [
            ('123,456789', 6),  # 6 decimal places
            ('0,00001', 5),     # 5 decimal places
            ('1234567890,1234567890', 10),  # Many decimal places
        ]
        
        for value_str, expected_precision in test_cases:
            with self.subTest(value=value_str):
                result = self.converter.to_decimal(value_str, preserve_precision=True)
                # Check decimal places
                decimal_places = abs(result.as_tuple().exponent)
                self.assertEqual(decimal_places, expected_precision)
                
    def test_handle_scientific_notation(self):
        """Test handling of scientific notation"""
        test_cases = [
            ('1,23E+3', Decimal('1230')),
            ('1,23e-2', Decimal('0.0123')),
            ('5E+6', Decimal('5000000')),
        ]
        
        for sci_notation, expected in test_cases:
            with self.subTest(input=sci_notation):
                result = self.converter.parse_scientific(sci_notation)
                self.assertEqual(result, expected)
                
    def test_invalid_format_handling(self):
        """Test handling of invalid decimal formats"""
        invalid_formats = [
            'abc',
            '12,34,56',      # Multiple commas
            '12.34.56',      # Multiple dots
            '12,34.56.78',   # Mixed invalid
            '',              # Empty string
        ]
        
        for invalid in invalid_formats:
            with self.subTest(invalid=invalid):
                with self.assertRaises(InvalidDecimalFormatError):
                    self.converter.to_decimal(invalid)


class TestFormatDetector(unittest.TestCase):
    """Test automatic format detection for dates and decimals"""
    
    def setUp(self):
        self.detector = FormatDetector()
        
    def test_detect_mixed_content(self):
        """Test detection in mixed content (dates, decimals, text)"""
        content = """
        Datum: 2024-01-15
        Belopp: 1 234,56 kr
        Procent: 45,5%
        Text: Normal text här
        """
        
        detection = self.detector.analyze(content)
        
        self.assertEqual(detection['date_format'], 'ISO')
        self.assertEqual(detection['decimal_format'], 'EU')
        self.assertTrue(detection['has_currency'])
        self.assertTrue(detection['has_percentage'])
        
    def test_detect_column_types_in_data(self):
        """Test type detection for data columns"""
        import pandas as pd
        
        data = pd.DataFrame({
            'datum': ['2024-01-15', '2024-02-20', '2024-03-25'],
            'belopp': ['1 234,56', '2 345,67', '3 456,78'],
            'procent': ['12,5%', '23,4%', '34,5%'],
            'namn': ['Återvinning', 'Förbränning', 'Kompost']
        })
        
        column_types = self.detector.detect_column_types(data)
        
        self.assertEqual(column_types['datum'], 'date')
        self.assertEqual(column_types['belopp'], 'decimal')
        self.assertEqual(column_types['procent'], 'percentage')
        self.assertEqual(column_types['namn'], 'text')
        
    def test_confidence_scoring(self):
        """Test confidence scoring for format detection"""
        test_cases = [
            ('2024-01-15', 'date', 1.0),      # Clear ISO date
            ('15/01/2024', 'date', 0.9),      # Clear EU date
            ('01/02/2024', 'date', 0.5),      # Ambiguous date
            ('1 234,56', 'decimal', 1.0),     # Clear EU decimal
            ('1234', 'decimal', 0.3),         # Could be integer or decimal
        ]
        
        for value, expected_type, min_confidence in test_cases:
            with self.subTest(value=value):
                result = self.detector.detect_with_confidence(value)
                self.assertEqual(result['type'], expected_type)
                self.assertGreaterEqual(result['confidence'], min_confidence)


class TestFormatConverterPerformance(unittest.TestCase):
    """Performance tests for format conversion"""
    
    def test_large_dataset_conversion(self):
        """Test conversion performance on large datasets"""
        import time
        import pandas as pd
        
        # Generate large dataset
        data = pd.DataFrame({
            'date': ['2024-01-15'] * 10000,
            'amount': ['1 234,56'] * 10000,
            'percent': ['45,5%'] * 10000,
        })
        
        converter = DecimalConverter()
        parser = EUDateParser()
        
        start = time.perf_counter()
        
        # Convert all columns
        data['date_parsed'] = data['date'].apply(parser.parse)
        data['amount_decimal'] = data['amount'].apply(converter.to_decimal)
        data['percent_decimal'] = data['percent'].apply(converter.parse_percentage)
        
        duration = time.perf_counter() - start
        
        self.assertLess(duration, 5.0)  # Should process 10k rows in < 5 seconds
        self.assertEqual(len(data), 10000)
        

if __name__ == '__main__':
    unittest.main()