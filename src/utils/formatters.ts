/**
 * Formateador de moneda para Pesos Colombianos (COP)
 * Agrega el signo '$ ', separador de miles con punto '.' y maneja valores 'N/A' o vacíos.
 */
export const formatColombianCurrency = (val?: string | number): string => {
  if (val === undefined || val === null || val === '') return '$ 0';
  const str = String(val).trim();
  
  // Si explícitamente es N/A
  if (str.toUpperCase() === 'N/A' || str === '$ N/A') return '$ N/A';
  
  // Extraer únicamente los dígitos numéricos
  const numOnly = str.replace(/[^0-9]/g, '');
  if (!numOnly) {
    return str.startsWith('$') ? str : `$ ${str}`;
  }
  
  const num = parseInt(numOnly, 10);
  // Formatear con puntos de miles según el estándar colombiano (es-CO)
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${formatted}`;
};

/**
 * Formateador específico para Valor de Adición
 */
export const formatValorAdicion = (val?: string | number): string => {
  if (val === undefined || val === null || val === '' || val === 'N/A' || val === '$ N/A') {
    return '$ N/A';
  }
  const str = String(val).trim();
  if (str.toUpperCase() === 'N/A' || str === '$ N/A') return '$ N/A';
  
  const numOnly = str.replace(/[^0-9]/g, '');
  if (!numOnly || numOnly === '0') return '$ N/A';
  
  const num = parseInt(numOnly, 10);
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${formatted}`;
};

/**
 * Convierte un número entero a su representación en letras en español (mayúsculas)
 */
export const numberToWordsSpanish = (num: number): string => {
  if (num === 0) return 'CERO';
  if (num === 1) return 'UN';

  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (num < 10) return units[num];
  if (num >= 10 && num < 20) return teens[num - 10];
  if (num >= 20 && num < 30) {
    if (num === 20) return 'VEINTE';
    if (num === 21) return 'VEINTIÚN';
    if (num === 22) return 'VEINTIDÓS';
    if (num === 23) return 'VEINTITRÉS';
    if (num === 26) return 'VEINTISÉIS';
    return `VEINTI${units[num % 10]}`;
  }
  if (num < 100) {
    const u = num % 10;
    const t = Math.floor(num / 10);
    return u === 0 ? tens[t] : `${tens[t]} Y ${units[u]}`;
  }
  if (num === 100) return 'CIEN';
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return rest === 0 ? hundreds[h] : `${hundreds[h]} ${numberToWordsSpanish(rest)}`;
  }
  return String(num);
};

/**
 * Formatea el plazo en formato "PALABRA(NUMERO) UNIDAD"
 * Ejemplo: "6 MESES" -> "SEIS(6) MESES"
 * Ejemplo: "1 MES" -> "UN(1) MES"
 * Ejemplo: "30 DÍAS" -> "TREINTA(30) DÍAS"
 */
export const formatPlazoLetraYNumero = (val?: string | number): string => {
  if (!val) return 'SEIS(6) MESES';
  const str = String(val).trim();
  if (!str) return 'SEIS(6) MESES';

  // Si ya viene formateado como "SEIS(6) MESES" o "SEIS (6) MESES"
  const alreadyFormattedMatch = str.match(/^([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)\s*\(\s*(\d+)\s*\)\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]*)$/);
  if (alreadyFormattedMatch) {
    const word = alreadyFormattedMatch[1].trim().toUpperCase();
    const num = alreadyFormattedMatch[2].trim();
    const unit = alreadyFormattedMatch[3].trim().toUpperCase() || (num === '1' ? 'MES' : 'MESES');
    return `${word}(${num}) ${unit}`.trim();
  }

  // Extraer número y unidad
  const numMatch = str.match(/\d+/);
  if (!numMatch) {
    const wordsMatch = str.toUpperCase();
    if (wordsMatch.includes('UN') || wordsMatch.includes('UNO')) return 'UN(1) MES';
    if (wordsMatch.includes('DOS')) return 'DOS(2) MESES';
    if (wordsMatch.includes('TRES')) return 'TRES(3) MESES';
    if (wordsMatch.includes('CUATRO')) return 'CUATRO(4) MESES';
    if (wordsMatch.includes('CINCO')) return 'CINCO(5) MESES';
    if (wordsMatch.includes('SEIS')) return 'SEIS(6) MESES';
    if (wordsMatch.includes('SIETE')) return 'SIETE(7) MESES';
    if (wordsMatch.includes('OCHO')) return 'OCHO(8) MESES';
    if (wordsMatch.includes('NUEVE')) return 'NUEVE(9) MESES';
    if (wordsMatch.includes('DIEZ')) return 'DIEZ(10) MESES';
    if (wordsMatch.includes('ONCE')) return 'ONCE(11) MESES';
    if (wordsMatch.includes('DOCE')) return 'DOCE(12) MESES';
    return str.toUpperCase();
  }

  const num = parseInt(numMatch[0], 10);
  const word = numberToWordsSpanish(num);

  // Determinar unidad (MESES, DÍAS, AÑOS)
  const lower = str.toLowerCase();
  let unit = num === 1 ? 'MES' : 'MESES';
  if (lower.includes('dia') || lower.includes('día')) {
    unit = num === 1 ? 'DÍA' : 'DÍAS';
  } else if (lower.includes('año') || lower.includes('ano')) {
    unit = num === 1 ? 'AÑO' : 'AÑOS';
  }

  return `${word}(${num}) ${unit}`;
};

/**
 * Formatea fechas a formato DD/MM/YYYY con barra slash (/)
 */
export const formatDateSlash = (val?: string): string => {
  if (!val || val === 'N/A') return val || 'N/A';
  const str = String(val).trim();
  if (str.includes('/')) return str;
  // Si viene YYYY-MM-DD
  const parts = str.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    } else {
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
  }
  return str;
};

/**
 * Genera la Fecha de Aplicación del Formato en MAYÚSCULAS (ej. "FEBRERO DE 2026")
 * a partir de una fecha o período (periodoHasta o periodoDesde).
 */
export const formatFechaAplicacion = (periodoHasta?: string, periodoDesde?: string): string => {
  const target = periodoHasta || periodoDesde;
  const monthNames = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  if (target && target !== 'N/A') {
    const str = String(target).trim();
    try {
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          const yr = parts[2];
          if (mIdx >= 0 && mIdx < 12 && yr) {
            return `${monthNames[mIdx]} DE ${yr}`;
          }
        }
      } else if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            const mIdx = parseInt(parts[1], 10) - 1;
            const yr = parts[0];
            if (mIdx >= 0 && mIdx < 12 && yr) {
              return `${monthNames[mIdx]} DE ${yr}`;
            }
          } else {
            const mIdx = parseInt(parts[1], 10) - 1;
            const yr = parts[2];
            if (mIdx >= 0 && mIdx < 12 && yr) {
              return `${monthNames[mIdx]} DE ${yr}`;
            }
          }
        }
      }
    } catch (e) {}
  }

  const now = new Date();
  return `${monthNames[now.getMonth()]} DE ${now.getFullYear()}`;
};

/**
 * Remueve decimales sobrantes (,00 o .00) de cualquier representación numérica o monetaria
 */
export const quitarDecimales = (val?: string | number): string => {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  return str.replace(/,00$/, '').replace(/\.00$/, '');
};

