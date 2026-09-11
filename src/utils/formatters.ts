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
 * Parsea los componentes de meses y días de un texto de plazo
 * Soporta formatos simples ("6 MESES", "20 DÍAS") y compuestos ("CUATRO(4) MESES 8 DIAS", "6 meses 8 dias", "SEIS(6) MESES Y OCHO(8) DÍAS")
 */
export const parsePlazoComponents = (val?: string | number): { meses: number; dias: number; text: string } => {
  if (!val && val !== 0) return { meses: 6, dias: 0, text: 'SEIS(6) MESES' };
  const str = String(val).trim();
  if (!str) return { meses: 6, dias: 0, text: 'SEIS(6) MESES' };

  const wordMap: Record<string, number> = {
    'UN': 1, 'UNO': 1, 'UNA': 1,
    'DOS': 2, 'TRES': 3, 'CUATRO': 4, 'CINCO': 5,
    'SEIS': 6, 'SIETE': 7, 'OCHO': 8, 'NUEVE': 9,
    'DIEZ': 10, 'ONCE': 11, 'DOCE': 12, 'TRECE': 13,
    'CATORCE': 14, 'QUINCE': 15, 'DIECISEIS': 16, 'DIECISÉIS': 16,
    'DIECISIETE': 17, 'DIECIOCHO': 18, 'DIECINUEVE': 19,
    'VEINTE': 20, 'VEINTIUNO': 21, 'VEINTIDOS': 22, 'VEINTIDÓS': 22,
    'VEINTITRES': 23, 'VEINTITRÉS': 23, 'VEINTICUATRO': 24, 'VEINTICINCO': 25,
    'VEINTISEIS': 26, 'VEINTISÉIS': 26, 'VEINTISIETE': 27, 'VEINTIOCHO': 28,
    'VEINTINUEVE': 29, 'TREINTA': 30
  };

  let m: number | null = null;
  let d: number | null = null;

  // 1. Regex para MESES: soporta "CUATRO(4) MESES", "(4) MESES", "4 MESES", "CUATRO MESES", "4M"
  const mesesMatch = str.match(/(\d+)\s*\)?\s*(?:mes|meses|m\b)/i) ||
                     str.match(/(?:([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*(?:\(\s*(\d+)\s*\))?)\s*(?:mes|meses|m\b)/i);
  if (mesesMatch) {
    if (mesesMatch[1] && /^\d+$/.test(mesesMatch[1])) {
      m = parseInt(mesesMatch[1], 10);
    } else if (mesesMatch[2] && /^\d+$/.test(mesesMatch[2])) {
      m = parseInt(mesesMatch[2], 10);
    } else if (mesesMatch[1]) {
      const w = mesesMatch[1].toUpperCase().trim();
      if (wordMap[w] !== undefined) m = wordMap[w];
    }
  }

  // 2. Regex para DÍAS: soporta "8 DIAS", "OCHO(8) DÍAS", "(8) DÍAS", "OCHO DÍAS", "8D"
  const diasMatch = str.match(/(\d+)\s*\)?\s*(?:d[ií]a|d[ií]as|d\b)/i) ||
                    str.match(/(?:([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*(?:\(\s*(\d+)\s*\))?)\s*(?:d[ií]as|d[ií]a|d\b)/i);
  if (diasMatch) {
    if (diasMatch[1] && /^\d+$/.test(diasMatch[1])) {
      d = parseInt(diasMatch[1], 10);
    } else if (diasMatch[2] && /^\d+$/.test(diasMatch[2])) {
      d = parseInt(diasMatch[2], 10);
    } else if (diasMatch[1]) {
      const w = diasMatch[1].toUpperCase().trim();
      if (wordMap[w] !== undefined) d = wordMap[w];
    }
  }

  // 3. Si no encontró explícitamente meses o días por sufijos, buscar números aislados
  if (m === null && d === null) {
    const nums = str.match(/\d+/g);
    if (nums && nums.length > 0) {
      if (nums.length >= 2) {
        m = parseInt(nums[0], 10);
        d = parseInt(nums[1], 10);
      } else {
        const isDay = /d[ií]a/i.test(str);
        if (isDay) {
          d = parseInt(nums[0], 10);
          m = 0;
        } else {
          m = parseInt(nums[0], 10);
          d = 0;
        }
      }
    } else {
      const upper = str.toUpperCase();
      for (const [w, val] of Object.entries(wordMap)) {
        if (upper.includes(w)) {
          m = val;
          d = 0;
          break;
        }
      }
    }
  }

  const finalM = m ?? (d !== null && d > 0 ? 0 : 6);
  const finalD = d ?? 0;

  return {
    meses: finalM,
    dias: finalD,
    text: str.toUpperCase()
  };
};

/**
 * Formatea el plazo de contrato respetando el texto explícito ingresado por el usuario
 * (ej: "CUATRO(4) MESES 8 DIAS" se mantiene tal como se escribió).
 * Si solo se ingresa un número simple como "6", lo convierte a "SEIS(6) MESES".
 */
export const formatPlazoLetraYNumero = (val?: string | number): string => {
  if (!val && val !== 0) return 'SEIS(6) MESES';
  const str = String(val).trim();
  if (!str) return 'SEIS(6) MESES';

  // Si ya es un texto con letras o estructura (ej. "CUATRO(4) MESES 8 DIAS", "6 MESES 8 DÍAS"), preservar tal como lo escribió el usuario
  if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(str)) {
    return str.toUpperCase();
  }

  // Si es un número solo (ej: "6" o 6)
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    const word = numberToWordsSpanish(num).toUpperCase();
    const unit = num === 1 ? 'MES' : 'MESES';
    return `${word}(${num}) ${unit}`;
  }

  return str.toUpperCase();
};

/**
 * Formatea fechas a formato DD/MM/YYYY con barra slash (/) en orden DÍA/MES/AÑO
 */
export const formatDateSlash = (val?: string): string => {
  if (!val || val === 'N/A' || val === '-') return val || 'N/A';
  const str = String(val).trim().split('T')[0];
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD -> DD/MM/YYYY
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      } else {
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
    }
    return str;
  }
  
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      } else {
        // DD-MM-YYYY -> DD/MM/YYYY
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
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

/**
 * Calcula la diferencia en días desde la fecha dada hasta la fecha actual.
 */
export const getDaysDifference = (dateVal?: string): number => {
  if (!dateVal || dateVal === 'N/A' || dateVal === '-') return 0;
  let d: Date | null = null;
  const str = String(dateVal).trim().split('T')[0];

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  } else {
    d = new Date(str);
  }

  if (!d || isNaN(d.getTime())) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const radicationDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffMs = today.getTime() - radicationDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * Verifica si una fecha de radicación/presentación supera un número de días límite (ej. 5 días).
 */
export const isOlderThanDays = (dateVal?: string, daysLimit: number = 5): boolean => {
  return getDaysDifference(dateVal) > daysLimit;
};


