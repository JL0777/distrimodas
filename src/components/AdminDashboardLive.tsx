"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Gem,
  Landmark,
  WalletCards,
} from "lucide-react";
import { getDashboardResumen } from "@/actions/sales";
import type { DashboardResumen } from "@/actions/sales";
import { Card } from "@/components/ui/card";
import { LiveSalesTable } from "@/components/LiveSalesTable";
import type { Sede } from "@/lib/types";

const POLL_MS = 5000;

function formatCOP(valor: number) {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

const METODOS_PAGO = {
  efectivo: { label: "Efectivo", icon: Banknote },
  tarjeta: { label: "Tarjeta", icon: CreditCard },
  transferencia: { label: "Transferencia", icon: Landmark },
} as const;

interface AdminDashboardLiveProps {
  sedes: Sede[];
  sedeInicialId: number | null;
  resumenInicial: DashboardResumen;
  yaLiquidado: boolean;
}

export function AdminDashboardLive({
  sedes,
  sedeInicialId,
  resumenInicial,
  yaLiquidado,
}: AdminDashboardLiveProps) {
  const [sedeId, setSedeId] = useState<number | null>(sedeInicialId);
  const [resumen, setResumen] = useState(resumenInicial);
  const [expandirMetodos, setExpandirMetodos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargarResumen() {
      setCargando(true);
      try {
        const nuevoResumen = await getDashboardResumen(sedeId);
        if (!cancelado) {
          setResumen(nuevoResumen);
          setError(null);
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? `No se pudo actualizar el resumen: ${err.message}`
              : "No se pudo actualizar el resumen del día."
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarResumen();
    const intervalId = setInterval(cargarResumen, POLL_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalId);
    };
  }, [sedeId]);

  return (
    <div className="space-y-5">
      <LiveSalesTable sedeId={sedeId} sedes={sedes} onSedeChange={setSedeId} />

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          className={`border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#f0faf5)] transition-all duration-300 ${
            expandirMetodos ? "sm:col-span-2 xl:col-span-2" : ""
          } ${cargando ? "opacity-80" : ""}`}
        >
          <button
            type="button"
            aria-expanded={expandirMetodos}
            aria-controls="metodos-pago-detalle"
            onClick={() => setExpandirMetodos((actual) => !actual)}
            className="w-full cursor-pointer text-left outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-emerald-600/15"
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5">
              <span className="text-sm font-medium text-muted-foreground">Total vendido hoy</span>
              <span className="flex items-center gap-2">
                <CircleDollarSign className="size-5 text-emerald-600" />
                <ChevronDown
                  className={`size-4 text-emerald-700 transition-transform duration-300 ${
                    expandirMetodos ? "rotate-180" : ""
                  }`}
                />
              </span>
            </div>
            <div className="px-5 pb-5 pt-2">
              <p className="text-2xl font-bold tracking-tight text-emerald-800">
                {formatCOP(resumen.totalVendidoHoy)}
              </p>
              <p className="mt-1 text-xs text-emerald-800/65">
                {expandirMetodos ? "Toca para ocultar el detalle" : "Toca para ver métodos de pago"}
              </p>
            </div>
          </button>
          <div
            id="metodos-pago-detalle"
            aria-hidden={!expandirMetodos}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              expandirMetodos ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="mx-5 border-t border-emerald-200/70 py-4">
                <ul className="space-y-3">
                  {resumen.ventasPorMetodo.map(({ metodoPago, total }) => {
                    const MetodoIcon = METODOS_PAGO[metodoPago].icon;
                    return (
                      <li
                        key={metodoPago}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="flex items-center gap-2 text-emerald-900/70">
                          <MetodoIcon className="size-4" />
                          {METODOS_PAGO[metodoPago].label}
                        </span>
                        <span className="font-semibold text-emerald-950">{formatCOP(total)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-emerald-200/70 pt-3 text-sm font-bold text-emerald-900">
                  <span>Total</span>
                  <span>{formatCOP(resumen.totalVendidoHoy)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className={`p-5 transition-opacity duration-200 ${cargando ? "opacity-80" : ""}`}>
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Códigos (tiemple) hoy <Gem className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight">{formatCOP(resumen.totalCodigosHoy)}</p>
        </Card>

        <Card className={`p-5 transition-opacity duration-200 ${cargando ? "opacity-80" : ""}`}>
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Ventas netas hoy <WalletCards className="size-5 text-sky-600" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight">{formatCOP(resumen.totalNetasHoy)}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Estado del día <BadgeCheck className="size-5 text-amber-600" />
          </div>
          <p className={`mt-3 text-2xl font-bold tracking-tight ${yaLiquidado ? "text-emerald-700" : "text-amber-700"}`}>
            {yaLiquidado ? "Liquidado" : "Pendiente"}
          </p>
        </Card>
      </div>
    </div>
  );
}
