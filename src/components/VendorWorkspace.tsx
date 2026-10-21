"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { SalesTerminal } from "@/components/SalesTerminal";
import { SalesFeed } from "@/components/SalesFeed";
import type { Empleado, Sede } from "@/lib/types";

interface VendorWorkspaceProps {
  empleados: Empleado[];
  sedes: Sede[];
}

export function VendorWorkspace({ empleados, sedes }: VendorWorkspaceProps) {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-100 bg-[linear-gradient(110deg,#fff7f8,#ffffff_62%,#f4faf7)] p-5 sm:flex-row sm:items-center sm:p-7">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            <Sparkles className="size-4" /> Punto de venta
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Registra una venta</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Busca productos, ajusta la venta y confirma el pago.</p>
        </div>
        <div className="rounded-xl border border-white bg-white/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <span className="font-semibold text-foreground">{empleados.length}</span> vendedores disponibles
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SalesTerminal empleados={empleados} onSaleRegistered={() => setRefreshSignal((s) => s + 1)} />
        <SalesFeed refreshSignal={refreshSignal} sedes={sedes} />
      </div>
    </div>
  );
}
