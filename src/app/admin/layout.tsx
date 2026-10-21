import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { BarChart3, Boxes, ClipboardList, LogOut, Users } from "lucide-react";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/vendedores", label: "Vendedores", icon: Users },
  { href: "/admin/productos", label: "Productos", icon: Boxes },
  { href: "/admin/ventas", label: "Registros", icon: ClipboardList },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "admin") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 shadow-[0_4px_20px_-18px_rgba(65,35,52,0.4)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
            <Link href="/admin" className="flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
                <Image src="/logo-distrimodas.png" alt="Distrimodas Logo" width={80} height={80} className="size-20 object-contain" />
              <span>
                <span className="block text-sm font-bold tracking-tight">Distrimodas</span>
                <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">LA SEXTA · ADMIN</span>
              </span>
            </Link>
            <nav aria-label="Navegación principal" className="flex flex-wrap gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                >
                  <link.icon className="size-4" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm" className="gap-2">
              <LogOut className="size-4" />
              Cerrar sesion
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      <AccessibilityControls />
    </div>
  );
}
