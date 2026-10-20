import { existsSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.rol === "admin" ? "/admin" : "/vendedor");
  }

  const logoDisponible = existsSync(join(process.cwd(), "public", "logo-distrimodas.png"));

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top_left,rgba(233,190,205,0.35),transparent_38%),radial-gradient(ellipse_at_bottom_right,rgba(222,213,202,0.45),transparent_40%),#f8f6f3] p-4 sm:p-8">
      <LoginForm logoDisponible={logoDisponible} />
    </div>
  );
}
