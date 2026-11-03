import { listAllSales } from "@/actions/sales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { MetodoPago } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

interface VentasPageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; metodoPago?: string; busqueda?: string }>;
}

const METODOS_PAGO: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

export default async function VentasPage({ searchParams }: VentasPageProps) {
  const filtros = await searchParams;
  const metodoPago =
    filtros.metodoPago && METODOS_PAGO.includes(filtros.metodoPago as MetodoPago)
      ? (filtros.metodoPago as MetodoPago)
      : undefined;

  const { ventas, totalesPorMetodo } = await listAllSales({
    desde: filtros.desde,
    hasta: filtros.hasta,
    metodoPago,
    busqueda: filtros.busqueda,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-heading">Registros</h2>
        <p className="page-subtitle">Busca y consulta el historial de ventas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,auto))_auto]" method="get">
            <div className="space-y-1.5">
              <Label htmlFor="busqueda">Buscar vendedor, artículo o sede</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busqueda"
                  name="busqueda"
                  defaultValue={filtros.busqueda}
                  placeholder="Ej. Camila, camisa o Punto Íntimo"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" name="desde" defaultValue={filtros.desde} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" name="hasta" defaultValue={filtros.hasta} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metodoPago">Metodo de pago</Label>
              <select
                id="metodoPago"
                name="metodoPago"
                defaultValue={filtros.metodoPago ?? ""}
                className="h-10 rounded-xl border border-input bg-white px-3 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              >
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <Button type="submit" size="sm">
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {METODOS_PAGO.map((metodo) => (
          <Card key={metodo}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground capitalize">{metodo}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCOP(totalesPorMetodo[metodo])}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas ({ventas.length}{ventas.length === 200 ? "+" : ""})</CardTitle>
        </CardHeader>
        <CardContent>
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
              {ventas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    No hay ventas para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : ventas.map((venta) => (
                <TableRow key={venta.id}>
                  <TableCell>{formatFecha(venta.fecha)}</TableCell>
                  <TableCell>{venta.empleado}</TableCell>
                  <TableCell>{venta.sede}</TableCell>
                  <TableCell className="max-w-48 truncate" title={venta.articulos}>
                    {venta.articulos}
                  </TableCell>
                  <TableCell className="capitalize">{venta.metodoPago}</TableCell>
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
                  <TableCell className="text-right">{formatCOP(venta.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
