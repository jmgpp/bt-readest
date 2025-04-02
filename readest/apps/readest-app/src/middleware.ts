import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * AUTHENTICATION MIDDLEWARE - COMPLETELY DISABLED
 * 
 * This middleware has been disabled to troubleshoot authentication issues.
 * All authentication is now handled at the client level to prevent redirect loops.
 * 
 * Re-enable this middleware only after client-side authentication is working properly.
 */
export function middleware(request: NextRequest) {
  // Log the request for debugging purposes
  console.log(`[Middleware] Request path: ${request.nextUrl.pathname}`);
  
  // Always allow the request to proceed
  return NextResponse.next();
}

// Keep the config so it's easy to re-enable later
export const config = {
  matcher: [
    // Apply to all paths except those starting with these prefixes
    '/((?!_next/|_vercel|favicon.ico|public/|api/|auth/).*)'
  ],
}; 