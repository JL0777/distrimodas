import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Instancia "edge-safe" (sin bcrypt/mysql) solo para proteger rutas por rol.
const { auth } = NextAuth(authConfig);

export function middleware(...args: Parameters<typeof auth>) {
  return auth(...args);
}

export const config = {
  matcher: ["/admin/:path*", "/vendedor/:path*"],
};
