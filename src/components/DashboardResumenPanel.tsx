"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Store, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardResumen } from "@/actions/sales";
import type { DashboardResumen } from "@/actions/sales";

const POLL_MS = 5000;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export function DashboardResumenPanel() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const data = await getDashboardResumen();
      if (!cancelado) setResumen(data);
    }
    cargar();
    intervalRef.current = setInterval(cargar, POLL_MS);
    return () => {
      cancelado = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const empleadosFiltrados = useMemo(() => {
    const lista = resumen?.ventasPorEmpleado ?? [];
    const texto = filtroEmpleado.trim().toLowerCase();
    if (!texto) return lista;
    return lista.filter((e) => e.empleado.toLowerCase().includes(texto));
  }, [resumen, filtroEmpleado]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="size-4" /> Ventas por sede (hoy)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sede</TableHead>
                <TableHead>Ventas</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(resumen?.ventasPorSede ?? []).map((sede) => (
                <TableRow key={sede.sedeId}>
                  <TableCell>{sede.sede}</TableCell>
                  <TableCell>{sede.cantidad}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(sede.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> Ventas por empleado (hoy)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Filtrar por nombre..."
            value={filtroEmpleado}
            onChange={(e) => setFiltroEmpleado(e.target.value)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Ventas</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleadosFiltrados.map((empleado) => (
                <TableRow key={empleado.empleadoId}>
                  <TableCell>{empleado.empleado}</TableCell>
                  <TableCell>{empleado.sede}</TableCell>
                  <TableCell>{empleado.cantidad}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(empleado.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
