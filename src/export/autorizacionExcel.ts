import ExcelJS from 'exceljs';
import { AutorizacionDesembolsoData } from '../types';

/**
 * Parses a string or number into a clean number, removing currency symbols, spaces, and separators.
 */
function parseCleanNumber(val: any): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const s = String(val).trim();
  if (!s || s === '-' || s.toUpperCase() === 'N/A' || s === '0') return null;

  // Remove currency symbol, dots, commas, spaces
  const clean = s.replace(/[$\s.]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Exports the Disbursement Authorization (Autorización de Desembolso) document using the official Excel template.
 */
export async function exportarAutorizacion(data: AutorizacionDesembolsoData): Promise<Blob> {
  console.log('[autorizacionExcel] data recibida:', JSON.stringify(data, null, 2));

  // 1. Load Excel template
  const templateUrl = `${(import.meta as any).env.BASE_URL}templates/AUTORIZACION_DE_DESEMBOLSO_Y_EQUIVALENTE_A_LA_FACTURA.xlsx`;
  let response: Response;
  try {
    response = await fetch(templateUrl);
  } catch (error) {
    throw new Error('No se encontró la plantilla del documento de autorización de desembolso (error de red o de ruta).');
  }

  if (!response.ok) {
    throw new Error(`Error al descargar la plantilla del documento de autorización de desembolso: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Clear defined names model if any to avoid repair dialogs in Excel
  (workbook as any).definedNames.model = [];

  // We write to the first sheet
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('No se encontró ninguna hoja en la plantilla Excel.');
  }

  // 2. Set Values according to inspection mappings

  // Fecha de Expedición (Cell D8)
  if (data.fechaExpedicion) {
    sheet.getCell('D8').value = data.fechaExpedicion;
  }

  // Consecutivo Nro. (Cell J8)
  if (data.consecutivoNro) {
    const numConsecutivo = parseInt(data.consecutivoNro, 10);
    sheet.getCell('J8').value = !isNaN(numConsecutivo) ? numConsecutivo : data.consecutivoNro;
  }

  // Nombre (Cell C14)
  if (data.nombre) {
    sheet.getCell('C14').value = data.nombre.toUpperCase();
  }

  // NIT. ó C.C (Cell I14)
  if (data.nitCc) {
    const cleanCc = data.nitCc.replace(/\D/g, '');
    const numCc = parseInt(cleanCc, 10);
    sheet.getCell('I14').value = !isNaN(numCc) ? numCc : data.nitCc;
  }

  // NRO. DE CUENTA (Cell C15)
  if (data.nroCuenta) {
    sheet.getCell('C15').value = data.nroCuenta.trim();
  }

  // TIPO DE CUENTA (Cell I15)
  if (data.tipoCuenta) {
    sheet.getCell('I15').value = data.tipoCuenta.toUpperCase();
  }

  // BANCO (Cell C16)
  if (data.banco) {
    sheet.getCell('C16').value = data.banco.toUpperCase();
  }

  // CIUDAD (Cell I16)
  if (data.ciudad) {
    sheet.getCell('I16').value = data.ciudad.toUpperCase();
  }

  // DIRECCIÓN (Cell C17)
  if (data.direccion) {
    sheet.getCell('C17').value = data.direccion.toUpperCase();
  }

  // TELÉFONO (Cell I17)
  if (data.telefono) {
    const cleanTel = data.telefono.replace(/\D/g, '');
    const numTel = parseInt(cleanTel, 10);
    sheet.getCell('I17').value = !isNaN(numTel) ? numTel : data.telefono;
  }

  // CONCEPTO (Cell D20)
  if (data.concepto) {
    sheet.getCell('D20').value = data.concepto.toUpperCase();
  }

  // NRO. Contrato / Concepto (Cell J20)
  if (data.conceptoNro) {
    const numContrato = parseInt(data.conceptoNro.replace(/\D/g, ''), 10);
    sheet.getCell('J20').value = !isNaN(numContrato) ? numContrato : data.conceptoNro;
  }

  // Objeto con Periodo (Cell B22)
  if (data.objeto) {
    sheet.getCell('B22').value = data.objeto.toUpperCase();
  }

  // VALOR EN NÚMEROS (Cell A25 - merged A25:G27)
  const valNumStr = (data.valorNumeros || data.subtotal || '').trim().replace(/^[\$\s]+/, '');
  if (valNumStr) {
    sheet.getCell('A25').value = `VALOR EN NÚMEROS ${valNumStr}`;
  }

  // Subtotal (Cell I25)
  const numericSubtotal = parseCleanNumber(data.subtotal || data.valorNumeros);
  if (numericSubtotal !== null) {
    sheet.getCell('I25').value = numericSubtotal;
  } else if (data.subtotal) {
    sheet.getCell('I25').value = data.subtotal;
  }

  // IVA Asumido (Cell I26)
  if (data.ivaAsumido !== undefined && data.ivaAsumido !== null && String(data.ivaAsumido).trim() !== '') {
    const numericIva = parseCleanNumber(data.ivaAsumido);
    sheet.getCell('I26').value = numericIva !== null ? numericIva : data.ivaAsumido;
  } else {
    sheet.getCell('I26').value = null; // Blank or 0
  }

  // Total (Cell I27)
  const numericTotal = parseCleanNumber(data.total || data.subtotal || data.valorNumeros);
  if (numericTotal !== null) {
    sheet.getCell('I27').value = numericTotal;
  } else {
    sheet.getCell('I27').value = { formula: 'I25' };
  }

  // Valor en Letras (Cell C28)
  if (data.valorLetras) {
    sheet.getCell('C28').value = data.valorLetras.toUpperCase();
  }

  // Endoso 1: Beneficiario (Cell C31), NIT (Cell I31)
  if (data.endoso1Beneficiario) {
    sheet.getCell('C31').value = data.endoso1Beneficiario.toUpperCase();
  }
  if (data.endoso1NitCc) {
    const cleanCc = data.endoso1NitCc.replace(/\D/g, '');
    const numCc = parseInt(cleanCc, 10);
    sheet.getCell('I31').value = !isNaN(numCc) ? numCc : data.endoso1NitCc;
  }

  // Endoso 1: Cuenta (Cell C32), Banco (Cell E32), Tipo (Cell I32)
  if (data.endoso1Cuenta) {
    sheet.getCell('C32').value = data.endoso1Cuenta.trim();
  }
  if (data.endoso1Banco) {
    sheet.getCell('E32').value = data.endoso1Banco.toUpperCase();
  }
  if (data.endoso1Tipo) {
    sheet.getCell('I32').value = data.endoso1Tipo.toUpperCase();
  }

  // Endoso 1: Concepto (Cell C33), Valor (Cell G33)
  if (data.endoso1Concepto) {
    sheet.getCell('C33').value = data.endoso1Concepto.toUpperCase();
  }
  if (data.endoso1Valor) {
    const valEndoso1 = parseCleanNumber(data.endoso1Valor);
    sheet.getCell('G33').value = valEndoso1 !== null ? valEndoso1 : data.endoso1Valor;
  }

  // Endoso 2: Beneficiario (Cell C36), NIT (Cell I36)
  if (data.endoso2Beneficiario) {
    sheet.getCell('C36').value = data.endoso2Beneficiario.toUpperCase();
  }
  if (data.endoso2NitCc) {
    const cleanCc = data.endoso2NitCc.replace(/\D/g, '');
    const numCc = parseInt(cleanCc, 10);
    sheet.getCell('I36').value = !isNaN(numCc) ? numCc : data.endoso2NitCc;
  }

  // Endoso 2: Cuenta (Cell C37), Banco (Cell E37), Tipo (Cell I37)
  if (data.endoso2Cuenta) {
    sheet.getCell('C37').value = data.endoso2Cuenta.trim();
  }
  if (data.endoso2Banco) {
    sheet.getCell('E37').value = data.endoso2Banco.toUpperCase();
  }
  if (data.endoso2Tipo) {
    sheet.getCell('I37').value = data.endoso2Tipo.toUpperCase();
  }

  // Endoso 2: Concepto (Cell C38), Valor (Cell G38)
  if (data.endoso2Concepto) {
    sheet.getCell('C38').value = data.endoso2Concepto.toUpperCase();
  }
  if (data.endoso2Valor) {
    const valEndoso2 = parseCleanNumber(data.endoso2Valor);
    sheet.getCell('G38').value = valEndoso2 !== null ? valEndoso2 : data.endoso2Valor;
  }

  // Bottom Info: DIRECCIÓN (Cell D41), TELÉFONO (Cell D42)
  if (data.direccion) {
    sheet.getCell('D41').value = data.direccion.toUpperCase();
  }
  if (data.telefono) {
    const cleanTel = data.telefono.replace(/\D/g, '');
    const numTel = parseInt(cleanTel, 10);
    sheet.getCell('D42').value = !isNaN(numTel) ? numTel : data.telefono;
  }

  // Force Excel to re-evaluate all formulas
  workbook.calcProperties.fullCalcOnLoad = true;

  // 3. Write workbook to buffer and return as Blob
  const outputBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([outputBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
