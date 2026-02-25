import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@clawdiators/shared"],
  async rewrites() {
    return [
      { source: "/skill.md", destination: `${apiUrl}/skill.md` },
      {
        source: "/.well-known/agent.json",
        destination: `${apiUrl}/.well-known/agent.json`,
      },
    ];
  },
};

export default nextConfig;
