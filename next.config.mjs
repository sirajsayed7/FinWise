/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  devIndicators: false,
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist"]
};

export default nextConfig;
