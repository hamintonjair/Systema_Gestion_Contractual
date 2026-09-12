import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Download, 
  Save, 
  Edit3, 
  Eye, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  FileText,
  Calendar,
  Layers,
  Target,
  Image as ImageIcon,
  Building,
  UserCheck,
  HelpCircle,
  FileDown,
  RotateCcw,
  Lock
} from 'lucide-react';
import { InformeFinalData, ReportData, AuthUser, ActividadInformeFinal, AnexoFotograficoFinal, parseContractNumberAndYear } from '../types';
import { generateInformeFinalWithAI, resolveGeminiConfig } from '../services/geminiService';
import { supabaseService } from '../services/supabaseService';
import { exportInformeFinalToWord, validateInformeFinalForExport } from '../export/informeFinalWord';

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export function formatSpanishDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+\d{4}$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    const mIdx = parseInt(m, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(d, 10)} de ${MESES_ES[mIdx]} de ${y}`;
    }
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const mIdx = parseInt(m, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(d, 10)} de ${MESES_ES[mIdx]} de ${y}`;
    }
  }
  return trimmed;
}

export function toIsoDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const textMatch = trimmed.match(/^(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+(\d{4})$/i);
  if (textMatch) {
    const [, d, monthName, y] = textMatch;
    const cleanMonth = monthName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const monthIndex = MESES_ES.findIndex(m => m.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === cleanMonth);
    if (monthIndex !== -1) {
      return `${y}-${String(monthIndex + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return '';
}

interface InformeFinalDocProps {
  data: InformeFinalData;
  user: AuthUser;
  reports: ReportData[];
  onSave: (data: InformeFinalData) => Promise<void> | void;
  onBack?: () => void;
}

export const InformeFinalDoc: React.FC<InformeFinalDocProps> = ({
  data: initialData,
  user,
  reports,
  onSave,
  onBack
}) => {
  const [data, setData] = useState<InformeFinalData>(initialData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exportValidationErrors, setExportValidationErrors] = useState<string[] | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Form states for AI modal & initial configuration
  const initialParsedContrato = useMemo(() => {
    const rawC = data.contratoNro || initialData?.contratoNro || user?.contratoNro;
    return parseContractNumberAndYear(rawC, user, reports);
  }, [data.contratoNro, initialData?.contratoNro, user, reports]);

  // Numero de contrato tomado de la tabla 'contratos': es la fuente de verdad y
  // tiene prioridad sobre el borrador local, sobre initialData y sobre el perfil.
  const contratoDbRef = React.useRef<{ numero: string; ano: string } | null>(null);

  const [contratoNumero, setContratoNumero] = useState<string>(initialParsedContrato.numero);
  const [contratoAno, setContratoAno] = useState<string>(initialParsedContrato.ano);
  const [contratoInput, setContratoInput] = useState<string>(data.contratoNro || initialParsedContrato.full);
  const [indicadorInput, setIndicadorInput] = useState<string>(data.indicador || '');
  const [metaInput, setMetaInput] = useState<string>(data.metaPlanDesarrollo || '');
  const [fechaInput, setFechaInput] = useState<string>(data.fechaPresentacion || '');
  const [zonasInput, setZonasInput] = useState<string>(data.metodologiaZonas || '');

  const updateContratoParts = (num: string, ano: string) => {
    const cleanNum = num.trim();
    const cleanAno = ano.trim();
    setContratoNumero(cleanNum);
    setContratoAno(cleanAno);
    const full = cleanNum ? `CPS ${cleanNum} de ${cleanAno || '2026'}` : `CPS de ${cleanAno || '2026'}`;
    setContratoInput(full);
    setData(prev => ({ ...prev, contratoNro: full }));
  };

  // Resuelve el contrato a mostrar: si ya se leyo de la tabla 'contratos' se usa
  // ese valor tal cual; si no, se infiere del borrador/perfil como respaldo.
  const resolverContrato = (rawC?: string) => {
    const db = contratoDbRef.current;
    if (db && db.numero) {
      return {
        numero: db.numero,
        ano: db.ano,
        full: 'CPS ' + db.numero + ' de ' + db.ano,
        labelContratoDe: 'Contrato Nº ' + db.numero + ' DE ' + db.ano
      };
    }
    return parseContractNumberAndYear(rawC, user, reports);
  };

  const getCleanDoc = () => (user?.documentoIdentidad || data?.contratistaDocumento || initialData?.contratistaDocumento || '').trim().replace(/\D/g, '');

  // Sincronizar initialData y cargar borrador previo de localStorage si existe avance
  React.useEffect(() => {
    if (initialData) {
      const cleanDoc = getCleanDoc();
      const rawDoc = user?.documentoIdentidad || initialData.contratistaDocumento || '';
      const localDraft = (cleanDoc ? localStorage.getItem(`informe_final_${cleanDoc}`) : null) || 
                         (rawDoc ? localStorage.getItem(`informe_final_${rawDoc}`) : null);

      if (localDraft) {
        try {
          const parsed = JSON.parse(localDraft);
          const hasLocalWork = Boolean(
            parsed.introduccion || 
            parsed.metaPlanDesarrollo || 
            parsed.indicador || 
            (parsed.cuadroActividades && parsed.cuadroActividades.length > 0) ||
            parsed.conclusiones
          );
          if (hasLocalWork) {
            const rawC = parsed.contratoNro || user?.contratoNro || initialData.contratoNro;
            const parsedC = resolverContrato(rawC);
            if (parsedC.numero) {
              parsed.contratoNro = parsedC.full;
            }
            setData(parsed);
            setContratoNumero(parsedC.numero);
            setContratoAno(parsedC.ano);
            setContratoInput(parsed.contratoNro || parsedC.full);
            setIndicadorInput(parsed.indicador || initialData.indicador || '');
            setMetaInput(parsed.metaPlanDesarrollo || initialData.metaPlanDesarrollo || '');
            setFechaInput(parsed.fechaPresentacion || initialData.fechaPresentacion || '');
            setZonasInput(parsed.metodologiaZonas || initialData.metodologiaZonas || '');
            return;
          }
        } catch (e) {}
      }

      const rawC = initialData.contratoNro || user?.contratoNro;
      const parsedC = resolverContrato(rawC);
      if (parsedC.numero) {
        initialData.contratoNro = parsedC.full;
      }
      setData(initialData);
      setContratoNumero(parsedC.numero);
      setContratoAno(parsedC.ano);
      setContratoInput(initialData.contratoNro || parsedC.full);
      setIndicadorInput(initialData.indicador || '');
      setMetaInput(initialData.metaPlanDesarrollo || '');
      setFechaInput(initialData.fechaPresentacion || '');
      setZonasInput(initialData.metodologiaZonas || '');
    }
  }, [initialData, user]);

  // Cargar los datos contractuales reales desde la tabla 'contratos'.
  // Estos valores mandan sobre el borrador local, initialData y el perfil.
  React.useEffect(() => {
    let vigente = true;
    const cargarContratoDeBd = async () => {
      const doc = user?.documentoIdentidad || data?.contratistaDocumento || initialData?.contratistaDocumento || '';
      if (!user?.id && !doc) return;
      try {
        const contrato = await supabaseService.getContratoDeContratista(user?.id, doc);
        if (!vigente || !contrato) return;

        // Campos institucionales: solo se sobrescriben si la BD tiene valor,
        // para no borrar lo que el contratista ya haya escrito a mano.
        setData(prev => ({
          ...prev,
          dependencia: contrato.dependencia || prev.dependencia,
          supervisorNombre: contrato.supervisorNombre || prev.supervisorNombre,
          supervisorCargo: contrato.supervisorCargo || prev.supervisorCargo,
          objetoContractual: contrato.objeto || prev.objetoContractual,
          contratistaLugarDoc: contrato.ciudad || prev.contratistaLugarDoc
        }));

        if (contrato.contratoNro) {
          const ano = contrato.vigencia || contratoAno || '2026';
          contratoDbRef.current = { numero: contrato.contratoNro, ano };
          updateContratoParts(contrato.contratoNro, ano);
        } else if (contrato.vigencia) {
          setContratoAno(contrato.vigencia);
        }
      } catch (e) {
        console.warn('No se pudieron cargar los datos del contrato desde la BD:', e);
      }
    };
    cargarContratoDeBd();
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.documentoIdentidad]);

  // Respaldo en segundo plano en localStorage cada vez que el usuario modifica campos
  React.useEffect(() => {
    if (!data) return;
    const cleanDoc = getCleanDoc();
    const rawDoc = user?.documentoIdentidad || data.contratistaDocumento || '';
    const jsonStr = JSON.stringify(data);
    if (cleanDoc) localStorage.setItem(`informe_final_${cleanDoc}`, jsonStr);
    if (rawDoc) localStorage.setItem(`informe_final_${rawDoc}`, jsonStr);
  }, [data]);

  // Auto-sincronizar lugar de expedición de la cédula si está en 'Quibdó' o vacío y existe en la BD / Declaración de Renta
  React.useEffect(() => {
    let isMounted = true;
    const resolveLugarExpedicion = async () => {
      const cleanDoc = getCleanDoc();
      if (!cleanDoc) return;

      let foundLugar = '';

      // 1. Check local storage for declaracion de renta
      const localRenta = localStorage.getItem(`dec_renta_${cleanDoc}_1`) || localStorage.getItem(`dec_renta_${cleanDoc}`);
      if (localRenta) {
        try {
          const parsed = JSON.parse(localRenta);
          if (parsed.expedicionCedula) foundLugar = parsed.expedicionCedula;
        } catch (e) {}
      }

      // 2. Query Supabase declaracion de renta
      if (!foundLugar) {
        try {
          const decDb = await supabaseService.getDeclaracionRenta(undefined, cleanDoc, '1');
          if (decDb?.expedicionCedula) {
            foundLugar = decDb.expedicionCedula;
          }
        } catch (e) {}
      }

      // 3. Fallback to user profile
      if (!foundLugar && user?.ciudad) {
        foundLugar = user.ciudad;
      }

      if (isMounted && foundLugar) {
        setData(prev => {
          if (!prev.contratistaLugarDoc || prev.contratistaLugarDoc === 'Quibdó') {
            return { ...prev, contratistaLugarDoc: foundLugar };
          }
          return prev;
        });
      }
    };

    resolveLugarExpedicion();
    return () => { isMounted = false; };
  }, [user?.documentoIdentidad, user?.ciudad]);

  // El Informe Final certifica cumplimiento contractual: solo los informes que
  // el supervisor ya aprobó son fuente confiable. Un borrador puede tener
  // obligaciones sin actividades registradas todavía (texto vacío), lo que
  // obligaría a la IA a inventar contenido solo para llenar esa fila.
  const approvedReports = (reports || []).filter(r => r.estado === 'Aprobado');
  const hasReports = approvedReports.length > 0;
  const isReportEmpty = (
    !data.generadoConIA &&
    (!data.introduccion || data.introduccion.trim().length === 0) &&
    (!data.cuadroActividades || data.cuadroActividades.length === 0 || !data.cuadroActividades.some(a => a.actividad && a.actividad.trim().length > 0)) &&
    (!data.conclusiones || data.conclusiones.trim().length === 0)
  );

  const handleTriggerAIGeneration = async () => {
    setAiError(null);

    // Validación 1: Debe haber al menos un informe mensual APROBADO
    if (!hasReports) {
      setAiError(
        reports && reports.length > 0
          ? 'Ninguno de tus informes mensuales está en estado Aprobado todavía. La IA solo puede consolidar informes ya aprobados por el supervisor.'
          : 'Para generar el Informe Final con IA es obligatorio contar con al menos un (1) informe mensual registrado en el sistema.'
      );
      return;
    }

    // Validación 2: Contrato, Indicador y Metas del Plan de Acción
    const cleanContrato = (contratoInput || data.contratoNro || (contratoNumero ? `CPS ${contratoNumero} de ${contratoAno || '2026'}` : '')).trim();
    if (!cleanContrato) {
      setAiError('El Número de Contrato es obligatorio para generar el Informe Final.');
      return;
    }
    if (!indicadorInput || !indicadorInput.trim()) {
      setAiError('El Indicador es obligatorio para generar el Informe Final.');
      return;
    }
    if (!metaInput || !metaInput.trim()) {
      setAiError('Las Metas del Plan de Acción / Desarrollo son obligatorias para generar el Informe Final.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      // La API Key institucional la administra el SuperAdmin y vive en la tabla
      // 'configuracion_ia'; un contratista no pasa por ese panel, asi que hay que
      // resolverla contra la BD y no solo contra el cache de localStorage.
      const claveIa = await resolveGeminiConfig();
      if (!claveIa.apiKey) {
        setAiError('No hay una API Key de Google Gemini configurada. Pide al administrador que la registre en Panel SuperAdmin > Inteligencia Artificial.');
        setIsGeneratingAI(false);
        return;
      }

      const generated = await generateInformeFinalWithAI({
        user,
        reports: approvedReports,
        contratoNro: cleanContrato,
        contratoAno: contratoAno || undefined,
        metaPlanDesarrollo: metaInput.trim(),
        indicador: indicadorInput.trim(),
        fechaPresentacion: fechaInput.trim() || undefined,
        zonasIntervencion: zonasInput.trim() || undefined,
        apiKey: claveIa.apiKey,
        model: claveIa.model
      });

      const parsedC = resolverContrato(generated.contratoNro || cleanContrato);
      setContratoNumero(parsedC.numero);
      setContratoAno(parsedC.ano);
      setContratoInput(parsedC.full);

      setData(generated);
      setShowAiModal(false);
      setSaveSuccess(true);
      setLastSavedAt(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
      setTimeout(() => setSaveSuccess(false), 4000);
      await onSave(generated);
    } catch (err: any) {
      console.error('Error al generar informe final con IA:', err);
      setAiError(err.message || 'Error al conectar con la Inteligencia Artificial.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveData = async () => {
    setIsSaving(true);
    try {
      // 1. Guardar de inmediato en localStorage para que esté 100% disponible
      const cleanDoc = getCleanDoc();
      const rawDoc = user?.documentoIdentidad || data.contratistaDocumento || '';
      const jsonStr = JSON.stringify(data);
      if (cleanDoc) localStorage.setItem(`informe_final_${cleanDoc}`, jsonStr);
      if (rawDoc) localStorage.setItem(`informe_final_${rawDoc}`, jsonStr);

      // 2. Persistir en la base de datos (Supabase)
      await onSave(data);

      const now = new Date();
      setLastSavedAt(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.warn('Aviso guardando en Supabase:', err);
      // El guardado local ya garantizó que el avance del usuario no se pierda
      const now = new Date();
      setLastSavedAt(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportDocx = async () => {
    // 1. Validar obligatoriedad: Solo se permite exportar si el informe está completamente cumplido/diligenciado
    const validation = validateInformeFinalForExport(data);
    if (!validation.isValid) {
      setExportValidationErrors(validation.missingFields);
      return;
    }

    setIsExporting(true);
    try {
      const blob = await exportInformeFinalToWord(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanContrato = (data.contratoNro || 'FINAL').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanNombre = (data.contratistaNombre || 'CONTRATISTA').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `INFORME_FINAL_EJECUCION_${cleanContrato}_${cleanNombre}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error al exportar a Word:', err);
      alert(`Error al generar archivo Word: ${err.message || 'Verifique la plantilla'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Descargar la plantilla oficial original en blanco almacenada en public/templates/INFORME_FINAL_EJECUCION.docx
  const handleDownloadBlankTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/INFORME_FINAL_EJECUCION.docx';
    link.download = 'INFORME_FINAL_EJECUCION_FORMATO_OFICIAL_EN_BLANCO.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Restablecer campos para trabajar en el formato oficial limpio / vacío
  const handleResetToBlank = async () => {
    const blankData: InformeFinalData = {
      ...data,
      metaPlanDesarrollo: '',
      indicador: '',
      fechaPresentacion: '',
      introduccion: '',
      metodologiaEnfoque: '',
      metodologiaEstrategias: '',
      metodologiaZonas: '',
      metodologiaHerramientas: '',
      cuadroActividades: [],
      productosEntregados: [],
      resultadosAlcanzados: [],
      cumplimientoMeta: '',
      analisisTecnico: '',
      impactoEjecucion: '',
      conclusiones: '',
      recomendaciones: [],
      anexosFotograficos: [],
      generadoConIA: false
    };

    setData(blankData);
    setContratoInput(blankData.contratoNro || '');
    setIndicadorInput('');
    setMetaInput('');
    setFechaInput('');
    setZonasInput('');

    // Limpiar localStorage
    const storageKey = `informe_final_${data.contratistaDocumento || user.documentoIdentidad || ''}`;
    localStorage.removeItem(storageKey);

    // Guardar estado vacío en Supabase
    try {
      await onSave(blankData);
    } catch (e) {
      console.warn('Error guardando informe vacío:', e);
    }

    setIsEditing(true);
  };

  // Activity row helpers
  const handleUpdateActivity = (index: number, field: keyof ActividadInformeFinal, value: any) => {
    const updated = [...data.cuadroActividades];
    updated[index] = { ...updated[index], [field]: value };
    setData({ ...data, cuadroActividades: updated });
  };

  const handleAddActivity = () => {
    const newAct: ActividadInformeFinal = {
      nro: data.cuadroActividades.length + 1,
      actividad: '',
      periodo: '',
      lugar: '',
      poblacion: '',
      resultados: '',
      evidencias: ''
    };
    setData({ ...data, cuadroActividades: [...data.cuadroActividades, newAct] });
  };

  const handleDeleteActivity = (index: number) => {
    const updated = data.cuadroActividades.filter((_, i) => i !== index).map((a, idx) => ({ ...a, nro: idx + 1 }));
    setData({ ...data, cuadroActividades: updated });
  };

  // Product helpers
  const handleAddProduct = () => {
    setData({ ...data, productosEntregados: [...data.productosEntregados, ''] });
  };
  const handleDeleteProduct = (index: number) => {
    setData({ ...data, productosEntregados: data.productosEntregados.filter((_, i) => i !== index) });
  };

  // Result helpers
  const handleAddResultado = () => {
    setData({ ...data, resultadosAlcanzados: [...data.resultadosAlcanzados, ''] });
  };
  const handleDeleteResultado = (index: number) => {
    setData({ ...data, resultadosAlcanzados: data.resultadosAlcanzados.filter((_, i) => i !== index) });
  };

  // Recommendation helpers
  const handleAddRecomendacion = () => {
    setData({ ...data, recomendaciones: [...data.recomendaciones, ''] });
  };
  const handleDeleteRecomendacion = (index: number) => {
    setData({ ...data, recomendaciones: data.recomendaciones.filter((_, i) => i !== index) });
  };

  // Photo handlers
  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        const newPhoto: AnexoFotograficoFinal = {
          id: `photo-${Date.now()}`,
          url: result,
          descripcion: file.name.replace(/\.[^/.]+$/, ''),
          periodo: `Periodo final`,
          fecha: data.fechaPresentacion
        };
        setData({
          ...data,
          anexosFotograficos: [...(data.anexosFotograficos || []), newPhoto]
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = (id: string) => {
    setData({
      ...data,
      anexosFotograficos: (data.anexosFotograficos || []).filter(p => p.id !== id)
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Controls Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Volver
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">
                Informe Final de Ejecución Contractual
              </h2>
              {data.generadoConIA && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                  Generado con IA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {data.contratoNro} • {data.contratistaNombre}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Generator Button */}
          <button
            id="btn-generar-informe-ia"
            type="button"
            onClick={() => setShowAiModal(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {data.generadoConIA ? 'Regenerar con IA (Gemini)' : 'Generar con IA (Gemini)'}
          </button>

          {/* Edit Mode Toggle */}
          <button
            id="btn-toggle-edicion-informe-final"
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              isEditing 
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isEditing ? (
              <>
                <Eye className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Modo Lectura
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                Modo Edición
              </>
            )}
          </button>

          {/* Reset to Blank Form (Always available) */}
          <button
            id="btn-reset-vacio-informe-final"
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            title="Vaciar campos y comenzar con el formato oficial en blanco"
            className="inline-flex items-center px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg shadow-sm transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
            Limpiar / Formato Vacío
          </button>

          {/* Download Blank Official .docx Template directly */}
          <button
            id="btn-descargar-plantilla-vacia-docx"
            type="button"
            onClick={handleDownloadBlankTemplate}
            title="Descargar el archivo oficial INFORME_FINAL_EJECUCION.docx en blanco"
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-sm transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Descargar Formato Vacío (.docx)
          </button>

          {/* Save Draft Button - Always allowed even with incomplete data */}
          <button
            id="btn-guardar-informe-final"
            type="button"
            onClick={handleSaveData}
            disabled={isSaving}
            title="Guarda tu avance como borrador en cualquier momento (incluso incompleto) para continuar editándolo después"
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-sm transition-all hover:shadow disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-amber-800" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5 text-amber-800" />
            )}
            {isSaving ? 'Guardando...' : saveSuccess ? '¡Guardado!' : 'Guardar Avance'}
          </button>

          {/* Word Export Button - Emerald styled */}
          <button
            id="btn-exportar-word-informe-final"
            type="button"
            onClick={handleExportDocx}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-all hover:shadow disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            Exportar a Word (.docx)
          </button>
        </div>
      </div>

      {/* Save Alert Banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>¡Avance guardado con éxito!</strong> Tu borrador está seguro en el sistema. Puedes salir, recargar o cambiar de módulo y continuar en cualquier momento.
            </span>
          </div>
          {lastSavedAt && (
            <span className="text-[11px] text-emerald-700 font-medium ml-3 shrink-0 bg-emerald-100/60 px-2 py-0.5 rounded">
              Hora: {lastSavedAt}
            </span>
          )}
        </div>
      )}

      {/* Empty State Policy Banner & Quick Configuration */}
      {isReportEmpty && (
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-white border-2 border-dashed border-indigo-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100/80 pb-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0 mt-0.5">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Formato Oficial de Informe Final en Blanco
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Pendiente de Diligenciamiento
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  El formato se encuentra actualmente limpio sin datos estáticos simulados. Para exportar el Word oficial debe estar completamente diligenciado y cumplido.
                </p>
              </div>
            </div>
          </div>

          {/* Validaciones Previas (Requisitos de IA y Exportación) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className={`p-3.5 rounded-xl border flex items-start space-x-2.5 transition-all ${
              hasReports ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-rose-50/80 border-rose-200 text-rose-950'
            }`}>
              {hasReports ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="block font-bold">Requisito 1: Informes Mensuales Aprobados</strong>
                <p className="text-[11px] mt-0.5 text-slate-600">
                  {hasReports
                    ? `Se detectaron ${approvedReports.length} informe(s) mensual(es) en estado Aprobado para consolidar en la ejecución.`
                    : (reports && reports.length > 0
                        ? `Tienes ${reports.length} informe(s) mensual(es) registrados, pero ninguno está en estado Aprobado. La IA solo puede consolidar informes ya aprobados por el supervisor.`
                        : `No tienes informes mensuales registrados. Para que la IA consolide la ejecución es obligatorio registrar al menos un (1) informe mensual y que esté aprobado.`)}
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border flex items-start space-x-2.5 transition-all ${
              (contratoInput && indicadorInput && metaInput) ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}>
              {(contratoInput && indicadorInput && metaInput) ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="block font-bold">Requisito 2: Datos Obligatorios del Informe</strong>
                <p className="text-[11px] mt-0.5 text-slate-600">
                  Se requiere ingresar: Número de contrato, Indicador y Metas del Plan de Acción.
                </p>
              </div>
            </div>
          </div>

          {/* Formulario de Entrada Rápida */}
          <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center">
              <Target className="w-4 h-4 mr-1.5 text-purple-600" />
              Datos requeridos para generar o diligenciar el Informe Final:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                  Número de Contrato: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={contratoInput}
                  onChange={(e) => {
                    setContratoInput(e.target.value);
                    setData(prev => ({ ...prev, contratoNro: e.target.value }));
                  }}
                  placeholder="Ej: CPS 025 de 2026"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                  Indicador de Producto / Gestión: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={indicadorInput}
                  onChange={(e) => {
                    setIndicadorInput(e.target.value);
                    setData(prev => ({ ...prev, indicador: e.target.value }));
                  }}
                  placeholder="Ej: Número de personas atendidas, familias caracterizadas, etc."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                Metas del Plan de Acción / Desarrollo Municipal: <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={metaInput}
                onChange={(e) => {
                  setMetaInput(e.target.value);
                  setData(prev => ({ ...prev, metaPlanDesarrollo: e.target.value }));
                }}
                rows={2}
                placeholder="Ej: Metas del Plan de Desarrollo Municipal asociadas al contrato..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Diligenciar Manualmente
              </button>

              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                disabled={!hasReports}
                className="inline-flex items-center px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {hasReports ? 'Generar Informe Final con IA' : 'Requiere al menos 1 informe previo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Printable Document Canvas */}
      <div className="bg-white shadow-xl rounded-xl border border-slate-200 p-8 sm:p-12 max-w-4xl mx-auto font-['Century_Gothic',Calibri,sans-serif] text-slate-900 text-[11pt] leading-relaxed">
        
        {/* Document Header with Seal & Title */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 text-center space-y-2">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <Building className="w-8 h-8 text-slate-800" />
            <div className="text-left">
              <h1 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                ALCALDÍA MUNICIPAL DE QUIBDÓ
              </h1>
              <p className="text-xs font-semibold text-slate-600 uppercase">
                {data.dependencia}
              </p>
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-wide uppercase pt-2">
            INFORME FINAL DE EJECUCIÓN CONTRACTUAL
          </h2>
          <div className="flex items-center justify-center space-x-2 text-xs font-medium text-slate-600">
            <span>Fecha de Presentación:</span>
            {isEditing ? (
              <div className="inline-flex items-center space-x-2">
                <input
                  type="date"
                  value={toIsoDate(data.fechaPresentacion)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const formatted = val ? formatSpanishDate(val) : '';
                    setData(prev => ({ ...prev, fechaPresentacion: formatted }));
                    setFechaInput(formatted);
                  }}
                  className="p-1.5 px-2.5 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white text-xs cursor-pointer shadow-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
                {data.fechaPresentacion && (
                  <span className="font-bold text-slate-800">
                    ({formatSpanishDate(data.fechaPresentacion)})
                  </span>
                )}
              </div>
            ) : (
              <span className="font-bold text-slate-800">
                {data.fechaPresentacion ? formatSpanishDate(data.fechaPresentacion) : <span className="italic text-slate-400 font-normal">Sin registrar</span>}
              </span>
            )}
          </div>
        </div>

        {/* 1. Información General del Contrato */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              1. Información General del Contrato
            </h3>
            {isEditing ? (
              <span className="text-[10px] text-amber-700 font-semibold flex items-center">
                <Edit3 className="w-3 h-3 mr-1" /> Campos editables habilitados
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-medium">
                Obtenido de Base de Datos y Contrato
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 bg-amber-50/30 p-4 rounded-xl border border-amber-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Número y Año del Contrato: <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 flex items-center border border-slate-300 rounded bg-white overflow-hidden focus-within:ring-1 focus-within:ring-purple-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1.5 text-xs font-bold border-r border-slate-300 shrink-0">
                        Contrato Nº
                      </span>
                      <input
                        type="text"
                        value={contratoNumero}
                        onChange={(e) => updateContratoParts(e.target.value, contratoAno)}
                        placeholder="Ej. 025"
                        className="w-full p-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="w-28 sm:w-32 flex items-center border border-slate-300 rounded bg-white overflow-hidden focus-within:ring-1 focus-within:ring-purple-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1.5 text-xs font-bold border-r border-slate-300 shrink-0">
                        DE
                      </span>
                      <input
                        type="text"
                        value={contratoAno}
                        onChange={(e) => updateContratoParts(contratoNumero, e.target.value)}
                        placeholder="2026"
                        className="w-full p-1.5 text-xs font-bold text-slate-900 text-center focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    Identificación oficial: {contratoNumero ? `Contrato Nº ${contratoNumero} DE ${contratoAno || '2026'} (CPS ${contratoNumero} de ${contratoAno || '2026'})` : 'Sin asignar'}
                  </p>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nombre del Contratista: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.contratistaNombre}
                    onChange={(e) => setData({ ...data, contratistaNombre: e.target.value })}
                    placeholder="Nombre completo del contratista"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Documento de Identidad: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.contratistaDocumento}
                    onChange={(e) => setData({ ...data, contratistaDocumento: e.target.value })}
                    placeholder="Cédula de ciudadanía"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Dependencia Responsable:
                  </label>
                  <input
                    type="text"
                    value={data.dependencia}
                    onChange={(e) => setData({ ...data, dependencia: e.target.value })}
                    placeholder="Dependencia o Secretaría municipal"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Supervisor del Contrato:
                  </label>
                  <input
                    type="text"
                    value={data.supervisorNombre}
                    onChange={(e) => setData({ ...data, supervisorNombre: e.target.value })}
                    placeholder="Nombre del supervisor institucional"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Cargo del Supervisor:
                  </label>
                  <input
                    type="text"
                    value={data.supervisorCargo}
                    onChange={(e) => setData({ ...data, supervisorCargo: e.target.value })}
                    placeholder="Cargo oficial del supervisor"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    Indicador de Gestión / Producto: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.indicador}
                    onChange={(e) => {
                      setData({ ...data, indicador: e.target.value });
                      setIndicadorInput(e.target.value);
                    }}
                    placeholder="Escribe el indicador establecido en el contrato o plan de acción"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-xs font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Objeto Contractual:
                </label>
                <textarea
                  value={data.objetoContractual}
                  onChange={(e) => setData({ ...data, objetoContractual: e.target.value })}
                  rows={2}
                  placeholder="Objeto suscrito en el contrato..."
                  className="w-full p-2 border border-slate-300 rounded bg-white text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Meta(s) del Plan de Desarrollo / Acción: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={data.metaPlanDesarrollo}
                  onChange={(e) => {
                    setData({ ...data, metaPlanDesarrollo: e.target.value });
                    setMetaInput(e.target.value);
                  }}
                  rows={3}
                  placeholder="Escribe las metas institucionales del Plan de Desarrollo o Acción a las que tributa el contrato..."
                  className="w-full p-2 border border-slate-300 rounded bg-white text-xs leading-relaxed focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <p>
                    <strong className="text-slate-700">Número del contrato:</strong>{' '}
                    <span className="font-semibold text-slate-900">
                      {contratoNumero ? `Contrato Nº ${contratoNumero} DE ${contratoAno || '2026'}` : `Contrato DE ${contratoAno || '2026'}`}
                    </span>
                    <span className="text-slate-500 font-medium text-[11px] ml-1.5">
                      ({data.contratoNro ? (data.contratoNro.toUpperCase().startsWith('CPS') ? data.contratoNro : `CPS ${data.contratoNro}`) : (contratoNumero ? `CPS ${contratoNumero} de ${contratoAno || '2026'}` : `CPS de ${contratoAno || '2026'}`)})
                    </span>
                  </p>
                  <p><strong className="text-slate-700">Nombre del contratista:</strong> {data.contratistaNombre || <span className="italic text-slate-400">Sin registrar</span>}</p>
                  <p><strong className="text-slate-700">Documento de identidad:</strong> {data.contratistaDocumento ? `C.C. ${data.contratistaDocumento}` : <span className="italic text-slate-400">Sin registrar</span>}</p>
                  <p><strong className="text-slate-700">Dependencia responsable:</strong> {data.dependencia || <span className="italic text-slate-400">Sin registrar</span>}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <p><strong className="text-slate-700">Supervisor del contrato:</strong> {data.supervisorNombre || <span className="italic text-slate-400">Sin registrar</span>}</p>
                  <p><strong className="text-slate-700">Cargo del supervisor:</strong> {data.supervisorCargo || <span className="italic text-slate-400">Sin registrar</span>}</p>
                  <p><strong className="text-slate-700">Indicador:</strong> {data.indicador ? <span className="text-slate-900">{data.indicador}</span> : <span className="italic text-slate-400">Sin registrar (activa Modo Edición para ingresar)</span>}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-2">
                <p><strong className="text-slate-700">Objeto contractual:</strong> {data.objetoContractual || <span className="italic text-slate-400">Sin registrar en contrato</span>}</p>
                <div>
                  <strong className="text-slate-700 block mb-1">Meta(s) del Plan de Desarrollo:</strong>
                  {data.metaPlanDesarrollo ? (
                    <div className="whitespace-pre-line text-slate-800 bg-white p-2.5 rounded border border-slate-200 font-medium leading-relaxed">
                      {data.metaPlanDesarrollo}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic bg-white p-2 rounded border border-slate-200">
                      Sin registrar (activa Modo Edición para redactar las metas o genera con IA)
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 2. Introducción */}
        <div className="mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900 flex items-center justify-between">
            <span>2. Introducción</span>
            {isEditing && <span className="text-[10px] text-amber-700 font-normal">Editable</span>}
          </h3>

          {isEditing ? (
            <textarea
              value={data.introduccion}
              onChange={(e) => setData({ ...data, introduccion: e.target.value })}
              rows={6}
              placeholder="Escribe la introducción y justificación del informe final..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          ) : data.introduccion ? (
            <div className="text-xs text-justify leading-relaxed whitespace-pre-line text-slate-800">
              {data.introduccion}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Sin introducción registrada aún. (Activa Modo Edición para redactar o pulsa Generar con IA).
            </p>
          )}
        </div>

        {/* 3. Metodología de Trabajo Desarrollada */}
        <div className="mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900 flex items-center justify-between">
            <span>3. Metodología de Trabajo Desarrollada</span>
            {isEditing && <span className="text-[10px] text-amber-700 font-normal">Editable</span>}
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <strong className="text-slate-900 block mb-1">Enfoque y articulación:</strong>
              {isEditing ? (
                <textarea
                  value={data.metodologiaEnfoque}
                  onChange={(e) => setData({ ...data, metodologiaEnfoque: e.target.value })}
                  rows={3}
                  placeholder="Enfoque técnico, operativo y diferencial aplicado..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                />
              ) : data.metodologiaEnfoque ? (
                <p className="text-slate-800 text-justify leading-relaxed">{data.metodologiaEnfoque}</p>
              ) : (
                <p className="text-slate-400 italic">Sin enfoque registrado aún.</p>
              )}
            </div>

            <div>
              <strong className="text-slate-900 block mb-1">Estrategias implementadas:</strong>
              {isEditing ? (
                <textarea
                  value={data.metodologiaEstrategias}
                  onChange={(e) => setData({ ...data, metodologiaEstrategias: e.target.value })}
                  rows={2}
                  placeholder="Estrategias metodológicas y de seguimiento implementadas..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                />
              ) : data.metodologiaEstrategias ? (
                <p className="text-slate-800 leading-relaxed">{data.metodologiaEstrategias}</p>
              ) : (
                <p className="text-slate-400 italic">Sin estrategias registradas aún.</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <strong className="text-slate-900 block">Zonas de intervención:</strong>
                <span className="text-[10px] text-slate-500">
                  (Territorio, comunas, barrios o sedes institucionales atendidas)
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={data.metodologiaZonas}
                  onChange={(e) => setData({ ...data, metodologiaZonas: e.target.value })}
                  placeholder="Ej: Sede Secretaría y comunas 1 a 6 de la zona urbana de Quibdó"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 text-xs"
                />
              ) : data.metodologiaZonas ? (
                <p className="text-slate-800 text-xs">{data.metodologiaZonas}</p>
              ) : (
                <p className="text-slate-400 italic text-xs">Sin zonas de intervención registradas aún.</p>
              )}
            </div>

            <div>
              <strong className="text-slate-900 block mb-1">Herramientas técnicas:</strong>
              {isEditing ? (
                <textarea
                  value={data.metodologiaHerramientas}
                  onChange={(e) => setData({ ...data, metodologiaHerramientas: e.target.value })}
                  rows={2}
                  placeholder="Software, equipos técnicos, formatos y canales institucionales..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
                />
              ) : data.metodologiaHerramientas ? (
                <p className="text-slate-800 leading-relaxed">{data.metodologiaHerramientas}</p>
              ) : (
                <p className="text-slate-400 italic">Sin herramientas técnicas registradas aún.</p>
              )}
            </div>
          </div>
        </div>

        {/* 4. Cuadro de Actividades Desarrolladas (Execution Matrix) */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              4. Cuadro de Actividades Desarrolladas
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={handleAddActivity}
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
              >
                <Plus className="w-3 h-3 mr-1 text-emerald-600" />
                Agregar Fila
              </button>
            )}
          </div>

          <p className="text-xs text-slate-600">
            Consolidado de las actividades mensuales presentadas y aprobadas durante el periodo contractual:
          </p>

          {(!data.cuadroActividades || data.cuadroActividades.length === 0) ? (
            <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg">
              No hay actividades registradas en el cuadro. {isEditing ? 'Haz clic en "Agregar Fila" para comenzar a ingresar actividades.' : 'Activa Modo Edición para redactar o pulsa Generar con IA.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="bg-slate-200 text-slate-900 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-2 border-b border-r border-slate-300 w-8 text-center">N°</th>
                    <th className="p-2 border-b border-r border-slate-300 min-w-[160px]">Actividades realizadas</th>
                    <th className="p-2 border-b border-r border-slate-300 w-20 text-center">Periodo</th>
                    <th className="p-2 border-b border-r border-slate-300 min-w-[120px]">Lugar</th>
                    <th className="p-2 border-b border-r border-slate-300 min-w-[100px]">Población</th>
                    <th className="p-2 border-b border-r border-slate-300 min-w-[130px]">Resultados</th>
                    <th className="p-2 border-b border-slate-300 min-w-[120px]">Evidencias</th>
                    {isEditing && <th className="p-2 border-b border-slate-300 w-8 text-center">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.cuadroActividades.map((act, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border-r border-slate-300 text-center font-bold text-slate-800">
                        {act.nro || idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-slate-800 leading-relaxed">
                        {isEditing ? (
                          <textarea
                            value={act.actividad}
                            onChange={(e) => handleUpdateActivity(idx, 'actividad', e.target.value)}
                            rows={3}
                            placeholder="Descripción de la actividad..."
                            className="w-full text-[10px] p-1 border border-slate-300 rounded"
                          />
                        ) : (
                          act.actividad
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-medium text-slate-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={act.periodo}
                            onChange={(e) => handleUpdateActivity(idx, 'periodo', e.target.value)}
                            placeholder="Mes 1"
                            className="w-full text-[10px] p-1 border border-slate-300 rounded text-center"
                          />
                        ) : (
                          act.periodo
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-slate-700">
                        {isEditing ? (
                          <textarea
                            value={act.lugar}
                            onChange={(e) => handleUpdateActivity(idx, 'lugar', e.target.value)}
                            rows={2}
                            placeholder="Lugar de ejecución..."
                            className="w-full text-[10px] p-1 border border-slate-300 rounded"
                          />
                        ) : (
                          act.lugar
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-slate-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={act.poblacion}
                            onChange={(e) => handleUpdateActivity(idx, 'poblacion', e.target.value)}
                            placeholder="Población..."
                            className="w-full text-[10px] p-1 border border-slate-300 rounded"
                          />
                        ) : (
                          act.poblacion
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-slate-700">
                        {isEditing ? (
                          <textarea
                            value={act.resultados}
                            onChange={(e) => handleUpdateActivity(idx, 'resultados', e.target.value)}
                            rows={2}
                            placeholder="Resultados obtenidos..."
                            className="w-full text-[10px] p-1 border border-slate-300 rounded"
                          />
                        ) : (
                          act.resultados
                        )}
                      </td>
                      <td className="p-2 border-slate-300 text-slate-700">
                        {isEditing ? (
                          <textarea
                            value={act.evidencias}
                            onChange={(e) => handleUpdateActivity(idx, 'evidencias', e.target.value)}
                            rows={2}
                            placeholder="Evidencias / Anexos..."
                            className="w-full text-[10px] p-1 border border-slate-300 rounded"
                          />
                        ) : (
                          act.evidencias
                        )}
                      </td>
                      {isEditing && (
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(idx)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 5. Productos Entregados */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              5. Productos Entregados
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={handleAddProduct}
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
              >
                <Plus className="w-3 h-3 mr-1 text-emerald-600" />
                Agregar Producto
              </button>
            )}
          </div>

          {(!data.productosEntregados || data.productosEntregados.length === 0) ? (
            <p className="text-xs text-slate-400 italic pl-2">
              Sin productos registrados aún. {isEditing ? 'Haz clic en "Agregar Producto" para registrar entregables.' : 'Activa Modo Edición o genera con IA.'}
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-800 pl-4 list-disc">
              {data.productosEntregados.map((prod, idx) => (
                <li key={idx} className="leading-relaxed">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={prod}
                        onChange={(e) => {
                          const updated = [...data.productosEntregados];
                          updated[idx] = e.target.value;
                          setData({ ...data, productosEntregados: updated });
                        }}
                        placeholder="Descripción del producto entregado..."
                        className="w-full p-1 border border-slate-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    prod
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 6. Resultados Alcanzados */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              6. Resultados Alcanzados
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={handleAddResultado}
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
              >
                <Plus className="w-3 h-3 mr-1 text-emerald-600" />
                Agregar Resultado
              </button>
            )}
          </div>

          {(!data.resultadosAlcanzados || data.resultadosAlcanzados.length === 0) ? (
            <p className="text-xs text-slate-400 italic pl-2">
              Sin resultados alcanzados registrados aún. {isEditing ? 'Haz clic en "Agregar Resultado" para ingresar logros.' : 'Activa Modo Edición o genera con IA.'}
            </p>
          ) : (
            <div className="space-y-2 text-xs text-justify text-slate-800 leading-relaxed">
              {data.resultadosAlcanzados.map((res, idx) => (
                <div key={idx} className="space-y-1">
                  {isEditing ? (
                    <div className="flex items-start gap-2">
                      <textarea
                        value={res}
                        onChange={(e) => {
                          const updated = [...data.resultadosAlcanzados];
                          updated[idx] = e.target.value;
                          setData({ ...data, resultadosAlcanzados: updated });
                        }}
                        rows={2}
                        placeholder="Descripción técnica del resultado o impacto alcanzado..."
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteResultado(idx)}
                        className="text-red-500 hover:text-red-700 p-1 mt-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p>{res}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Cumplimiento de la Meta del Plan de Desarrollo */}
        <div className="mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900 flex items-center justify-between">
            <span>7. Cumplimiento de la Meta del Plan de Desarrollo</span>
            {isEditing && <span className="text-[10px] text-amber-700 font-normal">Editable</span>}
          </h3>

          {isEditing ? (
            <textarea
              value={data.cumplimientoMeta}
              onChange={(e) => setData({ ...data, cumplimientoMeta: e.target.value })}
              rows={6}
              placeholder="Detalla cómo el contrato contribuyó al cumplimiento de las metas del plan de desarrollo municipal..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          ) : data.cumplimientoMeta ? (
            <div className="text-xs text-justify leading-relaxed whitespace-pre-line text-slate-800">
              {data.cumplimientoMeta}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Sin análisis de cumplimiento registrado aún. (Activa Modo Edición para redactar o pulsa Generar con IA).
            </p>
          )}
        </div>

        {/* 8. Análisis Técnico de los Resultados */}
        <div className="mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900 flex items-center justify-between">
            <span>8. Análisis Técnico de los Resultados</span>
            {isEditing && <span className="text-[10px] text-amber-700 font-normal">Editable</span>}
          </h3>

          {isEditing ? (
            <textarea
              value={data.analisisTecnico}
              onChange={(e) => setData({ ...data, analisisTecnico: e.target.value })}
              rows={6}
              placeholder="Análisis técnico, balance de indicadores y comparativo..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          ) : data.analisisTecnico ? (
            <div className="text-xs text-justify leading-relaxed whitespace-pre-line text-slate-800">
              {data.analisisTecnico}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Sin análisis técnico registrado aún.
            </p>
          )}
        </div>

        {/* 9. Impacto de la Ejecución Contractual */}
        <div className="mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900 flex items-center justify-between">
            <span>9. Impacto de la Ejecución Contractual</span>
            {isEditing && <span className="text-[10px] text-amber-700 font-normal">Editable</span>}
          </h3>

          {isEditing ? (
            <textarea
              value={data.impactoEjecucion}
              onChange={(e) => setData({ ...data, impactoEjecucion: e.target.value })}
              rows={4}
              placeholder="Impacto social, comunitario o administrativo generado por las actividades..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          ) : data.impactoEjecucion ? (
            <div className="text-xs text-justify leading-relaxed whitespace-pre-line text-slate-800">
              {data.impactoEjecucion}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Sin impacto registrado aún.
            </p>
          )}
        </div>

        {/* 10. Conclusiones */}
        <div className="mb-8 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900 flex items-center justify-between">
            <span>10. Conclusiones</span>
            {isEditing && <span className="text-[10px] text-amber-700 font-normal">Editable</span>}
          </h3>

          {isEditing ? (
            <textarea
              value={data.conclusiones}
              onChange={(e) => setData({ ...data, conclusiones: e.target.value })}
              rows={4}
              placeholder="Conclusiones principales del balance contractual..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900"
            />
          ) : data.conclusiones ? (
            <div className="text-xs text-justify leading-relaxed whitespace-pre-line text-slate-800">
              {data.conclusiones}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Sin conclusiones registradas aún.
            </p>
          )}
        </div>

        {/* 11. Recomendaciones */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded border-l-4 border-slate-900">
            <h3 className="text-xs font-bold text-slate-900 uppercase">
              11. Recomendaciones
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={handleAddRecomendacion}
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
              >
                <Plus className="w-3 h-3 mr-1 text-emerald-600" />
                Agregar Recomendación
              </button>
            )}
          </div>

          {(!data.recomendaciones || data.recomendaciones.length === 0) ? (
            <p className="text-xs text-slate-400 italic pl-2">
              Sin recomendaciones registradas aún. {isEditing ? 'Haz clic en "Agregar Recomendación" para registrar sugerencias.' : 'Activa Modo Edición o genera con IA.'}
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-800 pl-4 list-disc">
              {data.recomendaciones.map((rec, idx) => (
                <li key={idx} className="leading-relaxed">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <textarea
                        value={rec}
                        onChange={(e) => {
                          const updated = [...data.recomendaciones];
                          updated[idx] = e.target.value;
                          setData({ ...data, recomendaciones: updated });
                        }}
                        rows={2}
                        placeholder="Recomendación técnica para la continuidad institucional..."
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteRecomendacion(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    rec
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Firmas Institucionales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 pb-8 border-t border-slate-200">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold text-slate-600 mb-8">Elaborado por:</p>
            <div className="w-48 h-0.5 bg-slate-900 mx-auto"></div>
            <p className="text-xs font-bold text-slate-900 uppercase">{data.contratistaNombre}</p>
            <p className="text-[11px] text-slate-600">Contratista</p>
            <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1 flex-wrap">
              <span>C.C. {data.contratistaDocumento} de</span>
              {isEditing ? (
                <input
                  type="text"
                  value={data.contratistaLugarDoc || ''}
                  onChange={(e) => setData({ ...data, contratistaLugarDoc: e.target.value })}
                  placeholder="Lugar de expedición"
                  className="px-1.5 py-0.5 border border-slate-300 rounded text-xs font-semibold text-slate-900 w-36 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-amber-50/50"
                />
              ) : (
                <span className="font-semibold text-slate-900">{data.contratistaLugarDoc || user?.ciudad || 'Bogotá D.C'}</span>
              )}
            </p>
          </div>

          <div className="text-center space-y-2">
            <p className="text-xs font-semibold text-slate-600 mb-8">Aprobado por:</p>
            <div className="w-48 h-0.5 bg-slate-900 mx-auto"></div>
            <p className="text-xs font-bold text-slate-900 uppercase">{data.supervisorNombre}</p>
            <p className="text-[11px] text-slate-600">{data.supervisorCargo || data.dependencia}</p>
            <p className="text-[11px] text-slate-600">Supervisor(a) del Contrato</p>
          </div>
        </div>

        {/* 12. Anexos Fotográficos */}
        <div className="mt-12 pt-6 border-t-2 border-slate-300 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center">
              <ImageIcon className="w-4 h-4 mr-1.5 text-slate-700" />
              Anexos: Registros Fotográficos ({data.anexosFotograficos?.length || 0})
            </h3>
            <label className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adjuntar Foto
              <input
                type="file"
                accept="image/*"
                onChange={handleAddPhoto}
                className="hidden"
              />
            </label>
          </div>

          {(!data.anexosFotograficos || data.anexosFotograficos.length === 0) ? (
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              No hay fotografías registradas aún. Las fotos cargadas en los informes mensuales se consolidan aquí automáticamente o puede agregar nuevas arriba.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.anexosFotograficos.map((foto, idx) => (
                <div key={foto.id || idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 relative group">
                  <div className="aspect-[4/3] bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={foto.url}
                      alt={foto.descripcion || `Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-800">
                      {foto.descripcion || `Registro fotográfico ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {foto.periodo} {foto.fecha ? `• ${foto.fecha}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(foto.id)}
                    className="absolute top-4 right-4 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-700"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* AI Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Generar Informe Final con IA (Gemini)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Consolidará los informes mensuales aprobados y redactará todo el documento oficial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Verificación de Informes Mensuales */}
            {!hasReports ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                <div className="flex items-center font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 mr-1.5 text-rose-600 shrink-0" />
                  No hay informes mensuales registrados
                </div>
                <p>
                  Para que la Inteligencia Artificial pueda redactar y consolidar el Informe Final de Ejecución, es indispensable contar con al menos <strong>un (1) informe mensual</strong> registrado en el sistema.
                </p>
                <p className="text-[11px] text-rose-700">
                  Por favor registra primero tus informes mensuales en el Módulo de Informes de Actividades.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center justify-between">
                <span className="flex items-center font-medium">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-purple-600 shrink-0" />
                  Se consolidarán <strong>&nbsp;{approvedReports.length} informe(s) mensual(es)&nbsp;</strong> en estado Aprobado.
                </span>
                <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                  Listo para procesar
                </span>
              </div>
            )}

            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Contratista y Dependencia (Informativo) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <p><strong className="text-slate-700">Contratista:</strong> {data.contratistaNombre} (C.C. {data.contratistaDocumento})</p>
                <p><strong className="text-slate-700">Dependencia:</strong> {data.dependencia}</p>
                <p><strong className="text-slate-700">Supervisor:</strong> {data.supervisorNombre}</p>
              </div>

              {/* Información Contractual: Contrato Nº y Año */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1 text-purple-600" />
                    Información Contractual (Contrato Nº y Año): <span className="text-rose-500 ml-0.5">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Tomado automáticamente
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-600 bg-white">
                    <span className="bg-slate-100 text-slate-700 px-3 py-2 text-xs font-bold border-r border-slate-300 shrink-0">
                      Contrato Nº
                    </span>
                    <input
                      type="text"
                      value={contratoNumero}
                      onChange={(e) => updateContratoParts(e.target.value, contratoAno)}
                      placeholder="Ej. 025"
                      className="w-full p-2 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="w-32 sm:w-36 flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-600 bg-white">
                    <span className="bg-slate-100 text-slate-700 px-3 py-2 text-xs font-bold border-r border-slate-300 shrink-0">
                      DE
                    </span>
                    <input
                      type="text"
                      value={contratoAno}
                      onChange={(e) => updateContratoParts(contratoNumero, e.target.value)}
                      placeholder="2026"
                      className="w-full p-2 text-xs font-bold text-slate-900 text-center focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 bg-purple-50/70 px-2.5 py-1.5 rounded border border-purple-200">
                  <span>Identificación formal para el informe y Word:</span>
                  <strong className="text-purple-900 font-mono font-bold">
                    {contratoNumero ? `Contrato Nº ${contratoNumero} DE ${contratoAno || '2026'}` : `Contrato DE ${contratoAno || '2026'}`} ({contratoInput || (contratoNumero ? `CPS ${contratoNumero} de ${contratoAno || '2026'}` : `CPS de ${contratoAno || '2026'}`)})
                  </strong>
                </div>
              </div>

              {/* Indicador (Obligatorio) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center">
                    <Layers className="w-3.5 h-3.5 mr-1 text-purple-600" />
                    Indicador de Gestión / Producto: <span className="text-rose-500 ml-0.5">*</span>
                  </span>
                  {!indicadorInput.trim() && (
                    <span className="text-[10px] text-rose-600 font-normal">Requerido</span>
                  )}
                </label>
                <input
                  type="text"
                  value={indicadorInput}
                  onChange={(e) => {
                    setIndicadorInput(e.target.value);
                    setData(prev => ({ ...prev, indicador: e.target.value }));
                  }}
                  placeholder="Ej: Personas atendidas con servicios integrales."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                />
              </div>

              {/* Meta del Plan de Desarrollo (Obligatorio) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center">
                    <Target className="w-3.5 h-3.5 mr-1 text-purple-600" />
                    Metas del Plan de Acción / Desarrollo: <span className="text-rose-500 ml-0.5">*</span>
                  </span>
                  {!metaInput.trim() && (
                    <span className="text-[10px] text-rose-600 font-normal">Requerido</span>
                  )}
                </label>
                <textarea
                  value={metaInput}
                  onChange={(e) => {
                    setMetaInput(e.target.value);
                    setData(prev => ({ ...prev, metaPlanDesarrollo: e.target.value }));
                  }}
                  rows={3}
                  placeholder="Ej: META 158: Crear e implementar una ruta estratégica para la atención a población vulnerable..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                />
                <p className="text-[11px] text-slate-500">
                  Ingresa las metas institucionales del Plan de Acción a las cuales tributa tu contrato.
                </p>
              </div>

              {/* Campos complementarios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fecha con selector de calendario */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-purple-600" />
                      Fecha de Presentación:
                    </span>
                    {fechaInput && (
                      <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        {formatSpanishDate(fechaInput)}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={toIsoDate(fechaInput)}
                    onChange={(e) => {
                      const val = e.target.value;
                      const formatted = val ? formatSpanishDate(val) : '';
                      setFechaInput(formatted);
                      setData(prev => ({ ...prev, fechaPresentacion: formatted }));
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white cursor-pointer focus:ring-2 focus:ring-purple-600 focus:border-purple-600 shadow-sm"
                  />
                  <p className="text-[11px] text-slate-500">
                    Haz clic en el calendario para seleccionar la fecha de radicación.
                  </p>
                </div>

                {/* Zonas de intervención con explicación clara */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center">
                      <Building className="w-3.5 h-3.5 mr-1 text-purple-600" />
                      Zonas de Intervención:
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Territorio / Sedes)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={zonasInput}
                    onChange={(e) => {
                      setZonasInput(e.target.value);
                      setData(prev => ({ ...prev, metodologiaZonas: e.target.value }));
                    }}
                    placeholder="Ej: Sede Alcaldía y comunas de Quibdó"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 focus:border-purple-600"
                  />
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Lugar o territorio donde ejecutaste tus labores: sede administrativa, comunas, barrios o corregimientos del municipio.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>

              <button
                id="btn-confirmar-generacion-ia"
                type="button"
                onClick={handleTriggerAIGeneration}
                disabled={isGeneratingAI || !hasReports || !contratoInput.trim() || !indicadorInput.trim() || !metaInput.trim()}
                className="inline-flex items-center px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingAI ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Analizando y redactando con IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Iniciar Generación con IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Bloqueo por Validación de Exportación a Word */}
      {exportValidationErrors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-rose-700 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Exportación a Word Bloqueada
                </h3>
                <p className="text-xs text-rose-600 font-medium">
                  El informe debe estar completamente cumplido y diligenciado.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Para garantizar la validez legal y administrativa ante la supervisión de la Alcaldía de Quibdó, 
              no se permite descargar el formato oficial en Word mientras falten campos obligatorios:
            </p>

            <ul className="space-y-1.5 bg-rose-50/80 p-3.5 rounded-xl border border-rose-200 text-xs text-rose-950 max-h-48 overflow-y-auto">
              {exportValidationErrors.map((field, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>{field}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExportValidationErrors(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>

              {hasReports && (
                <button
                  type="button"
                  onClick={() => {
                    setExportValidationErrors(null);
                    setShowAiModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generar con IA
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setExportValidationErrors(null);
                  setIsEditing(true);
                }}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Completar en Edición
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sticky Bottom Action Bar during Edit Mode */}
      {isEditing && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center space-x-2 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">
              Modo Edición Activo
            </span>
          </div>

          <button
            id="btn-bottom-guardar-informe-final"
            type="button"
            onClick={handleSaveData}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-800" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isSaving ? 'Guardando...' : saveSuccess ? '¡Guardado!' : 'Guardar Avance'}
          </button>

          <button
            id="btn-bottom-finalizar-edicion"
            type="button"
            onClick={() => setIsEditing(false)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Vista Previa
          </button>
        </div>
      )}

      {/* Modal de confirmación para vaciar el Informe Final (reemplaza window.confirm) */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ¿Vaciar el contenido del informe?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Deseas vaciar todo el contenido del informe para comenzar desde cero con el formato en blanco.
                  Se conservarán los datos institucionales de tu contrato y perfil obtenidos de la base de datos.
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  handleResetToBlank();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                Sí, vaciar informe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InformeFinalDoc;
