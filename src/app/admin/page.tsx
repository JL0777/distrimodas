import { listActiveEmployees } from "@/actions/employees";
import { getTodaySalesSummary } from "@/actions/payroll";
import { getDashboardResumen } from "@/actions/sales";
import { CloseDayModal } from "@/components/CloseDayModal";
import { LiveSalesTable } from "@/components/LiveSalesTable";
import { DashboardResumenPanel } from "@/components/DashboardResumenPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    listActiveEmployees(),
    getTodaySalesSummary(),
    getDashboardResumen(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Resumen del dia y cierre de nomina</p>
        </div>
        <CloseDayModal empleados={empleados} yaLiquidadoInicial={resumen.yaLiquidado} />
      </div>

      <LiveSalesTable />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total vendido hoy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCOP(dashboardResumen.totalVendidoHoy)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Codigos (tiemple) hoy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCOP(resumen.totalTiemple)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Ventas Netas hoy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCOP(resumen.totalNetas)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Estado del dia</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {resumen.yaLiquidado ? "Liquidado" : "Pendiente"}
          </CardContent>
        </Card>
      </div>

      <DashboardResumenPanel />
    </div>
  );
}


