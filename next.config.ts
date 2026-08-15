import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The content library is read with fs at request time, so tracing can't infer
  // it from imports — include it explicitly or cache lookups miss in production.
  outputFileTracingIncludes: {
    "/api/generate/path": ["./content/library/**"],
    "/api/generate/expand": ["./content/library/**"],
  },
};

export default nextConfig;
