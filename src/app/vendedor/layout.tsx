import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "vendedor") redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b bg-white dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Distrimodas La Sexta</h1>
            <p className="text-sm text-muted-foreground">Terminal de ventas</p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesion
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
