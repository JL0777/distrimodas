import { getAdminSalesCalendar } from "@/actions/sales";
import { AdminSalesCalendar } from "@/components/AdminSalesCalendar";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const calendar = await getAdminSalesCalendar();

  return <AdminSalesCalendar initialData={calendar} />;
}
