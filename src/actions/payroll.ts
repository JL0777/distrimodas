"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getPool } from "@/lib/db";
import { closePayrollForDate, type PayrollCloseResult } from "@/lib/payroll-close";

// Trae las sumatorias de HOY (tiemple y ventas netas) para poder mostrar un
// preview en vivo en el modal de cierre de dia, antes de confirmar nada.
export async function getTodaySalesSummary(): Promise<{
  totalTiemple: number;
  totalNetas: number;
  yaLiquidado: boolean;
  empleadosLiquidados: number[];
  empleadosConVentas: number[];
}> {
  const pool = getPool();

  const [totales] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_tiemple,
       COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_netas
     FROM detalle_ventas dv
     INNER JOIN ventas v ON v.id = dv.venta_id
       INNER JOIN sedes s ON s.id = v.sede_id
       WHERE DATE(v.fecha) = CURDATE()
         AND (dv.es_venta_neta = FALSE OR s.nombre = 'Distrimodas La Sexta')`
  );
  const fila = (totales as { total_tiemple: number; total_netas: number }[])[0];

  const [empleadosConVentasRows] = await pool.query(
    `SELECT DISTINCT empleado_id
     FROM ventas
     WHERE DATE(fecha) = CURDATE()`
  );
  const empleadosConVentas = (
    empleadosConVentasRows as { empleado_id: number }[]
  ).map((row) => row.empleado_id);

  const [liquidacionExistente] = await pool.query(
    `SELECT id FROM liquidaciones WHERE fecha = CURDATE() LIMIT 1`
  );
  const liquidacion = (liquidacionExistente as { id: number }[])[0];

  let empleadosLiquidados: number[] = [];
  if (liquidacion) {
    const [empleadosRows] = await pool.query(
      `SELECT empleado_id FROM liquidacion_empleados WHERE liquidacion_id = ?`,
      [liquidacion.id]
    );
    empleadosLiquidados = (empleadosRows as { empleado_id: number }[]).map((row) => row.empleado_id);
  }

  return {
    totalTiemple: Number(fila?.total_tiemple ?? 0),
    totalNetas: Number(fila?.total_netas ?? 0),
    yaLiquidado: !!liquidacion,
    empleadosLiquidados,
    empleadosConVentas,
  };
}

const cerrarDiaSchema = z.object({
  empleadoIds: z.array(z.number().int().positive()).min(1, "Selecciona al menos un empleado"),
});

export type CerrarDiaResult = PayrollCloseResult;

// Ejecuta la liquidacion del dia: calcula la formula exacta de nomina
// solidaria y guarda el resultado + el detalle por empleado en una transaccion.
// Si `forzarRecalculo` es true y el dia ya estaba liquidado, se actualiza
// la liquidacion existente en vez de rechazar la operacion.
export async function closeDayPayroll(
  empleadoIds: number[],
  forzarRecalculo = false
): Promise<CerrarDiaResult> {
  const parsed = cerrarDiaSchema.safeParse({ empleadoIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const pool = getPool();
  const [todayRows] = await pool.query(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS fecha`
  );
  const fecha = (todayRows as { fecha: string }[])[0]?.fecha;
  if (!fecha) return { success: false, error: "No se pudo determinar la fecha del cierre." };

  const result = await closePayrollForDate(fecha, parsed.data.empleadoIds, forzarRecalculo);
  if (result.success) {
    revalidatePath("/admin");
    revalidatePath("/admin/ventas");
    revalidatePath("/admin/nomina");
  }
  return result;
}

export interface LiquidacionRow {
  id: number;
  fecha: string;
  asistentesCount: number;
  totalTiemple: number;
  totalNetas: number;
  pagoPorEmpleado: number;
  totalNomina: number;
  empleados: string[];
}

const PAYROLL_PAGE_SIZE = 10;

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.rol !== "admin") {
    throw new Error("No tienes permisos para consultar la nómina.");
  }
}

async function loadLiquidacionesPage(offset: number, limit: number): Promise<LiquidacionRow[]> {
  const pool = getPool();
  const [liquidaciones] = await pool.query(
    `SELECT l.id, DATE_FORMAT(l.fecha, '%Y-%m-%d') AS fecha, l.asistentes_count,
            l.total_tiemple, l.total_netas, l.pago_por_empleado,
            COALESCE(pagos.total_nomina, 0) AS total_nomina
     FROM liquidaciones l
     LEFT JOIN (
       SELECT liquidacion_id, SUM(pago_total) AS total_nomina
       FROM liquidacion_empleados
       GROUP BY liquidacion_id
     ) pagos ON pagos.liquidacion_id = l.id
     ORDER BY l.fecha DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const filas = liquidaciones as {
    id: number;
    fecha: string;
    asistentes_count: number;
    total_tiemple: number;
    total_netas: number;
    pago_por_empleado: number;
    total_nomina: number;
  }[];
  if (filas.length === 0) return [];

  const [empleadosRows] = await pool.query(
    `SELECT le.liquidacion_id, e.nombre
     FROM liquidacion_empleados le
     INNER JOIN empleados e ON e.id = le.empleado_id
     WHERE le.liquidacion_id IN (?)`,
    [filas.map((f) => f.id)]
  );
  const empleadosPorLiquidacion = new Map<number, string[]>();
  for (const fila of empleadosRows as { liquidacion_id: number; nombre: string }[]) {
    const lista = empleadosPorLiquidacion.get(fila.liquidacion_id) ?? [];
    lista.push(fila.nombre);
    empleadosPorLiquidacion.set(fila.liquidacion_id, lista);
  }

  return filas.map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    asistentesCount: fila.asistentes_count,
    totalTiemple: Number(fila.total_tiemple),
    totalNetas: Number(fila.total_netas),
    pagoPorEmpleado: Number(fila.pago_por_empleado),
    totalNomina: Number(fila.total_nomina),
    empleados: empleadosPorLiquidacion.get(fila.id) ?? [],
  }));
}

export interface PayrollDashboardData {
  totalPagado: number;
  diasLiquidados: number;
  promedioDiario: number;
  liquidaciones: LiquidacionRow[];
}

export async function getPayrollDashboard(): Promise<PayrollDashboardData> {
  await requireAdmin();
  const pool = getPool();
  const [summaryRows] = await pool.query(
    `SELECT COUNT(l.id) AS dias_liquidados,
            COALESCE(SUM(pagos.total_nomina), 0) AS total_pagado
     FROM liquidaciones l
     LEFT JOIN (
       SELECT liquidacion_id, SUM(pago_total) AS total_nomina
       FROM liquidacion_empleados
       GROUP BY liquidacion_id
     ) pagos ON pagos.liquidacion_id = l.id`
  );
  const summary = (summaryRows as { dias_liquidados: number; total_pagado: number }[])[0];
  const diasLiquidados = Number(summary?.dias_liquidados ?? 0);

  return {
    totalPagado: Number(summary?.total_pagado ?? 0),
    diasLiquidados,
    promedioDiario: diasLiquidados > 0
      ? Number(summary?.total_pagado ?? 0) / diasLiquidados
      : 0,
    liquidaciones: await loadLiquidacionesPage(0, PAYROLL_PAGE_SIZE),
  };
}

export async function getMoreLiquidaciones(offset: number): Promise<LiquidacionRow[]> {
  await requireAdmin();
  const parsedOffset = z.number().int().min(PAYROLL_PAGE_SIZE).safeParse(offset);
  if (!parsedOffset.success) {
    throw new Error("La página solicitada no es válida.");
  }
  return loadLiquidacionesPage(parsedOffset.data, PAYROLL_PAGE_SIZE);
}

export interface LiquidacionDetalle {
  id: number;
  fecha: string;
  asistentesCount: number;
  totalTiemple: number;
  totalNetas: number;
  pagoPorEmpleado: number;
  totalVentas: number;
  totalNomina: number;
  ventasPorSede: { sedeId: number; sede: string; cantidadVentas: number; total: number; totalCodigos: number }[];
  ventasPorMetodo: {
    sedeId: number;
    sede: string;
    metodoPago: "efectivo" | "tarjeta" | "transferencia";
    total: number;
  }[];
  pagosEmpleados: { empleadoId: number; empleado: string; pagoTotal: number }[];
}

const liquidacionDetalleSchema = z.object({
  liquidacionId: z.number().int().positive(),
});

// Obtiene el comprobante de una liquidación y los totales de venta asociados a su fecha.
export async function getLiquidacionDetalle(
  liquidacionId: number
): Promise<LiquidacionDetalle | null> {
  const parsed = liquidacionDetalleSchema.safeParse({ liquidacionId });
  if (!parsed.success) return null;

  const pool = getPool();
  const [liquidacionRows] = await pool.query(
    `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, asistentes_count,
            total_tiemple, total_netas, pago_por_empleado
     FROM liquidaciones
     WHERE id = ?
     LIMIT 1`,
    [parsed.data.liquidacionId]
  );
  const liquidacion = (
    liquidacionRows as {
      id: number;
      fecha: string;
      asistentes_count: number;
      total_tiemple: number;
      total_netas: number;
      pago_por_empleado: number;
    }[]
  )[0];
  if (!liquidacion) return null;

  const [sedeRows, metodoRows, pagoRows, ventaTotalRows] = await Promise.all([
    pool.query(
      `SELECT s.id AS sede_id, s.nombre AS sede, COALESCE(ventas.cantidad_ventas, 0) AS cantidad_ventas,
              COALESCE(ventas.total, 0) AS total, COALESCE(codigos.total_codigos, 0) AS total_codigos
       FROM sedes s
       LEFT JOIN (
         SELECT sede_id, COUNT(*) AS cantidad_ventas, SUM(total) AS total
         FROM ventas
         WHERE DATE(fecha) = ?
         GROUP BY sede_id
       ) ventas ON ventas.sede_id = s.id
       LEFT JOIN (
         SELECT v.sede_id, SUM(dv.valor_codigo * dv.cantidad) AS total_codigos
         FROM ventas v
         INNER JOIN detalle_ventas dv ON dv.venta_id = v.id
         WHERE DATE(v.fecha) = ? AND dv.es_venta_neta = FALSE
         GROUP BY v.sede_id
       ) codigos ON codigos.sede_id = s.id
       ORDER BY s.nombre`,
      [liquidacion.fecha, liquidacion.fecha]
    ),
    pool.query(
      `SELECT v.sede_id, s.nombre AS sede, v.metodo_pago, COALESCE(SUM(v.total), 0) AS total
       FROM ventas v
       INNER JOIN sedes s ON s.id = v.sede_id
       WHERE DATE(v.fecha) = ?
       GROUP BY v.sede_id, s.nombre, v.metodo_pago`,
      [liquidacion.fecha]
    ),
    pool.query(
      `SELECT e.id AS empleado_id, e.nombre AS empleado, le.pago_total
       FROM liquidacion_empleados le
       INNER JOIN empleados e ON e.id = le.empleado_id
       WHERE le.liquidacion_id = ?
       ORDER BY e.nombre`,
      [liquidacion.id]
    ),
    pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total_ventas
       FROM ventas
       WHERE DATE(fecha) = ?`,
      [liquidacion.fecha]
    ),
  ]);

  const sedes = sedeRows[0] as {
    sede_id: number;
    sede: string;
    cantidad_ventas: number;
    total: number;
    total_codigos: number;
  }[];
  const metodos = metodoRows[0] as {
    sede_id: number;
    sede: string;
    metodo_pago: "efectivo" | "tarjeta" | "transferencia";
    total: number;
  }[];
  const pagos = pagoRows[0] as { empleado_id: number; empleado: string; pago_total: number }[];
  const totalVentasRow = (ventaTotalRows[0] as { total_ventas: number }[])[0];
  const ventasPorMetodo = new Map(
    metodos.map((row) => [`${row.sede_id}:${row.metodo_pago}`, Number(row.total)])
  );

  return {
    id: liquidacion.id,
    fecha: liquidacion.fecha,
    asistentesCount: liquidacion.asistentes_count,
    totalTiemple: Number(liquidacion.total_tiemple),
    totalNetas: Number(liquidacion.total_netas),
    pagoPorEmpleado: Number(liquidacion.pago_por_empleado),
    totalVentas: Number(totalVentasRow?.total_ventas ?? 0),
    totalNomina: pagos.reduce((total, pago) => total + Number(pago.pago_total), 0),
    ventasPorSede: sedes.map((row) => ({
      sedeId: row.sede_id,
      sede: row.sede,
      cantidadVentas: Number(row.cantidad_ventas),
      total: Number(row.total),
      totalCodigos: Number(row.total_codigos),
    })),
    ventasPorMetodo: sedes.flatMap((sede) =>
      (["efectivo", "tarjeta", "transferencia"] as const).map((metodoPago) => ({
        sedeId: sede.sede_id,
        sede: sede.sede,
        metodoPago,
        total: ventasPorMetodo.get(`${sede.sede_id}:${metodoPago}`) ?? 0,
      }))
    ),
    pagosEmpleados: pagos.map((row) => ({
      empleadoId: row.empleado_id,
      empleado: row.empleado,
      pagoTotal: Number(row.pago_total),
    })),
  };
}
