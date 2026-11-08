"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Package,
  ReceiptText,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  getAdminSalesDayDetails,
  type AdminSalesDayDetails,
} from "@/actions/sales";
import type { MetodoPago } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAYMENT_DETAILS: Record<MetodoPago, { label: string; icon: typeof Banknote }> = {
  efectivo: { label: "Efectivo", icon: Banknote },
  tarjeta: { label: "Tarjeta", icon: CreditCard },
  transferencia: { label: "Transferencia", icon: Landmark },
};

function formatCOP(value: number) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

interface SalesDayDetailDialogProps {
  fecha: string | null;
  onOpenChange: (open: boolean) => void;
}

export function SalesDayDetailDialog({ fecha, onOpenChange }: SalesDayDetailDialogProps) {
  const [detail, setDetail] = useState<AdminSalesDayDetails | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sedeSeleccionada, setSedeSeleccionada] = useState("todas");
  const [metodoSeleccionado, setMetodoSeleccionado] = useState("todos");

  useEffect(() => {
    if (!fecha) return;
    let cancelado = false;
    const timeoutId = setTimeout(() => {
      setCargando(true);
      setError(null);
      setSedeSeleccionada("todas");
      setMetodoSeleccionado("todos");

      getAdminSalesDayDetails(fecha)
        .then((data) => {
          if (!cancelado) setDetail(data);
        })
        .catch((loadError: unknown) => {
          if (!cancelado) {
            setError(loadError instanceof Error ? loadError.message : "No se pudo consultar el día.");
          }
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }, 0);

    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
  }, [fecha]);

  const activeDetail = detail?.fecha === fecha ? detail : null;
  const filteredSales = useMemo(
    () =>
      (activeDetail?.ventas ?? []).filter(
        (sale) =>
          (sedeSeleccionada === "todas" || sale.sede === sedeSeleccionada) &&
          (metodoSeleccionado === "todos" || sale.metodoPago === metodoSeleccionado)
      ),
    [activeDetail, sedeSeleccionada, metodoSeleccionado]
  );
  const filteredTotal = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const maxSellerTotal = Math.max(...(activeDetail?.vendedores.map((seller) => seller.total) ?? [0]), 1);
  const maxProductCount = Math.max(...(activeDetail?.productos.map((product) => product.cantidad) ?? [0]), 1);

  return (
    <Dialog open={Boolean(fecha)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[96dvh] max-h-[96dvh] w-[calc(100vw-1rem)] max-w-none flex-col gap-4 overflow-hidden rounded-2xl p-3 sm:h-[94dvh] sm:max-h-[94dvh] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:p-5 lg:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl capitalize text-slate-950">
                {fecha ? formatLongDate(fecha) : "Detalle del día"}
              </DialogTitle>
              <DialogDescription>
                Ventas, métodos de pago, desempeño por vendedor y detalle de nómina.
              </DialogDescription>
            </div>
            {activeDetail && (
              <Badge
                className={`ml-auto gap-1.5 ${
                  activeDetail.liquidada
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                    : "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
                }`}
              >
                {activeDetail.liquidada ? <CheckCircle2 className="size-3.5" /> : <ReceiptText className="size-3.5" />}
                {activeDetail.liquidada ? "Completado y liquidado" : "Pendiente de liquidación"}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {cargando || (!activeDetail && !error) ? (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Cargando información del día...
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : activeDetail ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 pr-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total vendido"
                  value={formatCOP(activeDetail.resumen.totalVentas)}
                  detail={`${activeDetail.resumen.cantidadVentas} ventas registradas`}
                  icon={Wallet}
                  color="emerald"
                />
                <MetricCard
                  label="Códigos"
                  value={formatCOP(activeDetail.resumen.totalCodigos)}
                  detail="Suma de códigos vendidos"
                  icon={ReceiptText}
                  color="rose"
                />
                <MetricCard
                  label="Ventas netas"
                  value={formatCOP(activeDetail.resumen.totalNetas)}
                  detail="Valor de artículos sin código"
                  icon={Package}
                  color="sky"
                />
                <MetricCard
                  label="Total nómina"
                  value={formatCOP(activeDetail.resumen.totalNomina)}
                  detail={
                    activeDetail.liquidada
                      ? `${formatCOP(activeDetail.resumen.pagoPorEmpleado)} por empleado`
                      : "Se registra al liquidar el día"
                  }
                  icon={UsersRound}
                  color="amber"
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">Registro de ventas</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {filteredSales.length} de {activeDetail.ventas.length} ventas · {formatCOP(filteredTotal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label="Filtrar las ventas por sede"
                        value={sedeSeleccionada}
                        onChange={(event) => setSedeSeleccionada(event.target.value)}
                        className="h-9 min-w-36 rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                      >
                        <option value="todas">Todas las sedes</option>
                        {activeDetail.ventasPorSede.map((site) => (
                          <option key={site.sede} value={site.sede}>{site.sede}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrar las ventas por método de pago"
                        value={metodoSeleccionado}
                        onChange={(event) => setMetodoSeleccionado(event.target.value)}
                        className="h-9 min-w-36 rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                      >
                        <option value="todos">Todos los métodos</option>
                        {Object.entries(PAYMENT_DETAILS).map(([method, details]) => (
                          <option key={method} value={method}>{details.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead>Hora</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Sede</TableHead>
                          <TableHead>Artículos</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Código</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSales.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                              No hay ventas para estos filtros.
                            </TableCell>
                          </TableRow>
                        ) : filteredSales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="whitespace-nowrap">{sale.hora}</TableCell>
                            <TableCell className="font-medium">{sale.empleado}</TableCell>
                            <TableCell>{sale.sede}</TableCell>
                            <TableCell className="max-w-56 truncate" title={sale.articulos}>{sale.articulos}</TableCell>
                            <TableCell className={`capitalize ${sale.metodoPago === "efectivo" ? "" : "font-medium text-emerald-700"}`}>
                              {sale.metodoPago}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {sale.totalCodigo > 0 ? formatCOP(sale.totalCodigo) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap">{formatCOP(sale.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="font-semibold text-slate-950">Métodos de pago</h3>
                    <div className="mt-4 space-y-3">
                      {activeDetail.ventasPorMetodo.map(({ metodoPago, total }) => {
                        const payment = PAYMENT_DETAILS[metodoPago];
                        const Icon = payment.icon;
                        const share = activeDetail.resumen.totalVentas > 0
                          ? Math.round((total / activeDetail.resumen.totalVentas) * 100)
                          : 0;
                        return (
                          <div key={metodoPago} className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                              <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2 text-sm">
                                <span className="capitalize text-slate-600">{payment.label}</span>
                                <span className="font-medium text-slate-900">{formatCOP(total)}</span>
                              </div>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-rose-500" style={{ width: `${share}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-950">Ventas por sede</h3>
                    </div>
                    <div className="mt-3 divide-y divide-slate-100">
                      {activeDetail.ventasPorSede.map((site) => (
                        <div key={site.sede} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-800">{site.sede}</p>
                            <p className="text-xs text-slate-500">{site.cantidad} ventas</p>
                          </div>
                          <p className="font-semibold text-slate-900">{formatCOP(site.total)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <RankingCard
                  title="Vendedores destacados"
                  subtitle="Ordenados por valor vendido"
                  icon={UsersRound}
                  empty="No hay ventas de vendedores para este día."
                  rows={activeDetail.vendedores.map((seller) => ({
                    name: seller.empleado,
                    detail: `${seller.ventas} ventas`,
                    value: seller.total,
                    ratio: seller.total / maxSellerTotal,
                  }))}
                />
                <RankingCard
                  title="Productos más vendidos"
                  subtitle="Ordenados por unidades"
                  icon={Package}
                  empty="No hay artículos registrados para este día."
                  rows={activeDetail.productos.map((product) => ({
                    name: product.producto,
                    detail: `${product.cantidad} unidades`,
                    value: product.total,
                    ratio: product.cantidad / maxProductCount,
                  }))}
                />
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-950">Cierre de nómina</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeDetail.liquidada
                        ? `Códigos ${formatCOP(activeDetail.resumen.totalTiempleNomina)} + ventas netas ${formatCOP(activeDetail.resumen.totalNetasNomina)}`
                        : "El día todavía no tiene una liquidación guardada."}
                    </p>
                  </div>
                  {activeDetail.liquidada && (
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      Liquidación completada
                    </Badge>
                  )}
                </div>
                {activeDetail.liquidada ? (
                  activeDetail.asistentes.length > 0 ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {activeDetail.asistentes.map((person) => (
                        <div key={person.empleado} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                          <span className="truncate font-medium text-slate-700">{person.empleado}</span>
                          <span className="shrink-0 font-semibold text-slate-950">{formatCOP(person.pago)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      La liquidación existe, pero no tiene empleados asociados.
                    </p>
                  )
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Sin asistentes confirmados.</p>
                )}
              </section>
            </div>
          </ScrollArea>
        ) : null}

        <div className="flex shrink-0 justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  color: "emerald" | "rose" | "sky" | "amber";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
  }[color];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${colors}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function RankingCard({
  title,
  subtitle,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: typeof UsersRound;
  rows: { name: string; detail: string; value: number; ratio: number }[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {rows.map((row, index) => (
            <li key={row.name} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-slate-800">{row.name}</span>
                  <span className="shrink-0 font-semibold text-slate-900">{formatCOP(row.value)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(4, row.ratio * 100)}%` }} />
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">{row.detail}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
