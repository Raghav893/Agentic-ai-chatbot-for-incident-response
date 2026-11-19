import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @returns {import("next").NextConfig} */
export default function config(phase) {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return { output: "export" };

  const backend = process.env.THREATGUARD_BACKEND_URL ?? "http://127.0.0.1:8080";
  return {
    agentRules: false,
    devIndicators: false,
    experimental: {
      proxyClientMaxBodySize: "21mb",
      proxyTimeout: 85_000,
    },
    async rewrites() {
      return [
        { source: "/api/:path*", destination: `${backend}/api/:path*` },
        { source: "/swagger-ui/:path*", destination: `${backend}/swagger-ui/:path*` },
        { source: "/v3/api-docs/:path*", destination: `${backend}/v3/api-docs/:path*` },
      ];
    },
  };
}
