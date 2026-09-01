// Formula de liquidacion de nomina solidaria. Funcion pura para poder
// reutilizarla tanto en el preview del cliente como en el server action.

export const BASICO_DIARIO = 55000;
export const PORCENTAJE_TIEMPLE = 0.5; // 50% para empleados, 50% se lo queda el almacen
export const PORCENTAJE_NETAS = 0.02; // 2% de las ventas netas se reparte

export interface PayrollCalculo {
  totalTiemple: number;
  totalNetas: number;
  asistentesCount: number;
  pagoTiemplePorEmpleado: number;
  pagoNetasPorEmpleado: number;
  pagoTotalPorEmpleado: number;
}

export function calcularLiquidacion(
  totalTiemple: number,
  totalNetas: number,
  asistentesCount: number
): PayrollCalculo {
  if (asistentesCount <= 0) {
    return {
      totalTiemple,
      totalNetas,
      asistentesCount,
      pagoTiemplePorEmpleado: 0,
      pagoNetasPorEmpleado: 0,
      pagoTotalPorEmpleado: 0,
    };
  }

  const pagoTiemplePorEmpleado = (totalTiemple * PORCENTAJE_TIEMPLE) / asistentesCount;
  const pagoNetasPorEmpleado = (totalNetas * PORCENTAJE_NETAS) / asistentesCount;
  const pagoTotalPorEmpleado = BASICO_DIARIO + pagoTiemplePorEmpleado + pagoNetasPorEmpleado;

  return {
    totalTiemple,
    totalNetas,
    asistentesCount,
    pagoTiemplePorEmpleado,
    pagoNetasPorEmpleado,
    pagoTotalPorEmpleado,
  };
}
