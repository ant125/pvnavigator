import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for subdomain-based routing
 * 
 * Routes requests based on hostname:
 * - speicher.pvnavigator.de → /speicher/*
 * - pvnavigator.de → /*(main app)
 * 
 * This allows the Speicher module to have its own subdomain
 * while sharing the same codebase and deployment.
 * 
 * LOCAL DEVELOPMENT:
 * To test subdomains locally, add to /etc/hosts:
 * 127.0.0.1 speicher.localhost
 * Then access: http://speicher.localhost:3000
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";
  
  // Extract subdomain from hostname
  // Examples:
  // - speicher.pvnavigator.de → subdomain = "speicher"
  // - speicher.localhost:3000 → subdomain = "speicher"
  // - pvnavigator.de → subdomain = ""
  // - localhost:3000 → subdomain = ""
  
  let subdomain = "";
  
  // Handle production domains
  if (hostname.includes("pvnavigator.de")) {
    const parts = hostname.split(".");
    if (parts.length > 2) {
      subdomain = parts[0];
    }
  }
  
  // Handle local development (speicher.localhost:3000)
  if (hostname.includes("localhost")) {
    const hostWithoutPort = hostname.split(":")[0];
    const parts = hostWithoutPort.split(".");
    if (parts.length > 1 && parts[0] !== "localhost") {
      subdomain = parts[0];
    }
  }

  // Route speicher subdomain to /speicher/* routes
  if (subdomain === "speicher") {
    // Don't rewrite if already on a speicher path
    if (url.pathname.startsWith("/speicher")) {
      return NextResponse.next();
    }
    
    // Rewrite root and other paths to /speicher/*
    const newPath = `/speicher${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(new URL(newPath, request.url));
  }

  return NextResponse.next();
}

/**
 * Matcher configuration
 * 
 * Apply middleware to all routes except:
 * - API routes
 * - Static files
 * - Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};


