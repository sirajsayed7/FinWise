/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  devIndicators: false,
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/statements": ["./node_modules/pdfjs-dist/build/pdf.worker.mjs"]
  }
};

export default nextConfig;
