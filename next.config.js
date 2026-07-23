/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfkit citește fișiere .afm relativ la pachet → nu-l bundle-ui, lasă-l require din node_modules
    serverComponentsExternalPackages: ['pdfkit', 'fontkit'],
    // Asigură includerea fonturilor TTF în bundle-ul serverless al rutei (pdfkit)
    outputFileTracingIncludes: {
      '/api/verificare-ancom': ['./app/api/verificare-ancom/fonts/*.ttf'],
    },
  },
  async headers() {
    return [
      {
        // Static landing assets are content-versioned (…-v1.webp) → safe to cache forever.
        source: '/cds-landing-assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
