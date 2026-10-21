"use client";

import { useEffect, useState } from "react";
import { Loader2, ReceiptText } from "lucide-react";
import { getAllTodaySalesList } from "@/actions/sales";
import type { VentaFeedItem } from "@/actions/sales";
import type { Sede } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getSedeLabel(nombre: string) {
  const normalizado = nombre.toLocaleLowerCase("es-CO");
  if (normalizado.includes("punto intimo")) return "Punto Intimo";
  if (normalizado.includes("distrimodas")) return "Distrimodas";
  return nombre;
}

interface TodaySalesDialogProps {
  sedes: Sede[];
  refreshSignal: number;
}

export function TodaySalesDialog({ sedes, refreshSignal }: TodaySalesDialogProps) {
  const [open, setOpen] = useState(false);
  const [sedeId, setSedeId] = useState<number | null>(null);
  const [ventas, setVentas] = useState<VentaFeedItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    async function cargarVentas() {
      setCargando(true);
      try {
        const resultado = await getAllTodaySalesList(sedeId);
        if (!cancelado) {
          setVentas(resultado);
          setError(null);
        }
      } catch (err) {
        if (!cancelado) {
          setVentas([]);
          setError(
            err instanceof Error
              ? `No fue posible cargar las ventas: ${err.message}`
              : "No fue posible cargar las ventas de hoy."
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarVentas();
    const intervalId = setInterval(cargarVentas, 10000);
    return () => {
      cancelado = true;
      clearInterval(intervalId);
    };
  }, [open, sedeId, refreshSignal]);

  const totalVentas = ventas.reduce((total, venta) => total + venta.total, 0);

  return (
    <>
      <div className="flex justify-end border-t px-5 py-3">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <ReceiptText className="size-4" />
          Ver todas las ventas
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Ventas registradas hoy</DialogTitle>
            <DialogDescription>
              Consulta todas las ventas del día y filtra los registros por sede.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col justify-between gap-3 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <label htmlFor="filtro-sede-ventas" className="text-sm font-medium">
                Filtrar por sede
              </label>
              <select
                id="filtro-sede-ventas"
                value={sedeId === null ? "ambos" : String(sedeId)}
                onChange={(event) =>
                  setSedeId(event.target.value === "ambos" ? null : Number(event.target.value))
                }
                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10 sm:w-56"
              >
                <option value="ambos">Ambas sedes</option>
                {sedes.map((sede) => (
                  <option key={sede.id} value={String(sede.id)}>
                    {getSedeLabel(sede.nombre)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              <span>{ventas.length} {ventas.length === 1 ? "venta" : "ventas"}</span>
              <span className="mx-2">·</span>
              <span className="font-semibold text-foreground">{formatCOP(totalVentas)}</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando ventas...
            </div>
          ) : ventas.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-14 text-center">
              <ReceiptText className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No hay ventas para esta selección.</p>
            </div>
          ) : (
            <div className="max-h-[52vh] overflow-auto rounded-xl border">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground">Fecha</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground">Vendedor</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground">Sede</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground">Artículos</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground">Método</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground">Notas</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Código</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta) => (
                    <tr key={venta.id} className="border-t transition-colors hover:bg-accent/40">
                      <td className="whitespace-nowrap px-3 py-3">{formatFechaHora(venta.fecha)}</td>
                      <td className="px-3 py-3 font-medium">{venta.empleado}</td>
                      <td className="px-3 py-3">{venta.sede}</td>
                      <td className="max-w-56 truncate px-3 py-3" title={venta.articulos}>
                        {venta.articulos}
                      </td>
                      <td className="px-3 py-3 capitalize">{venta.metodoPago}</td>
                      <td className="max-w-40 truncate px-3 py-3" title={venta.notasTransferencia ?? undefined}>
                        {venta.notasTransferencia ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {venta.totalCodigo > 0 ? (
                          <Badge variant="outline">{formatCOP(venta.totalCodigo)}</Badge>
                        ) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                        {formatCOP(venta.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
