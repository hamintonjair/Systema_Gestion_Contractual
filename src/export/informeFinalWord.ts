import PizZip from 'pizzip';
import { InformeFinalData, ActividadInformeFinal, AnexoFotograficoFinal } from '../types';
import { formatDateSlash } from '../utils/formatters';

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

// Fuente y tamaño de los campos generales de la plantilla (Century Gothic 11pt;
// w:sz/w:szCs van en medios puntos, por eso 22 = 11pt). Se repite explícitamente
// en cada run nuevo creado por un salto de línea: sin esto, el run heredaría la
// fuente por defecto de Word en vez de mantener Century Gothic 11.
const RPR_CAMPO_GENERAL = '<w:rPr><w:rFonts w:ascii="Century Gothic" w:eastAsia="Calibri" w:hAnsi="Century Gothic" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';

/**
 * Igual que escapeXml, pero convierte cada salto de línea del valor en un
 * salto de línea real de Word (<w:br/>). Un <w:t> nunca renderiza un '\n'
 * como salto de línea: el texto queda corrido en una sola línea aunque el
 * dato original venga en varios renglones (ej. varias Metas del Plan de
 * Desarrollo). Debe usarse solo dentro de un <w:t>...</w:t> ya existente,
 * cerrando y reabriendo el run alrededor de cada <w:br/>, repitiendo la
 * fuente/tamaño para que los renglones nuevos no pierdan el formato.
 */
function escapeXmlWithLineBreaks(unsafe: string | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return '';
  const lineas = String(unsafe).split(/\r\n|\r|\n/);
  const separador = `</w:t></w:r><w:r>${RPR_CAMPO_GENERAL}<w:br/></w:r><w:r>${RPR_CAMPO_GENERAL}<w:t xml:space="preserve">`;
  return lineas.map(l => escapeXml(l)).join(separador);
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
 * Creates OpenXML paragraphs for multi-paragraph text with Century Gothic font
 */
function createXmlParagraphs(
  text: string | null | undefined,
  options: {
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'both' | 'center' | 'right';
    spacingBefore?: number;
    spacingAfter?: number;
    bullet?: boolean;
  } = {}
): string {
  const {
    fontFamily = 'Century Gothic',
    fontSize = 22, // 11pt
    bold = false,
    italic = false,
    align = 'both',
    spacingBefore = 60,
    spacingAfter = 60,
    bullet = false
  } = options;

  if (!text) return '';

  const lines = String(text)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return '';

  return lines.map(line => {
    const isBulletLine = bullet || line.startsWith('•') || line.startsWith('-');
    const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();

    return `
      <w:p>
        <w:pPr>
          <w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="240" w:lineRule="auto"/>
          <w:jc w:val="${align}"/>
          <w:rPr>
            <w:rFonts w:ascii="${fontFamily}" w:eastAsia="Calibri" w:hAnsi="${fontFamily}" w:cs="Times New Roman"/>
            ${bold ? '<w:b/><w:bCs/>' : ''}
            ${italic ? '<w:i/><w:iCs/>' : ''}
            <w:sz w:val="${fontSize}"/>
            <w:szCs w:val="${fontSize}"/>
          </w:rPr>
        </w:pPr>
        ${isBulletLine ? `
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="${fontFamily}" w:eastAsia="Calibri" w:hAnsi="${fontFamily}" w:cs="Times New Roman"/>
              <w:b/><w:bCs/>
              <w:sz w:val="${fontSize}"/>
              <w:szCs w:val="${fontSize}"/>
            </w:rPr>
            <w:t xml:space="preserve">•  </w:t>
          </w:r>
        ` : ''}
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${fontFamily}" w:eastAsia="Calibri" w:hAnsi="${fontFamily}" w:cs="Times New Roman"/>
            ${bold ? '<w:b/><w:bCs/>' : ''}
            ${italic ? '<w:i/><w:iCs/>' : ''}
            <w:sz w:val="${fontSize}"/>
            <w:szCs w:val="${fontSize}"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(cleanLine)}</w:t>
        </w:r>
      </w:p>
    `;
  }).join('');
}

/**
 * Builds Table 0 rows for the activity matrix
 */
function buildActivityTableXml(actividades: ActividadInformeFinal[]): string {
  const headerRow = `
    <w:tr w:rsidR="002A6E31" w:rsidRPr="002A6E31" w14:paraId="06A0B85B" w14:textId="77777777" w:rsidTr="002A6E31">
      <w:tc><w:tcPr><w:tcW w:w="412" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>N°</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1749" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>Actividades realizadas</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1053" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>Periodo de ejecución</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1454" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>Lugar de ejecución</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1309" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>Población beneficiaria</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1486" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>Resultados obtenidos</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1365" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/></w:rPr><w:t>Evidencias generadas</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `;

  const dataRows = actividades.map((a, idx) => `
    <w:tr w:rsidR="00183C4C" w:rsidRPr="00904D80" w14:paraId="28BDD88A" w14:textId="77777777" w:rsidTr="007B01DE">
      <w:tc><w:tcPr><w:tcW w:w="412" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${a.nro || idx + 1}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1749" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(a.actividad)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1053" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${escapeXml(a.periodo)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1454" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(a.lugar)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1309" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(a.poblacion)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1486" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(a.resultados)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1365" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(a.evidencias)}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  `).join('');

  return `<w:tbl><w:tblPr><w:tblStyle w:val="Tablaconcuadrcula"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="412"/><w:gridCol w:w="1749"/><w:gridCol w:w="1053"/><w:gridCol w:w="1454"/><w:gridCol w:w="1309"/><w:gridCol w:w="1486"/><w:gridCol w:w="1365"/></w:tblGrid>${headerRow}${dataRows}</w:tbl>`;
}

/**
 * Validation result for Informe Final before Word export
 */
export interface InformeFinalValidationResult {
  isValid: boolean;
  missingFields: string[];
}

/**
 * Validates that all required fields are filled before allowing Word export
 */
export function validateInformeFinalForExport(data: InformeFinalData): InformeFinalValidationResult {
  const missingFields: string[] = [];

  if (!data.contratoNro || !data.contratoNro.trim()) {
    missingFields.push('Número del contrato');
  }
  if (!data.indicador || !data.indicador.trim()) {
    missingFields.push('Indicador');
  }
  if (!data.metaPlanDesarrollo || !data.metaPlanDesarrollo.trim()) {
    missingFields.push('Metas del Plan de Desarrollo / Acción');
  }
  if (!data.introduccion || data.introduccion.trim().length < 20) {
    missingFields.push('Introducción');
  }
  if (!data.metodologiaEnfoque && !data.metodologiaEstrategias) {
    missingFields.push('Metodología de trabajo desarrollada');
  }
  if (!data.cuadroActividades || data.cuadroActividades.length === 0 || !data.cuadroActividades.some(a => a.actividad && a.actividad.trim())) {
    missingFields.push('Cuadro de actividades realizadas (mínimo 1 actividad registrada)');
  }
  if (!data.conclusiones || data.conclusiones.trim().length < 20) {
    missingFields.push('Conclusiones');
  }
  if (!data.cumplimientoMeta && (!data.resultadosAlcanzados || data.resultadosAlcanzados.length === 0)) {
    missingFields.push('Cumplimiento de la meta o resultados alcanzados');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Main function to export Informe Final to Word (.docx)
 */
export async function exportInformeFinalToWord(data: InformeFinalData): Promise<Blob> {
  // Validar obligatoriedad de todos los campos antes de exportar
  const validation = validateInformeFinalForExport(data);
  if (!validation.isValid) {
    throw new Error(
      `No se puede exportar el documento Word: El informe no está completamente diligenciado. ` +
      `Faltan los siguientes campos obligatorios: ${validation.missingFields.join(', ')}.`
    );
  }

  const templatePath = '/templates/INFORME_FINAL_EJECUCION.docx';
  let response = await fetch(templatePath);
  if (!response.ok) {
    // Intentar fallback codificado
    response = await fetch(encodeURI(templatePath));
  }
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla de Informe Final (${response.statusText})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  let docXml = zip.file('word/document.xml')?.asText() || '';
  let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';

  // 1. Reemplazar Fecha de Presentación
  if (data.fechaPresentacion) {
    docXml = docXml.replace(/(<w:t[^>]*>Fecha de Presentación:[\s\S]*?<w:t[^>]*>)\s*(?:XXXXXXXXXXXXXX|[^<]*)(<\/w:t>)/g, `$1 ${escapeXml(formatDateSlash(data.fechaPresentacion))}$2`);
  }

  // 2. Reemplazar Campos de Información General
  const replaceGeneralField = (label: string, val: string) => {
    if (!val) return;
    const regex = new RegExp(`(<w:t[^>]*>${label}<\\/w:t>[\\s\\S]*?<w:t[^>]*>:<\\/w:t>[\\s\\S]*?<w:t[^>]*>)[\\s\\S]*?(<\\/w:t>)`);
    if (regex.test(docXml)) {
      // $1 y $2 son literales de Word ('$$' escapa el '$' para que String.replace
      // no interprete secuencias como $1/$2 dentro del valor reemplazado).
      const valorSeguro = escapeXmlWithLineBreaks(val).replace(/\$/g, '$$$$');
      docXml = docXml.replace(regex, `$1 ${valorSeguro}$2`);
    }
  };

  replaceGeneralField('Número del contrato', data.contratoNro);
  replaceGeneralField('Nombre del contratista', data.contratistaNombre);
  replaceGeneralField('Dependencia responsable', data.dependencia);
  replaceGeneralField('Supervisor del contrato', data.supervisorNombre);
  replaceGeneralField('Objeto contractual', data.objetoContractual);
  replaceGeneralField('Meta del Plan de Desarrollo', data.metaPlanDesarrollo);

  // Reemplazar Indicador
  if (data.indicador) {
    if (docXml.includes('Personas atendidas con servicios integrales.')) {
      docXml = docXml.replace('Personas atendidas con servicios integrales.', '');
    }
    if (docXml.includes('Indicador:')) {
      docXml = docXml.replace(
        /(<w:t[^>]*>Indicador:<\/w:t>\s*<\/w:r>)/,
        `$1<w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:eastAsia="Calibri" w:hAnsi="Century Gothic" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> ${escapeXml(data.indicador.trim())}</w:t></w:r>`
      );
    } else {
      replaceGeneralField('Indicador', data.indicador);
    }
  }

  // 3. Reemplazar Introducción
  // Localizar bloque de introducción entre "Introducción" y "Metodología de trabajo desarrollada"
  const introMatch = docXml.match(/(<w:t[^>]*>Introducción<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Metodología de trabajo desarrollada<\/w:t>)/);
  if (introMatch) {
    const newIntroXml = createXmlParagraphs(data.introduccion, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(introMatch[0], `${introMatch[1]}${newIntroXml}${introMatch[3]}`);
  }

  // 4. Reemplazar Metodología
  const metMatch = docXml.match(/(<w:t[^>]*>Metodología de trabajo desarrollada<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Desarrollo de las actividades ejecutadas<\/w:t>)/);
  if (metMatch) {
    const metLines: string[] = [];
    if (data.metodologiaEnfoque) metLines.push(`Enfoque metodológico:\n${data.metodologiaEnfoque}`);
    if (data.metodologiaEstrategias) metLines.push(`Estrategias implementadas:\n${data.metodologiaEstrategias}`);
    if (data.metodologiaZonas) metLines.push(`Zonas de intervención:\n${data.metodologiaZonas}`);
    if (data.metodologiaHerramientas) metLines.push(`Herramientas técnicas y sistemas:\n${data.metodologiaHerramientas}`);
    const metXml = createXmlParagraphs(metLines.join('\n\n') || data.metodologiaEnfoque, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(metMatch[0], `${metMatch[1]}${metXml}${metMatch[3]}`);
  }

  // 5. Reemplazar Tabla 0 (Cuadro de actividades)
  const tables = docXml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g);
  if (tables && tables.length > 0) {
    const originalTable0 = tables[0];
    const newTable0 = buildActivityTableXml(data.cuadroActividades);
    docXml = docXml.replace(originalTable0, newTable0);
  }

  // 6. Reemplazar Productos Entregados
  const prodMatch = docXml.match(/(<w:t[^>]*>Productos entregados<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Resultados alcanzados<\/w:t>)/);
  if (prodMatch) {
    const prodList = (data.productosEntregados || []).join('\n');
    const newProdXml = createXmlParagraphs(prodList, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both', bullet: true });
    docXml = docXml.replace(prodMatch[0], `${prodMatch[1]}${newProdXml}${prodMatch[3]}`);
  }

  // 7. Reemplazar Resultados Alcanzados
  const resMatch = docXml.match(/(<w:t[^>]*>Resultados alcanzados<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Cumplimiento de la meta del Plan de Desarrollo<\/w:t>)/);
  if (resMatch) {
    const resList = (data.resultadosAlcanzados || []).join('\n\n');
    const newResXml = createXmlParagraphs(resList, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(resMatch[0], `${resMatch[1]}${newResXml}${resMatch[3]}`);
  }

  // 8. Reemplazar Cumplimiento de la Meta
  const metaSectionMatch = docXml.match(/(<w:t[^>]*>Cumplimiento de la meta del Plan de Desarrollo<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Análisis técnico de los resultados<\/w:t>)/);
  if (metaSectionMatch) {
    const newMetaXml = createXmlParagraphs(data.cumplimientoMeta, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(metaSectionMatch[0], `${metaSectionMatch[1]}${newMetaXml}${metaSectionMatch[3]}`);
  }

  // 9. Reemplazar Análisis Técnico
  const analisisMatch = docXml.match(/(<w:t[^>]*>Análisis técnico de los resultados<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Impacto de la ejecución contractual<\/w:t>)/);
  if (analisisMatch) {
    const newAnalisisXml = createXmlParagraphs(data.analisisTecnico, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(analisisMatch[0], `${analisisMatch[1]}${newAnalisisXml}${analisisMatch[3]}`);
  }

  // 10. Reemplazar Impacto de la Ejecución
  const impactoMatch = docXml.match(/(<w:t[^>]*>Impacto de la ejecución contractual<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Conclusiones<\/w:t>)/);
  if (impactoMatch) {
    const newImpactoXml = createXmlParagraphs(data.impactoEjecucion, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(impactoMatch[0], `${impactoMatch[1]}${newImpactoXml}${impactoMatch[3]}`);
  }

  // 11. Reemplazar Conclusiones
  const concMatch = docXml.match(/(<w:t[^>]*>Conclusiones<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Recomendaciones<\/w:t>)/);
  if (concMatch) {
    const newConcXml = createXmlParagraphs(data.conclusiones, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both' });
    docXml = docXml.replace(concMatch[0], `${concMatch[1]}${newConcXml}${concMatch[3]}`);
  }

  // 12. Reemplazar Recomendaciones
  const recMatch = docXml.match(/(<w:t[^>]*>Recomendaciones<\/w:t>[\s\S]*?<\/w:p>)([\s\S]*?)(<w:p[^>]*>[\s\S]*?<w:t[^>]*>Elaborado por:<\/w:t>)/);
  if (recMatch) {
    const recList = (data.recomendaciones || []).join('\n');
    const newRecXml = createXmlParagraphs(recList, { fontFamily: 'Century Gothic', fontSize: 22, align: 'both', bullet: true });
    docXml = docXml.replace(recMatch[0], `${recMatch[1]}${newRecXml}${recMatch[3]}`);
  }

  // 13. Reemplazar Firmas (Elaborado por y Aprobado por)
  docXml = docXml.replace(/(<w:t[^>]*>)XXXXXXXXXXXXXXXXXX(<\/w:t>)/g, `$1${escapeXml(data.contratistaNombre.toUpperCase())}$2`);
  docXml = docXml.replace(/(<w:t[^>]*>C\.C\.\s*<\/w:t>[\s\S]*?<w:t[^>]*>)XXXXXXXXX(<\/w:t>[\s\S]*?<w:t[^>]*>\s*de\s*<\/w:t>[\s\S]*?<w:t[^>]*>)XXXXXXXXX(<\/w:t>)/g, `$1${escapeXml(data.contratistaDocumento)}$2${escapeXml(data.contratistaLugarDoc || 'Quibdó')}$3`);
  docXml = docXml.replace(/(<w:t[^>]*>)XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX(<\/w:t>)/g, `$1${escapeXml(data.supervisorNombre.toUpperCase())}$2`);
  docXml = docXml.replace(/(<w:t[^>]*>)XXXXXXXXXXXXXXXXXXXXXXXXXXXX(<\/w:t>)/g, `$1${escapeXml(data.supervisorCargo || data.dependencia || 'Secretaria de Despacho')}$2`);

  // Fallbacks por compatibilidad
  docXml = docXml.replace(/(<w:t[^>]*>)(HAMINTON MENA MENA)(<\/w:t>)/gi, `$1${escapeXml(data.contratistaNombre.toUpperCase())}$3`);
  docXml = docXml.replace(/(<w:t[^>]*>)(DIANA ANDREA MOSQUERA GARCIA)(<\/w:t>)/gi, `$1${escapeXml(data.supervisorNombre.toUpperCase())}$3`);
  docXml = docXml.replace(/(<w:t[^>]*>)(Secretaria de Inclusion Social)(<\/w:t>)/gi, `$1${escapeXml(data.supervisorCargo || data.dependencia)}$3`);

  // 14. Anexos fotográficos dinámicos si existen en data.anexosFotograficos
  if (data.anexosFotograficos && data.anexosFotograficos.length > 0) {
    try {
      let rIdCounter = 100;
      const photoCellsXml: string[] = [];

      for (let i = 0; i < data.anexosFotograficos.length; i++) {
        const item = data.anexosFotograficos[i];
        const imgData = await fetchImageBuffer(item.url);
        if (imgData) {
          const rId = `rIdPhoto${rIdCounter++}`;
          const filename = `media/custom_evidence_${i}.${imgData.ext}`;
          
          zip.file(`word/${filename}`, imgData.buffer);

          const relEntry = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${filename}"/>`;
          if (!relsXml.includes(relEntry)) {
            relsXml = relsXml.replace('</Relationships>', `${relEntry}</Relationships>`);
          }

          const descText = item.descripcion || `Registro fotográfico ${i + 1} - ${item.periodo || ''}`;

          photoCellsXml.push(`
            <w:tc>
              <w:tcPr><w:tcW w:w="4400" w:type="dxa"/></w:tcPr>
              <w:p>
                <w:pPr><w:jc w:val="center"/></w:pPr>
                <w:r>
                  <w:drawing>
                    <wp:inline distT="0" distB="0" distL="0" distR="0">
                      <wp:extent cx="2400000" cy="1800000"/>
                      <wp:docPr id="${rIdCounter}" name="Foto ${i + 1}"/>
                      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                            <pic:nvPicPr>
                              <pic:cNvPr id="${rIdCounter}" name="Foto ${i + 1}"/>
                              <pic:cNvPicPr/>
                            </pic:nvPicPr>
                            <pic:blipFill>
                              <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                              <a:stretch><a:fillRect/></a:stretch>
                            </pic:blipFill>
                            <pic:spPr>
                              <a:xfrm><a:off x="0" y="0"/><a:ext cx="2400000" cy="1800000"/></a:xfrm>
                              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                            </pic:spPr>
                          </pic:pic>
                        </a:graphicData>
                      </a:graphic>
                    </wp:inline>
                  </w:drawing>
                </w:r>
              </w:p>
              <w:p>
                <w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="16"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${escapeXml(descText)}</w:t></w:r>
              </w:p>
            </w:tc>
          `);
        }
      }

      // Reemplazar o actualizar Table 1 si generamos celdas
      if (photoCellsXml.length > 0 && tables && tables.length > 1) {
        const photoRows: string[] = [];
        for (let j = 0; j < photoCellsXml.length; j += 2) {
          const c1 = photoCellsXml[j];
          const c2 = photoCellsXml[j + 1] || '<w:tc><w:tcPr><w:tcW w:w="4400" w:type="dxa"/></w:tcPr><w:p/></w:tc>';
          photoRows.push(`<w:tr><w:trPr><w:trHeight w:val="3000"/></w:trPr>${c1}${c2}</w:tr>`);
        }
        const newPhotoTable = `<w:tbl><w:tblPr><w:tblStyle w:val="Tablaconcuadrcula"/><w:tblW w:w="0" w:type="auto"/><w:tblGrid><w:gridCol w:w="4400"/><w:gridCol w:w="4400"/></w:tblGrid></w:tblPr>${photoRows.join('')}</w:tbl>`;
        docXml = docXml.replace(tables[1], newPhotoTable);
      }
    } catch (photoErr) {
      console.warn('Error al procesar anexos fotográficos para Word:', photoErr);
    }
  }

  // Guardar XMLs modificados
  zip.file('word/document.xml', docXml);
  zip.file('word/_rels/document.xml.rels', relsXml);

  const outBlob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  return outBlob;
}
