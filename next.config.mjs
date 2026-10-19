/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // pdfkit loads its built-in fonts lazily via package "imports" (#standard-fonts/...),
  // which Vercel's file tracing cannot see. Ship them with every route that renders PDFs.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/pdfkit/js/standard-fonts/**/*", "./node_modules/pdfkit/js/data/**/*", "./node_modules/pdfkit/package.json"],
  },
};
export default nextConfig;
