import { revalidatePath } from "next/cache";
import { closePendingPayrollDays } from "@/lib/payroll-close";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured for automatic payroll closing.");
    return Response.json({ error: "El cierre automático no está configurado." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const fechasLiquidadas = await closePendingPayrollDays();
    if (fechasLiquidadas.length > 0) {
      revalidatePath("/admin");
      revalidatePath("/admin/ventas");
      revalidatePath("/admin/nomina");
    }
    return Response.json({
      success: true,
      fechasLiquidadas,
      cantidad: fechasLiquidadas.length,
    });
  } catch (error) {
    console.error("Automatic payroll closing failed:", error);
    return Response.json(
      { error: "No se pudieron liquidar todos los días pendientes." },
      { status: 500 }
    );
  }
}
