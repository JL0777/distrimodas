import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/vendedores", label: "Vendedores" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/ventas", label: "Registros" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "admin") redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b bg-white dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Distrimodas La Sexta · Admin</h1>
            <nav className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
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
