import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format Swedish numbers with space as thousand separator and comma as decimal
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted Swedish number string
 */
export function formatSwedishNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format Swedish currency with proper spacing and symbol
 * @param value - The monetary value
 * @param currency - Currency code (default: 'SEK')
 * @returns Formatted Swedish currency string
 */
export function formatSwedishCurrency(value: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Format Swedish date
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted Swedish date string
 */
export function formatSwedishDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('sv-SE', options).format(dateObj)
}

/**
 * Check if a string contains Swedish characters (åäöÅÄÖ)
 * @param text - Text to check
 * @returns Boolean indicating if Swedish characters are present
 */
export function hasSwedishCharacters(text: string): boolean {
  return /[åäöÅÄÖ]/.test(text)
}

/**
 * Sort array with Swedish locale (å, ä, ö after z)
 * @param array - Array of strings to sort
 * @returns Sorted array using Swedish collation
 */
export function sortSwedish(array: string[]): string[] {
  return [...array].sort((a, b) => a.localeCompare(b, 'sv-SE', { sensitivity: 'base' }))
}

/**
 * Validate Swedish personnummer (personal identity number)
 * @param personnummer - The personnummer to validate
 * @returns Boolean indicating validity
 */
export function validatePersonnummer(personnummer: string): boolean {
  // Remove hyphens and spaces
  const cleaned = personnummer.replace(/[-\s]/g, '')
  
  // Must be 10 or 12 digits
  if (!/^\d{10}(\d{2})?$/.test(cleaned)) return false
  
  // Use last 10 digits for validation
  const digits = cleaned.slice(-10)
  
  // Luhn algorithm check
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(digits[i]) * ((i % 2) + 1)
    if (digit > 9) digit = Math.floor(digit / 10) + (digit % 10)
    sum += digit
  }
  
  const checksum = (10 - (sum % 10)) % 10
  return checksum === parseInt(digits[9])
}

/**
 * Mask Swedish personnummer for display (show only birth year)
 * @param personnummer - The personnummer to mask
 * @returns Masked personnummer string
 */
export function maskPersonnummer(personnummer: string): string {
  const cleaned = personnummer.replace(/[-\s]/g, '')
  if (cleaned.length >= 10) {
    const birthYear = cleaned.length === 12 ? cleaned.substr(0, 4) : `19${cleaned.substr(0, 2)}`
    return `${birthYear}****-****`
  }
  return '****-****'
}

/**
 * Generate human-friendly ID in INS-YYYY-MM-NNN format
 * @param prefix - ID prefix (INS, SCN, etc.)
 * @param sequence - Sequential number
 * @param date - Optional date (defaults to current)
 * @returns Formatted ID string
 */
export function generateHumanFriendlyId(
  prefix: string,
  sequence: number,
  date: Date = new Date()
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const seq = String(sequence).padStart(3, '0')
  
  return `${prefix}-${year}-${month}-${seq}`
}

/**
 * Parse human-friendly ID to extract components
 * @param id - ID string in format PREFIX-YYYY-MM-NNN
 * @returns Parsed ID components or null if invalid
 */
export function parseHumanFriendlyId(id: string): {
  prefix: string
  year: number
  month: number
  sequence: number
} | null {
  const match = id.match(/^([A-Z]+)-(\d{4})-(\d{2})-(\d{3})$/)
  if (!match) return null
  
  return {
    prefix: match[1],
    year: parseInt(match[2]),
    month: parseInt(match[3]),
    sequence: parseInt(match[4])
  }
}

/**
 * Check if user prefers reduced motion
 * @returns Boolean indicating reduced motion preference
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers high contrast
 * @returns Boolean indicating high contrast preference
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * Debounce function for performance optimization
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function for performance optimization
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}