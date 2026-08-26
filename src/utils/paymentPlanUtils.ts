/**
 * Utilidad para Generación del Plan de Pagos Contractual
 * Base de cálculo: 30 días comerciales por mes
 */

export interface ContratoParaPlanPagos {
  valor_total_contrato: number | string;
  valor_mensual?: number | string;
  fecha_inicio: string; // Formatos: 'YYYY-MM-DD' o 'DD/MM/YYYY'
  fecha_fin: string;    // Formatos: 'YYYY-MM-DD' o 'DD/MM/YYYY'
}

export interface PeriodoPagoItem {
  numero_pago: number;
  mes: string;                  // Ej: "Enero 2026"
  nombre_mes: string;           // Ej: "Enero"
  anio: number;                 // Ej: 2026
  fecha_inicio_periodo: string; // 'YYYY-MM-DD'
  fecha_fin_periodo: string;    // 'YYYY-MM-DD'
  periodo_texto: string;        // Ej: "DEL 14 DE ENERO AL 31 DE ENERO 2026"
  dias: number;
  valor_pagado: number;
  valor_pagado_formateado: string;       // Ej: "$ 1.780.426,67"
  valor_acumulado: number;
  valor_acumulado_formateado: string;    // Ej: "$ 1.780.426,67"
  porcentaje_ejecucion: number;
  porcentaje_ejecucion_formateado: string; // Ej: "8,89 %"
  porcentaje_acumulado: number;
  porcentaje_acumulado_formateado: string; // Ej: "8,89 %"
  saldo_restante: number;
  saldo_restante_formateado: string;     // Ej: "$ 18.249.373,33"
}

export interface PlanDePagosResult {
  resumen: {
    valor_total_contrato: number;
    valor_total_formateado: string;
    valor_mensual: number;
    valor_diario: number;
    total_dias_computados: number;
    total_periodos: number;
    porcentaje_total_ejecutado: number;
    saldo_final: number;
  };
  periodos: PeriodoPagoItem[];
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Normaliza y analiza fechas en formato 'YYYY-MM-DD' o 'DD/MM/YYYY'
 */
function parsearFecha(fechaStr: string): { year: number; month: number; day: number } {
  if (!fechaStr) {
    throw new Error('Fecha no proporcionada');
  }

  const clean = fechaStr.trim();
  
  if (clean.includes('-')) {
    const parts = clean.split('-').map(p => parseInt(p, 10));
    if (parts[0] > 1000) {
      // YYYY-MM-DD
      return { year: parts[0], month: parts[1], day: parts[2] };
    } else {
      // DD-MM-YYYY
      return { year: parts[2], month: parts[1], day: parts[0] };
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/').map(p => parseInt(p, 10));
    if (parts[0] > 1000) {
      // YYYY/MM/DD
      return { year: parts[0], month: parts[1], day: parts[2] };
    } else {
      // DD/MM/YYYY
      return { year: parts[2], month: parts[1], day: parts[0] };
    }
  }

  const d = new Date(clean);
  if (isNaN(d.getTime())) {
    throw new Error(`Formato de fecha inválido: ${fechaStr}`);
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Limpia y convierte cualquier cadena de moneda o número a un valor float numérico real
 * Maneja formatos como "$ 20.029.800", "$ 20.029.800,00", "20029800", "3.338.300,00", etc.
 */
export function limpiarNumeroMoneda(valStr: string | number | undefined | null): number {
  if (valStr === undefined || valStr === null) return 0;
  if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
  
  let str = valStr.toString().trim();
  if (!str || str === '-' || str === 'N/A') return 0;

  // Quitar el signo de moneda y espacios
  str = str.replace(/\$/g, '').trim();

  // Si tiene coma decimal (formato colombiano: 20.029.800,00 o 1.780.426,67)
  if (str.includes(',')) {
    // Los puntos son separadores de miles y la coma es decimal
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    // Si tiene puntos pero no coma:
    const parts = str.split('.');
    if (parts.length > 2) {
      // Múltiples puntos -> separadores de miles (ej: 20.029.800)
      str = parts.join('');
    } else if (parts.length === 2) {
      if (parts[1].length === 3) {
        // Ej: 20.000 -> probablemente miles
        str = parts.join('');
      } else if (parts[1].length <= 2) {
        // Ej: 20000.50 -> decimal
        str = parts[0] + '.' + parts[1];
      } else {
        str = parts.join('');
      }
    }
  } else {
    str = str.replace(/[^0-9]/g, '');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Obtiene el último día calendario de un mes dado
 */
function getUltimoDiaMesCalendario(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formateador de moneda colombiana sin decimales por defecto (estilo $ 1.780.427)
 */
export function formatearMonedaCol(valor: number, conDecimales: boolean = false): string {
  if (!conDecimales) {
    const entero = Math.round(valor);
    const enteroFormateado = Math.abs(entero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const signo = valor < 0 ? '-' : '';
    return `${signo}$ ${enteroFormateado}`;
  }
  const parts = Math.abs(valor).toFixed(2).split('.');
  const enteroFormateado = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signo = valor < 0 ? '-' : '';
  return `${signo}$ ${enteroFormateado},${parts[1]}`;
}

/**
 * Formateador de porcentaje con 2 decimales (estilo 8,89 %)
 */
export function formatearPorcentajeCol(porcentaje: number): string {
  return `${porcentaje.toFixed(2).replace('.', ',')} %`;
}

/**
 * Genera el plan de pagos contractual y porcentajes de ejecución bajo norma de 30 días
 */
export function generarPlanDePagos(contrato: ContratoParaPlanPagos): PeriodoPagoItem[] {
  const valorTotal = limpiarNumeroMoneda(contrato.valor_total_contrato);
  let valorMensual = contrato.valor_mensual !== undefined ? limpiarNumeroMoneda(contrato.valor_mensual) : 0;

  if (isNaN(valorTotal) || valorTotal <= 0) {
    throw new Error('Valor total contractual inválido.');
  }

  const inicio = parsearFecha(contrato.fecha_inicio);
  const fin = parsearFecha(contrato.fecha_fin);

  // Si no se suministró valor mensual, calcularlo según el plazo en meses del contrato
  if (!valorMensual || valorMensual <= 0) {
    const mesesDif = (fin.year - inicio.year) * 12 + (fin.month - inicio.month);
    const diasExtra = fin.day - inicio.day;
    const duracionMeses = Math.max(1, mesesDif + (diasExtra >= 0 ? 0 : 0));
    valorMensual = Math.round((valorTotal / duracionMeses) * 100) / 100;
  }

  // Valor diario comercial de alta precisión (30 días por mes)
  const valorDiario = valorMensual / 30;

  // Generar lista de meses entre inicio y fin
  interface MesIntervalo {
    year: number;
    month: number; // 1-12
    isFirst: boolean;
    isLast: boolean;
  }

  const meses: MesIntervalo[] = [];
  let curYear = inicio.year;
  let curMonth = inicio.month;

  while (curYear < fin.year || (curYear === fin.year && curMonth <= fin.month)) {
    meses.push({
      year: curYear,
      month: curMonth,
      isFirst: curYear === inicio.year && curMonth === inicio.month,
      isLast: curYear === fin.year && curMonth === fin.month,
    });

    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }

  const totalPeriodos = meses.length;
  const periodos: PeriodoPagoItem[] = [];

  let valorAcumulado = 0;
  let porcentajeAcumulado = 0;

  for (let i = 0; i < totalPeriodos; i++) {
    const itemMes = meses[i];
    const numeroPago = i + 1;
    const esUltimo = i === totalPeriodos - 1;
    const esPrimero = i === 0;

    let diasPeriodo = 30;
    let diaInicioPeriodo = 1;
    let diaFinPeriodo = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);

    if (totalPeriodos === 1) {
      // Contrato de un solo mes
      diaInicioPeriodo = inicio.day;
      diaFinPeriodo = fin.day;
      if (inicio.day === 1 && fin.day === getUltimoDiaMesCalendario(itemMes.year, itemMes.month)) {
        diasPeriodo = 30;
      } else {
        diasPeriodo = Math.max(1, fin.day - (inicio.day === 1 ? 0 : inicio.day));
      }
    } else if (esPrimero) {
      // Primer periodo: si inicia el día 14, días = 30 - 14 = 16 (sin +1)
      diaInicioPeriodo = inicio.day;
      diaFinPeriodo = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      diasPeriodo = inicio.day === 1 ? 30 : Math.max(1, 30 - inicio.day);
    } else if (esUltimo) {
      // Último periodo: si finaliza el día 14, días a pagar son exactamente 14 días
      diaInicioPeriodo = 1;
      diaFinPeriodo = fin.day;
      const ultimoDiaCal = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      diasPeriodo = fin.day >= ultimoDiaCal ? 30 : Math.max(1, fin.day);
    } else {
      // Meses intermedios completos: Siempre 30 días
      diaInicioPeriodo = 1;
      diaFinPeriodo = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      diasPeriodo = 30;
    }

    // Cálculo del valor del periodo
    let valorPeriodo: number;
    if (esUltimo) {
      // El último pago se calcula restando el valor acumulado anterior al valor total del contrato
      valorPeriodo = valorTotal - valorAcumulado;
    } else {
      valorPeriodo = diasPeriodo === 30 ? valorMensual : valorDiario * diasPeriodo;
    }

    // Porcentaje de ejecución financiera sobre el total del contrato
    const porcentajePeriodo = (valorPeriodo / valorTotal) * 100;

    valorAcumulado += valorPeriodo;
    porcentajeAcumulado = esUltimo ? 100 : porcentajeAcumulado + porcentajePeriodo;
    const saldoRestante = esUltimo ? 0 : Math.max(0, valorTotal - valorAcumulado);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fechaInicioStr = `${itemMes.year}-${pad(itemMes.month)}-${pad(diaInicioPeriodo)}`;
    const fechaFinStr = `${itemMes.year}-${pad(itemMes.month)}-${pad(diaFinPeriodo)}`;

    const nombreMes = NOMBRES_MESES[itemMes.month - 1];
    const mesEtiqueta = `${nombreMes} ${itemMes.year}`;
    const periodoTexto = `DEL ${pad(diaInicioPeriodo)} DE ${nombreMes.toUpperCase()} AL ${pad(diaFinPeriodo)} DE ${nombreMes.toUpperCase()} ${itemMes.year}`;

    periodos.push({
      numero_pago: numeroPago,
      mes: mesEtiqueta,
      nombre_mes: nombreMes,
      anio: itemMes.year,
      fecha_inicio_periodo: fechaInicioStr,
      fecha_fin_periodo: fechaFinStr,
      periodo_texto: periodoTexto,
      dias: diasPeriodo,
      valor_pagado: valorPeriodo,
      valor_pagado_formateado: formatearMonedaCol(valorPeriodo),
      valor_acumulado: valorAcumulado,
      valor_acumulado_formateado: formatearMonedaCol(valorAcumulado),
      porcentaje_ejecucion: porcentajePeriodo,
      porcentaje_ejecucion_formateado: formatearPorcentajeCol(porcentajePeriodo),
      porcentaje_acumulado: porcentajeAcumulado,
      porcentaje_acumulado_formateado: formatearPorcentajeCol(porcentajeAcumulado),
      saldo_restante: saldoRestante,
      saldo_restante_formateado: formatearMonedaCol(saldoRestante),
    });
  }

  return periodos;
}

/**
 * Obtiene los datos calculados para la sección 6 (Liquidación del pago) del Certificado de Supervisión
 * según el número de pago o informe.
 */
export function getDatosLiquidacionPeriodo(
  contrato: ContratoParaPlanPagos,
  numeroPago: number | string
): {
  pagoNro: string;
  periodoDesde: string;
  periodoHasta: string;
  porcentajeEjecucion: string;
  valorPagadoAcumulado: string;
  valorAPagarSinIva: string;
  iva: string;
  valorTotalAPagar: string;
  saldoPorPagar: string;
  periodoItem?: PeriodoPagoItem;
} | null {
  try {
    const periodos = generarPlanDePagos(contrato);
    if (!periodos || periodos.length === 0) return null;

    const num = typeof numeroPago === 'string' ? parseInt(numeroPago, 10) : numeroPago;
    const targetIdx = isNaN(num) || num < 1 ? 0 : Math.min(num - 1, periodos.length - 1);
    const item = periodos[targetIdx];

    // Formatear fechas a DD/MM/YYYY
    const formatFecha = (isoStr: string) => {
      if (!isoStr) return '';
      const parts = isoStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        } else {
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
      }
      return isoStr;
    };

    // Formato numérico sin decimales y sin signo de peso para inputs de tabla (ej. 1.780.427 o 3.338.300)
    const formatNumeroTabla = (val: number): string => {
      if (val === 0) return '0';
      const rounded = Math.round(val);
      return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(rounded);
    };

    const valorPagadoAnterior = targetIdx === 0 ? 0 : periodos[targetIdx - 1].valor_acumulado;

    return {
      pagoNro: item.numero_pago.toString(),
      periodoDesde: formatFecha(item.fecha_inicio_periodo),
      periodoHasta: formatFecha(item.fecha_fin_periodo),
      porcentajeEjecucion: `${item.porcentaje_acumulado.toFixed(2).replace('.', ',')} %`,
      valorPagadoAcumulado: formatNumeroTabla(valorPagadoAnterior),
      valorAPagarSinIva: formatNumeroTabla(item.valor_pagado),
      iva: '-',
      valorTotalAPagar: formatNumeroTabla(item.valor_pagado),
      saldoPorPagar: item.saldo_restante === 0 ? '0' : formatNumeroTabla(item.saldo_restante),
      periodoItem: item,
    };
  } catch (err) {
    console.warn('Error calculando datos de liquidación del periodo:', err);
    return null;
  }
}

/**
 * Función extendida que retorna el resumen consolidado además de los periodos
 */
export function generarPlanDePagosCompleto(contrato: ContratoParaPlanPagos): PlanDePagosResult {
  const periodos = generarPlanDePagos(contrato);
  const valorTotal = typeof contrato.valor_total_contrato === 'string'
    ? parseFloat(contrato.valor_total_contrato.replace(/[$. ]/g, '').replace(',', '.'))
    : Number(contrato.valor_total_contrato);

  const valorMensual = typeof contrato.valor_mensual === 'string'
    ? parseFloat(contrato.valor_mensual.replace(/[$. ]/g, '').replace(',', '.'))
    : Number(contrato.valor_mensual);

  const totalDias = periodos.reduce((acc, p) => acc + p.dias, 0);

  return {
    resumen: {
      valor_total_contrato: valorTotal,
      valor_total_formateado: formatearMonedaCol(valorTotal),
      valor_mensual: valorMensual,
      valor_diario: valorMensual / 30,
      total_dias_computados: totalDias,
      total_periodos: periodos.length,
      porcentaje_total_ejecutado: 100,
      saldo_final: 0,
    },
    periodos,
  };
}
