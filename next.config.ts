import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // Disable telemetry for CI/CD environments
  ...(process.env.CI && { telemetry: { enabled: false } }),
};

export default nextConfig;
