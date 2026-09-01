import { listAllEmployees } from "@/actions/employees";
import { listSedes } from "@/actions/sedes";
import { EmployeesManager } from "@/components/EmployeesManager";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const [empleados, sedes] = await Promise.all([listAllEmployees(), listSedes()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Gestion de Vendedores</h2>
        <p className="text-sm text-muted-foreground">Agrega, activa o desactiva empleados de ambas sedes</p>
      </div>
      <EmployeesManager empleados={empleados} sedes={sedes} />
    </div>
  );
}
