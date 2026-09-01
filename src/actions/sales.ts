"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
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
});

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
      const esVentaNeta = !item.tieneCodigo || item.valorCodigo === 0;
      await conn.query(
        `INSERT INTO detalle_ventas
           (venta_id, producto_id, cantidad, precio_unitario, es_venta_neta, valor_codigo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          item.productoId,
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
  notasTransferencia: string | null;
  articulos: string;
}

// Ultimas ventas de HOY (para la lista en vivo del terminal de vendedor y del dashboard admin).
export async function getTodaySalesList(): Promise<VentaFeedItem[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(dv.valor_codigo), 0) AS total_codigo,
            GROUP_CONCAT(
              CONCAT(p.nombre, IF(dv.cantidad > 1, CONCAT(' x', dv.cantidad), ''))
              ORDER BY dv.id SEPARATOR ', '
            ) AS articulos
     FROM ventas v
     INNER JOIN empleados e ON e.id = v.empleado_id
     INNER JOIN sedes s ON s.id = v.sede_id
     LEFT JOIN detalle_ventas dv ON dv.venta_id = v.id
     LEFT JOIN productos p ON p.id = dv.producto_id
     WHERE DATE(v.fecha) = CURDATE()
     GROUP BY v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre, s.nombre
     ORDER BY v.fecha DESC, v.id DESC
     LIMIT 50`
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
    notasTransferencia: row.notas_transferencia,
    articulos: row.articulos ?? "-",
  }));
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
    `SELECT dv.id, p.nombre AS producto_nombre, dv.cantidad, dv.precio_unitario, dv.es_venta_neta, dv.valor_codigo
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
  const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT v.id, v.fecha, v.total, v.metodo_pago, v.notas_transferencia, e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(dv.valor_codigo), 0) AS total_codigo,
            GROUP_CONCAT(
              CONCAT(p.nombre, IF(dv.cantidad > 1, CONCAT(' x', dv.cantidad), ''))
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
  ventasPorSede: VentaPorSede[];
  ventasPorEmpleado: VentaPorEmpleado[];
}

// Resumen de HOY para el dashboard admin: total general, por sede y por empleado.
export async function getDashboardResumen(): Promise<DashboardResumen> {
  const pool = getPool();

  const [totalRows] = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE DATE(fecha) = CURDATE()`
  );
  const totalVendidoHoy = Number((totalRows as { total: number }[])[0]?.total ?? 0);

  const [sedeRows] = await pool.query(
    `SELECT s.id AS sede_id, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.total END), 0) AS total,
            COUNT(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.id END) AS cantidad
     FROM sedes s
     LEFT JOIN ventas v ON v.sede_id = s.id
     GROUP BY s.id, s.nombre
     ORDER BY s.id ASC`
  );

  const [empRows] = await pool.query(
    `SELECT e.id AS empleado_id, e.nombre AS empleado, s.nombre AS sede,
            COALESCE(SUM(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.total END), 0) AS total,
            COUNT(CASE WHEN DATE(v.fecha) = CURDATE() THEN v.id END) AS cantidad
     FROM empleados e
     INNER JOIN sedes s ON s.id = e.sede_id
     LEFT JOIN ventas v ON v.empleado_id = e.id
     WHERE e.activo = TRUE
     GROUP BY e.id, e.nombre, s.nombre
     ORDER BY total DESC, e.nombre ASC`
  );

  return {
    totalVendidoHoy,
    ventasPorSede: (sedeRows as { sede_id: number; sede: string; total: number; cantidad: number }[]).map((r) => ({
      sedeId: r.sede_id,
      sede: r.sede,
      total: Number(r.total),
      cantidad: Number(r.cantidad),
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
