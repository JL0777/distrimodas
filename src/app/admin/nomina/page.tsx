import { getPayrollDashboard } from "@/actions/payroll";
import { PayrollDashboard } from "@/components/PayrollDashboard";

export const dynamic = "force-dynamic";

export default async function NominaPage() {
  const dashboard = await getPayrollDashboard();
  return <PayrollDashboard initialData={dashboard} />;
}
