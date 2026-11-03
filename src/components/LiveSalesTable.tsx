"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTodaySalesList } from "@/actions/sales";
import type { VentaFeedItem } from "@/actions/sales";
import type { Sede } from "@/lib/types";

const POLL_MS = 4000;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

interface LiveSalesTableProps {
  sedeId: number | null;
  sedes: Sede[];
  onSedeChange: (sedeId: number | null) => void;
}

function getSedeLabel(nombre: string) {
  const nombreNormalizado = nombre.toLocaleLowerCase("es-CO");
  if (nombreNormalizado.includes("punto intimo")) return "Punto Intimo";
  if (nombreNormalizado.includes("distrimodas")) return "Distrimodas";
  return nombre;
}

export function LiveSalesTable({ sedeId, sedes, onSedeChange }: LiveSalesTableProps) {
  const [ventas, setVentas] = useState<VentaFeedItem[]>([]);
  const [resaltarNoEfectivo, setResaltarNoEfectivo] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const data = await getTodaySalesList(sedeId);
      if (!cancelado) setVentas(data);
    }
    cargar();
    intervalRef.current = setInterval(cargar, POLL_MS);
    return () => {
      cancelado = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sedeId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Radio className="size-5 text-primary" /> Ventas en Vivo (hoy)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={resaltarNoEfectivo ? "default" : "outline"}
              aria-pressed={resaltarNoEfectivo}
              aria-label="Resaltar ventas con tarjeta o transferencia"
              onClick={() => setResaltarNoEfectivo((current) => !current)}
              className={resaltarNoEfectivo ? "bg-emerald-700 text-white hover:bg-emerald-800" : ""}
            >
              Transferencias
            </Button>
            <select
              aria-label="Filtrar ventas en vivo por sede"
              value={sedeId === null ? "ambos" : String(sedeId)}
              onChange={(event) =>
                onSedeChange(event.target.value === "ambos" ? null : Number(event.target.value))
              }
              className="h-9 rounded-xl border border-input bg-white px-3 text-sm font-medium shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            >
              {sedes.map((sede) => (
                <option key={sede.id} value={String(sede.id)}>
                  {getSedeLabel(sede.nombre)}
                </option>
              ))}
              <option value="ambos">Ambos</option>
            </select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ventas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay ventas registradas para esta selección.</p>
        ) : (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Articulo</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((venta) => (
                  <TableRow
                    key={venta.id}
                    className={
                      resaltarNoEfectivo && venta.metodoPago !== "efectivo"
                        ? "bg-emerald-100/75 hover:bg-emerald-100"
                        : ""
                    }
                  >
                    <TableCell>{formatFechaHora(venta.fecha)}</TableCell>
                    <TableCell>{venta.empleado}</TableCell>
                    <TableCell>{venta.sede}</TableCell>
                    <TableCell className="max-w-48 truncate" title={venta.articulos}>
                      {venta.articulos}
                    </TableCell>
                    <TableCell
                      className={`capitalize ${
                        venta.metodoPago !== "efectivo" ? "font-semibold text-emerald-700" : ""
                      }`}
                    >
                      {venta.metodoPago}
                    </TableCell>
                    <TableCell className="max-w-40 truncate" title={venta.notasTransferencia ?? undefined}>
                      {venta.notasTransferencia ?? "-"}
                    </TableCell>
                    <TableCell>
                      {venta.totalCodigo > 0 ? (
                        <Badge variant="outline">{formatCOP(venta.totalCodigo)}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCOP(venta.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
