import PizZip from 'pizzip';
import { ReportData, Obligacion, Anexo } from '../types';
import { 
  formatColombianCurrency, 
  formatValorAdicion, 
  formatPlazoLetraYNumero,
  formatFechaAplicacion,
  formatDateSlash 
} from '../utils/formatters';
import { obtenerValoresMonetariosReporte } from '../utils/numberToWords';

/**
 * Escapes characters for XML safe insertion
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
 * Converts a text string into OpenXML paragraphs or line breaks with Century Gothic 12pt
 */
function createXmlRuns(
  text: string | null | undefined, 
  options: { bold?: boolean; size?: number; align?: string; italic?: boolean; color?: string; fontFamily?: string } = {}
): string {
  const { bold = false, size = 24, align = 'both', italic = false, color = '000000', fontFamily = 'Calibri' } = options;
  if (!text) return '';

  const lines = String(text).split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return '';

  return lines.map(line => `
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="60" w:line="260" w:lineRule="auto"/>
        <w:jc w:val="${align}"/>
        <w:rPr>
          <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}" w:cs="${fontFamily}"/>
          ${bold ? '<w:b/><w:bCs/>' : ''}
          ${italic ? '<w:i/><w:iCs/>' : ''}
          <w:sz w:val="${size}"/>
          <w:szCs w:val="${size}"/>
          <w:color w:val="${color}"/>
        </w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}" w:cs="${fontFamily}"/>
          ${bold ? '<w:b/><w:bCs/>' : ''}
          ${italic ? '<w:i/><w:iCs/>' : ''}
          <w:sz w:val="${size}"/>
          <w:szCs w:val="${size}"/>
          <w:color w:val="${color}"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(line.trim())}</w:t>
      </w:r>
    </w:p>
  `).join('');
}

/**
 * Fetches or decodes an image URL/base64 to an ArrayBuffer and determines format
 */
async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; ext: string } | null> {
  try {
    if (!url) return null;

    if (url.startsWith('data:')) {
      const match = url.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.*)$/i);
      if (!match) return null;
      const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      const base64Data = match[2];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { buffer: bytes.buffer, ext: ext === 'jpg' ? 'jpeg' : ext };
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || '';
    let ext = 'jpeg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'png'; // treat as png or jpeg
    return { buffer: arrayBuffer, ext };
  } catch (e) {
    console.warn('No se pudo cargar la imagen para exportar a Word:', url, e);
    return null;
  }
}

/**
 * Cleans obligation text to avoid duplicated numbers like "1.  1. Actividad"
 */
function cleanObligacionLabel(text: string | undefined, index: number): string {
  if (!text) return `${index + 1}. `;
  let clean = text.trim();
  // Remove leading numbering like "1.", "1.1", "1 -", etc.
  clean = clean.replace(/^(\d+[\.\-\)]\s*)+/, '').trim();
  return `${index + 1}.  ${clean}`;
}

/**
 * Generates the full Word document from the institutional Alcaldía template
 */
export async function generarInformeWordDocx(data: ReportData): Promise<Blob> {
  // 1. Load the official docx template
  const templatePath = '/templates/Formato_informe_de_cumplimiento.docx';
  const response = await fetch(templatePath);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla oficial institucional (${response.statusText})`);
  }
  const templateArrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(templateArrayBuffer);

  // 2. Financial amounts in words and figures
  const { valorLetras, valorNumeroFormateado } = obtenerValoresMonetariosReporte(data);
  const valorPagarFormateado = valorNumeroFormateado 
    ? `$ ${valorNumeroFormateado}` 
    : formatColombianCurrency(data.valorPagar || data.valorMensual || '0');
  const valorLetrasCompleto = valorLetras || 'CERO PESOS M/CTE';

  // 3. Application Date / Header Date
  const rawFechaApp = data.fechaAplicacion || '';
  const fechaAplicacionTexto = formatFechaAplicacion(rawFechaApp).toUpperCase();

  // 4. Update Headers (header2.xml, header1.xml, header3.xml)
  ['header1.xml', 'header2.xml', 'header3.xml'].forEach(headerFile => {
    let headerContent = zip.file(`word/${headerFile}`)?.asText();
    if (headerContent) {
      // Update FECHA DE APLICACIÓN:
      headerContent = headerContent.replace(
        /<w:t>FECHA DE APLICACI[OÓ]N:?<\/w:t>[\s\S]*?<\/w:r>(?:<w:r>[\s\S]*?<\/w:r>)?/,
        `<w:t>FECHA DE APLICACIÓN: ${escapeXml(fechaAplicacionTexto)}</w:t></w:r>`
      );

      // Update Secretaria name in header if different from default
      if (data.secretariaNombre) {
        headerContent = headerContent.replace(
          /SECRETAR[IÍ]A DE INCLUSI[OÓ]N Y COHESI[OÓ]N SOCIAL/gi,
          escapeXml(data.secretariaNombre.toUpperCase())
        );
      }

      zip.file(`word/${headerFile}`, headerContent);
    }
  });

  // 5. Build Document Table & Content
  const isMensual = data.tipoInforme !== 'Final';
  const isFinal = data.tipoInforme === 'Final';

  // Build the 15-column Table XML
  const rowsXml: string[] = [];

  // ROW 1: HEADER "DATOS DEL INFORME"
  rowsXml.push(`
    <w:tr w:rsidR="00551514" w14:paraId="3D8E2D77">
      <w:trPr><w:trHeight w:val="297"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/><w:gridSpan w:val="15"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
            <w:t>DATOS DEL INFORME</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 2: TIPO INFORME (Mensual [ X ] / Final [ ]) - Size 9
  rowsXml.push(`
    <w:tr w:rsidR="00551514" w14:paraId="46C245A9">
      <w:trPr><w:trHeight w:val="297"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2470" w:type="pct"/><w:gridSpan w:val="6"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="18"/><w:szCs w:val="18"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="18"/><w:szCs w:val="18"/>
            </w:rPr>
            <w:t xml:space="preserve">Mensual   [ ${isMensual ? 'X' : '  '} ]</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2530" w:type="pct"/><w:gridSpan w:val="9"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="18"/><w:szCs w:val="18"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="18"/><w:szCs w:val="18"/>
            </w:rPr>
            <w:t xml:space="preserve">Final   [ ${isFinal ? 'X' : '  '} ]</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 3: NUMERO DE INFORME - Label 8, Number 11
  rowsXml.push(`
    <w:tr w:rsidR="00551514" w14:paraId="2E74B086">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/><w:gridSpan w:val="15"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="60" w:after="60" w:line="259" w:lineRule="auto"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="16"/><w:szCs w:val="16"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="16"/><w:szCs w:val="16"/>
            </w:rPr>
            <w:t xml:space="preserve">Informe mensual de actividades Nro. </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
            </w:rPr>
            <w:t>${escapeXml(data.informeNro)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 4: FECHA PRESENTACION (Label 8, Date 9) & PERIODO (Label 8, Dates 9)
  rowsXml.push(`
    <w:tr w:rsidR="00551514" w14:paraId="34BA8ED3">
      <w:trPr><w:trHeight w:val="350"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Fecha de Presentación:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(formatDateSlash(data.fechaPresentacion))}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="559" w:type="pct"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Período del informe:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2479" w:type="pct"/><w:gridSpan w:val="8"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">DESDE: </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(formatDateSlash(data.periodoDesde))}   </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">HASTA: </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(formatDateSlash(data.periodoHasta))}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 5: CONTRATISTA (Label 8, Name 11 Bold) & CC (Label 8, Doc 11 Bold)
  rowsXml.push(`
    <w:tr w:rsidR="00551514" w14:paraId="470DDA54">
      <w:trPr><w:trHeight w:val="350"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nombre del Contratista:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2464" w:type="pct"/><w:gridSpan w:val="11"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.contratistaNombre?.toUpperCase())}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="841" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nro. de documento de identidad:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="714" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.contratistaDocumento)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 6: CORREO (Label 8, Value 11) & TELEFONO (Label 8, Value 11)
  rowsXml.push(`
    <w:tr w:rsidR="00551514" w14:paraId="60F98CBC">
      <w:trPr><w:trHeight w:val="300"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Correo Electrónico:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2464" w:type="pct"/><w:gridSpan w:val="11"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.contratistaCorreo)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="841" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nro. de teléfono:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="714" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.contratistaTelefono)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 7: SUPERVISOR (Label 8, Name 11 Bold) & CC (Label 8, Doc 11)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="784BFA0B">
      <w:trPr><w:trHeight w:val="350"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nombre Interventor(a) o Supervisor(a):</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2464" w:type="pct"/><w:gridSpan w:val="11"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.supervisorNombre?.toUpperCase())}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="841" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nro. de documento de identidad:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="714" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.supervisorDocumento)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 8: APOYO SUPERVISION (Label 8, Value 8 Italic) & CC (Label 8, Doc 8 Italic)
  const defaultApoyoPlaceholder = '(Relacione aquí el nombre de la persona encargada del apoyo a la supervisión del contrato, si es el caso)';
  const apoyoNombreTexto = (!data.apoyoSupervisionNombre || data.apoyoSupervisionNombre.trim() === '' || data.apoyoSupervisionNombre.toUpperCase() === 'N/A')
    ? defaultApoyoPlaceholder
    : data.apoyoSupervisionNombre;
  const apoyoDocTexto = data.apoyoSupervisionDocumento || 'N/A';

  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="3E9FE015">
      <w:trPr><w:trHeight w:val="350"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nombre del Apoyo a la Supervisión:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2464" w:type="pct"/><w:gridSpan w:val="11"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${escapeXml(apoyoNombreTexto)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="841" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Nro. de documento de identidad:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="714" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${escapeXml(apoyoDocTexto)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 9: VALOR CONTRATO (Label 8, Value 11 Bold) & VALOR ADICION (Label 8, Value 11 Bold)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="7D6A5BB0">
      <w:trPr><w:trHeight w:val="350"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Valor del Contrato:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1682" w:type="pct"/><w:gridSpan w:val="8"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(formatColombianCurrency(data.valorContrato))}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="782" w:type="pct"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Valor de Adición:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1555" w:type="pct"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(formatValorAdicion(data.valorAdicion))}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 10: HEADER "DATOS DEL CONTRATO"
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="4630DA13">
      <w:trPr><w:trHeight w:val="297"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/><w:gridSpan w:val="15"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
            <w:t>DATOS DEL CONTRATO</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 11: CONTRATO NRO - Label 8, Number 11 Bold
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="63DE8EB1">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Contrato Nro.</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="4019" w:type="pct"/><w:gridSpan w:val="14"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(data.contratoNro)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 12: OBJETO - Label 8, Text 8
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="536CE60E">
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Objeto:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="4019" w:type="pct"/><w:gridSpan w:val="14"/><w:vAlign w:val="center"/></w:tcPr>
        ${createXmlRuns(data.objeto, { size: 16, align: 'both', fontFamily: 'Calibri' })}
      </w:tc>
    </w:tr>
  `);

  // ROW 13: CDP (Label 8, Value 9) & CRP (Label 8, Value 9)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="58A679BE">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>CDP Nro.</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1051" w:type="pct"/><w:gridSpan w:val="4"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(data.cdpNro)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="631" w:type="pct"/><w:gridSpan w:val="4"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>CRP Nro.</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2337" w:type="pct"/><w:gridSpan w:val="6"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(data.crpNro)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 14: POLIZA (Label 8, Value 9) & FECHA POLIZA (Label 8, Value 9)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="29B85449">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Póliza Nro.</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1051" w:type="pct"/><w:gridSpan w:val="4"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(data.polizaNro || 'N/A')}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1833" w:type="pct"/><w:gridSpan w:val="8"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Fecha Acta de Aprobación Póliza:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1135" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(formatDateSlash(data.fechaPoliza) || 'N/A')}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 15: PLAZO (Label 8, Value 9 Bold), FECHA INICIO (Label 8, Value 8), FECHA TERMINACION (Label 8, Value 8)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="2CA88CE6">
      <w:trPr><w:trHeight w:val="350"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="981" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Plazo:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1051" w:type="pct"/><w:gridSpan w:val="4"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(formatPlazoLetraYNumero(data.plazo))}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="631" w:type="pct"/><w:gridSpan w:val="4"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Fecha de Iniciación:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="500" w:type="pct"/><w:gridSpan w:val="1"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${escapeXml(formatDateSlash(data.fechaInicio))}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="688" w:type="pct"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Fecha de Terminación:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1149" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${escapeXml(formatDateSlash(data.fechaTerminacion))}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 16: MODIFICACIONES AL CONTRATO - Label 8, Value 8 Italic
  const defaultModificacionesPlaceholder = '(Relacione aquí todo lo correspondiente a una prórroga, adición y/o suspensión, si es el caso)';
  const modificacionesTexto = (!data.modificaciones || data.modificaciones.trim() === '' || data.modificaciones.toUpperCase() === 'N/A')
    ? defaultModificacionesPlaceholder
    : data.modificaciones;

  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="4097E9C4">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="1193" w:type="pct"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Modificaciones al Contrato:</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="3807" w:type="pct"/><w:gridSpan w:val="13"/><w:vAlign w:val="center"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:i/><w:iCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${escapeXml(modificacionesTexto)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 17: HEADER "EJECUCIÓN DE ACTIVIDADES..." (Size 10)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="1FFBE8D2">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/><w:gridSpan w:val="15"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
            <w:t>EJECUCIÓN DE ACTIVIDADES FRENTE A LAS OBLIGACIONES DURANTE EL PERÍODO REPORTADO</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 18: TABLE COLUMNS HEADER ("Obligaciones Contractuales" | "Actividades realizadas..." | "Soportes" - Size 8, Century Gothic)
  rowsXml.push(`
    <w:tr w:rsidR="0043731A" w14:paraId="11365A0D">
      <w:trPr><w:trHeight w:val="330"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1489" w:type="pct"/><w:gridSpan w:val="3"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>Obligaciones Contractuales</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1699" w:type="pct"/><w:gridSpan w:val="8"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>Actividades realizadas y/o productos entregados</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1812" w:type="pct"/><w:gridSpan w:val="4"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>Soportes</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROWS 19+: OBLIGATIONS DYNAMIC EXPANSION - Content size 11 (22 half-points), Century Gothic
  const obligacionesList: Obligacion[] = (data.obligaciones && data.obligaciones.length > 0) 
    ? data.obligaciones 
    : [{ id: 'ob-1', descripcion: 'Cumplir con las obligaciones contractuales pactadas.', actividades: 'Se realizaron las actividades del período.', soportes: 'Anexo fotográfico' }];

  obligacionesList.forEach((ob, idx) => {
    const obLabel = cleanObligacionLabel(ob.descripcion, idx);
    const obActividades = ob.actividades || 'Sin actividades registradas en el período.';
    const obSoportes = ob.soportes || 'Anexo fotográfico';

    rowsXml.push(`
      <w:tr w:rsidR="00006205">
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1489" w:type="pct"/><w:gridSpan w:val="3"/>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          ${createXmlRuns(obLabel, { size: 22, align: 'both', fontFamily: 'Century Gothic' })}
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1699" w:type="pct"/><w:gridSpan w:val="8"/>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          ${createXmlRuns(obActividades, { size: 22, align: 'both', fontFamily: 'Century Gothic' })}
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1812" w:type="pct"/><w:gridSpan w:val="4"/>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          ${createXmlRuns(obSoportes, { size: 22, align: 'left', fontFamily: 'Century Gothic' })}
        </w:tc>
      </w:tr>
    `);
  });

  // ROW 30: HEADER "SUSCRIPCIÓN DEL INFORME" (Size 11 Bold)
  rowsXml.push(`
    <w:tr w:rsidR="00006205">
      <w:trPr><w:trHeight w:val="297"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/><w:gridSpan w:val="15"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
            </w:rPr>
            <w:t>SUSCRIPCIÓN DEL INFORME</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 31: CERTIFICATION TEXT - Content size 9 Italic
  const certificacionTexto = `El supervisor con la firma del presente documento certifica que verificó el cumplimiento de las obligaciones contractuales para el período de presentación de este informe, como el pago de los aportes respectivos al Sistema de Seguridad Social, por concepto de salud, pensiones y ARL, por tal razón, se autoriza el pago al Contratista de la suma de ${valorLetrasCompleto} (${valorPagarFormateado})`;

  rowsXml.push(`
    <w:tr w:rsidR="00006205">
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/><w:gridSpan w:val="15"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="60" w:after="60" w:line="259" w:lineRule="auto"/>
            <w:jc w:val="both"/>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:i/><w:iCs/><w:sz w:val="18"/><w:szCs w:val="18"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
              <w:i/><w:iCs/><w:sz w:val="18"/><w:szCs w:val="18"/>
            </w:rPr>
            <w:t>${escapeXml(certificacionTexto)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // ROW 32: SIGNATURES BLOCK (2 COLUMNS)
  rowsXml.push(`
    <w:tr w:rsidR="00006205">
      <w:trPr><w:trHeight w:val="1600"/></w:trPr>
      <!-- FIRMA CONTRATISTA -->
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2542" w:type="pct"/><w:gridSpan w:val="8"/>
          <w:vAlign w:val="bottom"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/></w:pPr></w:p>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/></w:pPr></w:p>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>________________________________________________</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>Firma del contratista</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:shd w:val="clear" w:color="auto" w:fill="BFBFBF"/>
            <w:spacing w:before="60" w:after="60" w:line="259" w:lineRule="auto"/>
            <w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>${escapeXml(data.contratistaNombre?.toUpperCase())}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <!-- FIRMA SUPERVISOR -->
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2458" w:type="pct"/><w:gridSpan w:val="7"/>
          <w:vAlign w:val="bottom"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/></w:pPr></w:p>
        <w:p><w:pPr><w:spacing w:line="259" w:lineRule="auto"/></w:pPr></w:p>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>________________________________________________</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:spacing w:line="259" w:lineRule="auto"/><w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>Firma Supervisor</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:shd w:val="clear" w:color="auto" w:fill="BFBFBF"/>
            <w:spacing w:before="60" w:after="60" w:line="259" w:lineRule="auto"/>
            <w:jc w:val="center"/>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            <w:t>${escapeXml(data.supervisorNombre?.toUpperCase())}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `);

  // Construct complete Table XML with original 15-column tblGrid and borders
  const completeTableXml = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5617" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblLayout w:type="fixed"/>
        <w:tblLook w:val="01E0" w:firstRow="1" w:lastRow="1" w:firstColumn="1" w:lastColumn="1" w:noHBand="0" w:noVBand="0"/>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="1743"/>
        <w:gridCol w:w="377"/>
        <w:gridCol w:w="526"/>
        <w:gridCol w:w="841"/>
        <w:gridCol w:w="125"/>
        <w:gridCol w:w="777"/>
        <w:gridCol w:w="91"/>
        <w:gridCol w:w="38"/>
        <w:gridCol w:w="214"/>
        <w:gridCol w:w="912"/>
        <w:gridCol w:w="20"/>
        <w:gridCol w:w="458"/>
        <w:gridCol w:w="746"/>
        <w:gridCol w:w="748"/>
        <w:gridCol w:w="2301"/>
      </w:tblGrid>
      ${rowsXml.join('')}
    </w:tbl>
  `;

  // 6. Collect photos for ANEXOS section
  // Check photos on each obligation and in data.anexos
  const obligationPhotosMap: Map<number, Anexo[]> = new Map();

  obligacionesList.forEach((ob, idx) => {
    const list: Anexo[] = [];
    if (ob.fotos && ob.fotos.length > 0) {
      list.push(...ob.fotos);
    }
    // Also check global anexos linked to this obligation
    if (data.anexos && data.anexos.length > 0) {
      data.anexos.forEach(anx => {
        if (anx.obligacionIndex === idx || (ob.id && anx.obligacionId === ob.id)) {
          if (!list.some(existing => existing.id === anx.id || existing.imagenUrl === anx.imagenUrl)) {
            list.push(anx);
          }
        }
      });
    }
    if (list.length > 0) {
      obligationPhotosMap.set(idx, list);
    }
  });

  // If there are general anexos not linked to any obligation, group them
  const generalAnexos: Anexo[] = [];
  if (data.anexos && data.anexos.length > 0) {
    data.anexos.forEach(anx => {
      let isAttached = false;
      obligationPhotosMap.forEach(list => {
        if (list.some(existing => existing.id === anx.id || existing.imagenUrl === anx.imagenUrl)) {
          isAttached = true;
        }
      });
      if (!isAttached && anx.imagenUrl) {
        generalAnexos.push(anx);
      }
    });
  }

  // 7. Process Image Attachments & Relationships
  let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
  let imageCounter = 200;
  const anexosXmlRuns: string[] = [];

  const hasAnyPhotos = obligationPhotosMap.size > 0 || generalAnexos.length > 0;

  if (hasAnyPhotos) {
    // Header for ANEXOS (keepNext so it is never orphaned at bottom of page)
    anexosXmlRuns.push(`
      <w:p>
        <w:pPr>
          <w:keepNext/>
          <w:keepLines/>
          <w:spacing w:before="360" w:after="240" w:line="240" w:lineRule="auto"/>
          <w:jc w:val="center"/>
          <w:rPr>
            <w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/>
            <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/>
            <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
          <w:t>ANEXOS</w:t>
        </w:r>
      </w:p>
    `);

    // Add photos for each obligation
    for (const [obIdx, photos] of obligationPhotosMap.entries()) {
      anexosXmlRuns.push(`
        <w:p>
          <w:pPr>
            <w:keepNext/>
            <w:keepLines/>
            <w:spacing w:before="240" w:after="160" w:line="240" w:lineRule="auto"/>
            <w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/>
              <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/>
              <w:b/><w:sz w:val="22"/><w:szCs w:val="22"/>
            </w:rPr>
            <w:t>Responsabilidad contractual ${obIdx + 1}</w:t>
          </w:r>
        </w:p>
      `);

      for (let pIdx = 0; pIdx < photos.length; pIdx++) {
        const photo = photos[pIdx];
        if (!photo.imagenUrl) continue;

        const imgData = await fetchImageBuffer(photo.imagenUrl);
        if (imgData) {
          imageCounter++;
          const rId = `rIdAnexo${imageCounter}`;
          const imgFileName = `anexo_${imageCounter}.${imgData.ext}`;
          
          // Save binary image to docx zip
          zip.file(`word/media/${imgFileName}`, imgData.buffer, { binary: true });

          // Add relationship
          const relNode = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgFileName}"/>`;
          relsXml = relsXml.replace('</Relationships>', `${relNode}</Relationships>`);

          // 5.2 inches width = 4754880 EMUs, ~3.3 inches height = 3017520 EMUs
          const cx = 4754880;
          const cy = 3017520;

          anexosXmlRuns.push(`
            <w:p>
              <w:pPr>
                <w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/>
                <w:jc w:val="center"/>
              </w:pPr>
              <w:r>
                <w:drawing>
                  <wp:inline distT="0" distB="0" distL="0" distR="0">
                    <wp:extent cx="${cx}" cy="${cy}"/>
                    <wp:effectExtent l="0" t="0" r="0" b="0"/>
                    <wp:docPr id="${imageCounter}" name="Anexo Fotográfico ${imageCounter}"/>
                    <wp:cNvGraphicFramePr>
                      <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                    </wp:cNvGraphicFramePr>
                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                          <pic:nvPicPr>
                            <pic:cNvPr id="${imageCounter}" name="Anexo Fotográfico ${imageCounter}"/>
                            <pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>
                          </pic:nvPicPr>
                          <pic:blipFill>
                            <a:blip r:embed="${rId}"/>
                            <a:stretch><a:fillRect/></a:stretch>
                          </pic:blipFill>
                          <pic:spPr>
                            <a:xfrm>
                              <a:off x="0" y="0"/>
                              <a:ext cx="${cx}" cy="${cy}"/>
                            </a:xfrm>
                            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                          </pic:spPr>
                        </pic:pic>
                      </a:graphicData>
                    </a:graphic>
                  </wp:inline>
                </w:drawing>
              </w:r>
            </w:p>
          `);
        }
      }
    }

    // General anexos if any
    if (generalAnexos.length > 0) {
      for (let gIdx = 0; gIdx < generalAnexos.length; gIdx++) {
        const photo = generalAnexos[gIdx];
        const imgData = await fetchImageBuffer(photo.imagenUrl);
        if (imgData) {
          imageCounter++;
          const rId = `rIdAnexo${imageCounter}`;
          const imgFileName = `anexo_${imageCounter}.${imgData.ext}`;
          
          zip.file(`word/media/${imgFileName}`, imgData.buffer, { binary: true });

          const relNode = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgFileName}"/>`;
          relsXml = relsXml.replace('</Relationships>', `${relNode}</Relationships>`);

          const cx = 4754880;
          const cy = 3017520;

          anexosXmlRuns.push(`
            <w:p>
              <w:pPr>
                <w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/>
                <w:jc w:val="center"/>
              </w:pPr>
              <w:r>
                <w:drawing>
                  <wp:inline distT="0" distB="0" distL="0" distR="0">
                    <wp:extent cx="${cx}" cy="${cy}"/>
                    <wp:effectExtent l="0" t="0" r="0" b="0"/>
                    <wp:docPr id="${imageCounter}" name="Anexo ${imageCounter}"/>
                    <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                          <pic:nvPicPr><pic:cNvPr id="${imageCounter}" name="Anexo ${imageCounter}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>
                          <pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                          <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                        </pic:pic>
                      </a:graphicData>
                    </a:graphic>
                  </wp:inline>
                </w:drawing>
              </w:r>
            </w:p>
          `);
        }
      }
    }
  }

  // Update rels in docx zip
  zip.file('word/_rels/document.xml.rels', relsXml);

  // Update [Content_Types].xml to ensure all image formats are properly registered
  let contentTypes = zip.file('[Content_Types].xml')?.asText() || '';
  if (!contentTypes.includes('Extension="png"')) {
    contentTypes = contentTypes.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  }
  if (!contentTypes.includes('Extension="jpg"')) {
    contentTypes = contentTypes.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
  }
  if (!contentTypes.includes('Extension="jpeg"')) {
    contentTypes = contentTypes.replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
  }
  zip.file('[Content_Types].xml', contentTypes);

  // 8. Replace document.xml body content
  let docXml = zip.file('word/document.xml')?.asText() || '';

  // Ensure drawingml namespaces exist on root <w:document>
  if (!docXml.includes('xmlns:a=')) {
    docXml = docXml.replace('<w:document ', '<w:document xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ');
  }

  // Get the section properties <w:sectPr ...> at the end of the document
  const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPrXml = sectPrMatch ? sectPrMatch[0] : '<w:sectPr/>';

  // Replace everything inside <w:body> ... </w:body>
  const newBodyXml = `
    <w:body>
      ${completeTableXml}
      ${anexosXmlRuns.join('')}
      ${sectPrXml}
    </w:body>
  `;

  docXml = docXml.replace(/<w:body>[\s\S]*?<\/w:body>/, newBodyXml);

  zip.file('word/document.xml', docXml);

  // 10. Generate the final docx Blob
  const generatedBlob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  return generatedBlob;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

/**
 * Direct download trigger for the contractor report in Microsoft Word
 */
export async function descargarInformeWord(data: ReportData): Promise<void> {
  const blob = await generarInformeWordDocx(data);
  const contratoClean = (data.contratoNro || '000').replace(/[\s\/\\]+/g, '_');
  const informeNroClean = (data.informeNro || '1').replace(/[\s\/\\]+/g, '_');
  const fileName = `Informe_Cumplimiento_${contratoClean}_Nro_${informeNroClean}.docx`;
  triggerDownload(blob, fileName);
}
