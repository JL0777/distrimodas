import { listAllEmployees } from "@/actions/employees";
import { getTodaySalesSummary } from "@/actions/payroll";
import { getDashboardResumen } from "@/actions/sales";
import { CloseDayModal } from "@/components/CloseDayModal";
import { LiveSalesTable } from "@/components/LiveSalesTable";
import { DashboardResumenPanel } from "@/components/DashboardResumenPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, CircleDollarSign, Gem, WalletCards } from "lucide-react";

export const dynamic = "force-dynamic";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export default async function AdminDashboardPage() {
  const [empleados, resumen, dashboardResumen] = await Promise.all([
    listAllEmployees(),
    getTodaySalesSummary(),
    getDashboardResumen(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="page-heading">Resumen del día</h2>
          <p className="page-subtitle">Ventas, códigos y estado de la liquidación.</p>
        </div>
        <CloseDayModal empleados={empleados} yaLiquidadoInicial={resumen.yaLiquidado} />
      </div>

      <LiveSalesTable />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#f0faf5)]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              Total vendido hoy <CircleDollarSign className="size-5 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tracking-tight text-emerald-800">{formatCOP(dashboardResumen.totalVendidoHoy)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              Códigos (tiemple) hoy <Gem className="size-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tracking-tight">{formatCOP(resumen.totalTiemple)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              Ventas netas hoy <WalletCards className="size-5 text-sky-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tracking-tight">{formatCOP(resumen.totalNetas)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              Estado del día <BadgeCheck className="size-5 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className={`text-2xl font-bold tracking-tight ${resumen.yaLiquidado ? "text-emerald-700" : "text-amber-700"}`}>
            {resumen.yaLiquidado ? "Liquidado" : "Pendiente"}
          </CardContent>
        </Card>
      </div>

      <DashboardResumenPanel />
    </div>
  );
}
