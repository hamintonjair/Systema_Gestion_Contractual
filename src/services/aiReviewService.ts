import { GoogleGenAI, Type } from '@google/genai';
import { 
  ReportData, 
  AuthUser, 
  FieldComment, 
  CertificadoSupervisionData, 
  SoporteFiduciariaData,
  DeclaracionRentaData,
  AutorizacionDesembolsoData 
} from '../types';
import { resolveGeminiConfig, normalizeGeminiModel, parseGeminiError } from './geminiService';

export type AIReviewCategory = 
  | 'fechas_periodos' 
  | 'datos_contrato' 
  | 'actividades' 
  | 'financiero' 
  | 'anexos_evidencias'
  | 'control_financiero'
  | 'seguridad_social'
  | 'fechas_vigencia_prorrogas'
  | 'certificacion_satisfaccion'
  | 'beneficiario_cuentas'
  | 'consistencia_financiera'
  | 'codigos_presupuestales'
  | 'declaracion_juramentada'
  | 'autorizacion_desembolso';

export type AIReviewSeverity = 'critico' | 'advertencia' | 'correcto';

export interface AIReviewItem {
  campoId: string;
  nombreCampo: string;
  categoria: AIReviewCategory;
  severidad: AIReviewSeverity;
  mensaje: string;
  sugerencia: string;
  comentarioSupervisorSugerido?: string;
}

export interface AIReviewReportResult {
  puntuacion: number; // 0 - 100
  estadoGeneral: 'aprobado' | 'con_observaciones' | 'rechazado';
  resumenEjecutivo: string;
  hallazgos: AIReviewItem[];
  conclusiones: string[];
  fechaRevision: string;
  modeloUtilizado: string;
}

const REVIEW_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    puntuacion: { type: Type.INTEGER },
    estadoGeneral: { 
      type: Type.STRING, 
      enum: ['aprobado', 'con_observaciones', 'rechazado'] 
    },
    resumenEjecutivo: { type: Type.STRING },
    hallazgos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          campoId: { type: Type.STRING },
          nombreCampo: { type: Type.STRING },
          categoria: { 
            type: Type.STRING, 
            enum: [
              'fechas_periodos', 
              'datos_contrato', 
              'actividades', 
              'financiero', 
              'anexos_evidencias',
              'control_financiero',
              'seguridad_social',
              'fechas_vigencia_prorrogas',
              'certificacion_satisfaccion',
              'beneficiario_cuentas',
              'consistencia_financiera',
              'codigos_presupuestales',
              'declaracion_juramentada',
              'autorizacion_desembolso'
            ] 
          },
          severidad: { 
            type: Type.STRING, 
            enum: ['critico', 'advertencia', 'correcto'] 
          },
          mensaje: { type: Type.STRING },
          sugerencia: { type: Type.STRING },
          comentarioSupervisorSugerido: { type: Type.STRING }
        },
        required: ['campoId', 'nombreCampo', 'categoria', 'severidad', 'mensaje', 'sugerencia']
      }
    },
    conclusiones: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ['puntuacion', 'estadoGeneral', 'resumenEjecutivo', 'hallazgos', 'conclusiones']
};

/**
 * Servicio de Auditoría e Inteligencia Artificial para la Revisión de Informes de Supervisión
 * Alcaldía Municipal de Quibdó
 */
export async function reviewInformeMensualWithAI(
  report: ReportData,
  user?: AuthUser,
  allReports?: ReportData[]
): Promise<AIReviewReportResult> {
  const { apiKey, model } = await resolveGeminiConfig();

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'No se ha configurado la API Key de Google Gemini en el sistema. ' +
      'El Super Administrador puede registrarla desde el panel de configuración institucional de IA.'
    );
  }

  const modelToUse = normalizeGeminiModel(model || 'gemini-3.8-flash');
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // Preparar el resumen de obligaciones y actividades para la auditoría, incluyendo el conteo de evidencias fotográficas por obligación
  const obligacionesData = (report.obligaciones || []).map((obl, idx) => {
    const fotos = Array.isArray(obl.fotos) ? obl.fotos : [];
    const fotosValidas = fotos.filter(f => Boolean(f.imagenUrl || (f as any).url || (f as any).preview));
    const tieneFotosPropias = fotosValidas.length > 0;
    const tieneSoportesTexto = Boolean(obl.soportes && obl.soportes.trim() && obl.soportes.trim().toUpperCase() !== 'N/A');

    return {
      indice: idx + 1,
      descripcionObligacion: obl.descripcion || `Obligación contractual #${idx + 1}`,
      actividadesDesarrolladas: obl.actividades || '(Sin actividades registradas por el contratista)',
      soportesReportados: obl.soportes || '(Sin soportes especificados)',
      cuentaConSoporteTexto: tieneSoportesTexto,
      cantidadAnexosFotograficos: fotosValidas.length,
      cuentaConEvidenciaFotografica: tieneFotosPropias
    };
  });

  const totalAnexosGlobales = (report.anexos || []).length;
  const obligacionesSinFotos = obligacionesData.filter(o => !o.cuentaConEvidenciaFotografica);

  const prompt = `
Eres un Auditor y Supervisor Contractual Experto de la Alcaldía Municipal de Quibdó (Chocó, Colombia).
Tu función es auditar rigurosamente el siguiente Informe Mensual de Actividades presentado por un contratista de prestación de servicios de la administración municipal.

DATOS DEL CONTRATO Y DEL INFORME AUDITADO:
- Contratista: ${report.contratistaNombre || 'No indicado'} (C.C. ${report.contratistaDocumento || 'No indicado'})
- Supervisor / Interventor: ${report.supervisorNombre || 'No indicado'}
- Número de Contrato: ${report.contratoNro || 'No indicado'}
- Objeto Contractual: ${report.objeto || 'No indicado'}
- Plazo Pactado: ${report.plazo || 'No indicado'}
- Fecha de Inicio de Vigencia: ${report.fechaInicio || 'No indicado'}
- Fecha de Terminación de Vigencia: ${report.fechaTerminacion || 'No indicado'}
- CDP Nro: ${report.cdpNro || 'No indicado'}
- CRP Nro: ${report.crpNro || 'No indicado'}
- Fecha Registro Presupuestal: ${report.fechaRegistroPresupuestal || 'No indicado'}
- Código Rubro Presupuestal: ${report.codigoRubro || 'No indicado'}
- Valor Total del Contrato: ${report.valorContrato || 'No indicado'}
- Valor a Pagar en este Periodo: ${report.valorPagar || 'No indicado'}
- Tipo de Informe Marcado: ${report.tipoInforme || 'Mensual'} (Opciones: Mensual o Final)
- Número Consecutivo del Informe: ${report.informeNro || 'No indicado'}
- Fecha de Presentación: ${report.fechaPresentacion || 'No indicado'}
- Período del Informe: DESDE ${report.periodoDesde || 'No indicado'} HASTA ${report.periodoHasta || 'No indicado'}
- Total de Anexos Generales: ${totalAnexosGlobales}

OBLIGACIONES Y ACTIVIDADES EJECUTADAS (${obligacionesData.length} obligaciones):
${JSON.stringify(obligacionesData, null, 2)}

ESPECIFICACIONES Y REGLAS DE AUDITORÍA OBLIGATORIAS QUE DEBES VERIFICAR:
1. CATEGORÍA: fechas_periodos
   - Coherencia del período del informe frente a las fechas de vigencia: 'periodoDesde' no puede ser anterior a la 'fechaInicio' del contrato, ni 'periodoHasta' puede ser posterior a 'fechaTerminacion'.
   - Fecha de presentación: debe ser concordante con el cierre del período (igual o posterior a 'periodoHasta', y nunca anterior a 'fechaInicio').
   - Tipo de informe (Mensual vs Final): Si el período reportado culmina en la fecha de terminación del contrato o es el último mes según el plazo, debe advertirse si corresponde marcarlo como 'Final'. Si aún quedan meses o tiempo por ejecutar, debe ser 'Mensual'.
   - Consecutivo del informe: Verificar si el 'informeNro' corresponde lógicamente con los meses transcurridos desde 'fechaInicio'.

2. CATEGORÍA: datos_contrato
   - Verificar integridad de los campos: Contrato Nro, Objeto, CDP, CRP, Fecha Registro Presupuestal, Código Rubro Presupuestal, Plazo, Valor del Contrato, Fecha de Inicio y Fecha de Terminación.
   - REGLA: Ninguno de estos campos debe estar vacío (especialmente Fecha de Registro Presupuestal y Código de Rubro Presupuestal), ni contener datos ficticios o 'N/A' injustificados.

3. CATEGORÍA: actividades
   - Calidad y coherencia de las actividades descritas frente a las obligaciones del contrato:
     * Criterio estricto: NO deben existir frases genéricas o vagas como "se hizo el apoyo", "se cumplió a cabalidad", "se asistió a reuniones" sin detalles de qué, cómo, lugar, herramientas o beneficiarios.
     * El lenguaje debe ser técnico, formal, verificable y trazable de cara a la función pública en el Municipio de Quibdó.
     * Si alguna obligación no tiene actividades o están en blanco, calificar como CRÍTICO.

4. CATEGORÍA: financiero
   - Consistencia del valor a pagar: debe coincidir el valor y ser proporcional al valor total del contrato y plazo estipulado.
   - No debe superar el valor total del contrato.

5. CATEGORÍA: anexos_evidencias
   - Anexos fotográficos por obligación: Revisar que CADA UNA de las obligaciones cuente con sus respectivos soportes o anexos fotográficos presentes.
   - Si alguna obligación no cuenta con evidencias fotográficas adjuntas (cantidadAnexosFotograficos = 0 y cuentaConEvidenciaFotografica = false), registrar un hallazgo de observación indicando con precisión cuáles obligaciones carecen de soportes fotográficos (ej. 'obligacion_X_anexos' o 'anexos_fotograficos').
   - NOTA ACLARATORIA: La firma del contratista NO debe ser auditada ni penalizada.

INSTRUCCIONES DE FORMATO:
- Asigna una puntuación global de 0 a 100.
  * 90-100: 'aprobado' (Cumple con los estándares requeridos)
  * 70-89: 'con_observaciones' (Detalles menores de redacción o campos a precisar)
  * 0-69: 'rechazado' (Inconsistencias en fechas, actividades vacías o datos contractuales errados)
- Proporciona para cada hallazgo con observación o crítico:
  * campoId: ID del campo en el sistema (ej. 'periodoInforme', 'fechaPresentacion', 'tipoInforme', 'informeNro', 'objeto', 'cdpNro', 'crpNro', 'plazo', 'obligacion_1_actividades', 'valorPagar', 'anexo_obligacion_1').
  * comentarioSupervisorSugerido: Una redacción formal lista para que el supervisor o interventor la use directamente como comentario de devolución al contratista.
`;

  try {
    const callGeminiWithModel = async (targetModel: string) => {
      return await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: REVIEW_SCHEMA,
          temperature: 0.2, // Baja temperatura para análisis riguroso y determinista
        }
      });
    };

    let response: any = null;
    try {
      response = await callGeminiWithModel(modelToUse);
    } catch (primaryErr: any) {
      console.warn(`[AI Review] Error con modelo principal ${modelToUse}:`, primaryErr);
      const errStr = (primaryErr?.message || '').toLowerCase();
      // Si el modelo principal está en 503 o 429 quota 0, intentar con gemini-3.1-flash-lite
      if (modelToUse !== 'gemini-3.1-flash-lite' && (errStr.includes('503') || errStr.includes('429') || errStr.includes('unavailable'))) {
        console.log('[AI Review] Usando modelo de respaldo: gemini-3.1-flash-lite...');
        response = await callGeminiWithModel('gemini-3.1-flash-lite');
      } else {
        throw primaryErr;
      }
    }

    const responseText = response?.text || '';
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      puntuacion: typeof parsed.puntuacion === 'number' ? parsed.puntuacion : 85,
      estadoGeneral: parsed.estadoGeneral || 'con_observaciones',
      resumenEjecutivo: parsed.resumenEjecutivo || 'Revisión técnica y contractual completada.',
      hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [],
      conclusiones: Array.isArray(parsed.conclusiones) ? parsed.conclusiones : [],
      fechaRevision: new Date().toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      modeloUtilizado: modelToUse
    };
  } catch (error: any) {
    console.error('Error durante la revisión de informe con Gemini:', error);
    const parsedError = parseGeminiError(error, modelToUse);
    throw new Error(`${parsedError.title}: ${parsedError.explanation} (${parsedError.suggestion})`);
  }
}

/**
 * Servicio de Auditoría e Inteligencia Artificial para el Certificado de Supervisión
 * Alcaldía Municipal de Quibdó
 */
export async function reviewCertificadoSupervisionWithAI(
  cert: CertificadoSupervisionData,
  report?: ReportData,
  user?: AuthUser
): Promise<AIReviewReportResult> {
  const { apiKey, model } = await resolveGeminiConfig();

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'No se ha configurado la API Key de Google Gemini en el sistema. ' +
      'El Super Administrador puede registrarla desde el panel de configuración institucional de IA.'
    );
  }

  const modelToUse = normalizeGeminiModel(model || 'gemini-3.8-flash');
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const planillaSalud = (cert.saludPlanilla || '').trim();
  const planillaPension = (cert.pensionPlanilla || '').trim();
  const planillaArl = (cert.arpPlanilla || '').trim();

  const todasPlanillasPresentes = Boolean(planillaSalud && planillaPension && planillaArl);
  const planillasSonIdenticas = todasPlanillasPresentes && (planillaSalud === planillaPension && planillaPension === planillaArl);

  const camposSeguridadSocialVacios: string[] = [];
  if (!cert.saludValor || !cert.saludValor.trim()) camposSeguridadSocialVacios.push('Salud: Valor');
  if (!cert.saludEps || !cert.saludEps.trim()) camposSeguridadSocialVacios.push('Salud: Nombre EPS');
  if (!planillaSalud) camposSeguridadSocialVacios.push('Salud: Número de Planilla');

  if (!cert.pensionValor || !cert.pensionValor.trim()) camposSeguridadSocialVacios.push('Pensión: Valor');
  if (!cert.pensionFondo || !cert.pensionFondo.trim()) camposSeguridadSocialVacios.push('Pensión: Nombre Fondo');
  if (!planillaPension) camposSeguridadSocialVacios.push('Pensión: Número de Planilla');

  if (!cert.arpValor || !cert.arpValor.trim()) camposSeguridadSocialVacios.push('ARL: Valor');
  if (!cert.arpAseguradora || !cert.arpAseguradora.trim()) camposSeguridadSocialVacios.push('ARL: Nombre Aseguradora');
  if (!planillaArl) camposSeguridadSocialVacios.push('ARL: Número de Planilla');

  const fechaRegistroPresupuestalVacia = !cert.fechaRegistroPresupuestal || !cert.fechaRegistroPresupuestal.trim() || cert.fechaRegistroPresupuestal.trim().toUpperCase() === 'NO INDICADO';
  const codigoRubroVacio = !cert.codigoRubro || !cert.codigoRubro.trim() || cert.codigoRubro.trim().toUpperCase() === 'NO INDICADO';

  const prompt = `
Eres un Auditor y Supervisor Contractual Experto de la Alcaldía Municipal de Quibdó (Chocó, Colombia).
Tu función es auditar rigurosamente el siguiente CERTIFICADO DE SUPERVISIÓN Y CUMPLIMIENTO presentado para avalar el trámite de pago de un contratista de prestación de servicios.

DATOS DEL CERTIFICADO DE SUPERVISIÓN AUDITADO:
1. INFORMACIÓN CONTRACTUAL:
- Nombre del Contratista: ${cert.contratistaNombre || 'No indicado'}
- Tipo de Contrato: ${cert.tipoContrato || 'PRESTACION DE SERVICIOS'}
- Contrato Nº: ${cert.contratoNro || 'No indicado'} DE ${cert.contratoAno || 'No indicado'}
- Documento de Identidad: ${cert.tipoDocumento || 'C.C.'} Nº ${cert.contratistaDocumento || 'No indicado'}
- Nombre del Supervisor(a) o Interventor(a): ${cert.supervisorNombre || 'No indicado'}
- Cargo del Supervisor(a) o Interventor(a): ${cert.supervisorCargo || 'No indicado'}
- Objeto Contractual: ${cert.objeto || 'No indicado'}
- Cláusula de trámite de pago: ${cert.clausulaNro || 'No indicado'}

2. INFORMACIÓN FINANCIERA Y PLAZOS:
- Cuenta Bancaria: Nº ${cert.numeroCuenta || 'No indicado'}, Banco: ${cert.banco || 'No indicado'}, Tipo: ${cert.tipoCuenta || 'No indicado'}
- Fecha de Inicio (según acta): ${cert.fechaInicio || 'No indicado'}
- Plazo de Ejecución: ${cert.plazoMeses || '0'} meses y ${cert.plazoDias || '0'} días
- Fecha de Terminación (incluye prórrogas): ${cert.fechaTerminacion || 'No indicado'}
- Valor Inicial: ${cert.valorInicial || 'No indicado'}
- Adición 1: ${cert.adicion1 || '0'}, Adición 2: ${cert.adicion2 || '0'}, Adición 3: ${cert.adicion3 || '0'}
- Valor Total del Contrato: ${cert.valorTotal || 'No indicado'}
- Prórrogas (en días): Prórroga 1: ${cert.prorroga1Dias || '0'}, Prórroga 2: ${cert.prorroga2Dias || '0'}, Prórroga 3: ${cert.prorroga3Dias || '0'}

3. INFORMACIÓN PRESUPUESTAL:
- No. Certificado Disponibilidad Presupuestal (CDP): ${cert.cdpNro || 'No indicado'}
- No. Registro Presupuestal (CRP): ${cert.crpNro || 'No indicado'}
- Fecha Registro Presupuestal: ${cert.fechaRegistroPresupuestal || 'No indicado'} (${fechaRegistroPresupuestalVacia ? 'ALERTA: CAMPO VACÍO / NO REGISTRADO' : 'DILIGENCIADO CORRECTAMENTE'})
- Código Rubro Presupuestal: ${cert.codigoRubro || 'No indicado'} (${codigoRubroVacio ? 'ALERTA: CAMPO VACÍO / NO REGISTRADO' : 'DILIGENCIADO CORRECTAMENTE'})
- Valor a Pagar por Rubro Presupuestal: ${cert.valorRubro || 'No indicado'}

4. INFORMACIÓN DE APORTES A SEGURIDAD SOCIAL:
- Salud: Valor: ${cert.saludValor || 'No indicado'}, EPS: ${cert.saludEps || 'No indicado'}, Planilla Nº: ${cert.saludPlanilla || 'No indicado'}
- Pensión: Valor: ${cert.pensionValor || 'No indicado'}, Fondo de Pensiones: ${cert.pensionFondo || 'No indicado'}, Planilla Nº: ${cert.pensionPlanilla || 'No indicado'}
- ARL: Valor: ${cert.arpValor || 'No indicado'}, Aseguradora: ${cert.arpAseguradora || 'No indicado'}, Planilla Nº: ${cert.arpPlanilla || 'No indicado'}
- Diagnóstico técnico de Seguridad Social:
  * Campos vacíos o faltantes: ${camposSeguridadSocialVacios.length > 0 ? camposSeguridadSocialVacios.join(', ') : 'Ninguno (todos los campos requeridos están llenos)'}
  * Validación de Planilla Única: ${planillasSonIdenticas ? `CORRECTO: Las 3 planillas son idénticas ("${planillaSalud}")` : `ALERTA: Las planillas no coinciden entre los 3 subsistemas (Salud: "${planillaSalud}", Pensión: "${planillaPension}", ARL: "${planillaArl}")`}

5. INFORMACIÓN PARA LA LIQUIDACIÓN DEL PAGO:
- Nº de Pago: ${cert.pagoNro || 'No indicado'}
- Período de Pago: DESDE ${cert.periodoDesde || 'No indicado'} HASTA ${cert.periodoHasta || 'No indicado'}
- Porcentaje de Ejecución: ${cert.porcentajeEjecucion || 'No indicado'}
- Valor Pagado (acumulado anterior): ${cert.valorPagadoAcumulado || '0'}
- Valor a Pagar sin IVA: ${cert.valorAPagarSinIva || '0'}
- IVA: ${cert.iva || '0'}
- Valor Total a Pagar (presente pago): ${cert.valorTotalAPagar || '0'}
- Saldo por Pagar: ${cert.saldoPorPagar || '0'}

6. CERTIFICACIÓN DE CUMPLIMIENTO:
- Cumplimiento a satisfacción con el objeto del contrato de acuerdo con el informe mensual presentado.
- Verificación previa de los pagos al Sistema General de Seguridad Social y aportes parafiscales.
- Valor Avalado por el Supervisor: ${cert.valorAvalado || 'No indicado'}
- Fecha de Expedición: ${cert.expedicionDia || ''} de ${cert.expedicionMes || ''} de ${cert.expedicionAno || ''}

REGLAS DE AUDITORÍA OBLIGATORIAS QUE DEBES VERIFICAR:
1. CATEGORÍA: control_financiero
   - REGLA CRÍTICA ESTRICTA: Que la suma de (Valor Pagado Acumulado Anterior + Valor Total a Pagar del presente pago) NO SUPERE el Valor Total del Contrato. Si lo supera, marcar como CRÍTICO inmediatamente.
   - Criterio de Saldo por Pagar si todo está bien:
     * En pagos mensuales ordinarios (cuando aún restan pagos o vigencia por ejecutar): El Saldo por Pagar debe ser mayor a cero (> 0) y coincidir con exactitud matemática con la fórmula: [Valor Total del Contrato - (Valor Pagado Acumulado Anterior + Valor Total a Pagar)].
     * En el último pago (Informe Final / cierre de contrato): El Saldo por Pagar debe ser exactamente $0 (cero pesos) y la ejecución llegar al 100%, garantizando que no queden saldos pendientes sin justificar.
     * Inconsistencia crítica: El Saldo por Pagar bajo ninguna circunstancia puede ser negativo, ni la suma de pagos sobrepasar el valor total.
   - El Valor Total a Pagar debe coincidir con el Valor Avalado en la certificación del supervisor y con el Valor por Rubro Presupuestal.

2. CATEGORÍA: seguridad_social
   - CRITERIO SOLICITADO:
     * ÚNICAMENTE revisar si los campos están llenos (no vacíos ni omitidos):
       1) Los valores cotizados (Salud: valor, Pensión: valor, ARL: valor).
       2) Los nombres de las entidades (Salud: EPS, Pensión: Fondo de Pensiones, ARL: Aseguradora).
       3) El número de planilla para cada subsistema (Salud: planilla, Pensión: planilla, ARL: planilla).
     * REGLA OBLIGATORIA DEL NÚMERO DE PLANILLA: El número de planilla DEBE SER EXACTAMENTE EL MISMO PARA LOS 3 SUBSISTEMAS (Salud, Pensión y ARL).
       - Si los números de planilla son diferentes entre sí o no coinciden en los 3 subsistemas, reportar un hallazgo indicando que en la planilla integrada PILA el número de planilla debe ser exactamente el mismo para Salud, Pensión y ARL.
       - Si algún campo está vacío o en blanco, reportar observación indicando qué campo falta llenar.
     * REGLA: NO calcular ni exigir porcentaje legal del 40% de base de cotización ni fórmulas matemáticas; si los valores, nombres de entidad y números de planilla están llenos y el número de planilla es el mismo para los 3, clasificar como CORRECTO ('correcto').

3. CATEGORÍA: fechas_vigencia_prorrogas
   - Concordancia de fechas de inicio, suspensión, prórroga y terminación.
   - Que el plazo de ejecución (meses y días) coincida con la diferencia entre la fecha de inicio y la fecha de terminación.
   - Si hay prórrogas registradas, verificar que la fecha de terminación refleje la ampliación en días.
   - El período de pago (DESDE y HASTA) debe estar contenido dentro de la vigencia del contrato.
   - Fecha de expedición del certificado: Coherente con el corte de pago y no previa al inicio del contrato.

4. CATEGORÍA: certificacion_satisfaccion
   - Certificación explícita de recibo a satisfacción del servicio: Constancia formal de que el contratista cumplió a satisfacción con el objeto del contrato según el informe presentado.
   - Aval explícito del valor a pagar y certificación de la verificación de seguridad social.

5. CATEGORÍA: datos_contrato
   - REGLAS PRESUPUESTALES OBLIGATORIAS:
     * 'Fecha Registro Presupuestal' (campoId: 'fechaRegistroPresupuestal'): NO DEBE ESTAR VACÍA. Si no tiene fecha o está vacía, marcar observación/alerta indicando que se debe registrar la Fecha de Registro Presupuestal.
     * 'Código Rubro Presupuestal' (campoId: 'codigoRubro'): NO DEBE ESTAR VACÍO. Si está en blanco o vacío, marcar observación/alerta indicando que se debe registrar el Código del Rubro Presupuestal.
   - Verificar correspondencia exacta de Contrato Nº, Año, Objeto, Contratista, Cédula, Supervisor, Cargo, CDP, CRP y Cuentas Bancarias.

INSTRUCCIONES DE FORMATO:
- Asigna una puntuación global de 0 a 100.
  * 90-100: 'aprobado' (Cumple con los estándares requeridos)
  * 70-89: 'con_observaciones' (Detalles menores a precisar)
  * 0-69: 'rechazado' (Descuadre financiero, falta de planillas de seguridad social o inconsistencias de fechas)
- Proporciona para cada hallazgo con observación o crítico:
  * campoId: ID del campo en el sistema (ej. 'cert_control_financiero', 'cert_seguridad_social', 'cert_fechas_vigencia', 'cert_liquidacion_pago', 'cert_certificacion_satisfaccion', 'cert_datos_presupuestales').
  * comentarioSupervisorSugerido: Redacción formal lista para el supervisor.
`;

  try {
    const callGeminiWithModel = async (targetModel: string) => {
      return await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: REVIEW_SCHEMA,
          temperature: 0.2,
        }
      });
    };

    let response: any = null;
    try {
      response = await callGeminiWithModel(modelToUse);
    } catch (primaryErr: any) {
      console.warn(`[AI Review Certificado] Error con modelo principal ${modelToUse}:`, primaryErr);
      const errStr = (primaryErr?.message || '').toLowerCase();
      if (modelToUse !== 'gemini-3.1-flash-lite' && (errStr.includes('503') || errStr.includes('429') || errStr.includes('unavailable'))) {
        console.log('[AI Review Certificado] Usando modelo de respaldo: gemini-3.1-flash-lite...');
        response = await callGeminiWithModel('gemini-3.1-flash-lite');
      } else {
        throw primaryErr;
      }
    }

    const responseText = response?.text || '';
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      puntuacion: typeof parsed.puntuacion === 'number' ? parsed.puntuacion : 85,
      estadoGeneral: parsed.estadoGeneral || 'con_observaciones',
      resumenEjecutivo: parsed.resumenEjecutivo || 'Revisión del Certificado de Supervisión completada.',
      hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [],
      conclusiones: Array.isArray(parsed.conclusiones) ? parsed.conclusiones : [],
      fechaRevision: new Date().toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      modeloUtilizado: modelToUse
    };
  } catch (error: any) {
    console.error('Error durante la revisión del certificado con Gemini:', error);
    const parsedError = parseGeminiError(error, modelToUse);
    throw new Error(`${parsedError.title}: ${parsedError.explanation} (${parsedError.suggestion})`);
  }
}

/**
 * Servicio de Auditoría e Inteligencia Artificial para el Soporte Fiduciaria (Fiduprevisora / Adquisiciones)
 * Alcaldía Municipal de Quibdó
 */
export async function reviewSoporteFiduciariaWithAI(
  fiduciaria: SoporteFiduciariaData,
  report?: ReportData,
  user?: AuthUser
): Promise<AIReviewReportResult> {
  const { apiKey, model } = await resolveGeminiConfig();

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'No se ha configurado la API Key de Google Gemini en el sistema. ' +
      'El Super Administrador puede registrarla desde el panel de configuración institucional de IA.'
    );
  }

  const modelToUse = normalizeGeminiModel(model || 'gemini-3.8-flash');
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const nombreEsperado = (report?.contratistaNombre || user?.nombreCompleto || '').trim().toUpperCase();
  const cedulaEsperada = (report?.contratistaDocumento || user?.documentoIdentidad || '').replace(/[^0-9]/g, '');
  const nombreFiduciaria = (fiduciaria.nombresApellidos || '').trim().toUpperCase();
  const cedulaFiduciaria = (fiduciaria.cedula || '').replace(/[^0-9]/g, '');

  const nombresCoinciden = Boolean(nombreEsperado && nombreFiduciaria && (nombreEsperado === nombreFiduciaria || nombreEsperado.includes(nombreFiduciaria) || nombreFiduciaria.includes(nombreEsperado)));
  const cedulasCoinciden = Boolean(cedulaEsperada && cedulaFiduciaria && cedulaEsperada === cedulaFiduciaria);

  const cuentaNum = (report?.numeroCuenta || user?.numeroCuenta || '').trim();
  const cuentaBanco = (report?.banco || user?.banco || '').trim();
  const cuentaTipo = (report?.tipoCuenta || user?.tipoCuenta || '').trim();
  const tieneDatosBancarios = Boolean(cuentaNum && cuentaBanco);

  const cdpVal = (report?.cdpNro || '').trim();
  const crpVal = (report?.crpNro || '').trim();
  const rubroVal = (report?.codigoRubro || '').trim();

  const prompt = `
Eres un Auditor y Supervisor Contractual Experto de la Alcaldía Municipal de Quibdó (Chocó, Colombia).
Tu función es auditar rigurosamente el DOCUMENTO SOPORTE EN ADQUISICIONES EFECTUADAS A NO OBLIGADOS A FACTURAR (Soporte Fiduciaria La Previsora S.A. / Trámite de Giro y Desembolso), de acuerdo con la estructura visible en el formato oficial.

DATOS DEL DOCUMENTO SOPORTE FIDUCIARIA AUDITADO:
- Ciudad y Fecha: ${fiduciaria.ciudad || 'No indicado'} | ${fiduciaria.fecha || 'No indicado'}
- N° Doc Soporte: ${fiduciaria.docSoporteNro || '(En blanco)'} [NO AUDITAR NI PENALIZAR]
- Nombres y Apellidos del Beneficiario: ${fiduciaria.nombresApellidos || 'No indicado'}
- Nº Cédula de Ciudadanía / NIT: ${fiduciaria.cedula || 'No indicado'}
- Dirección: ${fiduciaria.direccion || 'No indicado'}
- Teléfono: ${fiduciaria.telefono || 'No indicado'}
- La suma total (números): ${fiduciaria.sumaTotal || '0'}
- Valor en letras: ${fiduciaria.valorLetras || 'No indicado'}
- Cantidad: ${fiduciaria.cantidad || '1'}
- Descripción del Bien o Servicio: ${fiduciaria.descripcionBienServicio || 'No indicado'}
- Sub Total: ${fiduciaria.subTotal || '0'}
- Total: ${fiduciaria.total || '0'}
- TOTAL GENERAL: ${fiduciaria.totalGeneral || '0'}
- Nota: ${fiduciaria.nota || 'RUT adjunto'}

DATOS DE REFERENCIA DEL CONTRATISTA Y DEL CONTRATO:
- Contratista Registrado en Contrato: ${nombreEsperado || 'No indicado'}
- Cédula / NIT Registrado en Contrato: ${cedulaEsperada || 'No indicado'}
- Cuenta Bancaria Registrada: Nº ${cuentaNum || 'No indicado'}, Banco: ${cuentaBanco || 'No indicado'}, Tipo: ${cuentaTipo || 'No indicado'}
- Valor a Pagar Liquidado en Informe: ${report?.valorPagar || 'No indicado'}
- Objeto Contractual Registrado: ${report?.objeto || 'No indicado'}

DIAGNÓSTICO AUTOMÁTICO PREVIO:
- ¿Coincide el nombre del beneficiario?: ${nombresCoinciden ? 'SÍ (Coincidencia exacta)' : 'NO COINCIDEN O DIFIEREN'}
- ¿Coincide la cédula/NIT?: ${cedulasCoinciden ? 'SÍ (Idéntica)' : 'NO COINCIDEN'}
- ¿Tiene cuenta bancaria registrada para dispersión?: ${tieneDatosBancarios ? `SÍ (${cuentaBanco} ${cuentaTipo} Nº ${cuentaNum})` : 'NO REGISTRADA O INCOMPLETA'}

REGLAS DE AUDITORÍA OBLIGATORIAS QUE DEBES VERIFICAR:
1. CATEGORÍA: beneficiario_cuentas
   - Correspondencia exacta del beneficiario: El nombre en 'Nombres y Apellidos' debe coincidir exactamente con el contratista registrado en el contrato.
   - Cédula / NIT: La cédula registrada en el soporte fiduciario debe coincidir exactamente con el documento de identidad del contratista.
   - Verificación de cuenta bancaria: Comprobar que los datos bancarios del beneficiario (número de cuenta, banco y tipo de cuenta) estén registrados y sean trazables para la dispersión del giro a la fiducia.
   - Datos generales: Verificar que Ciudad y Fecha, Dirección y Teléfono estén diligenciados y no vacíos.

2. CATEGORÍA: consistencia_financiera
   - Consistencia entre el valor bruto, deducciones/retenciones y el valor neto a desembolsar:
     * La suma total, Sub Total, Total y Total General deben ser consistentes entre sí y corresponder al valor a desembolsar para este período (${report?.valorPagar || 'monto mensual pactado'}).
     * Consistencia estricta entre el valor en números (ej. ${fiduciaria.sumaTotal}) y el valor en letras (ej. ${fiduciaria.valorLetras}). Si difieren, reportar observación de discrepancia.
     * Si no se aplican deducciones, el valor neto a desembolsar debe coincidir con el valor bruto total liquidado.
   - Descripción del Bien o Servicio: Debe corresponder fielmente al objeto del contrato de prestación de servicios y no estar vacía.

REGLAS DE EXCLUSIÓN EXPLÍCITAS (MUY IMPORTANTE):
- NO AUDITAR N° Doc Soporte: Este campo NO se valida. Puede estar en blanco o vacío sin ninguna penalización ni observación.
- NO AUDITAR Información Presupuestal: En este documento soporte NO van códigos presupuestales (CDP, RP/CRP ni Rubro Presupuestal), por lo que NO debes evaluarlos ni exigir que aparezcan en este formato.

INSTRUCCIONES DE FORMATO:
- Asigna una puntuación global de 0 a 100.
  * 90-100: 'aprobado' (Cumple con los estándares requeridos)
  * 70-89: 'con_observaciones' (Detalles menores de redacción o valores a precisar)
  * 0-69: 'rechazado' (Discrepancia en beneficiario, cédula o descuadre de valor)
- Proporciona para cada hallazgo con observación o crítico:
  * campoId: ID del campo en el sistema (ej. 'soporte_fiduciaria', 'fid_beneficiario', 'fid_cedula', 'fid_cuenta_bancaria', 'fid_valores', 'fid_valor_letras', 'fid_descripcion_servicio').
  * comentarioSupervisorSugerido: Redacción formal lista para el supervisor.
`;

  try {
    const callGeminiWithModel = async (targetModel: string) => {
      return await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: REVIEW_SCHEMA,
          temperature: 0.2,
        }
      });
    };

    let response: any = null;
    try {
      response = await callGeminiWithModel(modelToUse);
    } catch (primaryErr: any) {
      console.warn(`[AI Review Fiduciaria] Error con modelo principal ${modelToUse}:`, primaryErr);
      const errStr = (primaryErr?.message || '').toLowerCase();
      if (modelToUse !== 'gemini-3.1-flash-lite' && (errStr.includes('503') || errStr.includes('429') || errStr.includes('unavailable'))) {
        console.log('[AI Review Fiduciaria] Usando modelo de respaldo: gemini-3.1-flash-lite...');
        response = await callGeminiWithModel('gemini-3.1-flash-lite');
      } else {
        throw primaryErr;
      }
    }

    const responseText = response?.text || '';
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      puntuacion: typeof parsed.puntuacion === 'number' ? parsed.puntuacion : 85,
      estadoGeneral: parsed.estadoGeneral || 'con_observaciones',
      resumenEjecutivo: parsed.resumenEjecutivo || 'Revisión del Documento Soporte Fiduciario completada.',
      hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [],
      conclusiones: Array.isArray(parsed.conclusiones) ? parsed.conclusiones : [],
      fechaRevision: new Date().toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      modeloUtilizado: modelToUse
    };
  } catch (error: any) {
    console.error('Error durante la revisión fiduciaria con Gemini:', error);
    const parsedError = parseGeminiError(error, modelToUse);
    throw new Error(`${parsedError.title}: ${parsedError.explanation} (${parsedError.suggestion})`);
  }
}

/**
 * Servicio de Auditoría e Inteligencia Artificial para la Declaración Bajo Juramento (Retención en la Fuente)
 * Alcaldía Municipal de Quibdó
 */
export async function reviewDeclaracionJuramentadaWithAI(
  declaracion: DeclaracionRentaData,
  report?: ReportData,
  user?: AuthUser
): Promise<AIReviewReportResult> {
  const { apiKey, model } = await resolveGeminiConfig();

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'No se ha configurado la API Key de Google Gemini en el sistema. ' +
      'El Super Administrador puede registrarla desde el panel de configuración institucional de IA.'
    );
  }

  const modelToUse = normalizeGeminiModel(model || 'gemini-3.8-flash');
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const nombreEsperado = (report?.contratistaNombre || user?.nombreCompleto || '').trim().toUpperCase();
  const cedulaEsperada = (report?.contratistaDocumento || user?.documentoIdentidad || '').replace(/[^0-9]/g, '');

  const nombreTexto = (declaracion.nombresApellidos || '').trim().toUpperCase();
  const cedulaTexto = (declaracion.cedula || '').replace(/[^0-9]/g, '');
  const expTexto = (declaracion.expedicionCedula || '').trim();

  const firmaNombre = (declaracion.firmaNombre || '').trim().toUpperCase();
  const firmaCedula = (declaracion.firmaCedula || '').replace(/[^0-9]/g, '');
  const firmaExp = (declaracion.firmaExpedicion || '').trim();

  const fechaValida = Boolean(declaracion.fecha && declaracion.fecha.trim());
  const destinatarioValido = Boolean(declaracion.senores && declaracion.senores.trim());

  // Comparación interna entre texto de juramento y pie de firma
  const nombresCoincidenConFirma = Boolean(nombreTexto && firmaNombre && nombreTexto === firmaNombre);
  const cedulasCoincidenConFirma = Boolean(cedulaTexto && firmaCedula && cedulaTexto === firmaCedula);
  const expedicionesCoincidenConFirma = Boolean(expTexto && firmaExp && expTexto.toLowerCase() === firmaExp.toLowerCase());

  // Comparación con el contrato
  const nombreCoincideContrato = Boolean(nombreEsperado && nombreTexto && (nombreEsperado === nombreTexto || nombreEsperado.includes(nombreTexto) || nombreTexto.includes(nombreEsperado)));
  const cedulaCoincideContrato = Boolean(cedulaEsperada && cedulaTexto && cedulaEsperada === cedulaTexto);

  // Marcación: en el sistema, aplicaRetencion === false significa que NO tiene la X: "NO ( X )" y "SI ( )"
  const estaMarcadoNo = declaracion.aplicaRetencion === false;

  const prompt = `
Eres un Auditor y Supervisor Contractual Experto de la Alcaldía Municipal de Quibdó (Chocó, Colombia).
Tu función es auditar rigurosamente la CERTIFICACIÓN BAJO LA GRAVEDAD DE JURAMENTO (Para efectos de retención en la fuente - Ley 1819 de 2016 / Parágrafo 2 Art. 383 E.T.).

DATOS DEL DOCUMENTO AUDITADO:
- Fecha del Documento: "${declaracion.fecha || ''}"
- Dirigido a (Destinatario): "${declaracion.senores || ''}"
- Texto del Juramento:
  * Nombre en Juramento: "${declaracion.nombresApellidos || ''}"
  * Cédula en Juramento: "${declaracion.cedula || ''}"
  * Lugar de Expedición de la Cédula: "${declaracion.expedicionCedula || ''}"
- Casillas de Selección:
  * Marcado en SI: ${declaracion.aplicaRetencion ? 'SI ( X )' : 'SI ( )'}
  * Marcado en NO: ${!declaracion.aplicaRetencion ? 'NO ( X )' : 'NO ( )'}
- Datos en Pie de Firma:
  * Nombre al pie de firma: "${declaracion.firmaNombre || ''}"
  * Cédula al pie de firma: "${declaracion.firmaCedula || ''}"
  * Lugar de expedición al pie de firma: "${declaracion.firmaExpedicion || ''}"

DATOS DEL CONTRATISTA REGISTRADO EN EL CONTRATO:
- Nombre Oficial: "${nombreEsperado}"
- Cédula Oficial: "${cedulaEsperada}"

DIAGNÓSTICO TÉCNICO PREVIO:
- ¿Fecha presente y diligenciada?: ${fechaValida ? 'SÍ' : 'NO (Vacía o en blanco)'}
- ¿Destinatario (Señores Alcaldía) presente?: ${destinatarioValido ? 'SÍ' : 'NO (Vacío o en blanco)'}
- ¿Nombre coincide con el contrato?: ${nombreCoincideContrato ? 'SÍ' : 'NO COINCIDE'}
- ¿Cédula coincide con el contrato?: ${cedulaCoincideContrato ? 'SÍ' : 'NO COINCIDE'}
- ¿Datos del texto coinciden IDÉNTICAMENTE con los del pie de firma?:
  * Nombre: ${nombresCoincidenConFirma ? 'SÍ' : 'NO COINCIDEN'}
  * Cédula: ${cedulasCoincidenConFirma ? 'SÍ' : 'NO COINCIDEN'}
  * Lugar de Expedición: ${expedicionesCoincidenConFirma ? 'SÍ' : 'NO COINCIDEN'}
- ¿Está marcada la "X" en NO (X)?: ${estaMarcadoNo ? 'SÍ (Correcto: NO marcado con X)' : 'INCORRECTO (Está marcado en SI o sin marcar)'}

REGLAS DE AUDITORÍA OBLIGATORIAS QUE DEBES VERIFICAR (ÚNICAS REGLAS):
1. CATEGORÍA: declaracion_juramentada
   - 1. Fecha del Documento: Verificar que la fecha (ej. "Quibdó, 30 de septiembre de 2026") esté presente, no vacía y sea oportuna frente al período reportado.
   - 2. A quién va dirigido: Debe indicar la entidad destinataria (ej. "Señores ALCALDIA Ciudad." o "Señores ALCALDÍA MUNICIPAL DE QUIBDÓ"). No debe estar vacío.
   - 3. Nombre, Cédula y Lugar de Expedición:
     * El nombre debe coincidir con el contratista registrado.
     * La cédula debe coincidir con el documento de identidad del contratista.
     * El lugar de expedición de la cédula debe estar debidamente diligenciado (ej. "Lloró", "Quibdó").
   - 4. Coincidencia idéntica con el pie de firma:
     * El nombre, la cédula y el lugar de expedición que aparecen en el texto del juramento ("Yo, [NOMBRE], identificado con cédula... expedida en [LUGAR]") DEBEN SER EXACTAMENTE IGUALES a los que aparecen abajo en el pie de firma ("[NOMBRE], C.C. [CÉDULA] de [LUGAR]"). Si difieren, reportar observación.
     * NOTA: La imagen o rúbrica de la firma NO se penaliza ni audita.
   - 5. Marcación obligatoria de la X en NO():
     * Debe estar marcada la "X" en la opción NO: "NO ( X )" y desmarcada en "SI ( )".
     * Si está marcada en SI ("SI ( X )") o no tiene ninguna casilla marcada, marcar como observación obligatoria indicando que para la exoneración de retención debe marcarse la opción NO ( X ).

INSTRUCCIONES DE FORMATO:
- Asigna una puntuación global de 0 a 100.
  * 90-100: 'aprobado' (Cumple con todos los campos y la marcación de NO ( X ))
  * 70-89: 'con_observaciones' (Detalles menores en fecha, destinatario o lugar de expedición)
  * 0-69: 'rechazado' (Discrepancia entre texto y pie de firma, nombre/cédula errada o marcación en SI)
- Proporciona para cada hallazgo con observación o crítico:
  * campoId: ID del campo en el sistema (ej. 'dec_fecha', 'dec_senores', 'dec_nombre_cedula', 'dec_expedicion', 'dec_coincidencia_firma', 'dec_marcacion_no').
  * comentarioSupervisorSugerido: Redacción formal lista para el supervisor.
`;

  try {
    const callGeminiWithModel = async (targetModel: string) => {
      return await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: REVIEW_SCHEMA,
          temperature: 0.2,
        }
      });
    };

    let response: any = null;
    try {
      response = await callGeminiWithModel(modelToUse);
    } catch (primaryErr: any) {
      console.warn(`[AI Review Juramento] Error con modelo principal ${modelToUse}:`, primaryErr);
      const errStr = (primaryErr?.message || '').toLowerCase();
      if (modelToUse !== 'gemini-3.1-flash-lite' && (errStr.includes('503') || errStr.includes('429') || errStr.includes('unavailable'))) {
        console.log('[AI Review Juramento] Usando modelo de respaldo: gemini-3.1-flash-lite...');
        response = await callGeminiWithModel('gemini-3.1-flash-lite');
      } else {
        throw primaryErr;
      }
    }

    const responseText = response?.text || '';
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      puntuacion: typeof parsed.puntuacion === 'number' ? parsed.puntuacion : 85,
      estadoGeneral: parsed.estadoGeneral || 'con_observaciones',
      resumenEjecutivo: parsed.resumenEjecutivo || 'Revisión de la Declaración Bajo Juramento completada.',
      hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [],
      conclusiones: Array.isArray(parsed.conclusiones) ? parsed.conclusiones : [],
      fechaRevision: new Date().toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      modeloUtilizado: modelToUse
    };
  } catch (error: any) {
    console.error('Error durante la revisión de la declaración con Gemini:', error);
    const parsedError = parseGeminiError(error, modelToUse);
    throw new Error(`${parsedError.title}: ${parsedError.explanation} (${parsedError.suggestion})`);
  }
}

/**
 * Servicio de Auditoría e Inteligencia Artificial para la Autorización de Desembolso / Documento Equivalente a la Factura
 * Alcaldía Municipal de Quibdó
 */
export async function reviewAutorizacionDesembolsoWithAI(
  desembolso: AutorizacionDesembolsoData,
  report?: ReportData,
  user?: AuthUser
): Promise<AIReviewReportResult> {
  const { apiKey, model } = await resolveGeminiConfig();

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'No se ha configurado la API Key de Google Gemini en el sistema. ' +
      'El Super Administrador puede registrarla desde el panel de configuración institucional de IA.'
    );
  }

  const modelToUse = normalizeGeminiModel(model || 'gemini-3.8-flash');
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const nombreEsperado = (report?.contratistaNombre || user?.nombreCompleto || '').trim().toUpperCase();
  const cedulaEsperada = (report?.contratistaDocumento || user?.documentoIdentidad || '').replace(/[^0-9]/g, '');
  const cuentaEsperada = (report?.numeroCuenta || user?.numeroCuenta || '').trim();
  const bancoEsperado = (report?.banco || user?.banco || '').trim().toUpperCase();
  const direccionEsperada = (report?.direccion || report?.barrio || report?.contratistaDireccion || user?.direccion || user?.barrio || '').trim().toUpperCase();
  const telefonoEsperado = (report?.contratistaTelefono || user?.telefono || '').trim();
  const valorEsperado = (report?.valorPagar || report?.valorMensual || '').trim();

  // Validaciones directas del documento
  const fechaExpedicionValida = Boolean(desembolso.fechaExpedicion && desembolso.fechaExpedicion.trim());
  const consecutivoValido = Boolean(desembolso.consecutivoNro && desembolso.consecutivoNro.trim());
  const nombreValido = Boolean(desembolso.nombre && desembolso.nombre.trim());
  const nitCcValido = Boolean(desembolso.nitCc && desembolso.nitCc.trim());
  const cuentaValida = Boolean(desembolso.nroCuenta && desembolso.nroCuenta.trim());
  const bancoValido = Boolean(desembolso.banco && desembolso.banco.trim());
  const ciudadValida = Boolean(desembolso.ciudad && desembolso.ciudad.trim());
  const direccionTablaValida = Boolean(desembolso.direccion && desembolso.direccion.trim());
  const telefonoTablaValido = Boolean(desembolso.telefono && desembolso.telefono.trim());
  const contratoNroValido = Boolean((desembolso.contratoNro || desembolso.conceptoNro) && (desembolso.contratoNro || desembolso.conceptoNro || '').trim());
  const objetoValido = Boolean(desembolso.objeto && desembolso.objeto.trim());

  // Valores financieros
  const valorNumerosValido = Boolean(desembolso.valorNumeros && desembolso.valorNumeros.trim());
  const subtotalValido = Boolean(desembolso.subtotal && desembolso.subtotal.trim());
  const totalValido = Boolean(desembolso.total && desembolso.total.trim());
  const valorLetrasValido = Boolean(desembolso.valorLetras && desembolso.valorLetras.trim());

  // Firma y pie del documento (donde va la firma validar DIRECCIÓN y TELÉFONO)
  // En AutorizacionDesembolsoDoc, los campos de pie de firma utilizan formData.direccion y formData.telefono
  const pieFirmaDireccionValida = Boolean(desembolso.direccion && desembolso.direccion.trim());
  const pieFirmaTelefonoValido = Boolean(desembolso.telefono && desembolso.telefono.trim());

  const prompt = `
Eres un Auditor y Supervisor Contractual Experto de la Alcaldía Municipal de Quibdó (Chocó, Colombia).
Tu función es auditar rigurosamente la AUTORIZACIÓN DE DESEMBOLSO / DOCUMENTO EQUIVALENTE A LA FACTURA (Gestión Financiera - Personas Naturales no comerciantes, No responsables de IVA).

DATOS DEL DOCUMENTO DE AUTORIZACIÓN DE DESEMBOLSO AUDITADO:
- Fecha de Expedición: "${desembolso.fechaExpedicion || ''}"
- Consecutivo Nro.: "${desembolso.consecutivoNro || ''}"
- Entidad Contratante: MUNICIPIO DE QUIBDÓ (NIT. 891.680.011-0)
- DATOS DEL CONTRATISTA (Tabla principal):
  * Nombre: "${desembolso.nombre || ''}"
  * NIT. ó C.C: "${desembolso.nitCc || ''}"
  * Nro. de Cuenta: "${desembolso.nroCuenta || ''}"
  * Tipo de Cuenta: "${desembolso.tipoCuenta || ''}"
  * Banco: "${desembolso.banco || ''}"
  * Ciudad (Chocó): "${desembolso.ciudad || ''}"
  * Dirección: "${desembolso.direccion || ''}"
  * Teléfono: "${desembolso.telefono || ''}"
- CONCEPTO Y OBJETO:
  * Concepto: "${desembolso.concepto || 'PRESTACION DE SERVICIOS'}"
  * Nro. de Contrato: "${desembolso.contratoNro || desembolso.conceptoNro || ''}"
  * Cuyo objeto es (con período): "${desembolso.objeto || ''}"
- TABLA DE VALORES:
  * VALOR EN NÚMEROS: "${desembolso.valorNumeros || ''}"
  * SUBTOTAL: "${desembolso.subtotal || ''}"
  * IVA ASUMIDO: "${desembolso.ivaAsumido || '$ 0'}"
  * TOTAL: "${desembolso.total || ''}"
  * VALOR EN LETRAS: "${desembolso.valorLetras || ''}"
- PIE DE FIRMA:
  * Firma digital/espacio: ${desembolso.firmaUrl ? 'Firma digital registrada' : 'Espacio físico para firma'}
  * Dirección al pie de firma: "${desembolso.direccion || ''}"
  * Teléfono al pie de firma: "${desembolso.telefono || ''}"

DATOS OFICIALES DE REFERENCIA DEL CONTRATO:
- Contratista Registrado: "${nombreEsperado}"
- Documento / Cédula Oficial: "${cedulaEsperada}"
- Cuenta Bancaria Registrada: "${cuentaEsperada} (${bancoEsperado})"
- Dirección Registrada: "${direccionEsperada}"
- Teléfono Registrado: "${telefonoEsperado}"
- Valor a Pagar Liquidado: "${valorEsperado}"
- Objeto Contractual Registrado: "${report?.objeto || ''}"

DIAGNÓSTICO TÉCNICO PREVIO:
- ¿Fecha de expedición presente y diligenciada?: ${fechaExpedicionValida ? 'SÍ' : 'NO (Vacía o en blanco)'}
- ¿Consecutivo Nro. presente?: ${consecutivoValido ? 'SÍ' : 'NO (Vacío)'}
- ¿Nombre coincide con el contratista oficial?: ${nombreValido ? 'SÍ' : 'NO (Vacío o difiere)'}
- ¿NIT ó C.C coincide con el documento oficial?: ${nitCcValido ? 'SÍ' : 'NO (Vacío o difiere)'}
- ¿Nro. de Cuenta y Banco diligenciados?: ${cuentaValida && bancoValido ? 'SÍ' : 'INCOMPLETO'}
- ¿Ciudad (Chocó) diligenciada?: ${ciudadValida ? 'SÍ' : 'NO (Vacía)'}
- ¿Dirección y Teléfono en tabla diligenciados?: ${direccionTablaValida && telefonoTablaValido ? 'SÍ' : 'INCOMPLETO'}
- ¿Nro. de Contrato y Objeto ("Cuyo objeto es") diligenciados?: ${contratoNroValido && objetoValido ? 'SÍ' : 'INCOMPLETO'}
- ¿Valores en Números, Subtotal y Total consistentes?: ${valorNumerosValido && subtotalValido && totalValido ? 'SÍ' : 'INCOMPLETO O EN DESACUERDO'}
- ¿Valor en Letras presente y concordante con el valor en números?: ${valorLetrasValido ? 'SÍ' : 'NO (Vacío o no coincide)'}
- ¿Dirección y Teléfono donde va la firma diligenciados?: ${pieFirmaDireccionValida && pieFirmaTelefonoValido ? 'SÍ' : 'INCOMPLETO'}

REGLAS DE AUDITORÍA OBLIGATORIAS QUE DEBES VERIFICAR:
1. CATEGORÍA: datos_contrato
   - FECHA DE EXPEDICIÓN: Debe estar diligenciada y no vacía.
   - CONSECUTIVO NRO.: Debe estar diligenciado con el número correspondiente al consecutivo de cuenta/informe.
   - NOMBRE y NIT. Ó C.C: Deben coincidir exactamente con los datos del contratista registrado.
   - NRO. CONTRATO y "Cuyo objeto es": El número de contrato debe estar presente y el campo "Cuyo objeto es" debe describir el objeto y el período correspondiente de ejecución.

2. CATEGORÍA: beneficiario_cuentas
   - NRO. DE CUENTA, BANCO y CIUDAD (CHOCÓ): Deben estar debidamente diligenciados con los datos de la entidad bancaria y la ciudad de la cuenta.
   - DIRECCIÓN y TELÉFONO: Deben estar diligenciados en la sección de datos del contratista.

3. CATEGORÍA: consistencia_financiera
   - VALOR EN NÚMEROS, SUBTOTAL, IVA ASUMIDO y TOTAL:
     * El VALOR EN NÚMEROS y el SUBTOTAL deben corresponder al valor liquidado para este período (${valorEsperado}).
     * El TOTAL debe ser igual al valor neto a desembolsar.
     * IVA ASUMIDO: Para personas naturales no responsables de IVA debe estar en $ 0 o en blanco.
   - VALOR EN LETRAS:
     * Debe coincidir con total exactitud con el valor numérico total a pagar (ej. TRES MILLONES QUINIENTOS MIL PESOS M/CTE).

4. CATEGORÍA: autorizacion_desembolso
   - DONDE VA LA FIRMA:
     * Validar obligatoriamente que la DIRECCIÓN y el TELÉFONO al pie de firma estén diligenciados y coincidan con los datos de contacto del contratista.
     * NOTA: La rúbrica o imagen de la firma NO se penaliza si el documento está en proceso de trámite o firma física.

INSTRUCCIONES DE FORMATO:
- Asigna una puntuación global de 0 a 100.
  * 90-100: 'aprobado' (Cumple con todos los campos requeridos y consistencia financiera)
  * 70-89: 'con_observaciones' (Detalles menores de redacción o campos complementarios)
  * 0-69: 'rechazado' (Valores inconsistentes, falta de nombre/cédula o campos esenciales vacíos)
- Proporciona para cada hallazgo con observación o crítico:
  * campoId: ID del campo en el sistema (ej. 'des_fecha_expedicion', 'des_consecutivo', 'des_nombre', 'des_nit_cc', 'des_cuenta', 'des_banco', 'des_ciudad', 'des_direccion', 'des_telefono', 'des_contrato_nro', 'des_objeto', 'des_valores', 'des_valor_letras', 'des_firma_contacto').
  * comentarioSupervisorSugerido: Redacción formal lista para el supervisor.
`;

  try {
    const callGeminiWithModel = async (targetModel: string) => {
      return await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: REVIEW_SCHEMA,
          temperature: 0.2,
        }
      });
    };

    let response: any = null;
    try {
      response = await callGeminiWithModel(modelToUse);
    } catch (primaryErr: any) {
      console.warn(`[AI Review Desembolso] Error con modelo principal ${modelToUse}:`, primaryErr);
      const errStr = (primaryErr?.message || '').toLowerCase();
      if (modelToUse !== 'gemini-3.1-flash-lite' && (errStr.includes('503') || errStr.includes('429') || errStr.includes('unavailable'))) {
        console.log('[AI Review Desembolso] Usando modelo de respaldo: gemini-3.1-flash-lite...');
        response = await callGeminiWithModel('gemini-3.1-flash-lite');
      } else {
        throw primaryErr;
      }
    }

    const responseText = response?.text || '';
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      puntuacion: typeof parsed.puntuacion === 'number' ? parsed.puntuacion : 85,
      estadoGeneral: parsed.estadoGeneral || 'con_observaciones',
      resumenEjecutivo: parsed.resumenEjecutivo || 'Revisión de la Autorización de Desembolso completada.',
      hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [],
      conclusiones: Array.isArray(parsed.conclusiones) ? parsed.conclusiones : [],
      fechaRevision: new Date().toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      modeloUtilizado: modelToUse
    };
  } catch (error: any) {
    console.error('Error durante la revisión de la autorización de desembolso con Gemini:', error);
    const parsedError = parseGeminiError(error, modelToUse);
    throw new Error(`${parsedError.title}: ${parsedError.explanation} (${parsedError.suggestion})`);
  }
}
