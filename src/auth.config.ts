import type { NextAuthConfig } from "next-auth";

// Configuracion "edge-safe" (sin acceso a MySQL) usada por el middleware.
// La configuracion completa con el provider de credenciales vive en auth.ts.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const rol = auth?.user?.rol;
      const { pathname, origin } = request.nextUrl;
      const logueado = !!auth?.user;

      // Sin sesion -> el redirect a /login lo maneja NextAuth (pages.signIn).
      if (pathname.startsWith("/admin")) {
        if (!logueado) return false;
        return rol === "admin" ? true : Response.redirect(new URL("/vendedor", origin));
      }
      if (pathname.startsWith("/vendedor")) {
        if (!logueado) return false;
        return rol === "vendedor" ? true : Response.redirect(new URL("/admin", origin));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.rol) {
        session.user.rol = token.rol;
      }
      return session;
    },
  },
  providers: [], // se completa en auth.ts
} satisfies NextAuthConfig;
