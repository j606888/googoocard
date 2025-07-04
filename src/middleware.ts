import { NextResponse, NextRequest } from 'next/server'
 
// This function can be marked `async` if using `await` inside
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')

  const token = req.cookies.get('auth_token');

  if (!isPublic && !token) {
    const signupUrl = new URL("/signup", req.url);
    signupUrl.searchParams.set("redirect", pathname);
    signupUrl.searchParams.set("token", req.nextUrl.searchParams.get("token") || "");
    return NextResponse.redirect(signupUrl);
  }

  return NextResponse.next()
}
