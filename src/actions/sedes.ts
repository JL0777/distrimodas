"use server";

import { getPool } from "@/lib/db";
import type { Sede } from "@/lib/types";

export async function listSedes(): Promise<Sede[]> {
  const pool = getPool();
  const [rows] = await pool.query(`SELECT id, nombre FROM sedes ORDER BY id ASC`);
  return rows as Sede[];
}
