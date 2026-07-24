/**
 * NOAA CORS Proxy — Scalar Coherence Gate
 * Forwards requests to NOAA APIs with CORS headers for Pages origin(s).
 */

const ALLOWED_ORIGINS = [
  "https://macachor.com",
  "https://*.macachor.com",
  "https://plasmasphere-earth-dipole.pages.dev",
  "http://localhost:8788",
  "http://localhost:3000",
];

const NOAA_BASE = "https://services.swpc.noaa.gov";

function isAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
      return regex.test(origin);
    }
    return pattern === origin;
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Validate origin
    if (!isAllowed(origin)) {
      return new Response("Origin not permitted", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Build NOAA target URL
    // Expects requests like: /products/solar-wind/...
    const targetPath = url.pathname.replace(/^\/+/, "");
    const targetUrl = `${NOAA_BASE}/${targetPath}${url.search}`;

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "Accept": request.headers.get("Accept") || "application/json",
          "User-Agent": "NOAA-Proxy/1.0 (macachor.com)",
        },
      });

      // Clone and inject CORS headers
      const modified = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      const cors = corsHeaders(origin);
      Object.entries(cors).forEach(([k, v]) => modified.headers.set(k, v));

      return modified;

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin),
        },
      });
    }
  },
};
