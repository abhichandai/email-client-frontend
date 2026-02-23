import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/landing',
        permanent: false,
        has: [{ type: 'host', value: 'tryfocuskeep.com' }],
      },
      {
        source: '/',
        destination: '/landing',
        permanent: false,
        has: [{ type: 'host', value: 'www.tryfocuskeep.com' }],
      },
    ];
  },
};

export default nextConfig;
