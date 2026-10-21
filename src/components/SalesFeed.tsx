"use client";

import { useEffect, useRef, useState } from "react";
import { ListOrdered, Eye, Trash2, Loader2, Check, X, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTodaySalesList, deleteSale } from "@/actions/sales";
import type { VentaFeedItem } from "@/actions/sales";
import { SaleDetailDialog } from "@/components/SaleDetailDialog";
import type { Sede } from "@/lib/types";

const POLL_MS = 4000;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

interface SalesFeedProps {
  refreshSignal: number;
  sedes: Sede[];
}

export function SalesFeed({ refreshSignal, sedes }: SalesFeedProps) {
  const [ventas, setVentas] = useState<VentaFeedItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sedeId, setSedeId] = useState<number | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [confirmarId, setConfirmarId] = useState<number | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  function getSedeLabel(nombre: string) {
    const nombreNormalizado = nombre.toLocaleLowerCase("es-CO");
    if (nombreNormalizado.includes("punto intimo")) return "Punto Intimo";
    if (nombreNormalizado.includes("distrimodas")) return "Distrimodas";
    return nombre;
  }

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const data = await getTodaySalesList(sedeId);
        if (!cancelado) {
          setVentas(data);
          setErrorCarga(null);
        }
      } catch (error) {
        if (!cancelado) {
          setErrorCarga(error instanceof Error ? error.message : "No se pudieron cargar las ventas.");
        }
      }
    }
    cargar();
    intervalRef.current = setInterval(cargar, POLL_MS);
    return () => {
      cancelado = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshSignal, sedeId]);

  async function confirmarEliminar(id: number) {
    setErrorEliminar(null);
    setEliminandoId(id);
    try {
      const resultado = await deleteSale(id);
      if (resultado.success) {
        setVentas((prev) => prev.filter((v) => v.id !== id));
      } else {
        setErrorEliminar(resultado.error ?? "No se pudo eliminar la venta");
      }
    } finally {
      setEliminandoId(null);
      setConfirmarId(null);
    }
  }

  const totalHoy = ventas.reduce((acc, venta) => acc + venta.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 text-lg sm:text-xl">
            <ListOrdered className="size-5" /> Ventas de Hoy
            <Badge variant="secondary">{ventas.length}</Badge>
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="filtro-sede-ventas-vendedor" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Radio className="size-4" />
              Sede
            </label>
            <select
              id="filtro-sede-ventas-vendedor"
              value={sedeId === null ? "ambas" : String(sedeId)}
              onChange={(event) =>
                setSedeId(event.target.value === "ambas" ? null : Number(event.target.value))
              }
              className="h-11 min-w-48 rounded-xl border border-input bg-white px-3 text-sm font-medium shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            >
              <option value="ambas">Ambas sedes</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={String(sede.id)}>
                  {getSedeLabel(sede.nombre)}
                </option>
              ))}
            </select>
            <Badge variant="secondary" className="px-4 py-2 text-sm">{formatCOP(totalHoy)}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errorCarga && (
          <p role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            No se pudieron cargar las ventas: {errorCarga}
          </p>
        )}
        {errorEliminar && <p className="mb-2 text-sm text-destructive">{errorEliminar}</p>}
        {ventas.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-5 py-12 text-center text-sm text-muted-foreground">
            Aun no se han registrado ventas para esta sede hoy.
          </div>
        ) : (
          <ScrollArea className="h-[34rem]">
            <ul className="grid gap-3 pr-3 sm:grid-cols-2 xl:grid-cols-3">
              {ventas.map((venta) => (
                <li key={venta.id} className="rounded-2xl border border-border/70 bg-white p-4 text-sm shadow-sm transition-colors hover:bg-accent/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{venta.empleado}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatHora(venta.fecha)} · {venta.sede} · {venta.metodoPago}
                      </p>
                      <p className="mt-2 truncate text-sm text-muted-foreground" title={venta.articulos}>
                        {venta.articulos}
                      </p>
                      {venta.totalCodigo > 0 && (
                        <Badge variant="outline" className="mt-1">
                          Codigo {formatCOP(venta.totalCodigo)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="font-bold">{formatCOP(venta.total)}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Ver detalle"
                        onClick={() => setDetalleId(venta.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {confirmarId === venta.id ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            title="Confirmar eliminar"
                            disabled={eliminandoId === venta.id}
                            onClick={() => confirmarEliminar(venta.id)}
                          >
                            {eliminandoId === venta.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Cancelar"
                            onClick={() => setConfirmarId(null)}
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Eliminar venta"
                          onClick={() => setConfirmarId(venta.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>

      <SaleDetailDialog ventaId={detalleId} onOpenChange={(open) => !open && setDetalleId(null)} />
    </Card>
  );
}
