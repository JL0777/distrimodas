import { listActiveEmployees } from "@/actions/employees";
import { VendorWorkspace } from "@/components/VendorWorkspace";

export const dynamic = "force-dynamic";

export default async function VendedorPage() {
  const empleados = await listActiveEmployees();

  return <VendorWorkspace empleados={empleados} />;
}
