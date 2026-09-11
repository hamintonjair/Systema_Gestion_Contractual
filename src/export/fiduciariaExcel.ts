import ExcelJS from 'exceljs';
import { SoporteFiduciariaData } from '../types';

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
 * Exports the Fiduciary Support Document using the official Excel template.
 */
export async function exportarFiduciaria(data: SoporteFiduciariaData): Promise<Blob> {
  console.log('[fiduciariaExcel] data recibida:', JSON.stringify(data, null, 2));

  // 1. Load Excel template
  const templateUrl = `${(import.meta as any).env.BASE_URL}templates/Documento_soporte_Fiduciaria.xlsx`;
  let response: Response;
  try {
    response = await fetch(templateUrl);
  } catch (error) {
    throw new Error('No se encontró la plantilla del documento soporte fiduciaria (error de red o de ruta).');
  }

  if (!response.ok) {
    throw new Error(`Error al descargar la plantilla del documento soporte fiduciaria: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // We write to the first sheet
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('No se encontró ninguna hoja en la plantilla Excel.');
  }

  // 2. Set Values according to inspection mappings
  
  // Doc Soporte Nro (Cell J9)
  if (data.docSoporteNro) {
    sheet.getCell('J9').value = data.docSoporteNro;
  }

  // Ciudad (Cell E10)
  if (data.ciudad) {
    sheet.getCell('E10').value = data.ciudad.toUpperCase();
  }

  // Fecha (Cell G10)
  if (data.fecha) {
    sheet.getCell('G10').value = data.fecha;
  }

  // Nombres y Apellidos (Cell E11)
  if (data.nombresApellidos) {
    sheet.getCell('E11').value = data.nombresApellidos.toUpperCase();
  }

  // N° Cédula de Ciudadanía (Cell F12)
  if (data.cedula) {
    const cleanCc = data.cedula.replace(/\D/g, '');
    const numCc = parseInt(cleanCc, 10);
    sheet.getCell('F12').value = !isNaN(numCc) ? numCc : data.cedula;
  }

  // Dirección (Cell D13)
  if (data.direccion) {
    sheet.getCell('D13').value = data.direccion.toUpperCase();
  }

  // Teléfono (Cell D14)
  if (data.telefono) {
    const cleanTel = data.telefono.replace(/\D/g, '');
    const numTel = parseInt(cleanTel, 10);
    sheet.getCell('D14').value = !isNaN(numTel) ? numTel : data.telefono;
  }

  // La suma total (Cell E15)
  const numericSumaTotal = parseCleanNumber(data.sumaTotal || data.subTotal);
  if (numericSumaTotal !== null) {
    sheet.getCell('E15').value = numericSumaTotal;
  } else {
    sheet.getCell('E15').value = data.sumaTotal;
  }

  // (Valor en letras) (Cell E16)
  if (data.valorLetras) {
    sheet.getCell('E16').value = data.valorLetras.toUpperCase();
  }

  // Cantidad (Cell C21)
  if (data.cantidad) {
    const qty = parseInt(data.cantidad, 10);
    sheet.getCell('C21').value = !isNaN(qty) ? qty : 1;
  }

  // Descripción del bien o servicio (Cell D21)
  if (data.descripcionBienServicio) {
    sheet.getCell('D21').value = data.descripcionBienServicio.toUpperCase();
  }

  // Sub Total (Cell I21)
  const numericSubtotal = parseCleanNumber(data.subTotal);
  if (numericSubtotal !== null) {
    sheet.getCell('I21').value = { formula: 'E15', result: numericSubtotal };
  } else {
    sheet.getCell('I21').value = { formula: 'E15' };
  }

  // Total (Cell J21)
  const numericTotal = parseCleanNumber(data.total);
  if (numericTotal !== null) {
    sheet.getCell('J21').value = { formula: 'I21', result: numericTotal };
  } else {
    sheet.getCell('J21').value = { formula: 'I21' };
  }

  // Total General (Cell J22)
  const numericTotalGen = parseCleanNumber(data.totalGeneral || data.total);
  if (numericTotalGen !== null) {
    sheet.getCell('J22').value = { formula: 'J21', result: numericTotalGen };
  } else {
    sheet.getCell('J22').value = { formula: 'J21' };
  }

  // Nota (Cell C23)
  if (data.nota) {
    sheet.getCell('C23').value = data.nota;
  }

  // 3. Write workbook to buffer and return as Blob
  const outputBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([outputBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
