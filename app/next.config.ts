import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off (it's off unless listed here), so the live dashboard can use the clock.
  // Only needed if you open the site from another device on your network:
  allowedDevOrigins: ["10.32.216.132"],
};

export default nextConfig;