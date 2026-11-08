"use client";

import { useEffect, useState } from "react";
import { ListOrdered, Loader2, Search } from "lucide-react";
import { getTodaySalesPage } from "@/actions/sales";
import type { MetodoPago, Sede } from "@/lib/types";
import type { VentaFeedItem } from "@/actions/sales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEBOUNCE_MS = 250;

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
    timeZone: "America/Bogota",
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
}

export function TodaySalesDialog({ sedes }: TodaySalesDialogProps) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [sedeSeleccionada, setSedeSeleccionada] = useState("todas");
  const [metodoPago, setMetodoPago] = useState("todos");
  const [ventas, setVentas] = useState<VentaFeedItem[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalVendido, setTotalVendido] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    const timeoutId = setTimeout(async () => {
      setCargando(true);
      setError(null);
      setVentas([]);
      try {
        const page = await getTodaySalesPage({
          busqueda: busqueda.trim(),
          sedeId: sedeSeleccionada === "todas" ? null : Number(sedeSeleccionada),
          metodoPago: metodoPago === "todos" ? null : metodoPago as MetodoPago,
          offset: 0,
        });
        if (!cancelado) {
          setVentas(page.ventas);
          setTotalRegistros(page.totalRegistros);
          setTotalVendido(page.totalVendido);
          setHayMas(page.hayMas);
        }
      } catch (loadError) {
        if (!cancelado) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las ventas.");
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
  }, [open, busqueda, sedeSeleccionada, metodoPago]);

  async function cargarMas() {
    setCargandoMas(true);
    setError(null);
    try {
      const page = await getTodaySalesPage({
        busqueda: busqueda.trim(),
        sedeId: sedeSeleccionada === "todas" ? null : Number(sedeSeleccionada),
        metodoPago: metodoPago === "todos" ? null : metodoPago as MetodoPago,
        offset: ventas.length,
      });
      setVentas((actuales) => [...actuales, ...page.ventas]);
      setTotalRegistros(page.totalRegistros);
      setTotalVendido(page.totalVendido);
      setHayMas(page.hayMas);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar más ventas.");
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="gap-2">
            <ListOrdered className="size-4" />
            Ver todas
          </Button>
        }
      />
      <DialogContent className="flex h-[96dvh] max-h-[96dvh] w-[calc(100vw-1rem)] max-w-none flex-col gap-4 overflow-hidden rounded-2xl p-3 sm:h-[94dvh] sm:max-h-[94dvh] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:p-5 lg:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="text-xl">Todas las ventas de hoy</DialogTitle>
          <DialogDescription>
            Busca por vendedor, artículo o sede y combina los filtros para encontrar una venta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_minmax(10rem,0.6fr)_minmax(10rem,0.6fr)]">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar ventas por vendedor, artículo o sede"
              placeholder="Buscar vendedor, artículo o sede..."
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <select
            aria-label="Filtrar por sede"
            value={sedeSeleccionada}
            onChange={(event) => setSedeSeleccionada(event.target.value)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map((sede) => (
              <option key={sede.id} value={String(sede.id)}>
                {getSedeLabel(sede.nombre)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por método de pago"
            value={metodoPago}
            onChange={(event) => setMetodoPago(event.target.value)}
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          >
            <option value="todos">Todos los métodos</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <span>
            {cargando ? "Buscando..." : `${ventas.length} de ${totalRegistros} ventas cargadas`}
          </span>
          <span className="font-semibold">{formatCOP(totalVendido)}</span>
        </div>

        {error && (
          <p role="alert" className="shrink-0 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <ScrollArea className="min-h-0 flex-1 rounded-xl border">
          {cargando ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando ventas...
            </div>
          ) : ventas.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No hay ventas que coincidan con estos filtros.
            </p>
          ) : (
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Artículos</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Neto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell className="whitespace-nowrap">{formatFechaHora(venta.fecha)}</TableCell>
                    <TableCell>{venta.empleado}</TableCell>
                    <TableCell>{venta.sede}</TableCell>
                    <TableCell className="max-w-56 truncate" title={venta.articulos}>
                      {venta.articulos}
                    </TableCell>
                    <TableCell className={`capitalize ${venta.metodoPago === "efectivo" ? "" : "font-medium text-emerald-700"}`}>
                      {venta.metodoPago}
                    </TableCell>
                    <TableCell className="max-w-40 truncate" title={venta.notasTransferencia ?? undefined}>
                      {venta.notasTransferencia ?? "-"}
                    </TableCell>
                    <TableCell>
                      {venta.totalCodigo > 0 ? <Badge variant="outline">{formatCOP(venta.totalCodigo)}</Badge> : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {venta.totalNeta > 0 ? formatCOP(venta.totalNeta) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCOP(venta.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {hayMas && (
          <div className="shrink-0 text-center">
            <Button type="button" variant="outline" onClick={cargarMas} disabled={cargandoMas || cargando}>
              {cargandoMas && <Loader2 className="size-4 animate-spin" />}
              {cargandoMas ? "Cargando..." : `Cargar más ventas (${ventas.length} de ${totalRegistros})`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
