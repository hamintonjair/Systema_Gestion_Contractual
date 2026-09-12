import { GoogleGenAI, Type } from '@google/genai';
import { InformeFinalData, ReportData, AuthUser, createDefaultInformeFinalData } from '../types';
import { supabaseService } from './supabaseService';

// La API Key institucional se administra desde el panel de SuperAdmin y se
// persiste en la tabla `configuracion_ia` de Supabase. Nunca debe quedar
// escrita en el codigo fuente: este repositorio es publico.
export const GEMINI_DEFAULT_KEY = '';
export const STORAGE_GEMINI_KEY = 'alcaldia_quibdo_gemini_api_key';
export const STORAGE_GEMINI_MODEL = 'alcaldia_quibdo_gemini_model';

// Map legacy or deprecated model names to active Google Gemini models
export function normalizeGeminiModel(modelName?: string): string {
  if (!modelName) return 'gemini-3.1-flash-lite';
  const clean = modelName.trim().toLowerCase();
  
  if (clean === 'gemini-2.5-pro' || clean === 'gemini-pro' || clean === 'gemini-1.5-pro' || clean === 'gemini-2.0-pro') {
    return 'gemini-3.1-pro-preview';
  }
  if (clean === 'gemini-2.5-flash' || clean === 'gemini-1.5-flash' || clean === 'gemini-2.0-flash' || clean === 'gemini-flash') {
    return 'gemini-3.1-flash-lite';
  }
  if (clean === 'gemini-flash-lite' || clean === 'flash-lite') {
    return 'gemini-3.1-flash-lite';
  }
  return modelName.trim();
}

export interface GeminiErrorInfo {
  title: string;
  explanation: string;
  suggestion: string;
  suggestedModel?: string;
  isRetryable: boolean;
  rawError?: string;
}

export function parseGeminiError(error: any, modelUsed: string): GeminiErrorInfo {
  const rawMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));

  // 1. Quota 0 on Pro models (Google Cloud Free Tier no asigna cuota a modelos Pro)
  if (rawMsg.includes('429') && (rawMsg.includes('limit: 0') || rawMsg.includes('free_tier_requests') || rawMsg.includes('RESOURCE_EXHAUSTED'))) {
    if (modelUsed.includes('pro')) {
      return {
        title: 'Modelo Pro no disponible en la capa gratuita (Free Tier)',
        explanation: 'Google AI Studio asigna cuota 0 a los modelos Pro (gemini-3.1-pro-preview) en cuentas gratuitas sin facturación vinculada (Google Cloud Billing). Este modelo está reservado para cuentas de pago.',
        suggestion: 'Selecciona "gemini-3.1-flash-lite" o "gemini-3.8-flash", los cuales son 100% gratuitos y disponen de cuota diaria inmediata en Google AI Studio.',
        suggestedModel: 'gemini-3.1-flash-lite',
        isRetryable: false,
        rawError: rawMsg
      };
    }
    return {
      title: 'Límite de solicitudes por minuto alcanzado (Error 429)',
      explanation: 'Tu API Key alcanzó temporalmente el límite de solicitudes por minuto permitidas por Google.',
      suggestion: 'Espera entre 15 y 30 segundos y vuelve a probar la conexión.',
      isRetryable: true,
      rawError: rawMsg
    };
  }

  // 2. Error 503: Demanda alta temporal en los servidores de Google
  if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
    return {
      title: 'Alta demanda temporal en los servidores de Google (Error 503)',
      explanation: `El modelo '${modelUsed}' está experimentando un pico temporal de tráfico mundial en la infraestructura de Google. Google indica que estos picos suelen disiparse en pocos segundos.`,
      suggestion: 'Te recomendamos cambiar al modelo "gemini-3.1-flash-lite", el cual cuenta con altísima disponibilidad y menor latencia en la capa gratuita.',
      suggestedModel: 'gemini-3.1-flash-lite',
      isRetryable: true,
      rawError: rawMsg
    };
  }

  // 3. Clave inválida o sin permisos
  if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API key not valid')) {
    return {
      title: 'API Key de Google no válida o revocada',
      explanation: 'Google AI Studio no reconoce la clave ingresada. Puede haber un error de tipeo o haber sido eliminada.',
      suggestion: 'Genera una nueva clave gratuita en aistudio.google.com y pégala completa sin espacios antes ni después.',
      isRetryable: false,
      rawError: rawMsg
    };
  }

  // 4. Modelo no encontrado (404)
  if (rawMsg.includes('404') || rawMsg.includes('NOT_FOUND') || rawMsg.includes('no longer available')) {
    return {
      title: 'Modelo no disponible o descontinuado (Error 404)',
      explanation: `El modelo '${modelUsed}' ya no está activo en la versión actual de la API de Google.`,
      suggestion: 'Selecciona "gemini-3.1-flash-lite" (100% gratuito) para restaurar la conexión inmediatamente.',
      suggestedModel: 'gemini-3.1-flash-lite',
      isRetryable: false,
      rawError: rawMsg
    };
  }

  return {
    title: 'Aviso de Conexión con Google Gemini',
    explanation: rawMsg,
    suggestion: 'Verifica tu conexión a internet o prueba seleccionando el modelo "gemini-3.1-flash-lite".',
    suggestedModel: 'gemini-3.1-flash-lite',
    isRetryable: true,
    rawError: rawMsg
  };
}

export function getStoredGeminiKey(): string {
  if (typeof window !== 'undefined') {
    const key = localStorage.getItem(STORAGE_GEMINI_KEY);
    if (key && key.trim()) return key.trim();
  }
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && String(envKey).trim()) return String(envKey).trim();
  return GEMINI_DEFAULT_KEY;
}

export function saveStoredGeminiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_GEMINI_KEY, key.trim());
  }
}

export function getStoredGeminiModel(): string {
  if (typeof window !== 'undefined') {
    const model = localStorage.getItem(STORAGE_GEMINI_MODEL);
    if (model && model.trim()) return normalizeGeminiModel(model.trim());
  }
  return 'gemini-3.1-flash-lite';
}

// Resuelve la API Key institucional en orden: cache de localStorage, tabla
// 'configuracion_ia' de Supabase (donde la guarda el SuperAdmin) y, por ultimo,
// la variable de entorno de desarrollo. La clave nunca vive en el codigo fuente.
export async function resolveGeminiConfig(): Promise<{ apiKey: string; model: string }> {
  const claveLocal = getStoredGeminiKey();
  const modeloLocal = getStoredGeminiModel();
  if (claveLocal) return { apiKey: claveLocal, model: modeloLocal };

  try {
    const conf = await supabaseService.getAIConfig();
    if (conf && conf.apiKey) {
      saveStoredGeminiKey(conf.apiKey);
      if (conf.modelo) saveStoredGeminiModel(conf.modelo);
      return { apiKey: conf.apiKey.trim(), model: normalizeGeminiModel(conf.modelo || modeloLocal) };
    }
  } catch (e) {
    console.warn('No se pudo leer la configuracion de IA desde Supabase:', e);
  }

  return { apiKey: '', model: modeloLocal };
}

export function saveStoredGeminiModel(model: string): void {
  if (typeof window !== 'undefined') {
    const normalized = normalizeGeminiModel(model);
    localStorage.setItem(STORAGE_GEMINI_MODEL, normalized);
  }
}

export interface TestGeminiResponse {
  success: boolean;
  message: string;
  modelUsed: string;
  errorInfo?: GeminiErrorInfo;
}

/**
 * Tests the Gemini API Key connection with automatic retry on 503
 */
export async function testGeminiConnection(apiKey?: string, modelName?: string): Promise<TestGeminiResponse> {
  const resuelto = (apiKey && apiKey.trim()) ? null : await resolveGeminiConfig();
  const keyToUse = (apiKey && apiKey.trim()) || (resuelto ? resuelto.apiKey : '');
  const rawModel = modelName || (resuelto ? resuelto.model : getStoredGeminiModel());
  const modelToUse = normalizeGeminiModel(rawModel);

  if (!keyToUse) {
    return { 
      success: false, 
      message: 'No se ha configurado ninguna API Key.', 
      modelUsed: modelToUse,
      errorInfo: {
        title: 'Falta la API Key',
        explanation: 'Debes ingresar una clave de API válida de Google AI Studio.',
        suggestion: 'Ingresa una API Key en el campo superior.',
        isRetryable: false
      }
    };
  }

  const tryCall = async (targetModel: string) => {
    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: 'Responde únicamente con la frase: "CONEXION_EXITOSA"',
    });
    return response.text || '';
  };

  try {
    const text = await tryCall(modelToUse);
    if (text.includes('CONEXION_EXITOSA') || text.length > 0) {
      return {
        success: true,
        message: `¡Conexión exitosa con Google Gemini (${modelToUse})! La API Key está activa y autorizada para generar informes finales de ejecución.`,
        modelUsed: modelToUse
      };
    } else {
      return {
        success: true,
        message: `Conexión verificada exitosamente con el modelo ${modelToUse}.`,
        modelUsed: modelToUse
      };
    }
  } catch (firstError: any) {
    const firstParsed = parseGeminiError(firstError, modelToUse);

    // Si es error 503 (alta demanda), reintentamos tras 1.2 segundos
    if (firstParsed.isRetryable && (firstError?.message || '').includes('503')) {
      console.warn(`[Gemini] Detectada alta demanda (503) en ${modelToUse}. Reintentando en 1.5s...`);
      await new Promise(r => setTimeout(r, 1500));
      try {
        const textRetry = await tryCall(modelToUse);
        if (textRetry.length > 0) {
          return {
            success: true,
            message: `¡Conexión exitosa con Google Gemini (${modelToUse}) tras disiparse el pico de demanda!`,
            modelUsed: modelToUse
          };
        }
      } catch (retryError) {
        console.error('Reintento fallido para 503:', retryError);
      }
    }

    return {
      success: false,
      message: firstParsed.explanation,
      modelUsed: modelToUse,
      errorInfo: firstParsed
    };
  }
}

export interface GenerateInformeFinalParams {
  user: AuthUser;
  reports: ReportData[];
  metaPlanDesarrollo: string;
  indicador: string;
  fechaPresentacion?: string;
  zonasIntervencion?: string;
  apiKey?: string;
  model?: string;
}

/**
 * Extrae el nombre del mes en español a partir de una fecha en formato
 * YYYY-MM-DD o DD/MM/YYYY. Devuelve null si el formato no es reconocible.
 */
function obtenerMesDeFecha(rawDate?: string): string | null {
  if (!rawDate) return null;
  const str = String(rawDate).trim();
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  let mes: number | null = null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    mes = parseInt(isoMatch[2], 10);
  } else {
    const slashMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (slashMatch) {
      mes = parseInt(slashMatch[2], 10);
    }
  }
  if (!mes || mes < 1 || mes > 12) return null;
  const nombre = meses[mes - 1];
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

// Schema estricto para forzar la forma exacta del JSON que debe devolver
// Gemini. Usar responseSchema (en vez de solo describir el formato en el
// texto del prompt) reduce fallos de parseo y respuestas con forma
// inconsistente.
const INFORME_FINAL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    introduccion: { type: Type.STRING },
    metodologiaEnfoque: { type: Type.STRING },
    metodologiaEstrategias: { type: Type.STRING },
    metodologiaZonas: { type: Type.STRING },
    metodologiaHerramientas: { type: Type.STRING },
    cuadroActividades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nro: { type: Type.INTEGER },
          actividad: { type: Type.STRING },
          periodo: { type: Type.STRING },
          lugar: { type: Type.STRING },
          poblacion: { type: Type.STRING },
          resultados: { type: Type.STRING },
          evidencias: { type: Type.STRING }
        },
        required: ['nro', 'actividad', 'periodo', 'lugar', 'poblacion', 'resultados', 'evidencias']
      }
    },
    productosEntregados: { type: Type.ARRAY, items: { type: Type.STRING } },
    resultadosAlcanzados: { type: Type.ARRAY, items: { type: Type.STRING } },
    cumplimientoMeta: { type: Type.STRING },
    analisisTecnico: { type: Type.STRING },
    impactoEjecucion: { type: Type.STRING },
    conclusiones: { type: Type.STRING },
    recomendaciones: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: [
    'introduccion', 'metodologiaEnfoque', 'metodologiaEstrategias', 'metodologiaZonas',
    'metodologiaHerramientas', 'cuadroActividades', 'productosEntregados', 'resultadosAlcanzados',
    'cumplimientoMeta', 'analisisTecnico', 'impactoEjecucion', 'conclusiones', 'recomendaciones'
  ]
};

/**
 * Generates the Informe Final de Ejecución Contractual using Gemini AI
 */
export async function generateInformeFinalWithAI(params: {
  user: AuthUser;
  reports: ReportData[];
  metaPlanDesarrollo: string;
  indicador: string;
  contratoNro?: string;
  contratoAno?: string;
  fechaPresentacion?: string;
  zonasIntervencion?: string;
  apiKey?: string;
  model?: string;
}): Promise<InformeFinalData> {
  const { user, reports, metaPlanDesarrollo, indicador, contratoNro, contratoAno, fechaPresentacion, zonasIntervencion, apiKey, model } = params;

  if (!reports || reports.length === 0) {
    throw new Error('Para generar el Informe Final con IA es obligatorio contar con al menos un (1) informe mensual registrado en el sistema.');
  }

  const effectiveContratoNro = (contratoNro && contratoNro.trim()) || user.contratoNro || '';
  if (!effectiveContratoNro.trim()) {
    throw new Error('El número de contrato es obligatorio para generar el Informe Final.');
  }
  if (!indicador || !indicador.trim()) {
    throw new Error('El indicador es obligatorio para generar el Informe Final.');
  }
  if (!metaPlanDesarrollo || !metaPlanDesarrollo.trim()) {
    throw new Error('Las metas del Plan de Desarrollo / Acción son obligatorias para generar el Informe Final.');
  }

  const effectiveContratoAno = (contratoAno && contratoAno.trim()) || String(new Date().getFullYear());

  const resueltoGen = (apiKey && apiKey.trim() && model) ? null : await resolveGeminiConfig();
  const keyToUse = (apiKey && apiKey.trim()) || (resueltoGen ? resueltoGen.apiKey : '');
  const modelToUse = normalizeGeminiModel(model || (resueltoGen ? resueltoGen.model : getStoredGeminiModel()));

  if (!keyToUse) {
    throw new Error('No hay una API Key de Google Gemini configurada. Registrala en Panel SuperAdmin > Inteligencia Artificial.');
  }

  // Base fallback data para prellenar el objeto final con lo que ya se sabe
  // (contrato, meta, indicador...) antes de intentar la generación con IA.
  const defaultData = createDefaultInformeFinalData(user, reports);
  if (effectiveContratoNro) defaultData.contratoNro = effectiveContratoNro;
  if (metaPlanDesarrollo) defaultData.metaPlanDesarrollo = metaPlanDesarrollo;
  if (indicador) defaultData.indicador = indicador;
  if (fechaPresentacion) defaultData.fechaPresentacion = fechaPresentacion;
  if (zonasIntervencion) defaultData.metodologiaZonas = zonasIntervencion;

  // Las obligaciones contractuales son fijas durante todo el contrato: cada
  // informe mensual nuevo clona la misma lista (misma descripción) desde el
  // anterior y solo limpia el texto de "actividades" para el nuevo período
  // (ver ContratistaDashboard.tsx, clonado de obligaciones). Por eso se listan
  // UNA sola vez aquí, en vez de repetirlas en cada bloque de informe mensual.
  const reporteConObligaciones = reports.find(r => r.obligaciones && r.obligaciones.length > 0);
  const obligacionesContractuales = (reporteConObligaciones?.obligaciones || [])
    .map((ob, oi) => `  ${oi + 1}. ${ob.descripcion || 'Obligación contractual sin descripción registrada.'}`)
    .join('\n');

  // Resumen por informe mensual: solo lo que cambia mes a mes (las
  // actividades ejecutadas de cada obligación ese período), identificado por
  // el número de obligación para poder cruzarlo con la lista de arriba.
  const reportsContext = reports.map((r, i) => {
    const num = r.informeNro || (i + 1);
    const mesReal = obtenerMesDeFecha(r.periodoDesde) || obtenerMesDeFecha(r.fechaPresentacion) || `Mes ${num}`;
    const rangoPeriodo = (r.periodoDesde && r.periodoHasta) ? `${r.periodoDesde} a ${r.periodoHasta}` : '';
    const actividadesPorObligacion = (r.obligaciones || []).map((ob, oi) => {
      const texto = (ob.actividades && ob.actividades.trim()) ? ob.actividades.trim() : 'Sin novedades reportadas para esta obligación en este período.';
      return `  Obligación ${oi + 1}: ${texto}`;
    }).join('\n');
    const evidencias = (r.anexos || []).map(e => e.titulo).filter(Boolean).join(', ');
    return `--- INFORME MENSUAL NRO ${num} (Mes: ${mesReal}${rangoPeriodo ? `, Período: ${rangoPeriodo}` : ''}) ---
Lugar/Ciudad: ${r.ciudad || 'Quibdó'}
Actividades ejecutadas por obligación ese mes:
${actividadesPorObligacion || 'Desarrollo de las actividades de apoyo a la gestión y cumplimiento del objeto contractual.'}
Evidencias Fotográficas / Documentales: ${evidencias || 'Registros fotográficos, listados de asistencia y actas.'}`;
  }).join('\n\n');

  const prompt = `Eres un consultor experto en contratación estatal, auditoría de gestión y administración pública de la Alcaldía Municipal de Quibdó (Chocó, Colombia).

Tu tarea es redactar el "INFORME FINAL DE EJECUCIÓN CONTRACTUAL" con el más alto rigor técnico, administrativo, gramatical y jurídico institucional, consolidando TODOS los informes mensuales ejecutados por el contratista y alineándolos estrictamente con las Metas del Plan de Desarrollo Municipal ("Quibdó Territorio de Vida 2024-2027") y los Indicadores de gestión.

REGLA MÁS IMPORTANTE: no inventes cifras, lugares, nombres de instituciones, poblaciones atendidas ni resultados numéricos que no estén explícitamente presentes en los datos suministrados abajo. Si la información de un mes es general y no trae detalles específicos, redacta en términos generales sin inventar precisión que no existe. Es preferible un texto genérico y honesto que uno específico pero inventado.

DATOS DEL CONTRATO Y CONTRATISTA:
- Número de Contrato: CPS ${effectiveContratoNro} de ${effectiveContratoAno}
- Nombre del Contratista: ${user.nombreCompleto} (C.C. ${user.documentoIdentidad})
- Dependencia Responsable: ${user.secretariaNombre || defaultData.dependencia || 'Alcaldía Municipal de Quibdó'}
- Supervisor del Contrato: ${user.supervisorNombre || defaultData.supervisorNombre || 'Supervisor designado'}, ${user.supervisorCargo || defaultData.supervisorCargo || 'Supervisor(a) del Contrato'}
- Objeto Contractual: ${user.objetoContrato || defaultData.objetoContractual || 'Prestación de servicios profesionales y de apoyo a la gestión.'}
- Meta(s) del Plan de Desarrollo: ${metaPlanDesarrollo || defaultData.metaPlanDesarrollo}
- Indicador de Producto / Gestión: ${indicador || defaultData.indicador}
- Zonas de Intervención: ${zonasIntervencion || defaultData.metodologiaZonas}
- Fecha de Presentación: ${fechaPresentacion || defaultData.fechaPresentacion}

OBLIGACIONES CONTRACTUALES (fijas durante todo el contrato, iguales en cada informe mensual):
${obligacionesContractuales || 'No se registraron obligaciones contractuales específicas; redactar en términos generales de apoyo a la gestión.'}

HISTÓRICO DE INFORMES MENSUALES EJECUTADOS (${reports.length} en total — lo que cambia mes a mes es el texto de "actividades ejecutadas" de cada obligación, referenciada arriba por su número):
${reportsContext || 'Se ejecutaron todas las obligaciones mensuales con soporte en sistemas, bases de datos y comités territoriales.'}

INSTRUCCIONES DE RESPUESTA:
Responde con un objeto JSON que cumpla el schema entregado. Ten en cuenta lo siguiente para cada campo:
- "cuadroActividades" debe tener EXACTAMENTE ${reports.length} elementos, uno por cada INFORME MENSUAL listado arriba, en el mismo orden, ni más ni menos.
- Cada elemento de "cuadroActividades" resume UN mes: su campo "actividad" debe ser un párrafo narrativo fluido que combine de forma coherente las obligaciones que tuvieron avance ese mes (no enumeres "Obligación 1: ... Obligación 2: ..."). El campo "periodo" debe ser el nombre real del mes de ese informe (el que aparece como "Mes:" en sus datos). El campo "evidencias" debe terminar siempre con "e informe mensual No. X" (X = número real de ese informe).
- "lugar" y "poblacion" deben tomarse de lo mencionado en los datos de ese mes; si no hay algo específico, usa un término general ("Sede de la dependencia", "Comunidad y beneficiarios del programa") en vez de inventar un lugar o población concretos.
- "introduccion" debe tener 2 a 3 párrafos formales explicando el marco del Plan de Desarrollo, las metas, el objeto contractual y el rol desempeñado.
- "productosEntregados", "resultadosAlcanzados" y "recomendaciones" son listas de texto (párrafos u oraciones), no deben estar vacías.`;

  try {
    const ai = new GoogleGenAI({ apiKey: keyToUse });

    // Función auxiliar para llamar a Gemini con reintentos y fallback automático
    const callGeminiJson = async (targetModel: string) => {
      return await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: INFORME_FINAL_RESPONSE_SCHEMA,
          temperature: 0.35
        }
      });
    };

    let response: any = null;
    try {
      response = await callGeminiJson(modelToUse);
    } catch (primaryErr: any) {
      console.warn(`[Gemini] Error con modelo principal ${modelToUse}:`, primaryErr);
      const errStr = (primaryErr?.message || '').toLowerCase();

      // Si el modelo principal experimenta 503 (alta demanda) o 429 quota 0, usamos gemini-3.1-flash-lite
      if (modelToUse !== 'gemini-3.1-flash-lite' && (errStr.includes('503') || errStr.includes('429') || errStr.includes('unavailable') || errStr.includes('resource_exhausted'))) {
        console.log('[Gemini] Activando modelo de respaldo automático: gemini-3.1-flash-lite...');
        response = await callGeminiJson('gemini-3.1-flash-lite');
      } else {
        throw primaryErr;
      }
    }

    const responseText = response?.text || '';
    let parsed: any = null;

    try {
      // Clean possible code fences if present
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn('Fallo al parsear JSON de Gemini:', parseError, 'Respuesta cruda:', responseText.slice(0, 500));
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('La Inteligencia Artificial no devolvió un resultado con el formato esperado. Intenta nuevamente o cambia de modelo en el panel de SuperAdmin.');
    }

    return {
      ...defaultData,
      introduccion: parsed.introduccion || defaultData.introduccion,
      metodologiaEnfoque: parsed.metodologiaEnfoque || defaultData.metodologiaEnfoque,
      metodologiaEstrategias: parsed.metodologiaEstrategias || defaultData.metodologiaEstrategias,
      metodologiaZonas: parsed.metodologiaZonas || defaultData.metodologiaZonas,
      metodologiaHerramientas: parsed.metodologiaHerramientas || defaultData.metodologiaHerramientas,
      cuadroActividades: Array.isArray(parsed.cuadroActividades) && parsed.cuadroActividades.length > 0
        ? parsed.cuadroActividades.map((a: any, idx: number) => ({
            nro: a.nro || idx + 1,
            actividad: a.actividad || `Actividad mes ${idx + 1}`,
            periodo: a.periodo || `Mes ${idx + 1}`,
            lugar: a.lugar || 'Quibdó',
            poblacion: a.poblacion || 'Comunidad y beneficiarios',
            resultados: a.resultados || 'Cumplimiento a satisfacción',
            evidencias: a.evidencias || `Informe mensual No. ${idx + 1}`
          }))
        : defaultData.cuadroActividades,
      productosEntregados: Array.isArray(parsed.productosEntregados) && parsed.productosEntregados.length > 0
        ? parsed.productosEntregados
        : defaultData.productosEntregados,
      resultadosAlcanzados: Array.isArray(parsed.resultadosAlcanzados) && parsed.resultadosAlcanzados.length > 0
        ? parsed.resultadosAlcanzados
        : defaultData.resultadosAlcanzados,
      cumplimientoMeta: parsed.cumplimientoMeta || defaultData.cumplimientoMeta,
      analisisTecnico: parsed.analisisTecnico || defaultData.analisisTecnico,
      impactoEjecucion: parsed.impactoEjecucion || defaultData.impactoEjecucion,
      conclusiones: parsed.conclusiones || defaultData.conclusiones,
      recomendaciones: Array.isArray(parsed.recomendaciones) && parsed.recomendaciones.length > 0
        ? parsed.recomendaciones
        : defaultData.recomendaciones,
      generadoConIA: true,
      fechaGeneracionIA: new Date().toISOString()
    };
  } catch (apiError: any) {
    console.error('Error al generar con Gemini API:', apiError);
    const parsed = parseGeminiError(apiError, modelToUse);
    throw new Error(parsed.explanation || 'No se pudo generar el informe con Inteligencia Artificial. Verifique su conexión y API Key.');
  }
}
