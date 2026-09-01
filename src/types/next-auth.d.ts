import type { DefaultSession } from "next-auth";

// Extiende los tipos de next-auth para incluir el rol del usuario.
declare module "next-auth" {
  interface User {
    rol: "admin" | "vendedor";
  }
  interface Session {
    user: {
      rol: "admin" | "vendedor";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    rol?: "admin" | "vendedor";
  }
}
