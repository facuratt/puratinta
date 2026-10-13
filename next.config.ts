import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Genera la web como archivos estáticos en la carpeta `out/`, lista para arrastrar a Cloudflare.
  output: 'export',
  devIndicators: false,
};

export default nextConfig;
