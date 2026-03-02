import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

if (process.env.NODE_ENV === 'production') {
  nextConfig.output = 'export';
} else {
  nextConfig.images = {
    ...nextConfig.images,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
    ],
  };
  nextConfig.rewrites = async () => [
    {
      source: '/api/:path*',
      destination: 'http://localhost:8000/api/:path*',
    },
  ];
  nextConfig.redirects = async () => [
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
}

export default nextConfig;
