import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut, ShoppingBag, Sparkles } from "lucide-react";

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "vendedor") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 shadow-[0_4px_20px_-18px_rgba(65,35,52,0.4)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo-distrimodas.png" alt="Distrimodas Logo" className="size-15 object-contain" />
            <div>
              <h1 className="text-sm font-bold tracking-tight sm:text-base">Distrimodas La Sexta</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3 text-primary" /> Terminal de ventas
              </p>
            </div>
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
    </div>
  );
}
