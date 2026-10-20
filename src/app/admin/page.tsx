import { listAllEmployees } from "@/actions/employees";
import { getTodaySalesSummary } from "@/actions/payroll";
import { getDashboardResumen } from "@/actions/sales";
import { listSedes } from "@/actions/sedes";
import { AdminDashboardLive } from "@/components/AdminDashboardLive";
import { CloseDayModal } from "@/components/CloseDayModal";
import { DashboardResumenPanel } from "@/components/DashboardResumenPanel";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const sedes = await listSedes();
  const sedeInicial =
    sedes.find((sede) => sede.nombre.toLocaleLowerCase("es-CO").includes("distrimodas")) ??
    sedes[0] ??
    null;

  const [empleados, resumen, dashboardResumen] = await Promise.all([
    listAllEmployees(),
    getTodaySalesSummary(),
    getDashboardResumen(sedeInicial?.id ?? null),
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

      <AdminDashboardLive
        sedes={sedes}
        sedeInicialId={sedeInicial?.id ?? null}
        resumenInicial={dashboardResumen}
        yaLiquidado={resumen.yaLiquidado}
      />

      <DashboardResumenPanel />
    </div>
  );
}
