import { listActiveEmployees } from "@/actions/employees";
import { listSedes } from "@/actions/sedes";
import { VendorWorkspace } from "@/components/VendorWorkspace";

export const dynamic = "force-dynamic";

export default async function VendedorPage() {
  const [empleados, sedes] = await Promise.all([listActiveEmployees(), listSedes()]);

  return <VendorWorkspace empleados={empleados} sedes={sedes} />;
}
