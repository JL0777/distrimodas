"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getPool } from "@/lib/db";
import { createProduct } from "@/actions/products";
import type { MetodoPago } from "@/lib/types";

const itemVentaSchema = z.object({
  productoId: z.number().int().positive().nullable(),
  nombre: z.string().trim().min(1),
  precioUnitario: z.number().positive(),
  cantidad: z.number().int().positive(),
  tieneCodigo: z.boolean(),
  valorCodigo: z.number().min(0),
}).refine(
  (item) => item.tieneCodigo ? item.valorCodigo > 0 : item.valorCodigo === 0,
  {
    message: "Si el artículo tiene código, ingresa un valor mayor a 0; si no tiene, el código debe ser 0.",
    path: ["valorCodigo"],
  }
);

const registrarVentaSchema = z.object({
  empleadoId: z.number().int().positive(),
  metodoPago: z.enum(["efectivo", "tarjeta", "transferencia"]),
  notasTransferencia: z.string().trim().optional(),
  items: z.array(itemVentaSchema).min(1, "El carrito no puede estar vacio"),
}).refine(
  (data) => data.metodoPago !== "transferencia" || !!data.notasTransferencia,
  {
    message: "Las notas de transferencia son obligatorias para este metodo de pago",
    path: ["notasTransferencia"],
  }
);

export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>;

export interface RegistrarVentaResult {
  success: boolean;
  ventaId?: number;
  error?: string;
}

// Registra una venta completa (cabecera + detalle) dentro de una transaccion.
// Si algun producto es nuevo (productoId null) primero se crea en el catalogo.
export async function registerSale(
  input: RegistrarVentaInput
): Promise<RegistrarVentaResult> {
  const parsed = registrarVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [empleadoRows] = await conn.query(
      `SELECT sede_id FROM empleados WHERE id = ? AND activo = TRUE LIMIT 1`,
      [data.empleadoId]
    );
    const empleado = (empleadoRows as { sede_id: number }[])[0];
    if (!empleado) {
      throw new Error("El empleado seleccionado no existe o no esta activo");
    }

    // Resuelve productos nuevos (sin id) creandolos primero en el catalogo.
    const itemsResueltos = [];
    for (const item of data.items) {
      let productoId = item.productoId;
      if (!productoId) {
        productoId = await createProduct(
          {
            nombre: item.nombre,
            precioBase: item.precioUnitario,
            codigoTiemple: item.valorCodigo,
          },
          conn
        );
      }
      itemsResueltos.push({ ...item, productoId });
    }

    const total = itemsResueltos.reduce(
      (acc, item) => acc + item.precioUnitario * item.cantidad,
      0
    );

    const [ventaResult] = await conn.query(
      `INSERT INTO ventas (empleado_id, sede_id, total, metodo_pago, notas_transferencia)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.empleadoId,
        empleado.sede_id,
        total,
        data.metodoPago,
        data.metodoPago === "transferencia" ? data.notasTransferencia : null,
      ]
    );
    const ventaId = (ventaResult as { insertId: number }).insertId;

    for (const item of itemsResueltos) {
      const esVentaNeta = !item.tieneCodigo;
      await conn.query(
        `INSERT INTO detalle_ventas
           (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, es_venta_neta, valor_codigo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          item.productoId,
          item.nombre,
          item.cantidad,
          item.precioUnitario,
          esVentaNeta,
          esVentaNeta ? 0 : item.valorCodigo,
        ]
      );
    }

    await conn.commit();
    revalidatePath("/vendedor");
    revalidatePath("/admin");
    revalidatePath("/admin/ventas");
    return { success: true, ventaId };
  } catch (err) {
    await conn.rollback();
    const message = err instanceof Error ? err.message : "Error registrando la venta";
    return { success: false, error: message };
  } finally {
    conn.release();
  }
}

export interface VentaFeedItem {
  id: number;
  fecha: string;
  empleado: string;
  sede: string;
  total: number;
  metodoPago: MetodoPago;
  totalCodigo: number;
  totalNeta: number;
  notasTransferencia: string | null;
  articulos: string;
}

// Ultimas ventas de HOY (para la lista en vivo del terminal de vendedor y del dashboard admin).
async function loadTodaySalesList(
  sedeId: number | null
): Promise<VentaFeedItem[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_codigo,
            COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_neta,
            GROUP_CONCAT(
              CONCAT(COALESCE(dv.nombre_producto, p.nombre),
                     IF(dv.cantidad > 1, CONCAT(' x', dv.cantidad), ''))
              ORDER BY dv.id SEPARATOR ', '
            ) AS articulos
     FROM ventas v
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     LEFT JOIN detalle_ventas dv ON dv.venta_id = v.id
     LEFT JOIN productos p ON p.id = dv.producto_id
     WHERE DATE(v.fecha) = CURDATE()
       AND (? IS NULL OR v.sede_id = ?)
     GROUP BY v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre, s.nombre
     ORDER BY v.fecha DESC, v.id DESC
     LIMIT 50`,
    [sedeId, sedeId]
  );
  return (
    rows as {
      id: number;
      fecha: string;
      total: number;
      metodo_pago: MetodoPago;
      notas_transferencia: string | null;
      empleado: string;
      sede: string;
      total_codigo: number;
      total_neta: number;
      articulos: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    fecha: row.fecha,
    empleado: row.empleado,
    sede: row.sede,
    total: Number(row.total),
    metodoPago: row.metodo_pago,
    totalCodigo: Number(row.total_codigo),
    totalNeta: Number(row.total_neta),
    notasTransferencia: row.notas_transferencia,
    articulos: row.articulos ?? "-",
  }));
}

const todaySalesFilterSchema = z.number().int().positive().nullable();

export async function getTodaySalesList(sedeId: number | null = null): Promise<VentaFeedItem[]> {
  const parsed = todaySalesFilterSchema.safeParse(sedeId);
  if (!parsed.success) {
    throw new Error("La sede seleccionada no es válida.");
  }
  return loadTodaySalesList(parsed.data);
}

const TODAY_SALES_PAGE_SIZE = 100;
const todaySalesPageSchema = z.object({
  busqueda: z.string().trim().max(100),
  sedeId: z.number().int().positive().nullable(),
  metodoPago: z.enum(["efectivo", "tarjeta", "transferencia"]).nullable(),
  offset: z.number().int().min(0),
});

export interface TodaySalesPage {
  ventas: VentaFeedItem[];
  totalRegistros: number;
  totalVendido: number;
  hayMas: boolean;
}

export async function getTodaySalesPage(input: {
  busqueda: string;
  sedeId: number | null;
  metodoPago: MetodoPago | null;
  offset: number;
}): Promise<TodaySalesPage> {
  const parsed = todaySalesPageSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Los filtros de ventas no son válidos.");
  }

  const { busqueda, sedeId, metodoPago, offset } = parsed.data;
  const condiciones = ["DATE(v.fecha) = CURDATE()"];
  const params: (string | number)[] = [];

  if (sedeId !== null) {
    condiciones.push("v.sede_id = ?");
    params.push(sedeId);
  }
  if (metodoPago !== null) {
    condiciones.push("v.metodo_pago = ?");
    params.push(metodoPago);
  }
  if (busqueda) {
    const termino = `%${busqueda}%`;
    condiciones.push(`(
      e.nombre LIKE ?
      OR s.nombre LIKE ?
      OR EXISTS (
        SELECT 1
        FROM detalle_ventas dv_busqueda
        LEFT JOIN productos p_busqueda ON p_busqueda.id = dv_busqueda.producto_id
        WHERE dv_busqueda.venta_id = v.id
          AND COALESCE(dv_busqueda.nombre_producto, p_busqueda.nombre) LIKE ?
      )
    )`);
    params.push(termino, termino, termino);
  }
  const whereClause = `WHERE ${condiciones.join(" AND ")}`;
  const pool = getPool();

  const [summaryRows] = await pool.query(
    `SELECT COUNT(*) AS total_registros, COALESCE(SUM(v.total), 0) AS total_vendido
     FROM ventas v
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     ${whereClause}`,
    params
  );
  const summary = (summaryRows as { total_registros: number; total_vendido: number }[])[0];
  const totalRegistros = Number(summary?.total_registros ?? 0);

  const [rows] = await pool.query(
    `SELECT v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia,
            e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_codigo,
            COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_neta,
            GROUP_CONCAT(
              CONCAT(COALESCE(dv.nombre_producto, p.nombre),
                     IF(dv.cantidad > 1, CONCAT(' x', dv.cantidad), ''))
              ORDER BY dv.id SEPARATOR ', '
            ) AS articulos
     FROM ventas v
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     LEFT JOIN detalle_ventas dv ON dv.venta_id = v.id
     LEFT JOIN productos p ON p.id = dv.producto_id
     ${whereClause}
     GROUP BY v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre, s.nombre
     ORDER BY v.fecha DESC, v.id DESC
     LIMIT ? OFFSET ?`,
    [...params, TODAY_SALES_PAGE_SIZE, offset]
  );
  const ventas = (rows as {
    id: number;
    fecha: string;
    total: number;
    metodo_pago: MetodoPago;
    notas_transferencia: string | null;
    empleado: string;
    sede: string;
    total_codigo: number;
    total_neta: number;
    articulos: string | null;
  }[]).map((row) => ({
    id: row.id,
    fecha: row.fecha,
    empleado: row.empleado,
    sede: row.sede,
    total: Number(row.total),
    metodoPago: row.metodo_pago,
    totalCodigo: Number(row.total_codigo),
    totalNeta: Number(row.total_neta),
    notasTransferencia: row.notas_transferencia,
    articulos: row.articulos ?? "-",
  }));

  return {
    ventas,
    totalRegistros,
    totalVendido: Number(summary?.total_vendido ?? 0),
    hayMas: offset + ventas.length < totalRegistros,
  };
}

export interface VentaDetalleItem {
  id: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  esVentaNeta: boolean;
  valorCodigo: number;
}

export interface VentaDetalle {
  id: number;
  fecha: string;
  empleado: string;
  sede: string;
  metodoPago: MetodoPago;
  notasTransferencia: string | null;
  total: number;
  items: VentaDetalleItem[];
}

// Detalle completo de una venta (para el boton "ver" en la lista en vivo).
export async function getSaleDetail(ventaId: number): Promise<VentaDetalle | null> {
  const pool = getPool();
  const [ventaRows] = await pool.query(
    `SELECT v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre AS empleado, s.nombre AS sede
     FROM ventas v
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     WHERE v.id = ?
     LIMIT 1`,
    [ventaId]
  );
  const venta = (
    ventaRows as {
      id: number;
      fecha: string;
      total: number;
      metodo_pago: MetodoPago;
      notas_transferencia: string | null;
      empleado: string;
      sede: string;
    }[]
  )[0];
  if (!venta) return null;

  const [itemRows] = await pool.query(
    `SELECT dv.id, COALESCE(dv.nombre_producto, p.nombre) AS producto_nombre,
            dv.cantidad, dv.precio_unitario, dv.es_venta_neta, dv.valor_codigo
     FROM detalle_ventas dv
     INNER JOIN productos p ON p.id = dv.producto_id
     WHERE dv.venta_id = ?
     ORDER BY dv.id ASC`,
    [ventaId]
  );

  return {
    id: venta.id,
    fecha: venta.fecha,
    empleado: venta.empleado,
    sede: venta.sede,
    metodoPago: venta.metodo_pago,
    notasTransferencia: venta.notas_transferencia,
    total: Number(venta.total),
    items: (
      itemRows as {
        id: number;
        producto_nombre: string;
        cantidad: number;
        precio_unitario: number;
        es_venta_neta: number | boolean;
        valor_codigo: number;
      }[]
    ).map((row) => ({
      id: row.id,
      productoNombre: row.producto_nombre,
      cantidad: row.cantidad,
      precioUnitario: Number(row.precio_unitario),
      esVentaNeta: !!row.es_venta_neta,
      valorCodigo: Number(row.valor_codigo),
    })),
  };
}

export interface EliminarVentaResult {
  success: boolean;
  error?: string;
}

// Elimina una venta completa (el detalle se borra en cascada). No se permite
// si el dia ya fue liquidado, para no descuadrar una nomina ya pagada.
export async function deleteSale(ventaId: number): Promise<EliminarVentaResult> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ventaRows] = await conn.query(
      `SELECT fecha FROM ventas WHERE id = ? LIMIT 1 FOR UPDATE`,
      [ventaId]
    );
    const venta = (ventaRows as { fecha: string }[])[0];
    if (!venta) {
      throw new Error("La venta no existe");
    }

    const [liquidacionRows] = await conn.query(
      `SELECT id FROM liquidaciones WHERE fecha = DATE(?) LIMIT 1`,
      [venta.fecha]
    );
    if ((liquidacionRows as unknown[]).length > 0) {
      throw new Error("No se puede eliminar: el dia de esta venta ya fue liquidado");
    }

    await conn.query(`DELETE FROM ventas WHERE id = ?`, [ventaId]);

    await conn.commit();
    revalidatePath("/vendedor");
    revalidatePath("/admin");
    revalidatePath("/admin/ventas");
    return { success: true };
  } catch (err) {
    await conn.rollback();
    const message = err instanceof Error ? err.message : "Error eliminando la venta";
    return { success: false, error: message };
  } finally {
    conn.release();
  }
}


const filtrosVentasSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  metodoPago: z.enum(["efectivo", "tarjeta", "transferencia"]).optional(),
  busqueda: z.string().trim().max(100).optional(),
});

export type FiltrosVentas = z.infer<typeof filtrosVentasSchema>;

export interface ListaVentasResult {
  ventas: VentaFeedItem[];
  totalesPorMetodo: Record<MetodoPago, number>;
}

// Historico de ventas para el panel admin, con filtros opcionales de fecha y metodo de pago.
export async function listAllSales(filtros: FiltrosVentas = {}): Promise<ListaVentasResult> {
  const parsed = filtrosVentasSchema.parse(filtros);
  const pool = getPool();

  const condiciones: string[] = [];
  const params: (string | number)[] = [];

  if (parsed.desde) {
    condiciones.push("DATE(v.fecha) >= ?");
    params.push(parsed.desde);
  }
  if (parsed.hasta) {
    condiciones.push("DATE(v.fecha) <= ?");
    params.push(parsed.hasta);
  }
  if (parsed.metodoPago) {
    condiciones.push("v.metodo_pago = ?");
    params.push(parsed.metodoPago);
  }
  if (parsed.busqueda) {
    const termino = `%${parsed.busqueda}%`;
    condiciones.push(`(
      EXISTS (
        SELECT 1 FROM empleados e_busqueda
        WHERE e_busqueda.id = v.empleado_id AND e_busqueda.nombre LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM sedes s_busqueda
        WHERE s_busqueda.id = v.sede_id AND s_busqueda.nombre LIKE ?
      )
      OR EXISTS (
        SELECT 1
        FROM detalle_ventas dv_busqueda
        LEFT JOIN productos p_busqueda ON p_busqueda.id = dv_busqueda.producto_id
        WHERE dv_busqueda.venta_id = v.id
          AND COALESCE(dv_busqueda.nombre_producto, p_busqueda.nombre) LIKE ?
      )
    )`);
    params.push(termino, termino, termino);
  }
  const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_codigo,
            COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_neta,
            GROUP_CONCAT(
              CONCAT(COALESCE(dv.nombre_producto, p.nombre),
                     IF(dv.cantidad > 1, CONCAT(' x', dv.cantidad), ''))
              ORDER BY dv.id SEPARATOR ', '
            ) AS articulos
     FROM ventas v
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     LEFT JOIN detalle_ventas dv ON dv.venta_id = v.id
     LEFT JOIN productos p ON p.id = dv.producto_id
     ${whereClause}
     GROUP BY v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre, s.nombre
     ORDER BY v.fecha DESC, v.id DESC
     LIMIT 200`,
    params
  );

  const [totales] = await pool.query(
    `SELECT v.metodo_pago, COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     ${whereClause}
     GROUP BY v.metodo_pago`,
    params
  );

  const totalesPorMetodo: Record<MetodoPago, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const fila of totales as { metodo_pago: MetodoPago; total: number }[]) {
    totalesPorMetodo[fila.metodo_pago] = Number(fila.total);
  }

  const ventas = (
    rows as {
      id: number;
      fecha: string;
      total: number;
      metodo_pago: MetodoPago;
      notas_transferencia: string | null;
      empleado: string;
      sede: string;
      total_codigo: number;
      total_neta: number;
      articulos: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    fecha: row.fecha,
    empleado: row.empleado,
    sede: row.sede,
    total: Number(row.total),
    metodoPago: row.metodo_pago,
    totalCodigo: Number(row.total_codigo),
    totalNeta: Number(row.total_neta),
    notasTransferencia: row.notas_transferencia,
    articulos: row.articulos ?? "-",
  }));

  return { ventas, totalesPorMetodo };
}

export interface VentaPorSede {
  sedeId: number;
  sede: string;
  total: number;
  cantidad: number;
  totalCodigos: number;
}

export interface VentaPorEmpleado {
  empleadoId: number;
  empleado: string;
  sede: string;
  total: number;
  cantidad: number;
}

export interface DashboardResumen {
  totalVendidoHoy: number;
  totalCodigosHoy: number;
  totalNetasHoy: number;
  ventasPorMetodo: { metodoPago: MetodoPago; total: number }[];
  ventasPorSede: VentaPorSede[];
  ventasPorEmpleado: VentaPorEmpleado[];
}

export interface AdminSalesCalendarDay {
  fecha: string;
  ventas: number;
  totalVentas: number;
  liquidacionId: number | null;
  totalNomina: number;
  asistentes: number;
}

export interface AdminSalesCalendar {
  mes: string;
  hoy: string;
  dias: AdminSalesCalendarDay[];
}

async function requireSalesAdmin() {
  const session = await auth();
  if (session?.user?.rol !== "admin") {
    throw new Error("No tienes permisos para consultar los registros.");
  }
}

const adminCalendarMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export async function getAdminSalesCalendar(mes?: string): Promise<AdminSalesCalendar> {
  await requireSalesAdmin();
  if (mes !== undefined && !adminCalendarMonthSchema.safeParse(mes).success) {
    throw new Error("El mes solicitado no es válido.");
  }

  const pool = getPool();
  const [todayRows] = await pool.query(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy,
            DATE_FORMAT(CURDATE(), '%Y-%m') AS mes_actual`
  );
  const current = (todayRows as { hoy: string; mes_actual: string }[])[0];
  if (!current) throw new Error("No se pudo determinar la fecha actual.");
  const selectedMonth = mes && mes <= current.mes_actual ? mes : current.mes_actual;

  const [salesRows, liquidationRows] = await Promise.all([
    pool.query(
      `SELECT DATE_FORMAT(DATE(fecha), '%Y-%m-%d') AS fecha,
              COUNT(*) AS ventas, COALESCE(SUM(total), 0) AS total_ventas
       FROM ventas
       WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
       GROUP BY DATE(fecha)`,
      [selectedMonth]
    ),
    pool.query(
      `SELECT DATE_FORMAT(l.fecha, '%Y-%m-%d') AS fecha, l.id AS liquidacion_id,
              COALESCE(SUM(le.pago_total), 0) AS total_nomina,
              COUNT(le.empleado_id) AS asistentes
       FROM liquidaciones l
       LEFT JOIN liquidacion_empleados le ON le.liquidacion_id = l.id
       WHERE DATE_FORMAT(l.fecha, '%Y-%m') = ?
       GROUP BY l.id, l.fecha`,
      [selectedMonth]
    ),
  ]);

  const days = new Map<string, AdminSalesCalendarDay>();
  for (const row of salesRows[0] as {
    fecha: string;
    ventas: number;
    total_ventas: number;
  }[]) {
    days.set(row.fecha, {
      fecha: row.fecha,
      ventas: Number(row.ventas),
      totalVentas: Number(row.total_ventas),
      liquidacionId: null,
      totalNomina: 0,
      asistentes: 0,
    });
  }
  for (const row of liquidationRows[0] as {
    fecha: string;
    liquidacion_id: number;
    total_nomina: number;
    asistentes: number;
  }[]) {
    const day = days.get(row.fecha) ?? {
      fecha: row.fecha,
      ventas: 0,
      totalVentas: 0,
      liquidacionId: null,
      totalNomina: 0,
      asistentes: 0,
    };
    day.liquidacionId = Number(row.liquidacion_id);
    day.totalNomina = Number(row.total_nomina);
    day.asistentes = Number(row.asistentes);
    days.set(row.fecha, day);
  }

  return {
    mes: selectedMonth,
    hoy: current.hoy,
    dias: [...days.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}

export interface AdminSalesDayDetails {
  fecha: string;
  liquidada: boolean;
  resumen: {
    cantidadVentas: number;
    totalVentas: number;
    totalCodigos: number;
    totalNetas: number;
    totalNomina: number;
    totalTiempleNomina: number;
    totalNetasNomina: number;
    pagoPorEmpleado: number;
  };
  ventas: (VentaFeedItem & { hora: string })[];
  ventasPorSede: { sede: string; cantidad: number; total: number }[];
  ventasPorMetodo: { metodoPago: MetodoPago; total: number }[];
  vendedores: { empleado: string; ventas: number; total: number }[];
  productos: { producto: string; cantidad: number; total: number }[];
  asistentes: { empleado: string; pago: number }[];
}

const adminSalesDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

export async function getAdminSalesDayDetails(fecha: string): Promise<AdminSalesDayDetails> {
  await requireSalesAdmin();
  const parsedDate = adminSalesDaySchema.safeParse(fecha);
  if (!parsedDate.success) throw new Error("La fecha seleccionada no es válida.");

  const pool = getPool();
  const [salesRows, summaryRows, sedeRows, methodRows, sellerRows, productRows, payrollRows] =
    await Promise.all([
      pool.query(
        `SELECT v.id, DATE_FORMAT(v.fecha, '%H:%i') AS hora,
                DATE_FORMAT(v.fecha, '%Y-%m-%d') AS fecha, v.total, v.metodo_pago,
                v.notas_transferencia, e.nombre AS empleado, s.nombre AS sede,
                COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_codigo,
                COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_neta,
                GROUP_CONCAT(
                  CONCAT(COALESCE(dv.nombre_producto, p.nombre),
                         IF(dv.cantidad > 1, CONCAT(' x', dv.cantidad), ''))
                  ORDER BY dv.id SEPARATOR ', '
                ) AS articulos
         FROM ventas v
         INNER JOIN empleados e ON e.id = v.empleado_id
         INNER JOIN sedes s ON s.id = v.sede_id
         LEFT JOIN detalle_ventas dv ON dv.venta_id = v.id
         LEFT JOIN productos p ON p.id = dv.producto_id
         WHERE DATE(v.fecha) = ?
         GROUP BY v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre, s.nombre
         ORDER BY v.fecha DESC, v.id DESC`,
        [parsedDate.data]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM ventas WHERE DATE(fecha) = ?) AS cantidad_ventas,
           (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE DATE(fecha) = ?) AS total_ventas,
           (SELECT COALESCE(SUM(dv.valor_codigo * dv.cantidad), 0)
            FROM detalle_ventas dv
            INNER JOIN ventas v ON v.id = dv.venta_id
            WHERE DATE(v.fecha) = ? AND dv.es_venta_neta = FALSE) AS total_codigos,
           (SELECT COALESCE(SUM(dv.precio_unitario * dv.cantidad), 0)
            FROM detalle_ventas dv
            INNER JOIN ventas v ON v.id = dv.venta_id
            WHERE DATE(v.fecha) = ? AND dv.es_venta_neta = TRUE) AS total_netas`,
        [parsedDate.data, parsedDate.data, parsedDate.data, parsedDate.data]
      ),
      pool.query(
        `SELECT s.nombre AS sede, COUNT(v.id) AS cantidad, COALESCE(SUM(v.total), 0) AS total
         FROM sedes s
         LEFT JOIN ventas v ON v.sede_id = s.id AND DATE(v.fecha) = ?
         GROUP BY s.id, s.nombre
         ORDER BY total DESC, s.nombre`,
        [parsedDate.data]
      ),
      pool.query(
        `SELECT metodo_pago, COALESCE(SUM(total), 0) AS total
         FROM ventas
         WHERE DATE(fecha) = ?
         GROUP BY metodo_pago`,
        [parsedDate.data]
      ),
      pool.query(
        `SELECT e.nombre AS empleado, COUNT(v.id) AS ventas, COALESCE(SUM(v.total), 0) AS total
         FROM empleados e
         INNER JOIN ventas v ON v.empleado_id = e.id
         WHERE DATE(v.fecha) = ?
         GROUP BY e.id, e.nombre
         ORDER BY total DESC, e.nombre
         LIMIT 10`,
        [parsedDate.data]
      ),
      pool.query(
        `SELECT COALESCE(dv.nombre_producto, p.nombre) AS producto,
                SUM(dv.cantidad) AS cantidad,
                SUM(dv.precio_unitario * dv.cantidad) AS total
         FROM detalle_ventas dv
         INNER JOIN ventas v ON v.id = dv.venta_id
         LEFT JOIN productos p ON p.id = dv.producto_id
         WHERE DATE(v.fecha) = ?
         GROUP BY COALESCE(dv.nombre_producto, p.nombre)
         ORDER BY cantidad DESC, total DESC, producto
         LIMIT 10`,
        [parsedDate.data]
      ),
      pool.query(
        `SELECT l.id, l.total_tiemple, l.total_netas, l.pago_por_empleado,
                COALESCE(SUM(le.pago_total), 0) AS total_nomina
         FROM liquidaciones l
         LEFT JOIN liquidacion_empleados le ON le.liquidacion_id = l.id
         WHERE l.fecha = ?
         GROUP BY l.id, l.total_tiemple, l.total_netas, l.pago_por_empleado
         LIMIT 1`,
        [parsedDate.data]
      ),
    ]);

  const payroll = (payrollRows[0] as {
    id: number;
    total_tiemple: number;
    total_netas: number;
    pago_por_empleado: number;
    total_nomina: number;
  }[])[0];

  const attendanceRows = payroll
    ? await pool.query(
        `SELECT e.nombre AS empleado, le.pago_total AS pago
         FROM liquidacion_empleados le
         INNER JOIN empleados e ON e.id = le.empleado_id
         WHERE le.liquidacion_id = ?
         ORDER BY e.nombre`,
        [payroll.id]
      )
    : [[]];

  const summary = (summaryRows[0] as {
    cantidad_ventas: number;
    total_ventas: number;
    total_codigos: number;
    total_netas: number;
  }[])[0];
  const sales = (salesRows[0] as {
    id: number;
    hora: string;
    fecha: string;
    total: number;
    metodo_pago: MetodoPago;
    notas_transferencia: string | null;
    empleado: string;
    sede: string;
    total_codigo: number;
    total_neta: number;
    articulos: string | null;
  }[]).map((row) => ({
    id: row.id,
    fecha: row.fecha,
    hora: row.hora,
    empleado: row.empleado,
    sede: row.sede,
    total: Number(row.total),
    metodoPago: row.metodo_pago,
    totalCodigo: Number(row.total_codigo),
    totalNeta: Number(row.total_neta),
    notasTransferencia: row.notas_transferencia,
    articulos: row.articulos ?? "-",
  }));
  const paymentTotals = new Map(
    (methodRows[0] as { metodo_pago: MetodoPago; total: number }[]).map((row) => [
      row.metodo_pago,
      Number(row.total),
    ])
  );

  return {
    fecha: parsedDate.data,
    liquidada: Boolean(payroll),
    resumen: {
      cantidadVentas: Number(summary?.cantidad_ventas ?? 0),
      totalVentas: Number(summary?.total_ventas ?? 0),
      totalCodigos: Number(summary?.total_codigos ?? 0),
      totalNetas: Number(summary?.total_netas ?? 0),
      totalNomina: Number(payroll?.total_nomina ?? 0),
      totalTiempleNomina: Number(payroll?.total_tiemple ?? 0),
      totalNetasNomina: Number(payroll?.total_netas ?? 0),
      pagoPorEmpleado: Number(payroll?.pago_por_empleado ?? 0),
    },
    ventas: sales,
    ventasPorSede: (sedeRows[0] as { sede: string; cantidad: number; total: number }[]).map(
      (row) => ({ sede: row.sede, cantidad: Number(row.cantidad), total: Number(row.total) })
    ),
    ventasPorMetodo: (["efectivo", "tarjeta", "transferencia"] as const).map((metodoPago) => ({
      metodoPago,
      total: paymentTotals.get(metodoPago) ?? 0,
    })),
    vendedores: (sellerRows[0] as { empleado: string; ventas: number; total: number }[]).map(
      (row) => ({ empleado: row.empleado, ventas: Number(row.ventas), total: Number(row.total) })
    ),
    productos: (productRows[0] as { producto: string; cantidad: number; total: number }[]).map(
      (row) => ({ producto: row.producto, cantidad: Number(row.cantidad), total: Number(row.total) })
    ),
    asistentes: (attendanceRows[0] as { empleado: string; pago: number }[]).map((row) => ({
      empleado: row.empleado,
      pago: Number(row.pago),
    })),
  };
}

// Resumen de HOY para el dashboard admin: total general, por sede y por empleado.
export async function getDashboardResumen(sedeId: number | null = null): Promise<DashboardResumen> {
  const pool = getPool();

  const [totalRows] = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS total
     FROM ventas
     WHERE DATE(fecha) = CURDATE() AND (? IS NULL OR sede_id = ?)`,
    [sedeId, sedeId]
  );
  const totalVendidoHoy = Number((totalRows as { total: number }[])[0]?.total ?? 0);

  const [detalleRows] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN dv.es_venta_neta = FALSE THEN dv.valor_codigo * dv.cantidad ELSE 0 END), 0) AS total_codigos,
       COALESCE(SUM(CASE WHEN dv.es_venta_neta = TRUE THEN dv.precio_unitario * dv.cantidad ELSE 0 END), 0) AS total_netas
     FROM detalle_ventas dv
     INNER JOIN ventas v ON v.id = dv.venta_id
     WHERE DATE(v.fecha) = CURDATE() AND (? IS NULL OR v.sede_id = ?)`,
    [sedeId, sedeId]
  );
  const detalleHoy = (detalleRows as { total_codigos: number; total_netas: number }[])[0];

  const [metodoRows] = await pool.query(
    `SELECT metodo_pago, COALESCE(SUM(total), 0) AS total
     FROM ventas
     WHERE DATE(fecha) = CURDATE() AND (? IS NULL OR sede_id = ?)
     GROUP BY metodo_pago`,
    [sedeId, sedeId]
  );
  const metodosRegistrados = new Map(
    (metodoRows as { metodo_pago: MetodoPago; total: number }[]).map((row) => [
      row.metodo_pago,
      Number(row.total),
    ])
  );

  const [sedeRows] = await pool.query(
    `SELECT s.id AS sede_id, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.total END), 0) AS total,
            COUNT(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.id END) AS cantidad,
            COALESCE(codigos.total_codigos, 0) AS total_codigos
     FROM sedes s
     LEFT JOIN ventas v ON v.sede_id = s.id
     LEFT JOIN (
       SELECT v.sede_id, SUM(dv.valor_codigo * dv.cantidad) AS total_codigos
       FROM ventas v
       INNER JOIN detalle_ventas dv ON dv.venta_id = v.id
       WHERE DATE(v.fecha) = CURDATE() AND dv.es_venta_neta = FALSE
       GROUP BY v.sede_id
     ) codigos ON codigos.sede_id = s.id
     GROUP BY s.id, s.nombre
     ORDER BY s.id ASC`
  );

  const [empRows] = await pool.query(
    `SELECT e.id AS empleado_id, e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.total END), 0) AS total,
            COUNT(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.id END) AS cantidad
     FROM empleados e
     INNER JOIN sedes s ON s.id = e.sede_id
     LEFT JOIN ventas v ON v.empleado_id = e.id AND DATE(v.fecha) = CURDATE()
     WHERE e.activo = TRUE AND (? IS NULL OR e.sede_id = ?)
     GROUP BY e.id, e.nombre, s.nombre
     ORDER BY total DESC, e.nombre ASC`,
    [sedeId, sedeId]
  );

  return {
    totalVendidoHoy,
    totalCodigosHoy: Number(detalleHoy?.total_codigos ?? 0),
    totalNetasHoy: Number(detalleHoy?.total_netas ?? 0),
    ventasPorMetodo: (["efectivo", "tarjeta", "transferencia"] as const).map((metodoPago) => ({
      metodoPago,
      total: metodosRegistrados.get(metodoPago) ?? 0,
    })),
    ventasPorSede: (sedeRows as {
      sede_id: number;
      sede: string;
      total: number;
      cantidad: number;
      total_codigos: number;
    }[]).map((r) => ({
      sedeId: r.sede_id,
      sede: r.sede,
      total: Number(r.total),
      cantidad: Number(r.cantidad),
      totalCodigos: Number(r.total_codigos),
    })),
    ventasPorEmpleado: (
      empRows as { empleado_id: number; empleado: string; sede: string; total: number; cantidad: number }[]
    ).map((r) => ({
      empleadoId: r.empleado_id,
      empleado: r.empleado,
      sede: r.sede,
      total: Number(r.total),
      cantidad: Number(r.cantidad),
    })),
  };
}
