/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Archon-inspired color palette with Swedish accessibility standards
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // SVOA Lea clearance colors with WCAG AAA compliance
        clearance: {
          green: {
            DEFAULT: '#10b981', // Emerald 500 - WCAG AAA
            dark: '#059669',    // Emerald 600
            light: '#6ee7b7',   // Emerald 300
          },
          orange: {
            DEFAULT: '#f59e0b', // Amber 500 - WCAG AAA
            dark: '#d97706',    // Amber 600  
            light: '#fde68a',   // Amber 200
          },
          red: {
            DEFAULT: '#ef4444', // Red 500 - WCAG AAA
            dark: '#dc2626',    // Red 600
            light: '#fca5a5',   // Red 300
          }
        },
        // Swedish brand colors (optional)
        swedish: {
          blue: '#006aa7',    // Swedish flag blue
          yellow: '#fecc02',  // Swedish flag yellow
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '40px',
      },
      animation: {
        // Glassmorphism subtle animations
        'glass-shimmer': 'glass-shimmer 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        // Swedish accessibility - reduced motion safe animations
        'gentle-bounce': 'gentleBounce 1s ease-in-out infinite',
      },
      keyframes: {
        'glass-shimmer': {
          '0%': { 'backdrop-filter': 'blur(8px) brightness(1)' },
          '100%': { 'backdrop-filter': 'blur(8px) brightness(1.05)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        gentleBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
      // Accessibility - minimum touch targets (44px)
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    // Custom plugin for glassmorphism utilities
    function({ addUtilities, theme }) {
      const glassmorphismUtilities = {
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.05)',
          'backdrop-filter': 'blur(10px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-strong': {
          'background': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(20px) saturate(200%)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(200%)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-subtle': {
          'background': 'rgba(255, 255, 255, 0.02)',
          'backdrop-filter': 'blur(5px) saturate(150%)',
          '-webkit-backdrop-filter': 'blur(5px) saturate(150%)',
          'border': '1px solid rgba(255, 255, 255, 0.05)',
        },
        // Dark mode variants
        '.dark .glass': {
          'background': 'rgba(0, 0, 0, 0.05)',
          'border': '1px solid rgba(255, 255, 255, 0.05)',
        },
        '.dark .glass-strong': {
          'background': 'rgba(0, 0, 0, 0.1)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.dark .glass-subtle': {
          'background': 'rgba(0, 0, 0, 0.02)',
          'border': '1px solid rgba(255, 255, 255, 0.02)',
        },
      };
      addUtilities(glassmorphismUtilities);
    },
  ],
}