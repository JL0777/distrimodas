"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import { calcularLiquidacion, type PayrollCalculo } from "@/lib/payroll";

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
     WHERE DATE(v.fecha) = CURDATE()`
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

export interface CerrarDiaResult {
  success: boolean;
  error?: string;
  calculo?: PayrollCalculo;
}

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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existente] = await conn.query(
      `SELECT id FROM liquidaciones WHERE fecha = CURDATE() LIMIT 1 FOR UPDATE`
    );
    const liquidacionExistente = (existente as { id: number }[])[0];
    if (liquidacionExistente && !forzarRecalculo) {
      throw new Error("El dia de hoy ya fue liquidado. Usa 'Recalcular' si necesitas actualizarla.");
    }

    const [totales] = await conn.query(
      `SELECT
         COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_tiemple,
         COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_netas
       FROM detalle_ventas dv
       INNER JOIN ventas v ON v.id = dv.venta_id
       WHERE DATE(v.fecha) = CURDATE()`
    );
    const fila = (totales as { total_tiemple: number; total_netas: number }[])[0];
    const totalTiemple = Number(fila?.total_tiemple ?? 0);
    const totalNetas = Number(fila?.total_netas ?? 0);

    const calculo = calcularLiquidacion(totalTiemple, totalNetas, parsed.data.empleadoIds.length);

    let liquidacionId: number;
    if (liquidacionExistente) {
      liquidacionId = liquidacionExistente.id;
      await conn.query(
        `UPDATE liquidaciones
           SET asistentes_count = ?, total_tiemple = ?, total_netas = ?, pago_por_empleado = ?
         WHERE id = ?`,
        [calculo.asistentesCount, calculo.totalTiemple, calculo.totalNetas, calculo.pagoTotalPorEmpleado, liquidacionId]
      );
      await conn.query(`DELETE FROM liquidacion_empleados WHERE liquidacion_id = ?`, [liquidacionId]);
    } else {
      const [liquidacionResult] = await conn.query(
        `INSERT INTO liquidaciones
           (fecha, asistentes_count, total_tiemple, total_netas, pago_por_empleado)
         VALUES (CURDATE(), ?, ?, ?, ?)`,
        [calculo.asistentesCount, calculo.totalTiemple, calculo.totalNetas, calculo.pagoTotalPorEmpleado]
      );
      liquidacionId = (liquidacionResult as { insertId: number }).insertId;
    }

    for (const empleadoId of parsed.data.empleadoIds) {
      await conn.query(
        `INSERT INTO liquidacion_empleados (liquidacion_id, empleado_id, pago_total)
         VALUES (?, ?, ?)`,
        [liquidacionId, empleadoId, calculo.pagoTotalPorEmpleado]
      );
    }

    await conn.commit();
    revalidatePath("/admin");
    revalidatePath("/admin/ventas");
    return { success: true, calculo };
  } catch (err) {
    await conn.rollback();
    const message = err instanceof Error ? err.message : "Error liquidando el dia";
    return { success: false, error: message };
  } finally {
    conn.release();
  }
}

export interface LiquidacionRow {
  id: number;
  fecha: string;
  asistentesCount: number;
  totalTiemple: number;
  totalNetas: number;
  pagoPorEmpleado: number;
  empleados: string[];
}

// Historico de liquidaciones (para el panel admin de registros).
export async function listLiquidaciones(): Promise<LiquidacionRow[]> {
  const pool = getPool();
  const [liquidaciones] = await pool.query(
    `SELECT id, fecha, asistentes_count, total_tiemple, total_netas, pago_por_empleado
     FROM liquidaciones
     ORDER BY fecha DESC
     LIMIT 60`
  );

  const filas = liquidaciones as {
    id: number;
    fecha: string;
    asistentes_count: number;
    total_tiemple: number;
    total_netas: number;
    pago_por_empleado: number;
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
    empleados: empleadosPorLiquidacion.get(fila.id) ?? [],
  }));
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
  ventasPorSede: { sede: string; cantidadVentas: number; total: number }[];
  ventasPorMetodo: { metodoPago: "efectivo" | "tarjeta" | "transferencia"; total: number }[];
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
      `SELECT s.nombre AS sede, COUNT(v.id) AS cantidad_ventas,
              COALESCE(SUM(v.total), 0) AS total
       FROM ventas v
       INNER JOIN sedes s ON s.id = v.sede_id
       WHERE DATE(v.fecha) = ?
       GROUP BY s.id, s.nombre
       ORDER BY s.nombre`,
      [liquidacion.fecha]
    ),
    pool.query(
      `SELECT metodo_pago, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE DATE(fecha) = ?
       GROUP BY metodo_pago`,
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
    sede: string;
    cantidad_ventas: number;
    total: number;
  }[];
  const metodos = metodoRows[0] as {
    metodo_pago: "efectivo" | "tarjeta" | "transferencia";
    total: number;
  }[];
  const pagos = pagoRows[0] as { empleado_id: number; empleado: string; pago_total: number }[];
  const totalVentasRow = (ventaTotalRows[0] as { total_ventas: number }[])[0];
  const ventasPorMetodo = new Map(metodos.map((row) => [row.metodo_pago, Number(row.total)]));

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
      sede: row.sede,
      cantidadVentas: Number(row.cantidad_ventas),
      total: Number(row.total),
    })),
    ventasPorMetodo: (["efectivo", "tarjeta", "transferencia"] as const).map((metodoPago) => ({
      metodoPago,
      total: ventasPorMetodo.get(metodoPago) ?? 0,
    })),
    pagosEmpleados: pagos.map((row) => ({
      empleadoId: row.empleado_id,
      empleado: row.empleado,
      pagoTotal: Number(row.pago_total),
    })),
  };
}
