import ExcelJS from 'exceljs';
import { CertificadoSupervisionData } from '../types';
import { 
  CELL_MAP, 
  PRESUPUESTO_ROWS, 
  SEGSOCIAL_ROWS, 
  CELDAS_CON_FORMULA 
} from './cellMap';

/**
 * Parses a string or number into a clean number, handling currency symbols,
 * percentages, thousands separators (dots/commas), and hyphenated values.
 */
function parseCleanNumber(val: any): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const s = String(val).trim();
  if (!s || s === '-' || s.toUpperCase() === 'N/A' || s === '0') return null;

  // Handle percentages (e.g. "8,89 %", "31,85 %")
  if (s.includes('%')) {
    const cleanPct = s.replace(/[^0-9,.-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleanPct);
    return isNaN(parsed) ? null : parsed / 100;
  }

  // Remove currency symbol and spaces
  let clean = s.replace(/[$\s]/g, '');

  if (clean.includes(',') && clean.includes('.')) {
    // Standard format with both thousands and decimals e.g., "1.234,56" or "1,234.56"
    if (clean.indexOf('.') < clean.indexOf(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // If it has a comma, decide whether it's thousands or decimal
    const parts = clean.split(',');
    if (parts[1] && parts[1].length === 3) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(/,/g, '.');
    }
  } else if (clean.includes('.')) {
    // If it has a dot, decide whether it's thousands or decimal
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = clean.replace(/\./g, '');
    } else if (parts[1] && parts[1].length === 3) {
      clean = clean.replace(/\./g, '');
    }
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Parses various date string formats into a JavaScript Date object,
 * including dd/mm/yyyy, ISO, and Spanish textual months (e.g. 14-ene.-2026).
 */
function parseCleanDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (!s || s === '-' || s.toUpperCase() === 'N/A') return null;

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[/-]/).map(Number);
    return new Date(y, m - 1, d);
  }

  // DD-mmm-YYYY e.g., "14-ene.-2026"
  const monthsEs: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
  };
  
  const cleanDateStr = s.toLowerCase().replace(/\./g, '');
  const parts = cleanDateStr.split(/[\s-]/).filter(Boolean);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const year = parseInt(parts[2], 10);
    const monthAbbr = parts[1].substring(0, 3);
    if (!isNaN(day) && !isNaN(year) && monthsEs[monthAbbr] !== undefined) {
      return new Date(year, monthsEs[monthAbbr], day);
    }
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Writes a value to a cell, performing a runtime check to avoid writing to formula cells.
 */
function writeCell(sheet: ExcelJS.Worksheet, address: string, value: any) {
  if (CELDAS_CON_FORMULA.includes(address)) {
    throw new Error(`Error de validación: Intento prohibido de escribir en la celda con fórmula '${address}'.`);
  }
  const cell = sheet.getCell(address);
  cell.value = value;
}

interface RubroPresupuestal {
  cdp: string;
  crp: string;
  fecha: Date | null;
  rubro: string;
  valor: number | null;
}

/**
 * Exports the supervision certificate based on the official Excel template.
 * Loads the template from public folder, fills fields into specific cells,
 * and returns a Blob of the populated Excel file.
 */
export async function exportarCertificado(data: CertificadoSupervisionData): Promise<Blob> {
  console.log('[export] data recibida:', JSON.stringify(data, null, 2));

  // 1. Validate required fields
  const requiredFields: { key: keyof CertificadoSupervisionData; label: string }[] = [
    { key: 'contratistaNombre', label: 'Nombre del contratista' },
    { key: 'tipoDocumento', label: 'Tipo de documento' },
    { key: 'contratistaDocumento', label: 'Número de documento' },
    { key: 'contratoNro', label: 'Número de contrato' },
    { key: 'contratoAno', label: 'Año del contrato' },
    { key: 'supervisorNombre', label: 'Nombre del supervisor' },
    { key: 'supervisorCargo', label: 'Cargo del supervisor' },
    { key: 'valorInicial', label: 'Valor inicial' },
    { key: 'periodoDesde', label: 'Periodo desde (fecha)' },
    { key: 'periodoHasta', label: 'Periodo hasta (fecha)' },
    { key: 'valorAPagarSinIva', label: 'Valor a pagar' }
  ];

  for (const field of requiredFields) {
    const val = data[field.key];
    if (val === undefined || val === null || String(val).trim() === '' || String(val).trim() === '-') {
      throw new Error(`Falta el campo obligatorio: ${field.label}`);
    }
  }

  // 2. Load Excel template
  const templateUrl = `${(import.meta as any).env.BASE_URL}templates/Certificado_de_SUPERVISION_o_equivalente_a_Factura.xlsx`;
  let response: Response;
  try {
    response = await fetch(templateUrl);
  } catch (error) {
    throw new Error('No se encontró la plantilla del certificado (error de red o de ruta).');
  }

  if (!response.ok) {
    throw new Error('No se encontró la plantilla del certificado');
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  console.log('[export] Hojas encontradas en la plantilla:', workbook.worksheets.map(w => w.name));

  // BUG CORRECTION: ExcelJS does not rewrite inherited definedNames correctly, causing a repair dialog in Excel.
  // We clear all defined names from the workbook model, and set the printArea natively.
  (workbook as any).definedNames.model = [];

  // 3. Find all worksheets that represent the certificate template (both visible and hidden)
  const targetSheets = workbook.worksheets.filter(sheet => {
    const isTargetName = ['HOJA4', 'CERTIFICADO PARA PAGO'].includes(sheet.name.trim().toUpperCase());
    if (isTargetName) return true;

    // Check if the sheet contains the certificate header
    let hasHeader = false;
    for (let r = 1; r <= 10; r++) {
      for (let c = 1; c <= 20; c++) {
        const val = sheet.getRow(r).getCell(c).value;
        if (val && String(val).toUpperCase().includes('CERTIFICADO DE SUPERVISIÓN')) {
          hasHeader = true;
          break;
        }
      }
      if (hasHeader) break;
    }
    return hasHeader;
  });

  if (targetSheets.length === 0) {
    throw new Error('No se encontró ninguna hoja de trabajo válida en la plantilla del certificado.');
  }

  console.log('[export] Escribiendo datos en las siguientes hojas:', targetSheets.map(s => s.name));

  // Define print area natively on all target worksheets instead of as a workbook defined name
  targetSheets.forEach(sheet => {
    if (!sheet.pageSetup) {
      sheet.pageSetup = {} as any;
    }
    sheet.pageSetup.printArea = 'A1:AF83';
  });

  const celdasEscritas: { celda: string; valor: any; tipo: string; campo: string }[] = [];

  function writeCell(address: string, value: any, nombreCampo: string) {
    if (CELDAS_CON_FORMULA.includes(address)) {
      throw new Error(`Error de validación: Intento prohibido de escribir en la celda con fórmula '${address}'.`);
    }
    if (value === undefined || value === null || String(value).trim() === '') {
      console.warn(`[export] campo sin valor: ${nombreCampo} -> ${address}`);
    }
    
    // Write value to all matching sheets to ensure visible sheets receive it
    targetSheets.forEach(sheet => {
      const cell = sheet.getCell(address);
      cell.value = value;
    });

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      celdasEscritas.push({ celda: address, valor: value, tipo: typeof value, campo: nombreCampo });
    }
  }

  function writeCellSheetSpecific(sheetNameMap: { [sheetName: string]: string }, value: any, nombreCampo: string) {
    targetSheets.forEach(sheet => {
      const upperName = sheet.name.trim().toUpperCase();
      let address = sheetNameMap[upperName];
      if (address === undefined) {
        const keys = Object.keys(sheetNameMap);
        address = sheetNameMap[keys[0]];
      }

      // If address is empty string, skip writing on this sheet
      if (!address) {
        return;
      }

      if (CELDAS_CON_FORMULA.includes(address)) {
        throw new Error(`Error de validación: Intento prohibido de escribir en la celda con fórmula '${address}'.`);
      }

      const cell = sheet.getCell(address);
      cell.value = value;
    });

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      celdasEscritas.push({ celda: JSON.stringify(sheetNameMap), valor: value, tipo: typeof value, campo: nombreCampo });
    }
  }

  // 4. Fill mapped cells (Contractual, Financial, Social Security, Payment details, Expedicion)
  writeCell(CELL_MAP.contratistaNombre, data.contratistaNombre || null, 'contratistaNombre');
  writeCell(CELL_MAP.tipoContrato, data.tipoContrato || null, 'tipoContrato');
  writeCell(CELL_MAP.contratoNro, parseCleanNumber(data.contratoNro), 'contratoNro');
  writeCell(CELL_MAP.contratoAno, parseCleanNumber(data.contratoAno), 'contratoAno');
  writeCell(CELL_MAP.tipoDocumento, data.tipoDocumento || null, 'tipoDocumento');
  writeCell(CELL_MAP.contratistaDocumento, parseCleanNumber(data.contratistaDocumento), 'contratistaDocumento');
  writeCell(CELL_MAP.supervisorNombre, data.supervisorNombre || null, 'supervisorNombre');
  writeCell(CELL_MAP.supervisorCargo, data.supervisorCargo || null, 'supervisorCargo');
  writeCell(CELL_MAP.clausulaNro, data.clausulaNro || null, 'clausulaNro');

  // Contractual object (Objeto)
  writeCellSheetSpecific({
    'HOJA4': 'T8',
    'CERTIFICADO PARA PAGO': 'U8'
  }, data.objeto || null, 'objeto');

  // Manifestación de Intención (Señor/Contratista Nombre)
  writeCellSheetSpecific({
    'HOJA4': 'J21',
    'CERTIFICADO PARA PAGO': 'K21'
  }, data.contratistaNombre || null, 'manifestacionContratistaNombre');

  // Financial info
  writeCell(CELL_MAP.numeroCuenta, data.numeroCuenta ? String(data.numeroCuenta).trim() : null, 'numeroCuenta'); // Account number is exception: string
  writeCell(CELL_MAP.banco, data.banco || null, 'banco');
  writeCell(CELL_MAP.tipoCuenta, data.tipoCuenta || null, 'tipoCuenta');
  writeCell(CELL_MAP.fechaInicio, parseCleanDate(data.fechaInicio), 'fechaInicio');

  // Plazo de meses (Sheet specific layout)
  writeCellSheetSpecific({
    'HOJA4': 'U28',
    'CERTIFICADO PARA PAGO': 'V28'
  }, parseCleanNumber(data.plazoMeses), 'plazoMeses');

  // Plazo de días (Sheet specific layout)
  writeCellSheetSpecific({
    'HOJA4': 'Y28',
    'CERTIFICADO PARA PAGO': 'Z28'
  }, parseCleanNumber(data.plazoDias), 'plazoDias');

  writeCell(CELL_MAP.fechaTerminacion, parseCleanDate(data.fechaTerminacion), 'fechaTerminacion');
  writeCell(CELL_MAP.valorInicial, parseCleanNumber(data.valorInicial), 'valorInicial');
  writeCell(CELL_MAP.adicion1, parseCleanNumber(data.adicion1), 'adicion1');
  writeCell(CELL_MAP.adicion2, parseCleanNumber(data.adicion2), 'adicion2');
  writeCell(CELL_MAP.adicion3, parseCleanNumber(data.adicion3), 'adicion3');
  writeCell(CELL_MAP.prorroga1Dias, parseCleanNumber(data.prorroga1Dias), 'prorroga1Dias');
  writeCell(CELL_MAP.prorroga2Dias, parseCleanNumber(data.prorroga2Dias), 'prorroga2Dias');
  writeCell(CELL_MAP.prorroga3Dias, parseCleanNumber(data.prorroga3Dias), 'prorroga3Dias');

  // 5. Fill Budget entries (from 1 to 5)
  const rubros: RubroPresupuestal[] = [];
  
  if (data.cdpNro || data.crpNro || data.codigoRubro || data.valorRubro) {
    rubros.push({
      cdp: data.cdpNro || '',
      crp: data.crpNro || '',
      fecha: parseCleanDate(data.fechaRegistroPresupuestal),
      rubro: data.codigoRubro || '',
      valor: parseCleanNumber(data.valorRubro)
    });
  }

  for (let i = 2; i <= 5; i++) {
    const cdpKey = `cdpNro${i}` as keyof CertificadoSupervisionData;
    const crpKey = `crpNro${i}` as keyof CertificadoSupervisionData;
    const fechaKey = `fechaRegistroPresupuestal${i}` as keyof CertificadoSupervisionData;
    const rubroKey = `codigoRubro${i}` as keyof CertificadoSupervisionData;
    const valorKey = `valorRubro${i}` as keyof CertificadoSupervisionData;

    const cdpVal = data[cdpKey];
    const crpVal = data[crpKey];
    const rubroVal = data[rubroKey];
    const valorVal = data[valorKey];

    if (cdpVal || crpVal || rubroVal || valorVal) {
      rubros.push({
        cdp: String(cdpVal || ''),
        crp: String(crpVal || ''),
        fecha: parseCleanDate(data[fechaKey]),
        rubro: String(rubroVal || ''),
        valor: parseCleanNumber(valorVal)
      });
    }
  }

  if (rubros.length > 6) {
    throw new Error('No se pueden exportar más de 6 rubros presupuestales en esta plantilla.');
  }

  rubros.forEach((rubro, idx) => {
    writeCellSheetSpecific({
      'HOJA4': idx < 4 ? `C${41 + idx}` : '',
      'CERTIFICADO PARA PAGO': `D${41 + idx}`
    }, rubro.cdp || null, `rubro${idx + 1}_cdp`);

    writeCellSheetSpecific({
      'HOJA4': idx < 4 ? `H${41 + idx}` : '',
      'CERTIFICADO PARA PAGO': `I${41 + idx}`
    }, rubro.crp || null, `rubro${idx + 1}_crp`);

    writeCellSheetSpecific({
      'HOJA4': idx < 4 ? `L${41 + idx}` : '',
      'CERTIFICADO PARA PAGO': `M${41 + idx}`
    }, rubro.fecha, `rubro${idx + 1}_fecha`);

    writeCellSheetSpecific({
      'HOJA4': idx < 4 ? `Q${41 + idx}` : '',
      'CERTIFICADO PARA PAGO': `R${41 + idx}`
    }, rubro.rubro || null, `rubro${idx + 1}_rubro`);

    writeCellSheetSpecific({
      'HOJA4': idx < 4 ? `X${41 + idx}` : '',
      'CERTIFICADO PARA PAGO': `Y${41 + idx}`
    }, rubro.valor, `rubro${idx + 1}_valor`);
  });

  // 6. Fill Social Security
  writeCellSheetSpecific({
    'HOJA4': 'N48',
    'CERTIFICADO PARA PAGO': 'O50'
  }, data.saludEps || null, 'saludEps');

  writeCellSheetSpecific({
    'HOJA4': 'W48',
    'CERTIFICADO PARA PAGO': 'X50'
  }, parseCleanNumber(data.saludPlanilla), 'saludPlanilla');

  writeCellSheetSpecific({
    'HOJA4': 'F48',
    'CERTIFICADO PARA PAGO': 'G50'
  }, parseCleanNumber(data.saludValor), 'saludValor');

  writeCellSheetSpecific({
    'HOJA4': 'N49',
    'CERTIFICADO PARA PAGO': 'O52'
  }, data.pensionFondo || null, 'pensionFondo');

  writeCellSheetSpecific({
    'HOJA4': 'W49',
    'CERTIFICADO PARA PAGO': 'X52'
  }, parseCleanNumber(data.pensionPlanilla), 'pensionPlanilla');

  writeCellSheetSpecific({
    'HOJA4': 'F49',
    'CERTIFICADO PARA PAGO': 'G52'
  }, parseCleanNumber(data.pensionValor), 'pensionValor');

  writeCellSheetSpecific({
    'HOJA4': 'N50',
    'CERTIFICADO PARA PAGO': 'O54'
  }, data.arpAseguradora || null, 'arpAseguradora');

  writeCellSheetSpecific({
    'HOJA4': 'W50',
    'CERTIFICADO PARA PAGO': 'X54'
  }, parseCleanNumber(data.arpPlanilla), 'arpPlanilla');

  writeCellSheetSpecific({
    'HOJA4': 'F50',
    'CERTIFICADO PARA PAGO': 'G54'
  }, parseCleanNumber(data.arpValor), 'arpValor');

  // 7. Payment details (Liquidation row 61)
  writeCellSheetSpecific({
    'HOJA4': 'B57',
    'CERTIFICADO PARA PAGO': 'C61'
  }, parseCleanNumber(data.pagoNro), 'pagoNro');

  writeCellSheetSpecific({
    'HOJA4': 'D57',
    'CERTIFICADO PARA PAGO': 'E61'
  }, parseCleanDate(data.periodoDesde), 'periodoDesde');

  writeCellSheetSpecific({
    'HOJA4': 'G57',
    'CERTIFICADO PARA PAGO': 'H61'
  }, parseCleanDate(data.periodoHasta), 'periodoHasta');

  writeCellSheetSpecific({
    'HOJA4': 'J57',
    'CERTIFICADO PARA PAGO': 'K61'
  }, parseCleanNumber(data.porcentajeEjecucion), 'porcentajeEjecucion');

  writeCellSheetSpecific({
    'HOJA4': 'M57',
    'CERTIFICADO PARA PAGO': 'N61'
  }, parseCleanNumber(data.valorPagadoAcumulado), 'valorPagadoAcumulado');

  writeCellSheetSpecific({
    'HOJA4': 'P57',
    'CERTIFICADO PARA PAGO': 'Q61'
  }, parseCleanNumber(data.valorAPagarSinIva), 'valorAPagarSinIva');

  writeCellSheetSpecific({
    'HOJA4': 'S57',
    'CERTIFICADO PARA PAGO': 'T61'
  }, parseCleanNumber(data.iva), 'iva');

  writeCellSheetSpecific({
    'HOJA4': 'Z57',
    'CERTIFICADO PARA PAGO': 'AA61'
  }, parseCleanNumber(data.saldoPorPagar), 'saldoPorPagar');

  // Populate 'V57' in Hoja4 with the formula '=P57+S57' so that 'K71' (formula '=+V57') resolves to the total pay value!
  const hoja4V57 = targetSheets.find(s => s.name.trim().toUpperCase() === 'HOJA4')?.getCell('V57');
  if (hoja4V57) {
    hoja4V57.value = { formula: 'P57+S57' };
  }

  // Certification observations (C64)
  writeCellSheetSpecific({
    'HOJA4': 'B60',
    'CERTIFICADO PARA PAGO': 'C64'
  }, data.observacionesLiquidacion || null, 'observacionesLiquidacion');

  // Expedicion Date (Row 73 in HOJA4, Row 77 in CERTIFICADO PARA PAGO)
  writeCellSheetSpecific({
    'HOJA4': 'M73',
    'CERTIFICADO PARA PAGO': 'N77'
  }, parseCleanNumber(data.expedicionDia), 'expedicionDia');

  writeCellSheetSpecific({
    'HOJA4': 'P73',
    'CERTIFICADO PARA PAGO': 'Q77'
  }, data.expedicionMes ? String(data.expedicionMes).trim().toUpperCase() : null, 'expedicionMes');

  writeCellSheetSpecific({
    'HOJA4': 'T73',
    'CERTIFICADO PARA PAGO': 'U77'
  }, parseCleanNumber(data.expedicionAno), 'expedicionAno');

  if (celdasEscritas.length === 0) {
    throw new Error('No se escribió ningún dato: el objeto de datos no coincide con el CELL_MAP');
  }

  console.log('[export] celdas escritas:', celdasEscritas);

  // 8. Re-evaluate formulas upon loading in Excel
  workbook.calcProperties.fullCalcOnLoad = true;

  // 9. Generate file buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
