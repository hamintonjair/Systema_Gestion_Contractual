import { limpiarNumeroMoneda, getDatosLiquidacionPeriodo } from './paymentPlanUtils';

/**
 * Utilidad para conversión de números a letras en español (formato moneda colombiana Pesos M/CTE)
 * y extracción automática de valor en letras y números desde la certificación del informe.
 */

function Unidades(num: number): string {
  switch (num) {
    case 1: return 'UN';
    case 2: return 'DOS';
    case 3: return 'TRES';
    case 4: return 'CUATRO';
    case 5: return 'CINCO';
    case 6: return 'SEIS';
    case 7: return 'SIETE';
    case 8: return 'OCHO';
    case 9: return 'NUEVE';
    default: return '';
  }
}

function DecenasY(strSin: string, numUnidades: number): string {
  if (numUnidades > 0) {
    return strSin + ' Y ' + Unidades(numUnidades);
  }
  return strSin;
}

function Decenas(num: number): string {
  const decena = Math.floor(num / 10);
  const unidad = num - (decena * 10);

  switch (decena) {
    case 1:
      switch (unidad) {
        case 0: return 'DIEZ';
        case 1: return 'ONCE';
        case 2: return 'DOCE';
        case 3: return 'TRECE';
        case 4: return 'CATORCE';
        case 5: return 'QUINCE';
        default: return 'DIECI' + Unidades(unidad);
      }
    case 2:
      switch (unidad) {
        case 0: return 'VEINTE';
        default: return 'VEINTI' + Unidades(unidad);
      }
    case 3: return DecenasY('TREINTA', unidad);
    case 4: return DecenasY('CUARENTA', unidad);
    case 5: return DecenasY('CINCUENTA', unidad);
    case 6: return DecenasY('SESENTA', unidad);
    case 7: return DecenasY('SETENTA', unidad);
    case 8: return DecenasY('OCHENTA', unidad);
    case 9: return DecenasY('NOVENTA', unidad);
    case 0: return Unidades(unidad);
    default: return '';
  }
}

function Centenas(num: number): string {
  const centenas = Math.floor(num / 100);
  const decenas = num - (centenas * 100);

  switch (centenas) {
    case 1:
      if (decenas > 0) return 'CIENTO ' + Decenas(decenas);
      return 'CIEN';
    case 2: return 'DOSCIENTOS ' + Decenas(decenas);
    case 3: return 'TRESCIENTOS ' + Decenas(decenas);
    case 4: return 'CUATROCIENTOS ' + Decenas(decenas);
    case 5: return 'QUINIENTOS ' + Decenas(decenas);
    case 6: return 'SEISCIENTOS ' + Decenas(decenas);
    case 7: return 'SETECIENTOS ' + Decenas(decenas);
    case 8: return 'OCHOCIENTOS ' + Decenas(decenas);
    case 9: return 'NOVECIENTOS ' + Decenas(decenas);
    default: return Decenas(decenas);
  }
}

function Seccion(num: number, divisor: number, strSingular: string, strPlural: string): string {
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  let letras = '';

  if (cientos > 0) {
    if (cientos > 1) {
      letras = Centenas(cientos) + ' ' + strPlural;
    } else {
      letras = strSingular;
    }
  }

  if (resto > 0) {
    letras += '';
  }

  return letras;
}

function Miles(num: number): string {
  const divisor = 1000;
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  let strMiles = Seccion(num, divisor, 'UN MIL', 'MIL');
  let strCentenas = Centenas(resto);

  if (strMiles === '') return strCentenas;
  return (strMiles + ' ' + strCentenas).trim();
}

function Millones(num: number): string {
  const divisor = 1000000;
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  let strMillones = Seccion(num, divisor, 'UN MILLÓN', 'MILLONES');
  let strMiles = Miles(resto);

  if (strMillones === '') return strMiles;
  return (strMillones + ' ' + strMiles).trim();
}

export function convertirNumeroALetras(num: number): string {
  const entero = Math.round(Math.abs(num));
  if (entero === 0) return 'CERO PESOS M/CTE';
  
  const letras = Millones(entero);
  return `${letras} PESOS M/CTE`.replace(/\s+/g, ' ').trim().toUpperCase();
}

export interface ValorPagarExtraido {
  valorNumerico: number;
  valorNumeroFormateado: string;
  valorLetras: string;
}

/**
 * Extrae tanto el valor en números formateado (ej: "1.557.873", "2.160.000") como
 * el texto en letras (ej: "DOS MILLONES CIENTO SESENTA MIL PESOS M/CTE")
 * a partir de lo registrado en "Monto Certificado" (report.valorPagar) desde la Base de Datos.
 */
export function extraerLetrasYNumeroDeValorPagar(rawValorPagar?: string): ValorPagarExtraido {
  let raw = (rawValorPagar || '').trim();

  // Limpiar etiquetas de almacenamiento si vienen en bruto
  if (raw.includes('__VALOR_PAGAR__:')) {
    raw = raw.replace(/^.*__VALOR_PAGAR__:/, '').trim();
  }
  if (raw.includes('%20') || raw.includes('%24') || raw.includes('%C3') || raw.includes('%2F')) {
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {}
  }

  // 1. Extraer número
  let valorNumerico = 0;
  let valorNumeroFormateado = '2.160.000';

  const matchParentesis = raw.match(/\(\s*\$?\s*([\d.,]+)\s*\)/);
  const matchDolar = raw.match(/\$\s*([\d.,]+)/);
  const matchNumeroSeparador = raw.match(/([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]+)?)/) || raw.match(/([\d]{4,})/);

  let numStr = '';
  if (matchParentesis) {
    numStr = matchParentesis[1];
  } else if (matchDolar) {
    numStr = matchDolar[1];
  } else if (matchNumeroSeparador) {
    numStr = matchNumeroSeparador[1];
  }

  if (numStr) {
    const cleanNum = numStr.replace(/\./g, '').replace(/,/g, '.');
    const parsed = Math.round(parseFloat(cleanNum));
    if (!isNaN(parsed) && parsed > 0) {
      valorNumerico = parsed;
      valorNumeroFormateado = new Intl.NumberFormat('es-CO').format(valorNumerico);
    }
  }

  if (valorNumerico === 0) {
    const allDigits = raw.replace(/\D/g, '');
    if (allDigits) {
      const parsed = parseInt(allDigits, 10);
      if (!isNaN(parsed) && parsed > 0) {
        valorNumerico = parsed;
        valorNumeroFormateado = new Intl.NumberFormat('es-CO').format(valorNumerico);
      }
    }
  }

  if (valorNumerico === 0) {
    valorNumerico = 2160000;
    valorNumeroFormateado = '2.160.000';
  }

  // 2. Extraer texto en letras
  let letras = raw
    .replace(/\([^)]*\)/g, '')     // Quitar lo que esté dentro de paréntesis como ($2.160.000)
    .replace(/\$\s*[\d.,]+/g, '')  // Quitar montos tipo $ 2.160.000
    .trim();

  // Limpiar puntuaciones residuales
  letras = letras.replace(/^[:\-–—\s,.]+/, '').replace(/[:\-–—\s,.]+$/, '').trim();

  if (letras.length > 5 && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(letras)) {
    let textoLimpio = letras.toUpperCase();
    if (!textoLimpio.includes('PESOS') && !textoLimpio.includes('M/CTE') && !textoLimpio.includes('MCTE')) {
      textoLimpio = `${textoLimpio} PESOS M/CTE`;
    }
    return {
      valorNumerico,
      valorNumeroFormateado,
      valorLetras: textoLimpio.replace(/\s+/g, ' ').trim(),
    };
  }

  // Si no había texto en letras o era solo un número, convertir automáticamente
  const letrasGeneradas = convertirNumeroALetras(valorNumerico);
  return {
    valorNumerico,
    valorNumeroFormateado,
    valorLetras: letrasGeneradas,
  };
}

export interface ValoresMonetariosCalculados {
  valorNumerico: number;
  valorNumeroFormateado: string;
  sumaTotalConCentavos: string;
  valorLetras: string;
}

/**
 * Determina y resuelve con precisión los valores numéricos y en letras correspondientes a un informe
 * obteniéndolos directamente de lo registrado en la base de datos (report.valorPagar).
 */
export function obtenerValoresMonetariosReporte(report?: {
  valorPagar?: string;
  valorContrato?: string;
  valorMensual?: string;
  fechaInicio?: string;
  fechaTerminacion?: string;
  informeNro?: string;
  periodoDesde?: string;
  periodoHasta?: string;
}): ValoresMonetariosCalculados {
  if (!report) {
    return {
      valorNumerico: 2160000,
      valorNumeroFormateado: '2.160.000',
      sumaTotalConCentavos: '2.160.000,00',
      valorLetras: 'DOS MILLONES CIENTO SESENTA MIL PESOS M/CTE',
    };
  }

  // 1. Extraer directamente del valor registrado en el informe de la Base de Datos
  const extracted = extraerLetrasYNumeroDeValorPagar(report.valorPagar);

  let finalNum = 0;
  let finalFormateado = '';
  let finalLetras = '';

  // Si el informe tiene un valor registrado en la BD (valorPagar), usarlo directamente
  if (report.valorPagar && extracted.valorNumerico > 0) {
    finalNum = extracted.valorNumerico;
    finalFormateado = extracted.valorNumeroFormateado;
    finalLetras = extracted.valorLetras;
  } else {
    // Fallback únicamente si el informe no tiene valorPagar registrado
    const numValTotal = limpiarNumeroMoneda(report.valorContrato || '');
    const valMensual = report.valorMensual ? limpiarNumeroMoneda(report.valorMensual) : undefined;
    const fInicio = report.fechaInicio || report.periodoDesde || '13/08/2026';
    const fFin = report.fechaTerminacion || report.periodoHasta || '31/12/2026';

    let autoLiq: any = null;
    let numAutoLiq = 0;
    if ((numValTotal > 0 || (valMensual && valMensual > 0)) && (report.periodoDesde || report.informeNro)) {
      try {
        autoLiq = getDatosLiquidacionPeriodo({
          valor_total_contrato: numValTotal > 0 ? numValTotal : (valMensual ? valMensual * 5 : 16200000),
          valor_mensual: valMensual,
          fecha_inicio: fInicio,
          fecha_fin: fFin,
        }, report.informeNro || '1', report.periodoDesde, report.periodoHasta);

        if (autoLiq?.valorAPagarSinIva) {
          numAutoLiq = limpiarNumeroMoneda(autoLiq.valorAPagarSinIva);
        }
      } catch (e) {
        console.warn('Error calculando liquidación periodo:', e);
      }
    }

    if (numAutoLiq > 0) {
      finalNum = numAutoLiq;
      finalFormateado = autoLiq?.valorAPagarTabla || new Intl.NumberFormat('es-CO').format(numAutoLiq);
      finalLetras = convertirNumeroALetras(numAutoLiq);
    } else if (valMensual && valMensual > 0) {
      finalNum = valMensual;
      finalFormateado = new Intl.NumberFormat('es-CO').format(valMensual);
      finalLetras = convertirNumeroALetras(valMensual);
    }
  }

  if (finalNum <= 0) {
    finalNum = 2160000;
    finalFormateado = '2.160.000';
    finalLetras = 'DOS MILLONES CIENTO SESENTA MIL PESOS M/CTE';
  }

  return {
    valorNumerico: finalNum,
    valorNumeroFormateado: finalFormateado,
    sumaTotalConCentavos: `${finalFormateado},00`,
    valorLetras: finalLetras,
  };
}

const NOMBRES_MESES_ESP = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/**
 * Convierte cualquier fecha a formato 'YYYY-MM-DD' (año-mes-día)
 */
export function formatFechaAnioMesDia(rawDate?: string): string {
  if (!rawDate) return '2026-01-14';
  const str = rawDate.trim();

  // Si ya es YYYY-MM-DD
  if (/^20\d{2}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Si es DD/MM/YYYY o DD-MM-YYYY
  const matchDMY = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})$/);
  if (matchDMY) {
    const day = matchDMY[1].padStart(2, '0');
    const month = matchDMY[2].padStart(2, '0');
    const year = matchDMY[3].length === 2 ? `20${matchDMY[3]}` : matchDMY[3];
    return `${year}-${month}-${day}`;
  }

  // Si es texto tipo "14 de julio de 2026" o "Quibdó, 14 de julio de 2026"
  const matchText = str.match(/(\d{1,2})\s+de\s+([a-zA-ZA-Za-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+(20\d{2})/i);
  if (matchText) {
    const day = matchText[1].padStart(2, '0');
    const monthName = matchText[2].toLowerCase();
    const year = matchText[3];
    const monthMap: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04',
      mayo: '05', junio: '06', julio: '07', agosto: '08',
      septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    };
    const monthNum = monthMap[monthName] || '01';
    return `${year}-${monthNum}-${day}`;
  }

  // Partes separadas por / o -
  const parts = str.split(/[\/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  return str;
}

/**
 * Formatea la fecha para el Soporte Fiduciaria extrayendo día, mes y año
 * directamente del campo "Período Hasta" (o "Fecha Presentación" / "Período Desde")
 * correspondiente al informe seleccionado (ej. "31 de agosto de 2026", "30 de septiembre de 2026").
 */
export function formatFechaFiduciaria(rep?: any): string {
  if (!rep) return '14 de julio de 2026';

  const targetDateStr = rep.periodoHasta || rep.fechaPresentacion || rep.periodoDesde;
  
  let fiduDia = '31';
  let fiduMes = 'agosto';
  let fiduAno = '2026';

  if (targetDateStr) {
    const s = String(targetDateStr).trim();

    // 1. Formato DD/MM/YYYY o DD-MM-YYYY o DD/MM/YY
    const matchDMY = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})$/);
    if (matchDMY) {
      fiduDia = String(parseInt(matchDMY[1], 10));
      const mIdx = parseInt(matchDMY[2], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        fiduMes = NOMBRES_MESES_ESP[mIdx].toLowerCase();
      }
      fiduAno = matchDMY[3].length === 2 ? `20${matchDMY[3]}` : matchDMY[3];
      return `${fiduDia} de ${fiduMes} de ${fiduAno}`;
    }

    // 2. Formato ISO YYYY-MM-DD
    const matchYMD = s.match(/^(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (matchYMD) {
      fiduAno = matchYMD[1];
      const mIdx = parseInt(matchYMD[2], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        fiduMes = NOMBRES_MESES_ESP[mIdx].toLowerCase();
      }
      fiduDia = String(parseInt(matchYMD[3], 10));
      return `${fiduDia} de ${fiduMes} de ${fiduAno}`;
    }

    // 3. Formato texto "31 de agosto de 2026"
    const matchText = s.match(/(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+(20\d{2})/i);
    if (matchText) {
      fiduDia = String(parseInt(matchText[1], 10));
      fiduMes = matchText[2].toLowerCase();
      fiduAno = matchText[3];
      return `${fiduDia} de ${fiduMes} de ${fiduAno}`;
    }
  }

  // 4. Si solo hay fechaAplicacion (ej: "AGOSTO DE 2026")
  if (rep.fechaAplicacion) {
    const appUpper = rep.fechaAplicacion.trim().toUpperCase();
    for (let i = 0; i < NOMBRES_MESES_ESP.length; i++) {
      if (appUpper.includes(NOMBRES_MESES_ESP[i])) {
        fiduMes = NOMBRES_MESES_ESP[i].toLowerCase();
        break;
      }
    }
    const yearMatch = appUpper.match(/\b(20\d{2})\b/);
    if (yearMatch) fiduAno = yearMatch[1];
  }

  return `${fiduDia} de ${fiduMes} de ${fiduAno}`;
}

/**
 * Genera la cláusula de periodo para la autorización de desembolso:
 * CORRESPONDIENTE AL PERIODO DEL XX DE XXX AL XX DE XXX XXXX
 * 
 * - Días: Obtenidos prioritariamente de periodoDesde y periodoHasta.
 * - Meses y Año: Obtenidos de periodoHasta / periodoDesde / fechaAplicacion.
 *   Año corregido a 4 dígitos válidos (ej: 2026).
 */
export function generarTextoPeriodoDesembolso(
  fechaAplicacion?: string,
  fechaInicio?: string,
  fechaTerminacion?: string,
  fechaPresentacion?: string,
  periodoDesde?: string,
  periodoHasta?: string
): string {
  const parseDetails = (str?: string) => {
    if (!str) return null;
    const s = str.trim();

    const matchDMY = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})$/);
    if (matchDMY) {
      const day = matchDMY[1].padStart(2, '0');
      const monthIdx = parseInt(matchDMY[2], 10) - 1;
      const year = matchDMY[3].length === 2 ? `20${matchDMY[3]}` : matchDMY[3];
      return { day, monthIdx, year };
    }

    const matchYMD = s.match(/^(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (matchYMD) {
      const year = matchYMD[1];
      const monthIdx = parseInt(matchYMD[2], 10) - 1;
      const day = matchYMD[3].padStart(2, '0');
      return { day, monthIdx, year };
    }

    const matchDay = s.match(/^(\d{1,2})/);
    let day = matchDay ? matchDay[1].padStart(2, '0') : null;

    let monthIdx: number | null = null;
    const upper = s.toUpperCase();
    for (let i = 0; i < NOMBRES_MESES_ESP.length; i++) {
      if (upper.includes(NOMBRES_MESES_ESP[i])) {
        monthIdx = i;
        break;
      }
    }

    let year: string | null = null;
    const matchYr = s.match(/\b(202\d|2030)\b/);
    if (matchYr) {
      year = matchYr[1];
    }

    return { day, monthIdx, year };
  };

  const pDesde = parseDetails(periodoDesde);
  const pHasta = parseDetails(periodoHasta);
  const fIni = parseDetails(fechaInicio);
  const fTer = parseDetails(fechaTerminacion);
  const fApp = parseDetails(fechaAplicacion);

  // Día Inicio: prioritario periodoDesde, luego fechaInicio
  const diaInicio = pDesde?.day || fIni?.day || '01';

  // Día Fin: prioritario periodoHasta, luego fechaTerminacion
  const diaFin = pHasta?.day || fTer?.day || '31';

  // Año: prioritario periodoHasta -> periodoDesde -> fechaAplicacion -> fechaTerminacion -> '2026'
  let anio = pHasta?.year || pDesde?.year || fApp?.year || fTer?.year || fIni?.year || '2026';
  if (parseInt(anio, 10) > 2030) {
    anio = '2026';
  }

  // Meses
  let mesInicioIdx = pDesde?.monthIdx ?? fIni?.monthIdx ?? fApp?.monthIdx;
  let mesFinIdx = pHasta?.monthIdx ?? fTer?.monthIdx ?? fApp?.monthIdx;

  if (mesInicioIdx === undefined || mesInicioIdx === null) {
    mesInicioIdx = fApp?.monthIdx ?? 0;
  }
  if (mesFinIdx === undefined || mesFinIdx === null) {
    mesFinIdx = mesInicioIdx;
  }

  if (pDesde?.monthIdx === undefined && pHasta?.monthIdx === undefined) {
    const dIniNum = parseInt(diaInicio, 10);
    const dFinNum = parseInt(diaFin, 10);
    if (dIniNum > dFinNum) {
      mesInicioIdx = (mesFinIdx - 1 + 12) % 12;
    }
  }

  const mesInicioNombre = NOMBRES_MESES_ESP[mesInicioIdx ?? 0] || 'ENERO';
  const mesFinNombre = NOMBRES_MESES_ESP[mesFinIdx ?? 0] || 'ENERO';

  return `CORRESPONDIENTE AL PERIODO DEL ${diaInicio} DE ${mesInicioNombre} AL ${diaFin} DE ${mesFinNombre} ${anio}`;
}

/**
 * Combina el objeto contractual base con la línea obligatoria del periodo al final:
 * "<OBJETO_BASE>.\nCORRESPONDIENTE AL PERIODO DEL XX DE XXX AL XX DE XXX XXXX"
 */
export function formatearObjetoConPeriodo(
  objetoBase?: string,
  fechaAplicacion?: string,
  fechaInicio?: string,
  fechaTerminacion?: string,
  fechaPresentacion?: string,
  periodoDesde?: string,
  periodoHasta?: string
): string {
  let base = (objetoBase || '').trim().toUpperCase();

  // Si ya tiene una línea previa de "CORRESPONDIENTE AL PERIODO...", removerla para actualizarla limpiamente
  const regexPeriodo = /\n?CORRESPONDIENTE\s+AL\s+PERIODO\s+DEL[\s\S]*$/i;
  base = base.replace(regexPeriodo, '').trim();

  // Asegurar punto al final si no lo tiene
  if (base && !base.endsWith('.')) {
    base = `${base}.`;
  }

  const lineaPeriodo = generarTextoPeriodoDesembolso(
    fechaAplicacion,
    fechaInicio,
    fechaTerminacion,
    fechaPresentacion,
    periodoDesde,
    periodoHasta
  );

  return `${base}\n${lineaPeriodo}`.trim();
}

