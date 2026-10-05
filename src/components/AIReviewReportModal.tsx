import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  Calendar, 
  FileText, 
  Briefcase, 
  DollarSign, 
  Image as ImageIcon, 
  Check, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Send,
  BookOpen
} from 'lucide-react';
import { 
  ReportData, 
  AuthUser, 
  createDefaultCertificadoData, 
  createDefaultFiduciariaData,
  createDefaultDeclaracionRentaData,
  createDefaultAutorizacionDesembolsoData 
} from '../types';
import AIManualModal from './AIManualModal';
import { supabaseService } from '../services/supabaseService';
import { 
  AIReviewReportResult, 
  AIReviewCategory, 
  AIReviewItem, 
  reviewInformeMensualWithAI,
  reviewCertificadoSupervisionWithAI,
  reviewSoporteFiduciariaWithAI,
  reviewDeclaracionJuramentadaWithAI,
  reviewAutorizacionDesembolsoWithAI
} from '../services/aiReviewService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: ReportData;
  user: AuthUser;
  documentType?: 'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso';
  onApplyComment: (fieldId: string, fieldName: string, comentario: string) => Promise<void> | void;
  onApplyAllComments?: (comments: { fieldId: string; fieldName: string; comentario: string }[]) => Promise<void> | void;
}

export default function AIReviewReportModal({
  isOpen,
  onClose,
  report,
  user,
  documentType = 'informe',
  onApplyComment,
  onApplyAllComments
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<AIReviewReportResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [appliedComments, setAppliedComments] = useState<Record<string, boolean>>({});
  const [applyingBulk, setApplyingBulk] = useState<boolean>(false);
  const [showManual, setShowManual] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>('Iniciando auditoría técnica...');

  const runAudit = async () => {
    setLoading(true);
    setError(null);

    if (documentType === 'supervision') {
      setProgressStep('Verificando control financiero y sumatoria de pagos...');
    } else if (documentType === 'fiduciaria') {
      setProgressStep('Comprobando correspondencia de beneficiario, NIT/cédula y cuenta bancaria...');
    } else if (documentType === 'juramento') {
      setProgressStep('Verificando fecha, destinatario (Señores Alcaldía) y datos del contratista...');
    } else if (documentType === 'desembolso') {
      setProgressStep('Verificando fecha de expedición, consecutivo, nombre, NIT/C.C y cuenta...');
    } else {
      setProgressStep('Verificando fechas de vigencia y plazos...');
    }

    try {
      if (documentType === 'supervision') {
        const stepTimer1 = setTimeout(() => {
          setProgressStep('Validando aportes y planillas de seguridad social (Salud, Pensión, ARL)...');
        }, 900);

        const stepTimer2 = setTimeout(() => {
          setProgressStep('Revisando fechas de vigencia, prórrogas y certificación a satisfacción...');
        }, 1900);

        let certData = createDefaultCertificadoData(report);
        if (report?.id || (report?.contratistaDocumento && report?.informeNro)) {
          try {
            const savedCert = await supabaseService.getCertificadoSupervision(
              report.id,
              report.contratistaDocumento,
              report.informeNro
            );
            if (savedCert) {
              certData = {
                ...certData,
                ...savedCert,
                numeroCuenta: report?.numeroCuenta || savedCert.numeroCuenta || certData.numeroCuenta || '',
                banco: report?.banco || savedCert.banco || certData.banco || '',
                tipoCuenta: report?.tipoCuenta || savedCert.tipoCuenta || certData.tipoCuenta || 'AHORRO',
                fechaRegistroPresupuestal: report?.fechaRegistroPresupuestal || savedCert.fechaRegistroPresupuestal || certData.fechaRegistroPresupuestal || '',
                codigoRubro: report?.codigoRubro || savedCert.codigoRubro || certData.codigoRubro || '',
              };
            }
          } catch (fetchCertErr) {
            console.warn('[AI Review Modal] Error obteniendo certificado persistido, usando cálculo base:', fetchCertErr);
          }
        }
        const result = await reviewCertificadoSupervisionWithAI(certData, report, user);

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setReviewResult(result);
      } else if (documentType === 'fiduciaria') {
        const stepTimer1 = setTimeout(() => {
          setProgressStep('Auditando consistencia entre valores en números, letras y neto a desembolsar...');
        }, 900);

        const stepTimer2 = setTimeout(() => {
          setProgressStep('Comprobando descripción del bien o servicio y objeto contractual...');
        }, 1900);

        let fidData = createDefaultFiduciariaData(report);
        if (report?.id || (report?.contratistaDocumento && report?.informeNro)) {
          try {
            const savedFid = await supabaseService.getSoporteFiduciaria(
              report.id,
              report.contratistaDocumento,
              report.informeNro?.toString()
            );
            if (savedFid) {
              fidData = {
                ...fidData,
                ...savedFid,
              };
            }
          } catch (fetchFidErr) {
            console.warn('[AI Review Modal] Error obteniendo soporte fiduciario persistido:', fetchFidErr);
          }
        }
        const result = await reviewSoporteFiduciariaWithAI(fidData, report, user);

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setReviewResult(result);
      } else if (documentType === 'juramento') {
        const stepTimer1 = setTimeout(() => {
          setProgressStep('Validando correspondencia idéntica con el pie de firma (nombre, C.C. y lugar)...');
        }, 900);

        const stepTimer2 = setTimeout(() => {
          setProgressStep('Comprobando marcación obligatoria de la opción NO ( X )...');
        }, 1900);

        let decData = createDefaultDeclaracionRentaData(report);
        if (report?.id || (report?.contratistaDocumento && report?.informeNro)) {
          try {
            const savedDec = await supabaseService.getDeclaracionRenta(
              report.id,
              report.contratistaDocumento,
              report.informeNro?.toString()
            );
            if (savedDec) {
              decData = {
                ...decData,
                ...savedDec,
              };
            }
          } catch (fetchDecErr) {
            console.warn('[AI Review Modal] Error obteniendo declaración juramentada persistida:', fetchDecErr);
          }
        }
        const result = await reviewDeclaracionJuramentadaWithAI(decData, report, user);

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setReviewResult(result);
      } else if (documentType === 'desembolso') {
        const stepTimer1 = setTimeout(() => {
          setProgressStep('Auditando valores numéricos, subtotal, IVA asumido, total y valor en letras...');
        }, 900);

        const stepTimer2 = setTimeout(() => {
          setProgressStep('Validando objeto con período y dirección y teléfono al pie de firma...');
        }, 1900);

        let desData = createDefaultAutorizacionDesembolsoData(report);
        if (report?.id || (report?.contratistaDocumento && report?.informeNro)) {
          try {
            const savedDes = await supabaseService.getAutorizacionDesembolso(
              report.id,
              report.contratistaDocumento,
              report.informeNro?.toString()
            );
            if (savedDes) {
              desData = {
                ...desData,
                ...savedDes,
              };
            }
          } catch (fetchDesErr) {
            console.warn('[AI Review Modal] Error obteniendo autorización de desembolso persistida:', fetchDesErr);
          }
        }
        const result = await reviewAutorizacionDesembolsoWithAI(desData, report, user);

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setReviewResult(result);
      } else {
        const stepTimer1 = setTimeout(() => {
          setProgressStep('Auditando coherencia y calidad de actividades frente a obligaciones...');
        }, 900);

        const stepTimer2 = setTimeout(() => {
          setProgressStep('Validando consistencia financiera y anexos fotográficos por obligación...');
        }, 1900);

        const result = await reviewInformeMensualWithAI(report, user);

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setReviewResult(result);
      }
    } catch (err: any) {
      console.error('Error ejecutando auditoría:', err);
      setError(err?.message || 'Error inesperado al conectar con el servicio de IA de Google Gemini.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAppliedComments({});
      setActiveCategory('todos');
      runAudit();
    }
  }, [isOpen, report.id, report.informeNro, documentType]);

  if (!isOpen) return null;

  const handleApplySingle = async (item: AIReviewItem) => {
    const textToApply = item.comentarioSupervisorSugerido || item.mensaje;
    try {
      await onApplyComment(item.campoId, item.nombreCampo, textToApply);
      setAppliedComments(prev => ({ ...prev, [item.campoId]: true }));
    } catch (e) {
      console.error('Error aplicando comentario:', e);
    }
  };

  const handleApplyAll = async () => {
    if (!reviewResult) return;
    const itemsToApply = reviewResult.hallazgos.filter(
      h => (h.severidad === 'critico' || h.severidad === 'advertencia') && !appliedComments[h.campoId]
    );

    if (itemsToApply.length === 0) return;

    setApplyingBulk(true);
    try {
      if (onApplyAllComments) {
        const payload = itemsToApply.map(item => ({
          fieldId: item.campoId,
          fieldName: item.nombreCampo,
          comentario: item.comentarioSupervisorSugerido || item.mensaje
        }));
        await onApplyAllComments(payload);
      } else {
        for (const item of itemsToApply) {
          await onApplyComment(item.campoId, item.nombreCampo, item.comentarioSupervisorSugerido || item.mensaje);
        }
      }

      const newApplied: Record<string, boolean> = { ...appliedComments };
      itemsToApply.forEach(item => {
        newApplied[item.campoId] = true;
      });
      setAppliedComments(newApplied);
    } catch (e) {
      console.error('Error aplicando comentarios en lote:', e);
    } finally {
      setApplyingBulk(false);
    }
  };

  const hallazgos = reviewResult?.hallazgos || [];
  const criticos = hallazgos.filter(h => h.severidad === 'critico').length;
  const advertencias = hallazgos.filter(h => h.severidad === 'advertencia').length;
  const correctos = hallazgos.filter(h => h.severidad === 'correcto').length;

  const filteredHallazgos = hallazgos.filter(h => {
    if (activeCategory === 'todos') return true;
    if (activeCategory === 'observaciones') return h.severidad === 'critico' || h.severidad === 'advertencia';
    return h.categoria === activeCategory;
  });

  const getCategoryIcon = (cat: AIReviewCategory) => {
    switch (cat) {
      case 'fechas_periodos': return <Calendar size={13} className="text-blue-600" />;
      case 'datos_contrato': return <FileText size={13} className="text-purple-600" />;
      case 'actividades': return <Briefcase size={13} className="text-amber-600" />;
      case 'financiero': return <DollarSign size={13} className="text-emerald-600" />;
      case 'anexos_evidencias': return <ImageIcon size={13} className="text-indigo-600" />;
      case 'control_financiero': return <DollarSign size={13} className="text-emerald-600" />;
      case 'seguridad_social': return <ShieldCheck size={13} className="text-teal-600" />;
      case 'fechas_vigencia_prorrogas': return <Calendar size={13} className="text-blue-600" />;
      case 'certificacion_satisfaccion': return <CheckCircle2 size={13} className="text-emerald-600" />;
      case 'beneficiario_cuentas': return <Briefcase size={13} className="text-indigo-600" />;
      case 'consistencia_financiera': return <DollarSign size={13} className="text-emerald-600" />;
      case 'codigos_presupuestales': return <FileText size={13} className="text-purple-600" />;
      case 'declaracion_juramentada': return <ShieldCheck size={13} className="text-teal-600" />;
      case 'autorizacion_desembolso': return <CheckCircle2 size={13} className="text-emerald-600" />;
      default: return <Layers size={13} className="text-slate-600" />;
    }
  };

  const getCategoryLabel = (cat: AIReviewCategory) => {
    switch (cat) {
      case 'fechas_periodos': return 'Fechas y Períodos';
      case 'datos_contrato': return 'Datos del Contrato';
      case 'actividades': return 'Calidad de Actividades';
      case 'financiero': return 'Valores y Pagos';
      case 'anexos_evidencias': return 'Anexos por Obligación';
      case 'control_financiero': return 'Control Financiero';
      case 'seguridad_social': return 'Seguridad Social';
      case 'fechas_vigencia_prorrogas': return 'Fechas y Prórrogas';
      case 'certificacion_satisfaccion': return 'Certificación a Satisfacción';
      case 'beneficiario_cuentas': return 'Beneficiario y Cuentas';
      case 'consistencia_financiera': return 'Consistencia Financiera';
      case 'codigos_presupuestales': return 'Códigos Presupuestales';
      case 'declaracion_juramentada': return 'Declaración Juramentada';
      case 'autorizacion_desembolso': return 'Autorización y Desembolso';
      default: return 'General';
    }
  };

  const distinctCategories = Array.from(new Set(hallazgos.map(h => h.categoria)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Encabezado Institucional */}
        <div className="bg-gradient-to-r from-[#005226] via-[#006b33] to-[#0b8043] px-5 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] uppercase font-black tracking-widest text-emerald-200">
                  Alcaldía Municipal de Quibdó
                </span>
                <span className="text-[10px] px-2 py-0.2 bg-white/20 rounded-full font-bold">
                  Motor de IA Gemini
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                {documentType === 'supervision' 
                  ? 'Auditoría y Revisión Inteligente del Certificado de Supervisión'
                  : documentType === 'fiduciaria'
                  ? 'Auditoría y Revisión Inteligente del Soporte Fiduciaria / Pagos'
                  : documentType === 'juramento'
                  ? 'Auditoría y Revisión Inteligente de la Declaración Bajo Juramento'
                  : documentType === 'desembolso'
                  ? 'Auditoría y Revisión Inteligente de la Autorización de Desembolso'
                  : 'Auditoría y Revisión Inteligente del Informe Mensual'
                }
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all border border-white/30 cursor-pointer shadow-xs"
              title="Consultar el Manual y Criterios de Auditoría IA"
            >
              <BookOpen size={13} className="text-amber-300" />
              <span>Manual IA</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Cerrar modal de revisión"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de metadatos del informe analizado */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="font-semibold text-slate-500">Contrato:</span>{' '}
              <span className="font-mono font-bold text-slate-900">CPS #{report.contratoNro || 'S/N'}</span>
            </div>
            <div className="h-3 w-px bg-slate-300 hidden sm:block"></div>
            <div>
              <span className="font-semibold text-slate-500">Contratista:</span>{' '}
              <span className="font-bold text-slate-900 uppercase">{report.contratistaNombre || 'Contratista'}</span>
            </div>
            <div className="h-3 w-px bg-slate-300 hidden sm:block"></div>
            <div>
              <span className="font-semibold text-slate-500">Informe:</span>{' '}
              <span className="font-bold text-emerald-800">
                {report.tipoInforme || 'Mensual'} Nro. {report.informeNro || '1'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Período:</span>
            <span className="px-2 py-0.5 bg-slate-200/80 rounded font-mono text-[11px] font-bold text-slate-800">
              {report.periodoDesde || 'Inicio'} al {report.periodoHasta || 'Fin'}
            </span>
          </div>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {loading && (
            <div className="py-16 text-center space-y-4">
              <div className="inline-flex p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-700 shadow-sm animate-bounce">
                <Sparkles size={32} className="text-[#006b33] animate-spin" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Ejecutando Auditoría Integral con IA
                </h3>
                <p className="text-xs text-slate-500">
                  {progressStep}
                </p>
              </div>
              <div className="w-56 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-[#006b33] rounded-full animate-pulse w-3/4"></div>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 sm:p-5 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-950">Aviso durante la auditoría con IA</h4>
                  <p className="text-xs text-red-800 mt-0.5 leading-relaxed">{error}</p>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={runAudit}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw size={13} />
                  <span>Reintentar Auditoría</span>
                </button>
              </div>
            </div>
          )}

          {!loading && reviewResult && (
            <>
              {/* Tarjeta de Resumen Ejecutivo y Puntuación */}
              <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                reviewResult.estadoGeneral === 'aprobado'
                  ? 'bg-emerald-50/90 border-emerald-200'
                  : reviewResult.estadoGeneral === 'con_observaciones'
                  ? 'bg-amber-50/90 border-amber-200'
                  : 'bg-red-50/90 border-red-200'
              }`}>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                      reviewResult.estadoGeneral === 'aprobado'
                        ? 'bg-emerald-600 text-white'
                        : reviewResult.estadoGeneral === 'con_observaciones'
                        ? 'bg-amber-500 text-white'
                        : 'bg-red-600 text-white'
                    }`}>
                      {reviewResult.estadoGeneral === 'aprobado' ? '✅ Aprobado sin Inconsistencias' : reviewResult.estadoGeneral === 'con_observaciones' ? '⚠️ Con Observaciones Menores' : '❌ Requiere Subsanación Crítica'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Auditado con {reviewResult.modeloUtilizado} • {reviewResult.fechaRevision}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    {reviewResult.resumenEjecutivo}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-center sm:self-auto">
                  <div className="text-center px-4 py-2 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <div className={`text-2xl sm:text-3xl font-black ${
                      reviewResult.puntuacion >= 90 ? 'text-emerald-700' : reviewResult.puntuacion >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {reviewResult.puntuacion}<span className="text-sm font-normal text-slate-400">/100</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Calidad y Cumplimiento
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Maestro para Aplicar Todas las Observaciones */}
              {(criticos > 0 || advertencias > 0) && (
                <div className="p-3 bg-amber-100/70 border border-amber-300/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                    <span>
                      Se detectaron <strong>{criticos} inconsistencias críticas</strong> y <strong>{advertencias} observaciones</strong> que deben ser corregidas por el contratista.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyAll}
                    disabled={applyingBulk}
                    className="px-3.5 py-1.5 bg-[#006b33] hover:bg-[#005226] active:bg-[#00401d] text-white rounded-lg font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {applyingBulk ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span>Aplicar Todas las Observaciones al Informe</span>
                  </button>
                </div>
              )}

              {/* Barra de Filtros por Categoría */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategory('todos')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                    activeCategory === 'todos'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todos los Hallazgos ({hallazgos.length})
                </button>

                {(criticos > 0 || advertencias > 0) && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('observaciones')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1 ${
                      activeCategory === 'observaciones'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <span>Observaciones Activas ({criticos + advertencias})</span>
                  </button>
                )}

                {distinctCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {getCategoryIcon(cat)}
                    <span>{getCategoryLabel(cat)}</span>
                  </button>
                ))}
              </div>

              {/* Lista Detallada de Hallazgos */}
              <div className="space-y-3">
                {filteredHallazgos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No se encontraron hallazgos en esta categoría.
                  </div>
                ) : (
                  filteredHallazgos.map((item, idx) => {
                    const isApplied = Boolean(appliedComments[item.campoId]);
                    const isCritical = item.severidad === 'critico';
                    const isWarning = item.severidad === 'advertencia';

                    return (
                      <div 
                        key={`${item.campoId}_${idx}`}
                        className={`p-4 rounded-xl border transition-all ${
                          isCritical
                            ? 'bg-red-50/60 border-red-200'
                            : isWarning
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-emerald-50/40 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 shrink-0">
                              {isCritical ? (
                                <AlertCircle size={18} className="text-red-600" />
                              ) : isWarning ? (
                                <AlertTriangle size={18} className="text-amber-600" />
                              ) : (
                                <CheckCircle2 size={18} className="text-emerald-600" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900">
                                  {item.nombreCampo}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 flex items-center gap-1">
                                  {getCategoryIcon(item.categoria)}
                                  <span>{getCategoryLabel(item.categoria)}</span>
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCritical 
                                    ? 'bg-red-200 text-red-950 border border-red-300' 
                                    : isWarning 
                                    ? 'bg-amber-200 text-amber-950 border border-amber-300' 
                                    : 'bg-emerald-200 text-emerald-950 border border-emerald-300'
                                }`}>
                                  {isCritical ? 'Inconsistencia Crítica' : isWarning ? 'Observación de Mejora' : 'Conforme / Correcto'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 leading-relaxed">
                                {item.mensaje}
                              </p>

                              {item.sugerencia && (
                                <div className="mt-2 text-xs bg-white/80 p-2.5 rounded-lg border border-slate-200/80 text-slate-800 space-y-1">
                                  <div className="font-bold text-[11px] text-slate-600 flex items-center gap-1">
                                    <ArrowRight size={11} className="text-emerald-700" />
                                    <span>Criterio técnico de corrección:</span>
                                  </div>
                                  <p className="text-slate-700 italic">
                                    "{item.sugerencia}"
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Botón de acción para aplicar comentario individual si es observación */}
                          {(isCritical || isWarning) && (
                            <div className="shrink-0">
                              {isApplied ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold">
                                  <Check size={13} className="text-emerald-700" />
                                  <span>Aplicado</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleApplySingle(item)}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                  title="Insertar esta observación directamente en la casilla del informe"
                                >
                                  <span>Dejar Observación</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Recomendaciones Institucionales del Supervisor */}
              {reviewResult.conclusiones && reviewResult.conclusiones.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-800">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#006b33]" />
                    <span>Conclusiones de la Supervisión Contractual (Municipio de Quibdó)</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    {reviewResult.conclusiones.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

        </div>

        {/* Pie del Modal */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Supervisor(a):</span>
            <span className="font-bold text-slate-800 uppercase">{user.nombreCompleto || 'Supervisor'}</span>
          </div>

          <div className="flex items-center gap-2">
            {!loading && (
              <button
                type="button"
                onClick={runAudit}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw size={13} />
                <span>Volver a Auditar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors shadow-xs"
            >
              Cerrar Auditoría
            </button>
          </div>
        </div>

      </div>

      {showManual && (
        <AIManualModal
          isOpen={showManual}
          onClose={() => setShowManual(false)}
          documentType={documentType}
        />
      )}
    </div>
  );
}
