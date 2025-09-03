import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/lib/theme-provider'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  // Include Swedish characters
  preload: true,
})

export const metadata: Metadata = {
  title: {
    default: 'SVOA Lea Platform',
    template: '%s | SVOA Lea Platform',
  },
  description: 'EU/EES compliant waste management data quality assurance and insights platform',
  keywords: ['waste management', 'data quality', 'EU compliance', 'AI insights', 'Swedish'],
  authors: [{ name: 'SVOA Team' }],
  creator: 'SVOA',
  publisher: 'SVOA',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  // EU/EES compliance
  other: {
    'EU-Data-Residency': 'EU/EES',
    'GDPR-Compliant': 'true',
    'Accessibility-Level': 'WCAG 2.1 AA',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        {/* Swedish language and accessibility */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* EU/EES compliance headers */}
        <meta name="data-residency" content="EU/EES" />
        <meta name="privacy-policy" content="/privacy" />
        <meta name="cookie-policy" content="/cookies" />
        
        {/* Accessibility improvements */}
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#ffffff" />
        
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body 
        className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
        suppressHydrationWarning
      >
        {/* Skip links for accessibility */}
        <a
          href="#main-content"
          className="skip-link focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          Hoppa till huvudinnehåll
        </a>
        <a
          href="#navigation"
          className="skip-link focus:not-sr-only focus:absolute focus:top-16 focus:left-4 z-[100] bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          Hoppa till navigering
        </a>
        
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="svoa-lea-theme"
        >
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">
              {children}
            </div>
          </div>
        </ThemeProvider>

        {/* Performance and accessibility improvements */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent flash of unstyled content
              (function() {
                try {
                  var theme = localStorage.getItem('svoa-lea-theme') || 'system';
                  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  var resolvedTheme = theme === 'system' ? systemTheme : theme;
                  document.documentElement.classList.add(resolvedTheme);
                } catch (e) {}
              })();
            `,
          }}
        />

        {/* Swedish number formatting support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Set Swedish locale for number formatting
              if (typeof Intl !== 'undefined') {
                try {
                  Intl.NumberFormat('sv-SE', { style: 'decimal' });
                } catch (e) {
                  console.warn('Swedish locale not fully supported');
                }
              }
            `,
          }}
        />
      </body>
    </html>
  )
}