/**
 * Utilidad para Generación del Plan de Pagos Contractual y Liquidación de Cuentas Estatales
 * Base de cálculo: Norma comercial colombiana de 30 días por mes
 * 
 * Reglas de cálculo:
 * 1. Valor Diario = Valor Mensual Fijo / 30.
 * 2. Días Liquidados en el Período = (30 - Día_Inicio) + 1 [Si es mes completo, 30 días].
 * 3. Valor a Pagar Sin IVA = Días Liquidados * Valor Diario.
 * 4. Porcentaje de Ejecución del Período = (Valor a Pagar Sin IVA / Valor Total del Contrato) * 100.
 * 5. Saldo por Pagar = Valor Total del Contrato - (Pagos Acumulados Anteriores + Valor a Pagar Sin IVA).
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
  periodo_texto: string;        // Ej: "DEL 13 DE AGOSTO AL 31 DE AGOSTO 2026"
  dias: number;
  valor_pagado: number;
  valor_pagado_formateado: string;       // Ej: "$ 2.160.000"
  valor_acumulado: number;
  valor_acumulado_formateado: string;    // Ej: "$ 2.160.000"
  porcentaje_ejecucion: number;
  porcentaje_ejecucion_formateado: string; // Ej: "13,33 %"
  porcentaje_acumulado: number;
  porcentaje_acumulado_formateado: string; // Ej: "13,33 %"
  saldo_restante: number;
  saldo_restante_formateado: string;     // Ej: "$ 14.040.000"
}

export interface LiquidacionDetalladaResult {
  valorTotalContrato: number;
  valorMensual: number;
  valorDiario: number;
  diasLiquidados: number;
  valorAPagarSinIva: number;
  iva: number;
  valorTotalAPagar: number;
  
  // Porcentajes
  porcentajePeriodo: number;
  porcentajeAcumulado: number;
  porcentajeEjecucion: number; // Porcentaje acumulado a la fecha para el Certificado
  
  pagosAcumuladosAnteriores: number;
  totalAcumuladoPagado: number;
  saldoPorPagar: number;
  
  // Strings formateados para certificados y vistas
  valorTotalContratoFormateado: string;
  valorMensualFormateado: string;
  valorDiarioFormateado: string;
  valorAPagarSinIvaFormateado: string;
  valorTotalAPagarFormateado: string;
  porcentajePeriodoFormateado: string;
  porcentajeAcumuladoFormateado: string;
  porcentajeEjecucionFormateado: string;
  pagosAcumuladosFormateado: string;
  totalAcumuladoPagadoFormateado: string;
  saldoPorPagarFormateado: string;
  
  // Formato tabla (sin símbolo $)
  valorAPagarTabla: string;
  valorPagadoAcumuladoTabla: string;
  saldoPorPagarTabla: string;
  porcentajeTabla: string;
  fechaInicioPago?: string;
  fechaFinPago?: string;
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
 * Normaliza y analiza fechas en formato 'YYYY-MM-DD' o 'DD/MM/YYYY' o 'DD-MM-YYYY'
 */
export function parsearFecha(fechaStr: string): { year: number; month: number; day: number } {
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
 * Maneja formatos como "$ 16.200.000", "$ 16.200.000,00", "16200000", "3.600.000,00", etc.
 */
export function limpiarNumeroMoneda(valStr: string | number | undefined | null): number {
  if (valStr === undefined || valStr === null) return 0;
  if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
  
  let str = valStr.toString().trim();
  if (!str || str === '-' || str === 'N/A') return 0;

  // Si viene con texto tipo "DOS MILLONES ... ($2.160.000)", extraer el bloque entre paréntesis o con $
  const parenthesizedMatch = str.match(/\(\s*\$?([\d.,]+)\s*\)/);
  if (parenthesizedMatch) {
    str = parenthesizedMatch[1];
  } else {
    // Si hay texto largo con un valor monetario adentro
    const currencyMatch = str.match(/\$\s*([\d.,]+)/);
    if (currencyMatch) {
      str = currencyMatch[1];
    }
  }

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
 * Obtiene el último día calendario de un mes dado (ej: Febrero 28 o 29, Agosto 31, etc.)
 */
export function getUltimoDiaMesCalendario(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formateador de moneda colombiana sin decimales por defecto (estilo $ 2.160.000)
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
 * Formateador numérico para tablas (sin signo $)
 */
export function formatearNumeroTablaCol(valor: number): string {
  if (valor === 0) return '0';
  const rounded = Math.round(valor);
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}

/**
 * Formateador de porcentaje con 2 decimales (estilo 13,33 %)
 */
export function formatearPorcentajeCol(porcentaje: number): string {
  return `${porcentaje.toFixed(2).replace('.', ',')} %`;
}

/**
 * Calcula los días comerciales de un período según la norma colombiana de 30 días:
 * - Mes completo (Día 1 a Fin de Mes): 30 días.
 * - Inicio fraccionado hasta Fin de Mes: (30 - Día_Inicio) + 1 días.
 * - Inicio Día 1 hasta día intermedio Y: Y días (hasta máx 30).
 * - Inicio Día X hasta día Y del mismo mes: (Math.min(Y, 30) - X) + 1 días.
 */
export function calcularDiasComerciales(fechaInicioStr: string, fechaFinStr: string): number {
  try {
    const inicio = parsearFecha(fechaInicioStr);
    const fin = parsearFecha(fechaFinStr);

    if (inicio.year === fin.year && inicio.month === fin.month) {
      const ultimoDiaCal = getUltimoDiaMesCalendario(inicio.year, inicio.month);
      const esInicioMes = inicio.day === 1;
      const esFinMes = fin.day >= ultimoDiaCal || fin.day >= 30;

      if (esInicioMes && esFinMes) {
        return 30;
      }
      if (esFinMes) {
        return Math.max(1, (30 - inicio.day) + 1);
      }
      if (esInicioMes) {
        return Math.min(fin.day, 30);
      }
      return Math.max(1, (Math.min(fin.day, 30) - inicio.day) + 1);
    }

    // Período que abarca múltiples meses
    let totalDias = 0;
    let curYear = inicio.year;
    let curMonth = inicio.month;

    while (curYear < fin.year || (curYear === fin.year && curMonth <= fin.month)) {
      const isFirst = curYear === inicio.year && curMonth === inicio.month;
      const isLast = curYear === fin.year && curMonth === fin.month;
      const ultimoDiaCal = getUltimoDiaMesCalendario(curYear, curMonth);

      if (isFirst) {
        if (inicio.day === 1) {
          totalDias += 30;
        } else {
          totalDias += Math.max(1, (30 - inicio.day) + 1);
        }
      } else if (isLast) {
        if (fin.day >= ultimoDiaCal || fin.day >= 30) {
          totalDias += 30;
        } else {
          totalDias += Math.min(fin.day, 30);
        }
      } else {
        totalDias += 30;
      }

      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }

    return Math.max(1, totalDias);
  } catch (e) {
    console.warn('Error calculando días comerciales:', e);
    return 30;
  }
}

/**
 * Función central de Liquidación de Contratos Estatales en Colombia
 * Aplica con exactitud matemática las 5 reglas comerciales solicitadas:
 * 1. Valor Diario = Valor Mensual Fijo / 30.
 * 2. Días Liquidados en el Período = (30 - Día_Inicio) + 1 [Si es mes completo, usar 30 días].
 * 3. Valor a Pagar Sin IVA = Días Liquidados * Valor Diario.
 * 4. Porcentaje de Ejecución del Período = (Valor a Pagar Sin IVA / Valor Total del Contrato) * 100.
 * 5. Saldo por Pagar = Valor Total del Contrato - (Pagos Acumulados Anteriores + Valor a Pagar Sin IVA).
 */
export function calcularLiquidacionEstatal(params: {
  valorTotalContrato: number | string;
  valorMensual?: number | string;
  fechaInicioPago: string;
  fechaFinPago: string;
  pagosAcumuladosAnteriores?: number | string;
  esUltimoPago?: boolean;
  fechaFinContrato?: string;
}): LiquidacionDetalladaResult {
  const valorTotal = limpiarNumeroMoneda(params.valorTotalContrato);
  let valorMensual = params.valorMensual !== undefined ? limpiarNumeroMoneda(params.valorMensual) : 0;
  const pagosAcumulados = limpiarNumeroMoneda(params.pagosAcumuladosAnteriores);

  // Si no se proporcionó valor mensual pero sí valor total y fechas
  if (valorMensual <= 0 && valorTotal > 0 && params.fechaInicioPago && params.fechaFinPago) {
    try {
      const inicio = parsearFecha(params.fechaInicioPago);
      const fin = parsearFecha(params.fechaFinPago);
      const mesesDif = (fin.year - inicio.year) * 12 + (fin.month - inicio.month);
      const duracionMeses = Math.max(1, mesesDif + 1);
      valorMensual = valorTotal / duracionMeses;
    } catch {
      valorMensual = valorTotal;
    }
  }

  // 1. Valor Diario = Valor Mensual Fijo / 30
  const valorDiario = valorMensual > 0 ? (valorMensual / 30) : (valorTotal / 30);

  // 2. Días Liquidados en el Período
  const diasLiquidados = calcularDiasComerciales(params.fechaInicioPago, params.fechaFinPago);

  // 3. Valor a Pagar Sin IVA = Días Liquidados * Valor Diario
  let valorAPagarSinIva: number;
  if (diasLiquidados === 30 && valorMensual > 0) {
    valorAPagarSinIva = valorMensual;
  } else {
    valorAPagarSinIva = diasLiquidados * valorDiario;
  }

  // Saldo remanente antes de este pago
  const saldoRemanente = Math.max(0, valorTotal - pagosAcumulados);

  // Detección de último pago / ajuste final por saldo remanente:
  // Si el valor a pagar excede el saldo restante del contrato o si es el último pago
  const esFinContrato = params.fechaFinContrato && params.fechaFinPago && 
    (params.fechaFinPago.includes(params.fechaFinContrato) || params.fechaFinContrato.includes(params.fechaFinPago));
  const esUltimo = params.esUltimoPago || Boolean(esFinContrato) || (saldoRemanente > 0 && valorAPagarSinIva >= saldoRemanente);

  if (esUltimo && saldoRemanente > 0) {
    // Si el valor a pagar supera o iguala el saldo remanente, se ajusta al saldo exacto para cuadre contable
    if (valorAPagarSinIva >= saldoRemanente || (valorAPagarSinIva > 0 && Math.abs(valorAPagarSinIva - saldoRemanente) < (valorDiario * 5))) {
      valorAPagarSinIva = saldoRemanente;
    }
  } else if (valorAPagarSinIva > saldoRemanente && saldoRemanente > 0) {
    valorAPagarSinIva = saldoRemanente;
  }

  // 4. Porcentajes de Ejecución: Del período y acumulado a la fecha
  const porcentajePeriodo = valorTotal > 0 ? (valorAPagarSinIva / valorTotal) * 100 : 0;
  let totalComprometido = pagosAcumulados + valorAPagarSinIva;
  let saldoPorPagar = Math.max(0, valorTotal - totalComprometido);

  let porcentajeAcumulado = valorTotal > 0 ? (totalComprometido / valorTotal) * 100 : 0;

  // Ajuste y redondeo para el último pago / fin de contrato:
  // Si sobrepasa o alcanza el 100% (por ejemplo 100.00% o 102.22% por decimales de días), redondear exactamente a 100%
  if (porcentajeAcumulado >= 99.9 || saldoPorPagar === 0 || totalComprometido >= valorTotal || (esUltimo && saldoPorPagar <= 100)) {
    porcentajeAcumulado = 100;
    saldoPorPagar = 0;
    totalComprometido = valorTotal;
  }

  const porcentajeEjecucion = porcentajeAcumulado; // Para efectos del Certificado de Supervisión, se reporta el porcentaje acumulado

  const iva = 0;
  const valorTotalAPagar = valorAPagarSinIva;

  return {
    valorTotalContrato: valorTotal,
    valorMensual,
    valorDiario,
    diasLiquidados,
    valorAPagarSinIva,
    iva,
    valorTotalAPagar,
    porcentajePeriodo,
    porcentajeAcumulado,
    porcentajeEjecucion,
    pagosAcumuladosAnteriores: pagosAcumulados,
    totalAcumuladoPagado: totalComprometido,
    saldoPorPagar,

    valorTotalContratoFormateado: formatearMonedaCol(valorTotal),
    valorMensualFormateado: formatearMonedaCol(valorMensual),
    valorDiarioFormateado: formatearMonedaCol(valorDiario),
    valorAPagarSinIvaFormateado: formatearMonedaCol(valorAPagarSinIva),
    valorTotalAPagarFormateado: formatearMonedaCol(valorTotalAPagar),
    porcentajePeriodoFormateado: formatearPorcentajeCol(porcentajePeriodo),
    porcentajeAcumuladoFormateado: formatearPorcentajeCol(porcentajeAcumulado),
    porcentajeEjecucionFormateado: formatearPorcentajeCol(porcentajeAcumulado),
    pagosAcumuladosFormateado: formatearMonedaCol(pagosAcumulados),
    totalAcumuladoPagadoFormateado: formatearMonedaCol(totalComprometido),
    saldoPorPagarFormateado: formatearMonedaCol(saldoPorPagar),

    valorAPagarTabla: formatearNumeroTablaCol(valorAPagarSinIva),
    valorPagadoAcumuladoTabla: formatearNumeroTablaCol(pagosAcumulados),
    saldoPorPagarTabla: formatearNumeroTablaCol(saldoPorPagar),
    porcentajeTabla: formatearPorcentajeCol(porcentajeAcumulado),
    fechaInicioPago: params.fechaInicioPago,
    fechaFinPago: params.fechaFinPago,
  };
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

  // Si no se suministró valor mensual, calcularlo según los días comerciales exactos del contrato
  if (!valorMensual || valorMensual <= 0) {
    const totalDiasComerciales = calcularDiasComerciales(contrato.fecha_inicio, contrato.fecha_fin);
    if (totalDiasComerciales > 0) {
      const duracionMesesComerciales = totalDiasComerciales / 30;
      valorMensual = Math.round((valorTotal / duracionMesesComerciales) * 100) / 100;
    } else {
      const mesesDif = (fin.year - inicio.year) * 12 + (fin.month - inicio.month);
      const duracionMeses = Math.max(1, mesesDif + (fin.day >= inicio.day ? 1 : 0));
      valorMensual = Math.round((valorTotal / duracionMeses) * 100) / 100;
    }
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
      const ultimoDiaCal = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      if (inicio.day === 1 && fin.day >= ultimoDiaCal) {
        diasPeriodo = 30;
      } else if (fin.day >= ultimoDiaCal) {
        diasPeriodo = Math.max(1, (30 - inicio.day) + 1);
      } else if (inicio.day === 1) {
        diasPeriodo = Math.min(fin.day, 30);
      } else {
        diasPeriodo = Math.max(1, (Math.min(fin.day, 30) - inicio.day) + 1);
      }
    } else if (esPrimero) {
      // Primer periodo: si inicia el día 13, días = (30 - 13) + 1 = 18 días
      diaInicioPeriodo = inicio.day;
      diaFinPeriodo = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      diasPeriodo = inicio.day === 1 ? 30 : Math.max(1, (30 - inicio.day) + 1);
    } else if (esUltimo) {
      // Último periodo: si finaliza el día 14, días a pagar son exactamente 14 días
      diaInicioPeriodo = 1;
      diaFinPeriodo = fin.day;
      const ultimoDiaCal = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      diasPeriodo = (fin.day >= ultimoDiaCal || fin.day >= 30) ? 30 : Math.max(1, Math.min(fin.day, 30));
    } else {
      // Meses intermedios completos: Siempre 30 días
      diaInicioPeriodo = 1;
      diaFinPeriodo = getUltimoDiaMesCalendario(itemMes.year, itemMes.month);
      diasPeriodo = 30;
    }

    // Cálculo del valor del periodo
    let valorPeriodo: number;
    if (esUltimo) {
      // En el último periodo se liquida el saldo restante exacto para cuadre contable al 100%
      const saldoRemanente = valorTotal - valorAcumulado;
      valorPeriodo = diasPeriodo === 30 ? Math.min(valorMensual, saldoRemanente) : (valorDiario * diasPeriodo);
      if (valorPeriodo <= 0 || valorPeriodo > saldoRemanente) {
        valorPeriodo = Math.max(0, saldoRemanente);
      }
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
 * según el número de pago/informe o según las fechas directas del período.
 */
export function getDatosLiquidacionPeriodo(
  contrato: ContratoParaPlanPagos,
  numeroPago: number | string,
  periodoDesdeDirecto?: string,
  periodoHastaDirecto?: string
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
  diasLiquidados?: number;
  valorDiario?: number;
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

    const valorPagadoAnterior = targetIdx === 0 ? 0 : periodos[targetIdx - 1].valor_acumulado;

    // Si se enviaron fechas directas del período, usar la liquidación directa con la norma de 30 días
    if (periodoDesdeDirecto && periodoHastaDirecto) {
      const liqDirecta = calcularLiquidacionEstatal({
        valorTotalContrato: contrato.valor_total_contrato,
        valorMensual: contrato.valor_mensual,
        fechaInicioPago: periodoDesdeDirecto,
        fechaFinPago: periodoHastaDirecto,
        pagosAcumuladosAnteriores: valorPagadoAnterior,
      });

      return {
        pagoNro: (typeof numeroPago === 'string' && numeroPago.trim() ? numeroPago : item.numero_pago.toString()),
        periodoDesde: formatFecha(periodoDesdeDirecto),
        periodoHasta: formatFecha(periodoHastaDirecto),
        porcentajeEjecucion: liqDirecta.porcentajeEjecucionFormateado,
        valorPagadoAcumulado: liqDirecta.valorPagadoAcumuladoTabla,
        valorAPagarSinIva: liqDirecta.valorAPagarTabla,
        iva: '-',
        valorTotalAPagar: liqDirecta.valorAPagarTabla,
        saldoPorPagar: liqDirecta.saldoPorPagarTabla,
        periodoItem: item,
        diasLiquidados: liqDirecta.diasLiquidados,
        valorDiario: liqDirecta.valorDiario,
      };
    }

    return {
      pagoNro: item.numero_pago.toString(),
      periodoDesde: formatFecha(item.fecha_inicio_periodo),
      periodoHasta: formatFecha(item.fecha_fin_periodo),
      porcentajeEjecucion: `${item.porcentaje_acumulado.toFixed(2).replace('.', ',')} %`,
      valorPagadoAcumulado: formatearNumeroTablaCol(valorPagadoAnterior),
      valorAPagarSinIva: formatearNumeroTablaCol(item.valor_pagado),
      iva: '-',
      valorTotalAPagar: formatearNumeroTablaCol(item.valor_pagado),
      saldoPorPagar: item.saldo_restante === 0 ? '0' : formatearNumeroTablaCol(item.saldo_restante),
      periodoItem: item,
      diasLiquidados: item.dias,
      valorDiario: (limpiarNumeroMoneda(contrato.valor_mensual) || limpiarNumeroMoneda(contrato.valor_total_contrato)) / 30,
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
  const valorTotal = limpiarNumeroMoneda(contrato.valor_total_contrato);
  const valorMensual = contrato.valor_mensual ? limpiarNumeroMoneda(contrato.valor_mensual) : (valorTotal / Math.max(1, periodos.length));

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

