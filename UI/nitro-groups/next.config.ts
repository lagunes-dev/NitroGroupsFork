import type { NextConfig } from "next";
import { resolveBackendApiBaseUrl } from "./src/lib/backendBaseUrl";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  async rewrites() {
    // Debe coincidir con el host/puerto real del API (p. ej. https://localhost:7140/api vía .env).
    const backendUrl = resolveBackendApiBaseUrl();

    console.log("Rewriting /api/* →", backendUrl);

    // `/api/groups/*` va al API .NET (incl. subida de medios: `.../media/upload` → R2).
    return [
      {
        source: "/api/users/:path*",
        destination: `${backendUrl}/users/:path*`,
      },
      {
        source: "/api/musicians/:path*",
        destination: `${backendUrl}/musicians/:path*`,
      },
      {
        source: "/api/groups/:path*",
        destination: `${backendUrl}/groups/:path*`,
      },
      {
        source: "/api/event-requests/:path*",
        destination: `${backendUrl}/event-requests/:path*`,
      },
      {
        source: "/api/event-requests",
        destination: `${backendUrl}/event-requests`,
      },
      {
        source: "/api/genres",
        destination: `${backendUrl}/genres`,
      },
      {
        // The gig agenda: the caller's own gigs and their attendance answers.
        source: "/api/me/:path*",
        destination: `${backendUrl}/me/:path*`,
      },
      {
        source: "/api/gigs/:path*",
        destination: `${backendUrl}/gigs/:path*`,
      },
      {
        source: "/api/auth/sync",
        destination: `${backendUrl}/auth/sync`,
      },
    ];
  },
};

export default nextConfig;
