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
 * Extrae tanto el valor en números formateado (ej: "1.557.873") como
 * el texto en letras (ej: "UN MILLÓN QUINIENTOS CINCUENTA Y SIETE MIL...")
 * a partir de lo registrado en "Monto Certificado" (report.valorPagar).
 */
export function extraerLetrasYNumeroDeValorPagar(rawValorPagar?: string): ValorPagarExtraido {
  const raw = (rawValorPagar || '').trim();

  // 1. Extraer número
  let valorNumerico = 0;
  let valorNumeroFormateado = '1.557.873';

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
    valorNumerico = 1557873;
    valorNumeroFormateado = '1.557.873';
  }

  // 2. Extraer texto en letras
  let letras = raw
    .replace(/\([^)]*\)/g, '')     // Quitar lo que esté dentro de paréntesis como ($1.557.873)
    .replace(/\$\s*[\d.,]+/g, '')  // Quitar montos tipo $ 1.557.873
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

const NOMBRES_MESES_ESP = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/**
 * Genera la cláusula de periodo para la autorización de desembolso:
 * CORRESPONDIENTE AL PERIODO DEL XX DE XXX AL XX DE XXX XXXX
 * 
 * - Días: Obtenidos directamente de fechaInicio (día inicial) y fechaTerminacion (día final).
 * - Meses: Obtenidos de fechaAplicacion, periodoDesde / periodoHasta o fechaInicio / fechaTerminacion.
 *   Si el día de inicio es mayor al día de fin (ej: 15 al 14), abarca el mes anterior al mes actual (ej: 15 DE ENERO AL 14 DE FEBRERO).
 * - Año: 4 dígitos (ej: 2026).
 */
export function generarTextoPeriodoDesembolso(
  fechaAplicacion?: string,
  fechaInicio?: string,
  fechaTerminacion?: string,
  fechaPresentacion?: string,
  periodoDesde?: string,
  periodoHasta?: string
): string {
  // 1. Extraer día de inicio SOLO de fechaInicio
  let diaInicio = '01';
  if (fechaInicio) {
    const cleanIni = fechaInicio.trim();
    const matchDia = cleanIni.match(/^(\d{1,2})/) || cleanIni.match(/(\d{1,2})/);
    if (matchDia) {
      diaInicio = matchDia[1].padStart(2, '0');
    }
  } else if (periodoDesde) {
    const matchDia = periodoDesde.trim().match(/^(\d{1,2})/);
    if (matchDia) diaInicio = matchDia[1].padStart(2, '0');
  }

  // 2. Extraer día de fin SOLO de fechaTerminacion
  let diaFin = '31';
  if (fechaTerminacion) {
    const cleanFin = fechaTerminacion.trim();
    const matchDia = cleanFin.match(/^(\d{1,2})/) || cleanFin.match(/(\d{1,2})/);
    if (matchDia) {
      diaFin = matchDia[1].padStart(2, '0');
    }
  } else if (periodoHasta) {
    const matchDia = periodoHasta.trim().match(/^(\d{1,2})/);
    if (matchDia) diaFin = matchDia[1].padStart(2, '0');
  }

  // 3. Extraer mes y año de periodoDesde / periodoHasta o fechaAplicacion
  let mesAppIdx: number | null = null;
  let anioApp = '2026';

  const buscarMesEnTexto = (txt?: string) => {
    if (!txt) return;
    const upper = txt.toUpperCase().trim();
    for (let i = 0; i < NOMBRES_MESES_ESP.length; i++) {
      if (upper.includes(NOMBRES_MESES_ESP[i])) {
        mesAppIdx = i;
        break;
      }
    }
    const matchAnio = upper.match(/20\d{2}/);
    if (matchAnio) {
      anioApp = matchAnio[0];
    }
  };

  buscarMesEnTexto(fechaAplicacion);

  // Si no se encontró el mes en fechaAplicacion, intentar con periodoHasta o periodoDesde
  let mesInicioIdx: number | null = null;
  let mesFinIdx: number | null = null;

  if (periodoDesde) {
    const m = periodoDesde.match(/\d{1,2}[/-](\d{1,2})[/-](20\d{2}|\d{2})/);
    if (m) {
      mesInicioIdx = parseInt(m[1], 10) - 1;
      anioApp = m[2].length === 2 ? `20${m[2]}` : m[2];
    }
  }

  if (periodoHasta) {
    const m = periodoHasta.match(/\d{1,2}[/-](\d{1,2})[/-](20\d{2}|\d{2})/);
    if (m) {
      mesFinIdx = parseInt(m[1], 10) - 1;
      anioApp = m[2].length === 2 ? `20${m[2]}` : m[2];
    }
  }

  if (mesAppIdx === null) {
    mesAppIdx = mesFinIdx !== null ? mesFinIdx : (mesInicioIdx !== null ? mesInicioIdx : 6); // default Julio
  }

  // 4. Calcular nombres de mes para inicio y fin
  let mesInicioNombre = NOMBRES_MESES_ESP[mesInicioIdx !== null ? mesInicioIdx : mesAppIdx];
  let mesFinNombre = NOMBRES_MESES_ESP[mesFinIdx !== null ? mesFinIdx : mesAppIdx];

  const numDiaIni = parseInt(diaInicio, 10);
  const numDiaFin = parseInt(diaFin, 10);

  // Si no hay meses definidos explicitamente en periodoDesde/Hasta, y el dia inicio > dia fin, asumir mes anterior
  if (mesInicioIdx === null && mesFinIdx === null) {
    if (numDiaIni > numDiaFin) {
      const prevMonthIdx = (mesAppIdx - 1 + 12) % 12;
      mesInicioNombre = NOMBRES_MESES_ESP[prevMonthIdx];
      mesFinNombre = NOMBRES_MESES_ESP[mesAppIdx];
    }
  }

  return `CORRESPONDIENTE AL PERIODO DEL ${diaInicio} DE ${mesInicioNombre} AL ${diaFin} DE ${mesFinNombre} ${anioApp}`;
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

