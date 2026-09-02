import React, { useState, useEffect, useRef } from 'react';
import { DeclaracionRentaData, ReportData, createDefaultDeclaracionRentaData, FieldComment } from '../types';
import { supabaseService } from '../services/supabaseService';
import FieldCommentModal from './FieldCommentModal';
import { Printer, Save, Check, Edit3, Sparkles, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DeclaracionRentaDocProps {
  key?: React.Key;
  data?: DeclaracionRentaData;
  reportData?: ReportData;
  onChange?: (updated: DeclaracionRentaData) => void;
  onSave?: (saved: DeclaracionRentaData) => void;
  storageKey?: string;
  isEditable?: boolean;
  hideGuide?: boolean;
  isReviewMode?: boolean;
  onSaveComment?: (fieldId: string, fieldName: string, comentario: string) => void;
  onDeleteComment?: (fieldId: string) => void;
  authorName?: string;
}

const normalizeSenores = (val: string | undefined): string => {
  if (!val || !val.trim()) return 'Señores\nALCALDIA\nCiudad.';
  const trimmed = val.trim();
  if (!trimmed.toLowerCase().includes('señor') && !trimmed.toLowerCase().includes('senor')) {
    return `Señores\n${trimmed}`;
  }
  return trimmed;
};

export default function DeclaracionRentaDoc({
  data,
  reportData,
  onChange,
  onSave,
  storageKey,
  isEditable = true,
  hideGuide = false,
  isReviewMode = false,
  onSaveComment,
  onDeleteComment,
  authorName = 'Supervisora'
}: DeclaracionRentaDocProps) {
  const [commentModalState, setCommentModalState] = useState<{
    isOpen: boolean;
    fieldId: string;
    fieldName: string;
    fieldValuePreview?: string;
  }>({ isOpen: false, fieldId: '', fieldName: '' });

  const openCommentModal = (fieldId: string, fieldName: string, val?: string) => {
    if (isReviewMode && onSaveComment) {
      setCommentModalState({
        isOpen: true,
        fieldId,
        fieldName,
        fieldValuePreview: val
      });
    }
  };

  const getIdentityKey = () => {
    if (data?.id) return `data_${data.id}`;
    if (reportData) return `rep_${reportData.id || ''}_${reportData.informeNro || ''}_${storageKey || ''}`;
    return 'default';
  };

  const loadedKeyRef = useRef<string>('');
  const [formData, setFormData] = useState<DeclaracionRentaData>(() => {
    let initial: DeclaracionRentaData;
    if (data) initial = data;
    else if (reportData) initial = createDefaultDeclaracionRentaData(reportData);
    else initial = createDefaultDeclaracionRentaData();
    return {
      ...initial,
      senores: normalizeSenores(initial.senores)
    };
  });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    const currentKey = getIdentityKey();
    if (loadedKeyRef.current === currentKey && !data) {
      return;
    }
    loadedKeyRef.current = currentKey;
    setHasChanges(false);

    const loadData = async () => {
      let baseData: DeclaracionRentaData | null = null;
      if (data) {
        baseData = data;
      } else if (reportData) {
        const savedDB = await supabaseService.getDeclaracionRenta(
          reportData.id,
          reportData.contratistaDocumento,
          reportData.informeNro?.toString()
        );
        if (savedDB) {
          baseData = savedDB as DeclaracionRentaData;
        } else {
          const key = storageKey || `dec_renta_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            try { baseData = JSON.parse(saved); } catch (e) { baseData = createDefaultDeclaracionRentaData(reportData); }
          } else {
            baseData = createDefaultDeclaracionRentaData(reportData);
          }
        }
      } else {
        return;
      }

      if (loadedKeyRef.current === currentKey) {
        setFormData({
          ...baseData,
          senores: normalizeSenores(baseData.senores),
          reportId: reportData?.id || baseData.reportId,
          fecha: reportData ? createDefaultDeclaracionRentaData(reportData).fecha : baseData.fecha,
        });
      }
    };
    loadData();
  }, [data, reportData?.id, reportData?.informeNro, reportData?.periodoHasta, reportData?.fechaPresentacion, storageKey]);

  const handleFieldChange = (field: keyof DeclaracionRentaData, value: string | boolean) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setHasChanges(true);
    if (onChange) {
      onChange(updated);
    }
  };

  const jurComment = reportData?.comentariosCampos?.['declaracion_juramento'] || 
    Object.values(reportData?.comentariosCampos || {}).find((c: any) => 
      c.campoId === 'declaracion_juramento' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('declaración')) || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('juramento'))
    );

  const handleMarkCommentAsFixed = async () => {
    if (!reportData) return;
    const currentComments = { ...(reportData.comentariosCampos || {}) };
    const targetKey = Object.keys(currentComments).find(k => 
      k === 'declaracion_juramento' || 
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('declaración')) ||
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('juramento'))
    ) || 'declaracion_juramento';

    if (currentComments[targetKey]) {
      currentComments[targetKey] = {
        ...currentComments[targetKey],
        corregido: true
      };
    }

    // Guardar en Supabase
    await supabaseService.saveReportComments(
      reportData.id || '', 
      reportData.informeNro, 
      reportData.contratistaDocumento || '', 
      currentComments, 
      reportData.estado || 'Devuelto'
    );
    
    // Guardar en LocalStorage
    const userDocKey = reportData.contratistaDocumento ? `_${reportData.contratistaDocumento}` : '';
    const storageKeyInforme = `informe_data${userDocKey}_${reportData.informeNro}`;
    const rawInforme = localStorage.getItem(storageKeyInforme);
    if (rawInforme) {
      try {
        const parsed = JSON.parse(rawInforme);
        parsed.comentariosCampos = currentComments;
        localStorage.setItem(storageKeyInforme, JSON.stringify(parsed));
      } catch (e) {}
    }

    const notifKey = `notified_obs_${reportData.contratistaDocumento || ''}_${reportData.informeNro || ''}_${targetKey}`;
    localStorage.setItem(notifKey, 'seen');

    window.dispatchEvent(new CustomEvent('informe_comments_updated'));
    window.dispatchEvent(new CustomEvent('notificaciones_actualizadas'));
  };

  const handleSave = async () => {
    const key = storageKey || (reportData ? `dec_renta_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}` : 'dec_renta_global');
    localStorage.setItem(key, JSON.stringify(formData));
    
    await supabaseService.saveDeclaracionRenta(
      reportData?.id || '',
      formData,
      formData.cedula,
      reportData?.informeNro?.toString() || '1'
    );

    if (jurComment && !jurComment.corregido) {
      await handleMarkCommentAsFixed();
    }

    if (onSave) {
      onSave(formData);
    }
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const processCloneInputsAndTextareas = (cloneEl: HTMLElement) => {
    cloneEl.querySelectorAll('input, textarea').forEach(el => {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
      const val = inputEl.value || '';
      
      if (inputEl.type === 'radio' || inputEl.type === 'checkbox') {
         // handled separately or let it be if it renders okay, but checkboxes might not render.
         // Actually, let's just leave it if it's text, otherwise replace.
         if (inputEl.type === 'checkbox' || inputEl.type === 'radio') return;
      }
      
      const div = document.createElement('div');
      div.textContent = val;
      div.className = el.className.replace(/bg-amber-50/g, '');
      div.style.cssText = `
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        box-shadow: none;
        color: #000000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: ${window.getComputedStyle(el).fontSize};
        font-weight: ${window.getComputedStyle(el).fontWeight};
        padding: 0;
        margin: 0;
        line-height: 1.2;
        text-align: ${window.getComputedStyle(el).textAlign};
      `;
      if (el.tagName.toLowerCase() === 'textarea') {
         div.style.whiteSpace = 'pre-wrap';
      }
      el.parentNode?.replaceChild(div, el);
    });
  };

  const handleDirectPrint = () => {
    const element = document.getElementById('declaracion-renta-document');
    if (!element) {
      window.print();
      return;
    }
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');
      const clone = element.cloneNode(true) as HTMLElement;
      processCloneInputsAndTextareas(clone);
      clone.style.width = '21.59cm';
      clone.style.minHeight = 'auto';
      clone.style.transform = 'none';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.classList.remove('scale-[0.85]', 'sm:scale-100');
      
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <title>Certificado Bajo Juramento Alcaldia</title>
            ${styles}
            <style>
              @page {
                size: letter;
                margin: 0;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                margin: 0 !important;
                padding: 10mm !important;
                font-family: Arial, sans-serif;
              }
              .bg-amber-50 {
                background-color: transparent !important;
              }
              .border-b {
                border-bottom: 1px solid transparent !important;
              }
              input, textarea {
                border: none !important;
                background: transparent !important;
              }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
            <script>
              window.onload = () => {
                setTimeout(() => {
                  const oldTitle = window.parent.document.title;
                  window.parent.document.title = "Certificado Bajo Juramento Alcaldia";
                  window.print();
                  window.parent.document.title = oldTitle;
                  setTimeout(() => {
                    window.parent.document.body.removeChild(window.frameElement);
                  }, 500);
                }, 200);
              };
            </script>
          </body>
        </html>
      `);
      doc.close();
    } catch (e) {
      console.error("Error al imprimir", e);
      window.print();
    }
  };

  
  return (
    <div className="w-full max-w-[21.59cm] flex flex-col gap-3 mx-auto pb-10 font-sans">
      {/* PANEL DE ACCIONES */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#006b33]"></span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide font-sans">
            Declaración de Renta y Retención en la Fuente
          </span>
          <span className="text-[11px] font-mono bg-emerald-100 text-[#006b33] font-bold px-2 py-0.5 rounded border border-emerald-300">
            Ley 1819 de 2016
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditable && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isEditing 
                    ? 'bg-amber-400 text-gray-950 hover:bg-amber-300 shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
                <span>{isEditing ? 'Modo Visualización' : 'Llenar / Editar Campos'}</span>
              </button>
              
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !hasChanges
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                    : saveSuccess 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                }`}
                title={!hasChanges ? 'Sin cambios pendientes para guardar' : 'Guardar modificaciones en la base de datos'}
              >
                {saveSuccess ? <Check size={14} /> : <Save size={14} />}
                <span>{saveSuccess ? '¡Guardado con Éxito!' : 'Guardar Datos'}</span>
              </button>
            </>
          )}

          <button
            onClick={handleDirectPrint}
            className="p-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs shadow-xs"
            title="Imprimir Copia Oficial"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Guía Paso a Paso para Edición de Campos */}
      {!hideGuide && (
        <div className="w-full bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/60 border border-emerald-200 rounded-xl p-3 text-slate-700 shadow-xs print:hidden">
          <div className="flex items-start gap-2.5">
            <div className="bg-[#006b33] text-white p-1 rounded-md mt-0.5 shrink-0 shadow-xs">
              <Sparkles size={14} />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-950">
                  Guía para Diligenciar y Editar la Declaración Bajo Juramento:
                </span>
                <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {isEditing ? 'Modo Edición Activado' : 'Modo Lectura'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-snug">
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">1. Habilitar Edición:</span>
                  Haga clic en <strong className="text-amber-900 bg-amber-100 px-1 py-0.5 rounded">«Llenar / Editar Campos»</strong> para desbloquear las opciones y firmas.
                </div>
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">2. Seleccionar Opciones:</span>
                  Marque las casillas SI/NO de vinculación de trabajadores, deducción de dependientes o medicina prepagada.
                </div>
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">3. Guardar e Imprimir:</span>
                  Presione <strong className="text-emerald-900 bg-emerald-200 px-1 py-0.5 rounded">«Guardar Datos»</strong> para guardar su selección y luego <strong className="text-slate-900 bg-slate-200 px-1 py-0.5 rounded">«Imprimir»</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER OBSERVACIONES PARA EL CONTRATISTA (PENDIENTE DE CORREGIR) */}
      {!isReviewMode && jurComment && !jurComment.corregido && (
        <div className="w-full mb-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[10.5px] uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                  Observación de Supervisión (Pendiente)
                </span>
                <span className="text-[10.5px] text-amber-800 font-semibold">
                  {jurComment.fecha || 'Reciente'} • {jurComment.autor || 'Supervisora'}
                </span>
              </div>
              <p className="text-xs font-bold text-amber-950 mt-1">
                "{jurComment.comentario}"
              </p>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Modifique los datos requeridos y presione <strong>"Guardar Datos"</strong> o <strong>"Marcar como Subsanado"</strong> para enviar la corrección.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMarkCommentAsFixed}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span>Marcar como Subsanado</span>
          </button>
        </div>
      )}

      {/* BANNER OBSERVACIONES PARA EL CONTRATISTA (CORRECCIÓN REALIZADA / SUBSANADA) */}
      {!isReviewMode && jurComment && jurComment.corregido && (
        <div className="w-full mb-3 p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm print:hidden">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[10.5px] uppercase bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                  🟢 Subsanación Realizada
                </span>
                <span className="text-[10.5px] text-emerald-800 font-semibold">
                  Enviado a revisión de supervisión
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-900 mt-1">
                Has corregido la observación: <span className="italic font-bold">"{jurComment.comentario}"</span>. Tu documento actualizado está registrado y en espera de validación final por la supervisora.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold shrink-0">
            En espera de aval
          </span>
        </div>
      )}

      {/* BANNER MODO REVISIÓN ADMINISTRADORA / SUPERVISORA */}
      {isReviewMode && (
        jurComment ? (
          jurComment.corregido ? (
            <div className="w-full mb-3 p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm print:hidden">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10.5px] uppercase bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                      🟢 Corrección Realizada por el Contratista
                    </span>
                    <span className="text-[10.5px] text-emerald-800 font-semibold">
                      Listo para Validar
                    </span>
                  </div>
                  <p className="text-xs font-bold text-emerald-950 mt-1">
                    Observación atendida: "{jurComment.comentario}"
                  </p>
                  <p className="text-[11px] text-emerald-900 mt-0.5">
                    El contratista ha modificado y marcado como subsanada esta declaración. Verifique los datos y presione <strong>"Validar y Quitar Observación"</strong> si es conforme.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteComment) {
                      onDeleteComment('declaracion_juramento');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Validar y Quitar Observación</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCommentModal('declaracion_juramento', 'Declaración Juramento', 'Declaración Bajo Juramento')}
                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors"
                  title="Editar observación"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full mb-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10.5px] uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                      ⚠️ Observación Activa (Pendiente de Corrección)
                    </span>
                    <span className="text-[10.5px] text-amber-800 font-semibold">
                      {jurComment.fecha || 'Reciente'} • {jurComment.autor || 'Supervisora'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-950 mt-1">
                    "{jurComment.comentario}"
                  </p>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    El contratista aún <strong>NO</strong> ha modificado ni marcado como subsanado este documento.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openCommentModal('declaracion_juramento', 'Declaración Juramento', 'Declaración Bajo Juramento')}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Editar Observación</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="w-full mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-xs print:hidden">
            <div className="flex items-center gap-2 font-bold">
              <MessageSquare size={16} className="text-amber-700" />
              <span>Modo Revisión: Haga clic en el botón para dejar observaciones y comentarios sobre esta declaración bajo juramento.</span>
            </div>
            <button
              type="button"
              onClick={() => openCommentModal('declaracion_juramento', 'Declaración Juramento', 'Declaración Bajo Juramento')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
            >
              <MessageSquare size={13} />
              <span>Comentar Juramento</span>
            </button>
          </div>
        )
      )}

      {/* MODAL DE COMENTARIOS */}
      <FieldCommentModal
        isOpen={commentModalState.isOpen}
        fieldId={commentModalState.fieldId}
        fieldName={commentModalState.fieldName}
        fieldValuePreview={commentModalState.fieldValuePreview}
        initialComment={reportData?.comentariosCampos?.[commentModalState.fieldId]}
        authorName={authorName}
        onSave={(fId, fName, comm) => {
          if (onSaveComment) onSaveComment(fId, fName, comm);
        }}
        onDelete={(fId) => {
          if (onDeleteComment) onDeleteComment(fId);
        }}
        onClose={() => setCommentModalState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* DOCUMENT PAGE */}
      <div className="w-full max-w-full overflow-x-auto pb-4 flex justify-start sm:justify-center">
        <div 
          id="declaracion-renta-document"
          className="bg-white shadow-xl origin-top transition-transform duration-300 shrink-0"
          style={{
            width: '21.59cm',
            minHeight: '27.94cm', // Letter size
            padding: '2.54cm', // 1 inch margins approx
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            position: 'relative'
          }}
        >
        <div className="text-[14px] leading-relaxed relative">
          
          <div className="mb-6">
            {isEditing ? (
              <input
                type="text"
                value={formData.fecha}
                onChange={(e) => handleFieldChange('fecha', e.target.value)}
                className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 w-2/3"
                placeholder="Quibdó, 14 de julio de 2026"
              />
            ) : (
              <div>{formData.fecha}</div>
            )}
          </div>

          <div className="mb-6">
            {isEditing ? (
              <textarea
                value={formData.senores}
                onChange={(e) => handleFieldChange('senores', e.target.value)}
                className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 w-1/2 resize-none"
                rows={3}
                placeholder="Señores&#10;ALCALDIA&#10;Ciudad."
              />
            ) : (
              <div className="whitespace-pre-wrap">
                {normalizeSenores(formData.senores).split('\n').map((line, idx) => (
                  <div key={idx} className={line.toUpperCase().includes('ALCALD') ? 'font-bold' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6 font-bold uppercase">
            REF: CERTIFICACIÓN PARA EFECTOS DE RETENCIÓN EN LA FUENTE LEY 1819 DE 2016- RENTAS DE TRABAJO.
          </div>

          <div className="mb-6 font-bold uppercase text-center">
            CERTIFICACIÓN BAJO LA GRAVEDAD DE JURAMENTO
          </div>

          <div className="mb-6 text-justify">
            Yo, {isEditing ? (
              <input
                type="text"
                value={formData.nombresApellidos}
                onChange={(e) => handleFieldChange('nombresApellidos', e.target.value)}
                className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-bold uppercase w-64 inline-block text-center"
              />
            ) : (
              <strong className="uppercase">{formData.nombresApellidos}</strong>
            )}, identificada con cedula de ciudadanía No. {isEditing ? (
              <input
                type="text"
                value={formData.cedula}
                onChange={(e) => handleFieldChange('cedula', e.target.value)}
                className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-bold w-24 inline-block text-center"
              />
            ) : (
              <strong>{formData.cedula}</strong>
            )} expedida en {isEditing ? (
              <input
                type="text"
                value={formData.expedicionCedula}
                onChange={(e) => handleFieldChange('expedicionCedula', e.target.value)}
                className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-bold w-32 inline-block text-center"
              />
            ) : (
              <strong>{formData.expedicionCedula}</strong>
            )}, con el fin de dar cumplimiento a las disposiciones establecidas en la ley 1819 de 2016 
            y del parágrafo 2 del artículo 383 del Estatuto Tributario, manifiesto bajo gravedad de juramento 
            que:
          </div>

          <div className="mb-6 text-justify">
            Para efectos de la aplicación de la tabla de retención en la fuente establecida en el artículo 383 del 
            Estatuto tributario, la cual se le aplica a los pagos o abonos en cuenta por concepto de Ingresos por 
            honorarios y por compensación por servicios personales. . <strong>(Parágrafo 2 ART 383 E.T)</strong>.
          </div>

          <div className="flex flex-row justify-between mb-6 pl-12 pr-48 font-bold">
            <div className="flex items-center cursor-pointer" onClick={() => isEditing && handleFieldChange('aplicaRetencion', true)}>
              <span>SI ( </span>
              <span className="w-4 text-center inline-block">{formData.aplicaRetencion ? 'X' : '\u00A0'}</span>
              <span> )</span>
            </div>
            <div className="flex items-center cursor-pointer" onClick={() => isEditing && handleFieldChange('aplicaRetencion', false)}>
              <span>NO ( </span>
              <span className="w-4 text-center inline-block">{!formData.aplicaRetencion ? 'X' : '\u00A0'}</span>
              <span> )</span>
            </div>
          </div>

          <div className="mb-6 text-justify">
            De la misma manera, en el momento en que contrate o vincule más de un trabajador asociado a 
            mi actividad económica, me comprometo a informar.
          </div>

          <div className="mb-6">
            Cordialmente,
          </div>

          <div className="mt-12 print:break-inside-avoid">
            {/* Firma */}
            <div className="w-[300px]">
              <div className="border-b-[1px] border-black mb-1 w-full h-10"></div>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={formData.firmaNombre}
                    onChange={(e) => handleFieldChange('firmaNombre', e.target.value)}
                    className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-bold uppercase w-full block mb-1"
                  />
                  <div className="flex flex-row items-center whitespace-nowrap">
                    <span>C.C. </span>
                    <input
                      type="text"
                      value={formData.firmaCedula}
                      onChange={(e) => handleFieldChange('firmaCedula', e.target.value)}
                      className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-bold w-24 mx-1 text-center"
                    />
                    <span> de </span>
                    <input
                      type="text"
                      value={formData.firmaExpedicion}
                      onChange={(e) => handleFieldChange('firmaExpedicion', e.target.value)}
                      className="bg-amber-50 outline-none border-b border-transparent hover:border-slate-300 focus:border-emerald-500 w-32 ml-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold uppercase mb-1">{formData.firmaNombre}</div>
                  <div>C.C. {formData.firmaCedula} de {formData.firmaExpedicion}</div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
);
}
