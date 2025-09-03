/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost'],
  },
  i18n: {
    locales: ['sv', 'en'],
    defaultLocale: 'sv', // Swedish primary, English secondary
    localeDetection: true,
  },
  // EU/EES compliance settings
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apply security headers for EU compliance
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          // WCAG 2.1 AA compliance headers
          {
            key: 'X-UA-Compatible',
            value: 'IE=edge',
          },
        ],
      },
    ];
  },
  // Performance optimization for Swedish content
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Accessibility and SEO
  trailingSlash: false,
  reactStrictMode: true,
}

module.exports = nextConfig