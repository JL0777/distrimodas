import { listAllSales } from "@/actions/sales";
import { listLiquidaciones } from "@/actions/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{ desde?: string; hasta?: string; metodoPago?: string }>;
}

const METODOS_PAGO: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

export default async function VentasPage({ searchParams }: VentasPageProps) {
  const filtros = await searchParams;
  const metodoPago =
    filtros.metodoPago && METODOS_PAGO.includes(filtros.metodoPago as MetodoPago)
      ? (filtros.metodoPago as MetodoPago)
      : undefined;

  const [{ ventas, totalesPorMetodo }, liquidaciones] = await Promise.all([
    listAllSales({ desde: filtros.desde, hasta: filtros.hasta, metodoPago }),
    listLiquidaciones(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Registros</h2>
        <p className="text-sm text-muted-foreground">Historico de ventas y liquidaciones de nomina</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" method="get">
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
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <Button type="submit" size="sm">
              Filtrar
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
          <CardTitle>Ventas ({ventas.length})</CardTitle>
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
              {ventas.map((venta) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Liquidaciones de nomina</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Asistentes</TableHead>
                <TableHead>Total Codigos</TableHead>
                <TableHead>Total Netas</TableHead>
                <TableHead>Pago x empleado</TableHead>
                <TableHead>Empleados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liquidaciones.map((liq) => (
                <TableRow key={liq.id}>
                  <TableCell>{new Date(liq.fecha).toLocaleDateString("es-CO")}</TableCell>
                  <TableCell>{liq.asistentesCount}</TableCell>
                  <TableCell>{formatCOP(liq.totalTiemple)}</TableCell>
                  <TableCell>{formatCOP(liq.totalNetas)}</TableCell>
                  <TableCell>{formatCOP(liq.pagoPorEmpleado)}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {liq.empleados.map((nombre) => (
                        <Badge key={nombre} variant="outline">
                          {nombre}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
