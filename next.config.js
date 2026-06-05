/** @type {import('next').NextConfig} */
const nextConfig = {
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
