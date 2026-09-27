/** @type {import('next').NextConfig} */
const BACKEND_URL = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

const nextConfig = {
  allowedDevOrigins: ['*.pinggy-free.link', '*.free.pinggy.net', '*.pinggy.io', 'localhost', '127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/detect-corners',
        destination: `${BACKEND_URL}/detect-corners`,
      },
      {
        source: '/scan-pro',
        destination: `${BACKEND_URL}/scan-pro`,
      },
      {
        source: '/api/ocr',
        destination: `${BACKEND_URL}/api/ocr`,
      },
      {
        source: '/api/history',
        destination: `${BACKEND_URL}/api/history`,
      },
      {
        source: '/api/validate-document',
        destination: `${BACKEND_URL}/api/validate-document`,
      },
      {
        source: '/api/detect-tampering',
        destination: `${BACKEND_URL}/api/detect-tampering`,
      },
      {
        source: '/api/verify-face',
        destination: `${BACKEND_URL}/api/verify-face`,
      },
      {
        source: '/api/save-verified-user',
        destination: `${BACKEND_URL}/api/save-verified-user`,
      },
      {
        source: '/backend/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;

