import { redirect } from "next/navigation";
import { getJoseWeeklyReport } from "@/actions/jose-sales";
import { JoseSalesReport } from "@/components/JoseSalesReport";

export const dynamic = "force-dynamic";

export default async function JoseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string | string[] }>;
}) {
  const params = await searchParams;
  const weekStart = Array.isArray(params.semana) ? params.semana[0] : params.semana;
  if (weekStart) {
    const date = new Date(`${weekStart}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
      || Number.isNaN(date.getTime())
      || date.toISOString().slice(0, 10) !== weekStart
      || date.getUTCDay() !== 1
    ) {
      redirect("/jose/historial");
    }
  }

  const report = await getJoseWeeklyReport(weekStart);
  return <JoseSalesReport key={report.weekStart} initialReport={report} view="history" />;
}
