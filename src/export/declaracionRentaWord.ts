import PizZip from 'pizzip';
import { DeclaracionRentaData, ReportData } from '../types';
import { formatFechaDeclaracionRenta } from '../utils/formatters';

/**
 * Escapes XML special characters for safe inclusion in Word XML.
 */
function escapeXml(unsafe: string | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Helper to fetch image binary data from URL or Base64 data URI
 */
async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; ext: string } | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const meta = parts[0];
      const base64Data = parts[1];
      let ext = 'png';
      if (meta.includes('jpeg') || meta.includes('jpg')) ext = 'jpeg';
      else if (meta.includes('png')) ext = 'png';

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return { buffer: byteArray.buffer, ext };
    } else {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const contentType = resp.headers.get('content-type') || '';
      let ext = 'png';
      if (contentType.includes('jpeg') || contentType.includes('jpg') || url.endsWith('.jpg') || url.endsWith('.jpeg')) ext = 'jpeg';
      const buf = await resp.arrayBuffer();
      return { buffer: buf, ext };
    }
  } catch (err) {
    console.warn('Error al obtener imagen para Word:', err);
    return null;
  }
}

/**
 * Exports the Declaración Juramentada de Ingresos y Retención en la Fuente (Certificado bajo juramento)
 * to a standard Word (.docx) document using the official municipal template.
 */
export async function exportDeclaracionRentaToWord(
  data: DeclaracionRentaData,
  reportData?: ReportData
): Promise<Blob> {
  // 1. Fetch template docx
  const templateUrl = `${(import.meta as any).env.BASE_URL}templates/Certificado_bajo_juramento_Alcaldia.docx`;
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla Word de Certificado bajo juramento (${response.status} ${response.statusText})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  // 2. Read document.xml
  let documentXml = zip.file('word/document.xml')?.asText();
  if (!documentXml) {
    throw new Error('El archivo de plantilla no contiene word/document.xml');
  }

  // 3. Prepare replacement values
  const rawDate = data.fecha || reportData?.periodoHasta || reportData?.fechaPresentacion || '14 de julio de 2026';
  const fechaStr = formatFechaDeclaracionRenta(rawDate);
  const nombreContratista = (data.nombresApellidos || reportData?.contratistaNombre || 'HAMINTON MENA MENA').trim().toUpperCase();
  const cedulaContratista = (data.cedula || reportData?.contratistaDocumento || '80.772.379').trim();
  const expedicionCedula = (data.expedicionCedula || reportData?.contratistaLugarDoc || 'Bogotá D.C').trim();
  
  const firmaNombre = (data.firmaNombre || nombreContratista).trim().toUpperCase();
  const firmaCedula = (data.firmaCedula || cedulaContratista).trim();
  const firmaExpedicion = (data.firmaExpedicion || expedicionCedula).trim();

  // Parse senores lines
  const rawSenores = data.senores || 'Señores\nALCALDIA\nCiudad.';
  const senoresLines = rawSenores.split('\n').map(l => l.trim()).filter(Boolean);
  const line0 = senoresLines[0] || 'Señores';
  const line1 = senoresLines[1] || 'ALCALDIA';
  const line2 = senoresLines[2] || 'Ciudad.';

  // Build Date XML paragraph with clean separation before Señores (font size 11pt / sz 22)
  const fechaXml = `<w:p w14:paraId="347D8A10" w14:textId="77777777" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(fechaStr)}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`;

  // Build Senores XML paragraphs (font size 11pt)
  const senores0Xml = `<w:p w14:paraId="3B8F89A5" w14:textId="77777777" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(line0)}</w:t></w:r></w:p>`;
  const senores1Xml = `<w:p w14:paraId="2E7E2C95" w14:textId="77777777" w:rsidR="00A856BF" w:rsidRDefault="00E37F39" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(line1)}</w:t></w:r></w:p>`;
  const senores2Xml = `<w:p w14:paraId="34127C97" w14:textId="77777777" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(line2)}</w:t></w:r></w:p>`;

  // Build REF and Title XML (font size 11pt, preserving original layout)
  const refXml = `<w:p w14:paraId="486C9E5E" w14:textId="52A6D2A4" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>REF: CERTIFICACIÒN PARA EFECTOS DE RETENCIÓN EN LA FUENTE LEY 1819 DE 2016- RENTAS DE TRABAJO.</w:t></w:r></w:p>`;
  const tituloXml = `<w:p w14:paraId="659CC2F9" w14:textId="77777777" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>CERTIFICACIÒN BAJO LA GRAVEDAD DE JURAMENTO</w:t></w:r></w:p>`;

  // Build Juramento Body Paragraph (font size 11pt, preserving original single line spacing)
  const juramentoXml = `<w:p w14:paraId="2F1B4D89" w14:textId="53944B6C" w:rsidR="00CC2221" w:rsidRDefault="00CC2221" w:rsidP="00CC2221"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">Yo, </w:t></w:r><w:r w:rsidR="00AC639B"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(nombreContratista)}</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">, </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>identificada con cedula de ciudadanía</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>No.</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="007802FB"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(cedulaContratista)} expedida</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>en</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AC639B"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(expedicionCedula)}</w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>, con el fin de dar cumplimiento a las disposiciones establecidas en la ley 1819 de 2016 y del parágrafo 2 del artículo 383 del Estatuto Tributario, manifiesto bajo gravedad de juramento que:</w:t></w:r></w:p>`;

  // Article 383 paragraph (font size 11pt)
  const art383Xml = `<w:p w14:paraId="024C0057" w14:textId="77777777" w:rsidR="00CC2221" w:rsidRDefault="00CC2221" w:rsidP="00CC2221"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">Para efectos de la aplicación de la tabla de retención en la fuente establecida en el artículo 383 del Estatuto tributario, la cual se le aplica a los pagos o abonos en cuenta por concepto de Ingresos por honorarios y por compensación por servicios personales. </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">. </w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Parágrafo 2 ART 383 E.T).</w:t></w:r></w:p>`;

  // SI / NO selection (font size 11pt)
  const isAplica = Boolean(data.aplicaRetencion);
  const siText = isAplica ? 'SI (   X  )' : 'SI (    )';
  const noText = isAplica ? 'NO (    )' : 'NO (   X  )';
  const checkboxesXml = `<w:p w14:paraId="2D2C96F0" w14:textId="77777777" w:rsidR="00CC2221" w:rsidRDefault="00CC2221" w:rsidP="00CC2221"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:tabs><w:tab w:val="left" w:pos="5190"/></w:tabs><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(siText)}</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:tab/><w:t>${escapeXml(noText)}</w:t></w:r></w:p>`;

  // Worker commitment paragraph (font size 11pt)
  const compXml = `<w:p w14:paraId="0408F9D4" w14:textId="77777777" w:rsidR="00CC2221" w:rsidRDefault="00CC2221" w:rsidP="00CC2221"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>De la misma manera, en el momento en que contrate o vincule más de un trabajador asociado a mi actividad económica, me comprometo a informar.</w:t></w:r></w:p>`;

  // Cordialmente paragraph
  const cordXml = `<w:p w14:paraId="24A643ED" w14:textId="0364F4E3" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Cordialmente,</w:t></w:r></w:p>`;

  // Space for signature area (signature image removed)
  const blankSigSpaceXml = `<w:p><w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`;

  // Signatory name and CC paragraphs (font size 11pt)
  const firmaNombreXml = `<w:p w14:paraId="7F2499DF" w14:textId="59043054" w:rsidR="00C325A3" w:rsidRDefault="00AC639B" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(firmaNombre)}</w:t></w:r></w:p>`;
  const firmaCedulaXml = `<w:p w14:paraId="2C48F7A4" w14:textId="38397B80" w:rsidR="00A856BF" w:rsidRDefault="00A856BF" w:rsidP="00A856BF"><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">C.C. </w:t></w:r><w:r w:rsidR="00AC639B"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(firmaCedula)}</w:t></w:r><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> de ${escapeXml(firmaExpedicion)}</w:t></w:r></w:p>`;

  // Precise replacement by paragraph ID and fallback patterns
  if (documentXml.includes('347D8A10')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="347D8A10"[\s\S]*?<\/w:p>/, fechaXml);
  } else {
    documentXml = documentXml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?Quibdó[\s\S]*?<\/w:p>/, fechaXml);
  }

  if (documentXml.includes('3B8F89A5')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="3B8F89A5"[\s\S]*?<\/w:p>/, senores0Xml);
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="2E7E2C95"[\s\S]*?<\/w:p>/, senores1Xml);
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="34127C97"[\s\S]*?<\/w:p>/, senores2Xml);
  } else {
    documentXml = documentXml.replace(
      /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?Señores[\s\S]*?<\/w:p>\s*<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?ALCALDIA[\s\S]*?<\/w:p>\s*<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?Ciudad\.[\s\S]*?<\/w:p>/,
      `${senores0Xml}\n${senores1Xml}\n${senores2Xml}`
    );
  }

  if (documentXml.includes('486C9E5E')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="486C9E5E"[\s\S]*?<\/w:p>/, refXml);
  }
  if (documentXml.includes('659CC2F9')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="659CC2F9"[\s\S]*?<\/w:p>/, tituloXml);
  }

  if (documentXml.includes('2F1B4D89')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="2F1B4D89"[\s\S]*?<\/w:p>/, juramentoXml);
  } else {
    documentXml = documentXml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?Yo,(?:(?!<\/w:p>)[\s\S])*?Estatuto Tributario[\s\S]*?<\/w:p>/, juramentoXml);
  }

  if (documentXml.includes('024C0057')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="024C0057"[\s\S]*?<\/w:p>/, art383Xml);
  }

  if (documentXml.includes('2D2C96F0')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="2D2C96F0"[\s\S]*?<\/w:p>/, checkboxesXml);
  } else {
    documentXml = documentXml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?SI \((?:(?!<\/w:p>)[\s\S])*?NO \([\s\S]*?<\/w:p>/, checkboxesXml);
  }

  if (documentXml.includes('0408F9D4')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="0408F9D4"[\s\S]*?<\/w:p>/, compXml);
  }

  if (documentXml.includes('24A643ED')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="24A643ED"[\s\S]*?<\/w:p>/, cordXml);
  }

  // Remove signature drawing/image completely
  documentXml = documentXml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:drawing\b[\s\S]*?<\/w:p>/g, blankSigSpaceXml);

  if (documentXml.includes('7F2499DF')) {
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="7F2499DF"[\s\S]*?<\/w:p>/, firmaNombreXml);
    documentXml = documentXml.replace(/<w:p\b[^>]*w14:paraId="2C48F7A4"[\s\S]*?<\/w:p>/, firmaCedulaXml);
  } else {
    const lastPIndex = documentXml.lastIndexOf('HAMINTON MENA MENA');
    if (lastPIndex !== -1) {
      const pStart = documentXml.lastIndexOf('<w:p', lastPIndex);
      const pBefore = documentXml.substring(0, pStart);
      const pAfter = documentXml.substring(pStart);
      const replacedAfter = pAfter.replace(
        /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?HAMINTON MENA MENA[\s\S]*?<\/w:p>\s*<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?C\.C\.[\s\S]*?<\/w:p>/,
        `${firmaNombreXml}\n${firmaCedulaXml}`
      );
      documentXml = pBefore + replacedAfter;
    }
  }

  // 4. Clean up signature image files if present
  try {
    zip.remove('word/media/image1.jpeg');
  } catch (e) {
    // ignore if not present
  }

  // 5. Save modified document.xml
  zip.file('word/document.xml', documentXml);

  // 6. Generate Blob
  const outBlob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  return outBlob;
}

