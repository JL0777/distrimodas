"use client";

import { useState } from "react";
import { SalesTerminal } from "@/components/SalesTerminal";
import { SalesFeed } from "@/components/SalesFeed";
import type { Empleado } from "@/lib/types";

interface VendorWorkspaceProps {
  empleados: Empleado[];
}

export function VendorWorkspace({ empleados }: VendorWorkspaceProps) {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <SalesTerminal empleados={empleados} onSaleRegistered={() => setRefreshSignal((s) => s + 1)} />
      <SalesFeed refreshSignal={refreshSignal} />
    </div>
  );
}
