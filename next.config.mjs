/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  devIndicators: false,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"]
};

export default nextConfig;
