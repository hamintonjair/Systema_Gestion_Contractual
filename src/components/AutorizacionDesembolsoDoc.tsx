import React, { useState, useEffect, useRef } from 'react';
import { AutorizacionDesembolsoData, ReportData, createDefaultAutorizacionDesembolsoData, FieldComment } from '../types';
import { obtenerValoresMonetariosReporte, convertirNumeroALetras, formatearObjetoConPeriodo, formatFechaAnioMesDia } from '../utils/numberToWords';
import { limpiarNumeroMoneda } from '../utils/paymentPlanUtils';
import { supabaseService } from '../services/supabaseService';
import FieldCommentModal from './FieldCommentModal';
import { Printer, Save, Check, Edit3, Sparkles, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import QuibdoLogo from './QuibdoLogo';

interface Props {
  key?: React.Key;
  data?: AutorizacionDesembolsoData;
  reportData?: ReportData;
  onChange?: (updated: AutorizacionDesembolsoData) => void;
  onSave?: (saved: AutorizacionDesembolsoData) => void;
  isEditable?: boolean;
  onPrint?: () => void;
  storageKey?: string;
  hideGuide?: boolean;
  isReviewMode?: boolean;
  onSaveComment?: (fieldId: string, fieldName: string, comentario: string) => void;
  onDeleteComment?: (fieldId: string) => void;
  authorName?: string;
}

export default function AutorizacionDesembolsoDoc({
  data,
  reportData,
  onChange,
  onSave,
  isEditable = true,
  onPrint,
  storageKey,
  hideGuide = false,
  isReviewMode = false,
  onSaveComment,
  onDeleteComment,
  authorName = 'Supervisora',
}: Props) {
  const [commentModalState, setCommentModalState] = useState<{
    isOpen: boolean;
    fieldId: string;
    fieldName: string;
    fieldValuePreview?: string;
  }>({ isOpen: false, fieldId: '', fieldName: '' });

  const fidComment: FieldComment | undefined = reportData?.comentariosCampos?.autorizacion_desembolso;

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
  const getInitialData = (): AutorizacionDesembolsoData => {
    let baseData: AutorizacionDesembolsoData;
    const key = storageKey || (reportData ? `desembolso_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}` : 'desembolso_global');
    
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          baseData = JSON.parse(saved);
        } catch (e) {
          baseData = data || createDefaultAutorizacionDesembolsoData(reportData);
        }
      } else {
        baseData = data || createDefaultAutorizacionDesembolsoData(reportData);
      }
    } else {
      baseData = data || createDefaultAutorizacionDesembolsoData(reportData);
    }
    
    if (reportData) {
      const { valorNumeroFormateado, valorLetras } = obtenerValoresMonetariosReporte(reportData);
      const defaultObjeto = formatearObjetoConPeriodo(
        reportData.objeto || (baseData && baseData.objeto),
        reportData.fechaAplicacion,
        reportData.fechaInicio,
        reportData.fechaTerminacion,
        reportData.fechaPresentacion,
        reportData.periodoDesde,
        reportData.periodoHasta
      );

      const rawExp = reportData.periodoHasta || reportData.fechaPresentacion || '2026-07-14';
      const defaultFechaExp = formatFechaAnioMesDia(rawExp);

      return {
        ...baseData,
        reportId: reportData.id || baseData.reportId,
        fechaExpedicion: defaultFechaExp,
        consecutivoNro: reportData.informeNro || baseData.consecutivoNro || '1',
        nombre: reportData.contratistaNombre || baseData.nombre,
        nitCc: reportData.contratistaDocumento || baseData.nitCc,
        telefono: reportData.contratistaTelefono || baseData.telefono,
        direccion: (reportData.direccion || reportData.barrio || reportData.contratistaDireccion || baseData.direccion || 'BARRIO BUENOS AIRES').toUpperCase(),
        nroCuenta: reportData.numeroCuenta || baseData.nroCuenta || '53686186829',
        banco: (reportData.banco || baseData.banco || 'BANCOLOMBIA').toUpperCase(),
        tipoCuenta: (reportData.tipoCuenta || baseData.tipoCuenta || 'AHORRO').toUpperCase(),
        ciudad: (reportData.ciudad || reportData.ciudadCuenta || baseData.ciudad || 'CHOCÓ').toUpperCase(),
        contratoNro: reportData.contratoNro ? reportData.contratoNro.trim().split(/[\s\-\/]+/)[0].replace(/\D/g, '') : (baseData.contratoNro || '590'),
        conceptoNro: reportData.contratoNro ? reportData.contratoNro.trim().split(/[\s\-\/]+/)[0].replace(/\D/g, '') : (baseData.conceptoNro || '590'),
        objeto: defaultObjeto,
        valorNumeros: valorNumeroFormateado,
        subtotal: valorNumeroFormateado,
        total: valorNumeroFormateado,
        valorLetras: valorLetras,
      };
    }

    return baseData;
  };

  const getIdentityKey = () => {
    if (data?.id) return `data_${data.id}`;
    if (reportData) return `rep_${reportData.id || ''}_${reportData.informeNro || ''}_${reportData.periodoDesde || ''}_${reportData.periodoHasta || ''}_${storageKey || ''}`;
    return 'default';
  };

  const loadedKeyRef = useRef<string>('');
  const [formData, setFormData] = useState<AutorizacionDesembolsoData>(getInitialData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    const currentKey = getIdentityKey();
    if (loadedKeyRef.current === currentKey && !data) {
      return;
    }
    loadedKeyRef.current = currentKey;
    setHasChanges(false);

    const loadData = async () => {
      let baseData: AutorizacionDesembolsoData | null = null;
      if (data) {
        baseData = data;
      } else if (reportData) {
        // Cargar desde Supabase o localStorage
        const savedDB = await supabaseService.getAutorizacionDesembolso(
          reportData.id,
          reportData.contratistaDocumento,
          reportData.informeNro?.toString()
        );
        if (savedDB) {
          baseData = savedDB as AutorizacionDesembolsoData;
        } else {
          const key = storageKey || `desembolso_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            try { baseData = JSON.parse(saved); } catch (e) { baseData = createDefaultAutorizacionDesembolsoData(reportData); }
          } else {
            baseData = createDefaultAutorizacionDesembolsoData(reportData);
          }
        }
      } else {
        return;
      }

      if (loadedKeyRef.current === currentKey) {
        if (reportData) {
          const { valorNumeroFormateado, valorLetras } = obtenerValoresMonetariosReporte(reportData);
          const defaultObjeto = formatearObjetoConPeriodo(
            reportData.objeto || (baseData && baseData.objeto),
            reportData.fechaAplicacion,
            reportData.fechaInicio,
            reportData.fechaTerminacion,
            reportData.fechaPresentacion,
            reportData.periodoDesde,
            reportData.periodoHasta
          );

          const rawExp = reportData.periodoHasta || reportData.fechaPresentacion || '2026-07-14';
          const defaultFechaExp = formatFechaAnioMesDia(rawExp);

          setFormData({
            ...baseData,
            reportId: reportData.id || baseData.reportId,
            fechaExpedicion: defaultFechaExp,
            consecutivoNro: reportData.informeNro || baseData.consecutivoNro || '1',
            nombre: reportData.contratistaNombre || baseData.nombre,
            nitCc: reportData.contratistaDocumento || baseData.nitCc,
            telefono: reportData.contratistaTelefono || baseData.telefono,
            direccion: (reportData.direccion || reportData.barrio || reportData.contratistaDireccion || baseData.direccion || 'BARRIO BUENOS AIRES').toUpperCase(),
            nroCuenta: reportData.numeroCuenta || baseData.nroCuenta || '53686186829',
            banco: (reportData.banco || baseData.banco || 'BANCOLOMBIA').toUpperCase(),
            tipoCuenta: (reportData.tipoCuenta || baseData.tipoCuenta || 'AHORRO').toUpperCase(),
            ciudad: (reportData.ciudad || reportData.ciudadCuenta || baseData.ciudad || 'CHOCÓ').toUpperCase(),
            contratoNro: reportData.contratoNro ? reportData.contratoNro.trim().split(/[\s\-\/]+/)[0].replace(/\D/g, '') : (baseData.contratoNro || '590'),
            conceptoNro: reportData.contratoNro ? reportData.contratoNro.trim().split(/[\s\-\/]+/)[0].replace(/\D/g, '') : (baseData.conceptoNro || '590'),
            objeto: defaultObjeto,
            valorNumeros: valorNumeroFormateado,
            subtotal: valorNumeroFormateado,
            total: valorNumeroFormateado,
            valorLetras: valorLetras,
          });
        } else if (baseData) {
          setFormData(baseData);
        }
      }
    };

    loadData();
  }, [data, reportData?.id, reportData?.informeNro, reportData?.contratistaNombre, reportData?.contratistaDocumento, reportData?.contratistaTelefono, reportData?.barrio, reportData?.direccion, reportData?.numeroCuenta, reportData?.banco, reportData?.tipoCuenta, reportData?.ciudad, reportData?.valorPagar, reportData?.valorContrato, reportData?.valorMensual, reportData?.periodoDesde, reportData?.periodoHasta, reportData?.fechaPresentacion, storageKey]);

  useEffect(() => {
    const handleSyncEvent = (e: any) => {
      if (e?.detail) {
        setFormData(prev => ({
          ...prev,
          ...e.detail
        }));
      }
    };
    window.addEventListener('desembolso_updated_event', handleSyncEvent);
    return () => window.removeEventListener('desembolso_updated_event', handleSyncEvent);
  }, []);

  const handleFieldChange = (field: keyof AutorizacionDesembolsoData, value: any) => {
    let updated = { ...formData, [field]: value };

    // Sincronización inteligente si se edita el valor numérico en el formulario
    if (field === 'valorNumeros' || field === 'subtotal' || field === 'total') {
      const num = limpiarNumeroMoneda(value);
      if (num > 0) {
        const letras = convertirNumeroALetras(num);
        const formateado = new Intl.NumberFormat('es-CO').format(num);
        updated = {
          ...updated,
          [field]: value,
          valorNumeros: field === 'valorNumeros' ? value : formateado,
          subtotal: field === 'subtotal' ? value : formateado,
          total: field === 'total' ? value : formateado,
          valorLetras: letras,
        };
      }
    }

    setFormData(updated);
    setHasChanges(true);
    if (onChange) {
      onChange(updated);
    }
  };

  const desembComment = reportData?.comentariosCampos?.['autorizacion_desembolso'] || 
    Object.values(reportData?.comentariosCampos || {}).find((c: any) => 
      c.campoId === 'autorizacion_desembolso' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('autorización de desembolso')) || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('desembolso'))
    );

  const handleMarkCommentAsFixed = async () => {
    if (!reportData) return;
    const currentComments = { ...(reportData.comentariosCampos || {}) };
    const targetKey = Object.keys(currentComments).find(k => 
      k === 'autorizacion_desembolso' || 
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('autorización de desembolso')) ||
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('desembolso'))
    ) || 'autorizacion_desembolso';

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
    const key = storageKey || (reportData ? `desembolso_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}` : 'desembolso_global');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(formData));
    }
    
    // Guardar en Supabase
    await supabaseService.saveAutorizacionDesembolso(
      reportData?.id || '',
      formData,
      formData.nitCc || reportData?.contratistaDocumento,
      reportData?.informeNro?.toString() || '1',
      reportData?.contratoId
    );

    if (desembComment && !desembComment.corregido) {
      await handleMarkCommentAsFixed();
    }

    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    
    if (onSave) {
      onSave(formData);
    }
  };

  const processCloneInputsAndTextareas = (clone: HTMLElement) => {
    const inputs = clone.querySelectorAll('input');
    inputs.forEach(input => {
      const span = document.createElement('span');
      span.textContent = input.value;
      span.className = input.className;
      span.style.cssText = window.getComputedStyle(input).cssText;
      span.style.backgroundColor = 'transparent';
      span.style.border = 'none';
      span.style.padding = '0';
      span.style.margin = '0';
      span.style.display = 'inline-block';
      input.parentNode?.replaceChild(span, input);
    });

    const textareas = clone.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      const div = document.createElement('div');
      div.innerHTML = textarea.value.replace(/\\n/g, '<br/>');
      div.className = textarea.className;
      div.style.cssText = window.getComputedStyle(textarea).cssText;
      div.style.backgroundColor = 'transparent';
      div.style.border = 'none';
      div.style.padding = '0';
      div.style.margin = '0';
      div.style.overflow = 'hidden';
      div.style.whiteSpace = 'pre-wrap';
      textarea.parentNode?.replaceChild(div, textarea);
    });
  };

  const handleDirectPrint = () => {
    if (onPrint) onPrint();
    
    const element = document.getElementById('desembolso-document');
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
            <title></title>
            ${styles}
            <style>
              @page {
                size: letter;
                margin: 0 !important;
              }
              @page :left, @page :right, @page :first {
                margin: 0 !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                margin: 0 !important;
                padding: 5mm !important;
                font-family: "Times New Roman", Times, serif !important;
              }
              #desembolso-document,
              #desembolso-document *:not(.font-arial-narrow):not(.font-arial-narrow *) {
                font-family: "Times New Roman", Times, serif !important;
              }
              .font-arial-narrow,
              .font-arial-narrow * {
                font-family: 'Arial Narrow', 'Nimbus Sans Narrow', Arial, sans-serif !important;
              }
              .bg-amber-50 {
                background-color: transparent !important;
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
                  window.parent.document.title = "";
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
            Autorización de Desembolso / Documento Equivalente
          </span>
          <span className="text-[11px] font-mono bg-emerald-100 text-[#006b33] font-bold px-2 py-0.5 rounded border border-emerald-300">
            {formData.consecutivoNro ? `Consecutivo #${formData.consecutivoNro}` : 'Consecutivo Nro. 1'}
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
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 text-slate-800'
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
            <div className="w-full bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/60 border border-emerald-200 rounded-xl p-3 text-slate-700 shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="bg-[#006b33] text-white p-1 rounded-md mt-0.5 shrink-0 shadow-xs">
                  <Sparkles size={14} />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-950">
                      Guía para Diligenciar y Editar la Autorización de Desembolso:
                    </span>
                    <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {isEditing ? 'Modo Edición Activado' : 'Modo Lectura'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-snug">
                    <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                      <span className="font-bold text-emerald-900 block mb-0.5">1. Habilitar Edición:</span>
                      Haga clic en <strong className="text-amber-900 bg-amber-100 px-1 py-0.5 rounded">«Llenar / Editar Campos»</strong> para habilitar las casillas editables.
                    </div>
                    <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                      <span className="font-bold text-emerald-900 block mb-0.5">2. Modificar Campos:</span>
                      Ajuste los valores del período, concepto de cobro, retenciones aplicables y firmas correspondientes.
                    </div>
                    <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                      <span className="font-bold text-emerald-900 block mb-0.5">3. Guardar e Imprimir:</span>
                      Presione <strong className="text-emerald-900 bg-emerald-200 px-1 py-0.5 rounded">«Guardar Datos»</strong> para guardar los cambios y luego <strong className="text-slate-900 bg-slate-200 px-1 py-0.5 rounded">«Imprimir»</strong>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BANNER OBSERVACIONES PARA EL CONTRATISTA (PENDIENTE DE CORREGIR) */}
          {!isReviewMode && desembComment && !desembComment.corregido && (
            <div className="w-full mb-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10.5px] uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                      Observación de Supervisión (Pendiente)
                    </span>
                    <span className="text-[10.5px] text-amber-800 font-semibold">
                      {desembComment.fecha || 'Reciente'} • {desembComment.autor || 'Supervisora'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-950 mt-1">
                    "{desembComment.comentario}"
                  </p>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    Modifique los datos correspondientes y presione <strong>"Guardar Datos"</strong> o <strong>"Marcar como Subsanado"</strong> para enviar la corrección.
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
          {!isReviewMode && desembComment && desembComment.corregido && (
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
                    Has corregido la observación: <span className="italic font-bold">"{desembComment.comentario}"</span>. Tu documento actualizado está registrado y en espera de validación final por la supervisora.
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
            desembComment ? (
              desembComment.corregido ? (
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
                        Observación atendida: "{desembComment.comentario}"
                      </p>
                      <p className="text-[11px] text-emerald-900 mt-0.5">
                        El contratista ha modificado y marcado como subsanada esta autorización. Verifique los datos y presione <strong>"Validar y Quitar Observación"</strong> si es conforme.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (onDeleteComment) {
                          onDeleteComment('autorizacion_desembolso');
                        }
                      }}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span>Validar y Quitar Observación</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openCommentModal('autorizacion_desembolso', 'Autorización Desembolso', 'Autorización de Desembolso')}
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
                          {desembComment.fecha || 'Reciente'} • {desembComment.autor || 'Supervisora'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-amber-950 mt-1">
                        "{desembComment.comentario}"
                      </p>
                      <p className="text-[11px] text-amber-900 mt-0.5">
                        El contratista aún <strong>NO</strong> ha modificado ni marcado como subsanado este documento.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openCommentModal('autorizacion_desembolso', 'Autorización Desembolso', 'Autorización de Desembolso')}
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
                  <span>Modo Revisión: Haga clic en el botón para dejar observaciones y comentarios sobre esta autorización de desembolso.</span>
                </div>
                <button
                  type="button"
                  onClick={() => openCommentModal('autorizacion_desembolso', 'Autorización Desembolso', 'Autorización de Desembolso')}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <MessageSquare size={13} />
                  <span>Comentar Desembolso</span>
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

      {/* CONTENIDO DEL DOCUMENTO */}
      <div className="w-full max-w-full overflow-x-auto pb-4 flex justify-start sm:justify-center">
        <div 
          id="desembolso-document"
          className="bg-white p-3 sm:p-6 shadow-md text-black transition-all origin-top shrink-0 print:scale-100 print:shadow-none print:p-0 print:m-0"
          style={{
            width: '21.59cm',
            fontFamily: '"Times New Roman", Times, serif',
            color: '#000000',
            position: 'relative'
          }}
        >
        {/* Contenedor Principal con borde perimetral grueso */}
        <div className="w-full text-[11px] leading-snug border-2 border-black font-serif">
          
          {/* ENCABEZADO: Logo a la izquierda y Texto perfectamente centrado en todo el ancho */}
          <div className="relative pt-4 pb-3 px-3">
            {/* Logo de Quibdó a la izquierda, más grande */}
            <div className="absolute left-4 top-3 flex items-center justify-center">
              <QuibdoLogo variant="full" size="lg" className="scale-110" />
            </div>

            {/* Bloque de títulos centrado en toda la página */}
            <div className="w-full text-center font-bold font-serif flex flex-col justify-center items-center">
              <div className="text-[13px] uppercase tracking-wide">MUNICIPIO DE QUIBDÓ</div>
              <div className="text-[13px] uppercase mt-0.5">DOCUMENTO EQUIVALENTE A LA FACTURA</div>
              <div className="text-[11px] uppercase mt-1">GESTIÓN FINANCIERA</div>
              
              <div className="text-[14px] font-bold mt-3">Aplica para personas naturales no comerciantes</div>
              <div className="text-[15px] font-black uppercase mt-0.5 tracking-wider">
                NO RESPONSABLES DEL IMPUESTO A LAS VENTAS
              </div>
            </div>
          </div>

          {/* SECCIÓN FECHA Y CONSECUTIVO (Sin línea superior divisoria, cajas con fondo gris y borde negro) */}
          <div className="flex justify-between items-center px-2 py-3 font-bold font-serif text-[11px]">
            <div className="flex items-center gap-2 pl-2">
              <span className="uppercase tracking-tight text-[11px]">FECHA DE EXPEDICIÓN</span>
              <div className="border-2 border-black bg-gray-200 px-4 py-0.5 min-w-[150px] text-center shadow-none">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.fechaExpedicion} 
                    onChange={(e) => handleFieldChange('fechaExpedicion', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none text-xs font-serif font-bold" 
                  />
                ) : (
                  <span className="text-xs">{formData.fechaExpedicion}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="uppercase tracking-tight text-[11px]">CONSECUTIVO NRO.</span>
              <div className="border-2 border-black bg-gray-200 px-3 py-0.5 min-w-[50px] text-center shadow-none mr-0">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.consecutivoNro} 
                    onChange={(e) => handleFieldChange('consecutivoNro', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none text-xs font-serif font-bold" 
                  />
                ) : (
                  <span className="text-xs">{formData.consecutivoNro}</span>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN ENTIDAD CONTRATANTE (Sin líneas divisorias arriba/abajo directas, centrado limpio) */}
          <div className="text-center font-bold pb-3 pt-1 font-serif text-[12px]">
            <div>ENTIDAD CONTRATANTE: MUNICIPIO DE QUIBDÓ</div>
            <div className="text-[11px] mt-0.5">NIT. 891.680.011-0</div>
          </div>

          {/* DATOS DEL CONTRATISTA (Título con fondo gris y bordes) */}
          <div className="w-full text-center bg-gray-200 border-t-2 border-b-2 border-black font-bold text-[11px] py-1 uppercase tracking-wide font-serif">
            DATOS DEL CONTRATISTA
          </div>

          {/* TABLA DE DATOS DEL CONTRATISTA */}
          <div className="flex flex-col w-full border-b-2 border-black font-serif">
            {/* Fila 1: NOMBRE / NIT Ó C.C */}
            <div className="flex w-full border-b border-black">
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                NOMBRE
              </div>
              <div className="w-[42%] px-2 py-1 font-bold text-center border-r border-black uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.nombre} 
                    onChange={(e) => handleFieldChange('nombre', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.nombre}</span>
                )}
              </div>
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                NIT. Ó C.C
              </div>
              <div className="w-[22%] px-2 py-1 font-bold text-center uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.nitCc} 
                    onChange={(e) => handleFieldChange('nitCc', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.nitCc}</span>
                )}
              </div>
            </div>

            {/* Fila 2: NRO. DE CUENTA / TIPO DE CUENTA */}
            <div className="flex w-full border-b border-black">
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                NRO. DE CUENTA
              </div>
              <div className="w-[42%] px-2 py-1 font-bold text-center border-r border-black text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.nroCuenta} 
                    onChange={(e) => handleFieldChange('nroCuenta', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.nroCuenta}</span>
                )}
              </div>
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                TIPO DE CUENTA
              </div>
              <div className="w-[22%] px-2 py-1 font-bold text-center uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.tipoCuenta} 
                    onChange={(e) => handleFieldChange('tipoCuenta', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.tipoCuenta}</span>
                )}
              </div>
            </div>

            {/* Fila 3: BANCO / CIUDAD */}
            <div className="flex w-full border-b border-black">
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                BANCO
              </div>
              <div className="w-[42%] px-2 py-1 font-bold text-center border-r border-black uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.banco} 
                    onChange={(e) => handleFieldChange('banco', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.banco}</span>
                )}
              </div>
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                CIUDAD
              </div>
              <div className="w-[22%] px-2 py-1 font-bold text-center uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.ciudad} 
                    onChange={(e) => handleFieldChange('ciudad', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.ciudad}</span>
                )}
              </div>
            </div>

            {/* Fila 4: DIRECCIÓN / TELÉFONO */}
            <div className="flex w-full">
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                DIRECCIÓN
              </div>
              <div className="w-[42%] px-2 py-1 font-bold text-center border-r border-black uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.direccion} 
                    onChange={(e) => handleFieldChange('direccion', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.direccion}</span>
                )}
              </div>
              <div className="w-[18%] px-2 py-1 font-bold border-r border-black uppercase text-[10px] flex items-center">
                TELÉFONO
              </div>
              <div className="w-[22%] px-2 py-1 font-bold text-center uppercase text-[11px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.telefono} 
                    onChange={(e) => handleFieldChange('telefono', e.target.value)} 
                    className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                  />
                ) : (
                  <span>{formData.telefono}</span>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN CONCEPTO Y OBJETO */}
          <div className="pt-3 pb-2 border-b-2 border-black font-serif">
            {/* Concepto y Nro con márgenes laterales px-8 */}
            <div className="flex justify-between items-center px-8 py-1.5 mb-1.5">
              <div className="flex items-center gap-3">
                <span className="font-bold text-[11px] uppercase tracking-wide">CONCEPTO</span>
                <div className="border-2 border-black px-4 py-1 w-[380px] max-w-[400px] text-center bg-white font-bold uppercase text-[11px] shadow-none">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.concepto || 'PRESTACION DE SERVICIOS'} 
                      onChange={(e) => handleFieldChange('concepto', e.target.value)} 
                      className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                    />
                  ) : (
                    <span>{formData.concepto || 'PRESTACION DE SERVICIOS'}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-[11px] uppercase tracking-wide">NRO.</span>
                <div className="border-2 border-black px-3 py-1 min-w-[50px] text-center bg-white font-bold uppercase text-[11px] shadow-none">
                  {isEditing ? (
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={(formData.contratoNro || formData.conceptoNro || '590').replace(/\D/g, '')} 
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/\D/g, '');
                        handleFieldChange('contratoNro', cleanVal);
                        handleFieldChange('conceptoNro', cleanVal);
                      }} 
                      className="w-full text-center bg-amber-50 outline-none uppercase font-serif font-bold text-[11px]" 
                    />
                  ) : (
                    <span>{(formData.contratoNro || formData.conceptoNro || '590').replace(/\D/g, '')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Texto "Cuyo objeto es" con margen izquierdo ml-8 */}
            <div className="flex items-center justify-between mb-1 mx-8">
              <div className="text-[11px] font-bold">
                Cuyo objeto es
              </div>
              {isEditing && reportData && (
                <button
                  type="button"
                  onClick={() => {
                    const autoObj = formatearObjetoConPeriodo(
                      reportData.objeto,
                      reportData.fechaAplicacion,
                      reportData.fechaInicio,
                      reportData.fechaTerminacion,
                      reportData.fechaPresentacion,
                      reportData.periodoDesde,
                      reportData.periodoHasta
                    );
                    handleFieldChange('objeto', autoObj);
                  }}
                  className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                  title="Regenerar automáticamente con el objeto y las fechas del informe"
                >
                  <Sparkles size={11} />
                  <span>Autocompletar con Periodo</span>
                </button>
              )}
            </div>

            {/* Caja descriptiva del contrato con márgenes laterales mx-8 */}
            <div className="mx-8 mb-3 border-2 border-black p-2.5 text-center text-[11px] font-normal uppercase bg-white leading-relaxed">
              {isEditing ? (
                <textarea 
                  value={formData.objeto} 
                  onChange={(e) => handleFieldChange('objeto', e.target.value)} 
                  rows={4}
                  placeholder="OBJETO DEL CONTRATO...\nCORRESPONDIENTE AL PERIODO DEL 01 DE JULIO AL 31 DE JULIO 2026"
                  className="w-full min-h-[85px] text-center bg-amber-50 outline-none resize-y font-serif text-[11px] font-normal leading-relaxed uppercase border border-amber-300 rounded p-1" 
                />
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed tracking-tight font-serif text-[11px] font-normal">{formData.objeto}</div>
              )}
            </div>
          </div>

          {/* TABLA DE VALORES (Números y Letras con tipografía Arial Narrow y estructura idéntica) */}
          <div 
            className="flex w-full border-b-2 border-black font-arial-narrow" 
            style={{ fontFamily: "'Arial Narrow', 'Nimbus Sans Narrow', Arial, sans-serif" }}
          >
            {/* Lado Izquierdo: Valor en Números en la esquina superior izquierda */}
            <div className="w-[62%] p-2 border-r-2 border-black flex flex-col justify-start">
              <div className="text-[12px] font-bold uppercase tracking-tight flex items-baseline gap-2">
                <span>VALOR EN NÚMEROS</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.valorNumeros} 
                    onChange={(e) => handleFieldChange('valorNumeros', e.target.value)} 
                    className="bg-amber-50 outline-none font-bold text-[12px] px-1 italic font-serif" 
                    style={{ fontStyle: 'italic' }}
                  />
                ) : (
                  <span className="text-[12px] font-bold italic font-serif">{formData.valorNumeros}</span>
                )}
              </div>
            </div>

            {/* Lado Derecho: SUBTOTAL, IVA ASUMIDO, TOTAL con fondo gris en etiquetas y valores a la derecha */}
            <div className="w-[38%] flex flex-col">
              {/* Fila SUBTOTAL */}
              <div className="flex w-full border-b border-black">
                <div className="w-[45%] bg-[#e5e7eb] px-2 py-0.5 text-[11px] font-bold border-r border-black uppercase flex items-center">
                  SUBTOTAL
                </div>
                <div className="w-[55%] bg-white px-2 py-0.5 text-right text-[11.5px] font-bold flex items-center justify-end">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.subtotal} 
                      onChange={(e) => handleFieldChange('subtotal', e.target.value)} 
                      className="w-full text-right bg-amber-50 outline-none uppercase font-bold text-[11.5px] italic font-serif" 
                      style={{ fontStyle: 'italic' }}
                    />
                  ) : (
                    <span className="italic font-serif">{formData.subtotal}</span>
                  )}
                </div>
              </div>

              {/* Fila IVA ASUMIDO */}
              <div className="flex w-full border-b border-black">
                <div className="w-[45%] bg-[#e5e7eb] px-2 py-0.5 text-[11px] font-bold border-r border-black uppercase flex items-center">
                  IVA ASUMIDO
                </div>
                <div className="w-[55%] bg-white px-2 py-0.5 text-right text-[11.5px] font-bold flex items-center justify-end">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.ivaAsumido} 
                      onChange={(e) => handleFieldChange('ivaAsumido', e.target.value)} 
                      className="w-full text-right bg-amber-50 outline-none uppercase font-bold text-[11.5px] italic font-serif" 
                      style={{ fontStyle: 'italic' }}
                    />
                  ) : (
                    <span className="italic font-serif">{formData.ivaAsumido}</span>
                  )}
                </div>
              </div>

              {/* Fila TOTAL */}
              <div className="flex w-full">
                <div className="w-[45%] bg-[#e5e7eb] px-2 py-0.5 text-[11px] font-bold border-r border-black uppercase flex items-center">
                  TOTAL
                </div>
                <div className="w-[55%] bg-white px-2 py-0.5 text-right text-[11.5px] font-bold flex items-center justify-end">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.total} 
                      onChange={(e) => handleFieldChange('total', e.target.value)} 
                      className="w-full text-right bg-amber-50 outline-none uppercase font-bold text-[11.5px] italic font-serif" 
                      style={{ fontStyle: 'italic' }}
                    />
                  ) : (
                    <span className="italic font-serif">{formData.total}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VALOR EN LETRAS: Etiqueta con fondo gris y valor en celda derecha */}
          <div 
            className="flex w-full border-b-2 border-black"
            style={{ fontFamily: "'Arial Narrow', 'Nimbus Sans Narrow', Arial, sans-serif" }}
          >
            <div className="w-[20%] bg-[#e5e7eb] px-2 py-1.5 font-bold text-[11px] border-r-2 border-black uppercase flex items-center">
              VALOR EN LETRAS:
            </div>
            <div className="w-[80%] bg-white px-3 py-1.5 font-bold text-center text-[10.5px] uppercase flex items-center justify-center font-serif italic">
              {isEditing ? (
                <input 
                  type="text" 
                  value={formData.valorLetras} 
                  onChange={(e) => handleFieldChange('valorLetras', e.target.value)} 
                  className="w-full text-center bg-amber-50 outline-none uppercase font-serif text-[10.5px] font-bold italic" 
                  style={{ fontStyle: 'italic' }}
                />
              ) : (
                <span className="font-bold tracking-tight italic font-serif">{formData.valorLetras}</span>
              )}
            </div>
          </div>

          {/* SECCIÓN ENDOSOS CON MÁRGENES mx-6 (BLOQUES FLOTANTES) */}
          <div className="py-2.5 px-2 print:py-1.5 print:px-1 border-b-2 border-black font-serif text-[10px] space-y-2 print:space-y-1">
            {/* Endoso 1 */}
            <div className="mx-6 print:mx-4 border-2 border-black p-1.5 print:p-1 font-normal">
              <div className="mb-1 print:mb-0.5 font-bold uppercase text-[10px]">ENDOSO 1:</div>
              <div className="flex items-center mb-1 print:mb-0.5">
                <span className="w-36 font-normal">Beneficiario del endoso:</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso1Beneficiario} onChange={(e) => handleFieldChange('endoso1Beneficiario', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso1Beneficiario}
                </div>
                <span className="w-14 text-center font-normal">NIT/CC</span>
                <div className="w-36 border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso1NitCc} onChange={(e) => handleFieldChange('endoso1NitCc', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso1NitCc}
                </div>
              </div>
              <div className="flex items-center mb-1 print:mb-0.5">
                <span className="w-14 font-normal">Cuenta</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso1Cuenta} onChange={(e) => handleFieldChange('endoso1Cuenta', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso1Cuenta}
                </div>
                <span className="w-14 text-center font-normal">Banco</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso1Banco} onChange={(e) => handleFieldChange('endoso1Banco', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso1Banco}
                </div>
                <span className="w-12 text-center font-normal">Tipo</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso1Tipo} onChange={(e) => handleFieldChange('endoso1Tipo', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso1Tipo}
                </div>
              </div>
              <div className="flex items-center">
                <span className="w-14 font-normal">Concepto</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso1Concepto} onChange={(e) => handleFieldChange('endoso1Concepto', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso1Concepto}
                </div>
                <span className="w-14 text-center font-normal">Valor</span>
                <div className="w-36 border border-black text-left px-2 mx-1 h-4 flex items-center">
                  {isEditing ? <input type="text" value={formData.endoso1Valor || '$ 0'} onChange={(e) => handleFieldChange('endoso1Valor', e.target.value)} className="w-full bg-amber-50 outline-none text-left h-4 font-serif text-[10px]" /> : (formData.endoso1Valor || '$ 0')}
                </div>
              </div>
            </div>

            {/* Endoso 2 */}
            <div className="mx-6 print:mx-4 border-2 border-black p-1.5 print:p-1 font-normal">
              <div className="mb-1 print:mb-0.5 font-bold uppercase text-[10px]">ENDOSO 2:</div>
              <div className="flex items-center mb-1 print:mb-0.5">
                <span className="w-36 font-normal">Beneficiario del endoso:</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso2Beneficiario} onChange={(e) => handleFieldChange('endoso2Beneficiario', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso2Beneficiario}
                </div>
                <span className="w-14 text-center font-normal">NIT/CC</span>
                <div className="w-36 border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso2NitCc} onChange={(e) => handleFieldChange('endoso2NitCc', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso2NitCc}
                </div>
              </div>
              <div className="flex items-center mb-1 print:mb-0.5">
                <span className="w-14 font-normal">Cuenta</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso2Cuenta} onChange={(e) => handleFieldChange('endoso2Cuenta', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso2Cuenta}
                </div>
                <span className="w-14 text-center font-normal">Banco</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso2Banco} onChange={(e) => handleFieldChange('endoso2Banco', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso2Banco}
                </div>
                <span className="w-12 text-center font-normal">Tipo</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso2Tipo} onChange={(e) => handleFieldChange('endoso2Tipo', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso2Tipo}
                </div>
              </div>
              <div className="flex items-center">
                <span className="w-14 font-normal">Concepto</span>
                <div className="flex-grow border-b border-black text-center mx-2 h-4">
                  {isEditing ? <input type="text" value={formData.endoso2Concepto} onChange={(e) => handleFieldChange('endoso2Concepto', e.target.value)} className="w-full bg-amber-50 outline-none text-center h-4 font-serif text-[10px]" /> : formData.endoso2Concepto}
                </div>
                <span className="w-14 text-center font-normal">Valor</span>
                <div className="w-36 border border-black text-left px-2 mx-1 h-4 flex items-center">
                  {isEditing ? <input type="text" value={formData.endoso2Valor || '$ 0'} onChange={(e) => handleFieldChange('endoso2Valor', e.target.value)} className="w-full bg-amber-50 outline-none text-left h-4 font-serif text-[10px]" /> : (formData.endoso2Valor || '$ 0')}
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN FINAL (FIRMA, DIRECCIÓN, TELÉFONO con márgenes ml-10 y anchos definidos) */}
          <div className="pt-3 pb-2 px-4 print:pt-2 print:pb-1 font-serif">
            <div className="ml-10 print:ml-8 mb-2 mt-3 print:mt-1 space-y-1.5">
              
              {/* Fila FIRMA */}
              <div className="flex flex-row items-end">
                <div className="w-[120px] font-bold text-[12px] leading-none pb-1">FIRMA</div>
                <div className="border-b-2 border-black w-[300px] h-8 flex items-end pl-2 pb-0.5 relative">
                  {formData.firmaContratista ? (
                    <img 
                      src={formData.firmaContratista} 
                      alt="Firma Contratista" 
                      className="max-h-11 print:max-h-9 object-contain"
                    />
                  ) : isEditing ? (
                    <input 
                      type="text" 
                      className="w-full bg-amber-50 outline-none text-xs font-serif italic text-gray-500" 
                      placeholder="(Espacio de firma)" 
                    />
                  ) : null}
                </div>
              </div>

              {/* Fila DIRECCIÓN */}
              <div className="flex flex-row items-center">
                <div className="w-[120px] font-bold text-[11px] uppercase leading-none">DIRECCIÓN</div>
                <div className="bg-[#e5e7eb] w-[400px] px-3 py-1 text-[11px] font-normal uppercase text-black leading-none">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.direccion} 
                      onChange={(e) => handleFieldChange('direccion', e.target.value)} 
                      className="w-full bg-amber-50 outline-none font-serif uppercase text-[11px] leading-none" 
                    />
                  ) : (
                    <span className="leading-none">{formData.direccion || 'BARRIO BUENOS AIRES'}</span>
                  )}
                </div>
              </div>

              {/* Fila TELÉFONO */}
              <div className="flex flex-row items-center">
                <div className="w-[120px] font-bold text-[11px] uppercase leading-none">TELÉFONO</div>
                <div className="bg-[#e5e7eb] w-[400px] px-3 py-1 text-[11px] font-normal uppercase text-black leading-none">
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.telefono} 
                      onChange={(e) => handleFieldChange('telefono', e.target.value)} 
                      className="w-full bg-amber-50 outline-none font-serif uppercase text-[11px] leading-none" 
                    />
                  ) : (
                    <span className="leading-none">{formData.telefono || '3124943527'}</span>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* FOOTER NOTICE (Centrado, sin línea divisoria al final) */}
          <div className="w-full text-center text-[9px] print:text-[8px] font-bold pb-3 pt-3 print:py-1 font-serif print:break-inside-avoid">
            Adquisiciones efectuadas a Personas Naturales no comerciantes o no responsables del Impuesto a las Ventas<br/>
            Articulo 3 Decreto 522 de Marzo 7/2003
          </div>

        </div>
      </div>
    </div>
  </div>
);
}
