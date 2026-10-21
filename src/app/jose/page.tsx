import { getJoseWeeklyReport } from "@/actions/jose-sales";
import { JoseSalesReport } from "@/components/JoseSalesReport";

export const dynamic = "force-dynamic";

export default async function JoseDashboardPage() {
  const report = await getJoseWeeklyReport();
  return <JoseSalesReport initialReport={report} view="current" />;
}
