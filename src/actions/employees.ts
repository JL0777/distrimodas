"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import type { Empleado } from "@/lib/types";

// Lista los empleados activos de ambas sedes (para el dropdown de vendedor
// del terminal de ventas y el checklist del cierre de dia).
export async function listActiveEmployees(): Promise<Empleado[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, nombre, sede_id, activo
     FROM empleados
     WHERE activo = TRUE
     ORDER BY nombre ASC`
  );
  return rows as Empleado[];
}

// Lista TODOS los empleados (activos e inactivos) para la gestion admin.
export async function listAllEmployees(): Promise<Empleado[]> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, nombre, sede_id, activo FROM empleados ORDER BY nombre ASC`
  );
  return rows as Empleado[];
}

const nuevoEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  sedeId: z.number().int().positive(),
});

export type NuevoEmpleadoInput = z.infer<typeof nuevoEmpleadoSchema>;

export interface EmployeeActionResult {
  success: boolean;
  error?: string;
}

// Crea un nuevo empleado (vendedor) asignado a una sede.
export async function createEmployee(input: NuevoEmpleadoInput): Promise<EmployeeActionResult> {
  const parsed = nuevoEmpleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const pool = getPool();
  await pool.query(`INSERT INTO empleados (nombre, sede_id, activo) VALUES (?, ?, TRUE)`, [
    parsed.data.nombre,
    parsed.data.sedeId,
  ]);
  revalidatePath("/admin/vendedores");
  return { success: true };
}

// Activa/desactiva un empleado (no se eliminan por las FK de ventas/liquidaciones).
export async function setEmployeeActive(id: number, activo: boolean): Promise<EmployeeActionResult> {
  const pool = getPool();
  await pool.query(`UPDATE empleados SET activo = ? WHERE id = ?`, [activo, id]);
  revalidatePath("/admin/vendedores");
  return { success: true };
}
