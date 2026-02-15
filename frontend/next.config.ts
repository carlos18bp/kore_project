import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/programas',
        destination: '/programs',
        permanent: true,
      },
      {
        source: '/la-marca-kore',
        destination: '/kore-brand',
        permanent: true,
      },
      {
        source: '/calendario',
        destination: '/calendar',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
