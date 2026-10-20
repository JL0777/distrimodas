import { listAllEmployees } from "@/actions/employees";
import { listSedes } from "@/actions/sedes";
import { EmployeesManager } from "@/components/EmployeesManager";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const [empleados, sedes] = await Promise.all([listAllEmployees(), listSedes()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-heading">Gestión de vendedores</h2>
        <p className="page-subtitle">Agrega y administra los equipos de tus sedes.</p>
      </div>
      <EmployeesManager empleados={empleados} sedes={sedes} />
    </div>
  );
}
