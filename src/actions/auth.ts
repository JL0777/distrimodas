"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export interface LoginState {
  error?: string;
}

// Server action para el formulario de login (usada con useActionState).
export async function authenticate(
  _prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Usuario o contraseña incorrectos" };
    }
    throw err;
  }

  // El redirect por rol se resuelve en la pagina "/" (server component).
  redirect("/");
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
