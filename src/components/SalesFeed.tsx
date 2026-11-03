"use client";

import { useEffect, useRef, useState } from "react";
import { ListOrdered, Eye, Trash2, Loader2, Check, X, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [resaltarNoEfectivo, setResaltarNoEfectivo] = useState(false);
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
            <Button
              type="button"
              size="default"
              variant={resaltarNoEfectivo ? "default" : "outline"}
              aria-pressed={resaltarNoEfectivo}
              aria-label="Resaltar ventas con tarjeta o transferencia"
              onClick={() => setResaltarNoEfectivo((current) => !current)}
              className={resaltarNoEfectivo ? "bg-emerald-700 text-white hover:bg-emerald-800" : ""}
            >
              Transferencias
            </Button>
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
            <div className="pr-3">
              <Table className="min-w-[1080px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Artículos</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="text-right">Código</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
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
                      <TableCell className="whitespace-nowrap">{formatHora(venta.fecha)}</TableCell>
                      <TableCell className="font-medium">{venta.empleado}</TableCell>
                      <TableCell>{venta.sede}</TableCell>
                      <TableCell className="max-w-64 truncate" title={venta.articulos}>
                        {venta.articulos}
                      </TableCell>
                      <TableCell
                        className={`capitalize ${
                          venta.metodoPago !== "efectivo" ? "font-semibold text-emerald-700" : ""
                        }`}
                      >
                        {venta.metodoPago}
                      </TableCell>
                      <TableCell
                        className="max-w-48 truncate"
                        title={venta.notasTransferencia ?? undefined}
                      >
                        {venta.notasTransferencia ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {venta.totalCodigo > 0 ? (
                          <Badge variant="outline">{formatCOP(venta.totalCodigo)}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCOP(venta.total)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Ver detalle de venta ${venta.id}`}
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
                                aria-label={`Confirmar eliminación de venta ${venta.id}`}
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
                                aria-label={`Cancelar eliminación de venta ${venta.id}`}
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
                              aria-label={`Eliminar venta ${venta.id}`}
                              title="Eliminar venta"
                              onClick={() => setConfirmarId(venta.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <SaleDetailDialog ventaId={detalleId} onOpenChange={(open) => !open && setDetalleId(null)} />
    </Card>
  );
}
