import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { getPool } from "@/lib/db";

interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  rol: "admin" | "vendedor";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === "string" ? credentials.username : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const pool = getPool();
        const [rows] = await pool.query(
          `SELECT id, username, password_hash, rol
           FROM usuarios
           WHERE username = ? AND activo = TRUE
           LIMIT 1`,
          [username]
        );
        const usuario = (rows as UsuarioRow[])[0];
        if (!usuario) return null;

        const valido = await bcrypt.compare(password, usuario.password_hash);
        if (!valido) return null;

        return { id: String(usuario.id), name: usuario.username, rol: usuario.rol };
      },
    }),
  ],
});
