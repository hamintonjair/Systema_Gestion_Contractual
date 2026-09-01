import React, { useState, useEffect, useRef } from 'react';
import { SoporteFiduciariaData, ReportData, createDefaultFiduciariaData, FieldComment } from '../types';
import { obtenerValoresMonetariosReporte, convertirNumeroALetras, formatFechaFiduciaria } from '../utils/numberToWords';
import { limpiarNumeroMoneda } from '../utils/paymentPlanUtils';
import { supabaseService } from '../services/supabaseService';
import { openWhatsAppForCertificate } from '../utils/whatsappNotifier';
import FieldCommentModal from './FieldCommentModal';
import { Printer, Download, Edit3, Check, Save, RotateCcw, Image as ImageIcon, Sparkles, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  key?: React.Key;
  data?: SoporteFiduciariaData;
  reportData?: ReportData;
  onChange?: (updated: SoporteFiduciariaData) => void;
  onSave?: (saved: SoporteFiduciariaData) => void;
  isEditable?: boolean;
  onPrint?: () => void;
  storageKey?: string;
  hideGuide?: boolean;
  isReviewMode?: boolean;
  onSaveComment?: (fieldId: string, fieldName: string, comentario: string) => void;
  onDeleteComment?: (fieldId: string) => void;
  authorName?: string;
}

export default function SoporteFiduciariaDoc({
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
  const getInitialData = (): SoporteFiduciariaData => {
    let baseData: SoporteFiduciariaData;
    const key = storageKey || (reportData ? `fid_data_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}` : 'fid_data_global');
    
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          baseData = JSON.parse(saved);
        } catch (e) {
          baseData = data || createDefaultFiduciariaData(reportData);
        }
      } else {
        baseData = data || createDefaultFiduciariaData(reportData);
      }
    } else {
      baseData = data || createDefaultFiduciariaData(reportData);
    }

    if (reportData) {
      const { valorNumeroFormateado, sumaTotalConCentavos, valorLetras } = obtenerValoresMonetariosReporte(reportData);

      return {
        ...baseData,
        reportId: reportData.id || baseData.reportId,
        nombresApellidos: reportData.contratistaNombre || baseData.nombresApellidos,
        cedula: reportData.contratistaDocumento || baseData.cedula,
        telefono: reportData.contratistaTelefono || baseData.telefono,
        sumaTotal: sumaTotalConCentavos,
        valorLetras: valorLetras,
        subTotal: valorNumeroFormateado,
        total: valorNumeroFormateado,
        totalGeneral: valorNumeroFormateado,
        descripcionBienServicio: reportData.objeto || baseData.descripcionBienServicio,
        docSoporteNro: reportData.informeNro || baseData.docSoporteNro || '1',
        fecha: formatFechaFiduciaria(reportData),
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
  const [formData, setFormData] = useState<SoporteFiduciariaData>(getInitialData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
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
      let baseData: SoporteFiduciariaData | null = null;
      if (data) {
        baseData = data;
      } else if (reportData) {
        const savedDB = await supabaseService.getSoporteFiduciaria(
          reportData.id,
          reportData.contratistaDocumento,
          reportData.informeNro?.toString()
        );
        if (savedDB) {
          baseData = savedDB as SoporteFiduciariaData;
        } else {
          const key = storageKey || `fid_data_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            try { baseData = JSON.parse(saved); } catch (e) { baseData = createDefaultFiduciariaData(reportData); }
          } else {
            baseData = createDefaultFiduciariaData(reportData);
          }
        }
      } else {
        return;
      }

      if (loadedKeyRef.current === currentKey) {
        if (reportData) {
          const { valorNumeroFormateado, sumaTotalConCentavos, valorLetras } = obtenerValoresMonetariosReporte(reportData);

          setFormData({
            ...baseData,
            reportId: reportData.id || baseData.reportId,
            nombresApellidos: reportData.contratistaNombre || baseData.nombresApellidos,
            cedula: reportData.contratistaDocumento || baseData.cedula,
            telefono: reportData.contratistaTelefono || baseData.telefono,
            direccion: (reportData.direccion || reportData.barrio || reportData.contratistaDireccion || baseData.direccion || 'BARRIO BUENOS AIRES').toUpperCase(),
            ciudad: (reportData.ciudad || reportData.ciudadCuenta || baseData.ciudad || 'CHOCÓ').toUpperCase(),
            sumaTotal: sumaTotalConCentavos,
            valorLetras: valorLetras,
            subTotal: valorNumeroFormateado,
            total: valorNumeroFormateado,
            totalGeneral: valorNumeroFormateado,
            descripcionBienServicio: reportData.objeto || baseData.descripcionBienServicio,
            docSoporteNro: reportData.informeNro || baseData.docSoporteNro || '1',
            fecha: formatFechaFiduciaria(reportData),
          });
        } else if (baseData) {
          setFormData(baseData);
        }
      }
    };
    loadData();
  }, [data, reportData?.id, reportData?.informeNro, reportData?.contratistaNombre, reportData?.contratistaDocumento, reportData?.contratistaTelefono, reportData?.barrio, reportData?.direccion, reportData?.ciudad, reportData?.numeroCuenta, reportData?.banco, reportData?.tipoCuenta, reportData?.valorPagar, reportData?.valorContrato, reportData?.valorMensual, reportData?.periodoDesde, reportData?.periodoHasta, reportData?.fechaPresentacion, storageKey]);

  useEffect(() => {
    const handleSyncEvent = (e: any) => {
      if (e?.detail) {
        setFormData(prev => ({
          ...prev,
          ...e.detail
        }));
      }
    };
    window.addEventListener('fiduciaria_updated_event', handleSyncEvent);
    return () => window.removeEventListener('fiduciaria_updated_event', handleSyncEvent);
  }, []);

  const handleFieldChange = (field: keyof SoporteFiduciariaData, value: string) => {
    let updated = { ...formData, [field]: value };

    // Sincronización inteligente de valores si se edita subTotal o total
    if (field === 'subTotal' || field === 'total' || field === 'totalGeneral') {
      const num = limpiarNumeroMoneda(value);
      if (num > 0) {
        const letras = convertirNumeroALetras(num);
        const formateado = new Intl.NumberFormat('es-CO').format(num);
        updated = {
          ...updated,
          [field]: value,
          total: field === 'subTotal' ? value : updated.total,
          totalGeneral: field === 'subTotal' ? value : updated.totalGeneral,
          sumaTotal: `${formateado},00`,
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

  const fidComment = reportData?.comentariosCampos?.['soporte_fiduciaria'] || 
    Object.values(reportData?.comentariosCampos || {}).find((c: any) => 
      c.campoId === 'soporte_fiduciaria' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('soporte fiduciaria')) || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('fiduciaria'))
    );

  const handleMarkCommentAsFixed = async () => {
    if (!reportData) return;
    const currentComments = { ...(reportData.comentariosCampos || {}) };
    const targetKey = Object.keys(currentComments).find(k => 
      k === 'soporte_fiduciaria' || 
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('soporte fiduciaria')) ||
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('fiduciaria'))
    ) || 'soporte_fiduciaria';

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
    const key = storageKey || (reportData ? `fid_data_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}` : 'fid_data_global');
    localStorage.setItem(key, JSON.stringify(formData));
    
    // Guardar y sincronizar en Supabase
    await supabaseService.saveSoporteFiduciaria(
      reportData?.id || '',
      formData,
      formData.cedula,
      reportData?.informeNro?.toString() || '1',
      reportData?.contratoId
    );

    if (fidComment && !fidComment.corregido) {
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
    cloneEl.querySelectorAll('input').forEach(input => {
      const inputEl = input as HTMLInputElement;
      const val = inputEl.value || '';
      const div = document.createElement('div');
      div.textContent = val;
      div.className = inputEl.className.replace(/bg-amber-50/g, '').replace(/bg-\[#d9d9d9\]/g, '');
      const isRight = inputEl.classList.contains('text-right');
      const isCenter = inputEl.classList.contains('text-center');
      div.style.cssText = `
        display: flex;
        align-items: flex-end;
        justify-content: ${isRight ? 'flex-end' : isCenter ? 'center' : 'flex-start'};
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        box-shadow: none;
        color: #000000;
        font-weight: normal;
        font-family: "Courier New", Courier, monospace;
        padding: 0 2px 2px 2px;
        margin: 0;
        box-sizing: border-box;
        line-height: 1.1;
      `;
      input.parentNode?.replaceChild(div, input);
    });
    cloneEl.querySelectorAll('textarea').forEach(textarea => {
      const taEl = textarea as HTMLTextAreaElement;
      const val = taEl.value || '';
      const div = document.createElement('div');
      div.textContent = val;
      div.className = taEl.className.replace(/bg-amber-50/g, '');
      const isCenter = taEl.classList.contains('text-center');
      div.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: ${isCenter ? 'center' : 'flex-start'};
        text-align: ${isCenter ? 'center' : 'left'};
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        box-shadow: none;
        color: #000000;
        font-weight: normal;
        font-family: "Courier New", Courier, monospace;
        padding: 2px;
        margin: 0;
        box-sizing: border-box;
        line-height: 1.3;
      `;
      textarea.parentNode?.replaceChild(div, textarea);
    });
  };

  const handleDirectPrint = () => {
    const element = document.getElementById('soporte-fiduciaria-document');
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

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <title>Documento Soporte Fiduciaria - Alcaldía de Quibdó</title>
            ${styles}
            <style>
              @page {
                size: letter portrait;
                margin: 8mm;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: "Courier New", Courier, monospace !important;
                width: 100% !important;
              }
              .print-container {
                width: 100% !important;
                max-width: 200mm !important;
                margin: 0 auto !important;
                background: white !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
              }
              #soporte-fiduciaria-document {
                box-shadow: none !important;
                border: 1.5px solid #000000 !important;
                margin: 0 auto !important;
                width: 100% !important;
                padding: 25px !important;
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${clone.outerHTML}
            </div>
            <script>
              setTimeout(() => {
                const oldTitle = window.parent.document.title;
                window.parent.document.title = "Documento Soporte Fiduciaria";
                window.print();
                window.parent.document.title = oldTitle;
                setTimeout(() => {
                  window.frameElement?.remove();
                }, 500);
              }, 400);
            </script>
          </body>
        </html>
      `);
      doc.close();

      if (onPrint) onPrint();
    } catch (err) {
      window.print();
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('soporte-fiduciaria-document');
    if (!element) {
      setIsExporting(false);
      return;
    }

    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      document.body.appendChild(container);

      const clone = element.cloneNode(true) as HTMLElement;
      processCloneInputsAndTextareas(clone);
      clone.style.width = '794px';
      clone.style.background = '#ffffff';
      clone.style.boxShadow = 'none';
      clone.style.border = '1px solid #000';
      clone.style.padding = '25px';

      container.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'letter');
      const imgWidth = 215.9;
      const pageHeight = 279.4;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Documento Soporte Fiduciaria.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToImage = async () => {
    setIsExportingImage(true);
    const element = document.getElementById('soporte-fiduciaria-document');
    if (!element) {
      setIsExportingImage(false);
      return;
    }

    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '850px';
      document.body.appendChild(container);

      const clone = element.cloneNode(true) as HTMLElement;
      processCloneInputsAndTextareas(clone);
      clone.style.width = '850px';
      clone.style.background = '#ffffff';
      clone.style.boxShadow = 'none';
      clone.style.border = '1px solid #000';
      clone.style.padding = '30px';

      container.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Documento Soporte Fiduciaria.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating Image:', error);
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('¿Está seguro de restaurar los datos fiduciarios por defecto con la información del informe?')) {
      const def = createDefaultFiduciariaData(reportData);
      setFormData(def);
      setHasChanges(true);
      if (onChange) onChange(def);
    }
  };

  return (
    <div className="w-full max-w-[21.59cm] flex flex-col gap-3 text-xs font-sans text-black">
      {/* PANEL DE ACCIONES */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#006b33]"></span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide font-sans">
            Soporte Fiduciaria y Adquisiciones
          </span>
          <span className="text-[11px] font-mono bg-emerald-100 text-[#006b33] font-bold px-2 py-0.5 rounded border border-emerald-300">
            {formData.docSoporteNro ? `Documento #${formData.docSoporteNro}` : 'N° Doc Soporte: En Blanco'}
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

      {/* Guía Paso a Paso para Edición de Campos (Oculta al imprimir) */}
      {!hideGuide && (
        <div className="w-full bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/60 border border-emerald-200 rounded-xl p-3 text-slate-700 shadow-xs print:hidden">
          <div className="flex items-start gap-2.5">
            <div className="bg-[#006b33] text-white p-1 rounded-md mt-0.5 shrink-0 shadow-xs">
              <Sparkles size={14} />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-950">
                  Guía para Diligenciar y Editar el Soporte Fiduciario:
                </span>
                <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {isEditing ? 'Modo Edición Activado' : 'Modo Lectura'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-snug">
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">1. Habilitar Edición:</span>
                  Haga clic en <strong className="text-amber-900 bg-amber-100 px-1 py-0.5 rounded">«Llenar / Editar Campos»</strong> para desbloquear las casillas editables resaltadas.
                </div>
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">2. Modificar Datos:</span>
                  Edite la información de beneficiario, cuenta bancaria, retenciones, aportes PILA y fechas directamente sobre el formulario.
                </div>
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">3. Guardar e Imprimir:</span>
                  Presione <strong className="text-emerald-900 bg-emerald-200 px-1 py-0.5 rounded">«Guardar Datos»</strong> para registrar los cambios y <strong className="text-slate-900 bg-slate-200 px-1 py-0.5 rounded">«Imprimir»</strong> para generar el documento.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER OBSERVACIONES PARA EL CONTRATISTA (PENDIENTE DE CORREGIR) */}
      {!isReviewMode && fidComment && !fidComment.corregido && (
        <div className="w-full mb-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[10.5px] uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                  Observación de Supervisión (Pendiente)
                </span>
                <span className="text-[10.5px] text-amber-800 font-semibold">
                  {fidComment.fecha || 'Reciente'} • {fidComment.autor || 'Supervisora'}
                </span>
              </div>
              <p className="text-xs font-bold text-amber-950 mt-1">
                "{fidComment.comentario}"
              </p>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Modifique los campos correspondientes y presione <strong>"Guardar Datos"</strong> o <strong>"Marcar como Subsanado"</strong> para enviar la corrección.
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
      {!isReviewMode && fidComment && fidComment.corregido && (
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
                Has corregido la observación: <span className="italic font-bold">"{fidComment.comentario}"</span>. Tu documento actualizado está registrado y en espera de validación final por la supervisora.
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
        fidComment ? (
          fidComment.corregido ? (
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
                    Observación atendida: "{fidComment.comentario}"
                  </p>
                  <p className="text-[11px] text-emerald-900 mt-0.5">
                    El contratista ha modificado y marcado como subsanado este soporte. Verifique los datos y presione <strong>"Validar y Quitar Observación"</strong> si es conforme.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteComment) {
                      onDeleteComment('soporte_fiduciaria');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Validar y Quitar Observación</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCommentModal('soporte_fiduciaria', 'Soporte Fiduciaria', 'Soporte Fiduciaria y Adquisiciones')}
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
                      {fidComment.fecha || 'Reciente'} • {fidComment.autor || 'Supervisora'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-950 mt-1">
                    "{fidComment.comentario}"
                  </p>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    El contratista aún <strong>NO</strong> ha modificado ni marcado como subsanado este documento.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openWhatsAppForCertificate({
                    docName: 'Soporte Fiduciaria / Pagos',
                    informeNro: reportData?.informeNro || '1',
                    contratoNro: reportData?.contratoNro || '',
                    contratistaNombre: reportData?.contratistaNombre || 'Contratista',
                    telefono: reportData?.contratistaTelefono || '',
                    comentario: fidComment.comentario,
                    isSubsanado: fidComment.corregido,
                    supervisorNombre: authorName || 'Supervisora'
                  })}
                  className="px-3 py-1.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Enviar aviso por WhatsApp"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCommentModal('soporte_fiduciaria', 'Soporte Fiduciaria', 'Soporte Fiduciaria y Adquisiciones')}
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
              <span>Modo Revisión: Haga clic en el botón para dejar observaciones y comentarios sobre este soporte fiduciario.</span>
            </div>
            <button
              type="button"
              onClick={() => openCommentModal('soporte_fiduciaria', 'Soporte Fiduciaria', 'Soporte Fiduciaria y Adquisiciones')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
            >
              <MessageSquare size={13} />
              <span>Comentar Soporte</span>
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

      {/* DOCUMENTO SOPORTE IMPRESO */}
      <div className="w-full max-w-full overflow-x-auto pb-4 flex justify-start sm:justify-center">
        <div
          id="soporte-fiduciaria-document"
          className="min-w-[760px] max-w-[850px] w-full bg-white border-[1.5px] border-black shadow-md p-6 sm:p-10 text-black leading-normal select-text relative shrink-0"
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            boxSizing: 'border-box',
          }}
        >
        {/* Cabecera / Header */}
        <div className="relative mb-6 pt-1 min-h-[110px]">
          {/* Logo Fiduprevisora */}
          <div 
            className="absolute left-0 top-0 w-[140px] h-[40px] flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #cc6b29 0%, #a42c3b 40%, #6e1531 100%)'
            }}
          >
             <div className="text-[14px] text-white font-bold tracking-wider" style={{ fontFamily: 'Georgia, serif' }}>
              {'{fiduprevisora}'}
            </div>
          </div>

          {/* Información Central */}
          <div className="w-full text-center">
            <div className="pl-[145px] pr-[135px]">
              <h1 className="text-[11.5px] font-bold tracking-tight text-black mb-3 text-center uppercase font-mono">
                DOCUMENTO SOPORTE EN ADQUISICIONES EFECTUADAS A NO OBLIGADOS A FACTURAR.
              </h1>
            </div>
            <div className="text-[15px] font-bold text-black mb-0.5 font-mono tracking-wide">
              E.F. MUNICIPIO DE QUIBDÓ
            </div>
            <div className="text-[15px] font-bold text-black mb-4 font-mono tracking-wide">
              FIDUCIARIA LA PREVISORA S.A.
            </div>
            <div className="text-[13px] font-bold text-black font-mono">
              NIT. 860.525.148
            </div>
          </div>

          {/* Caja N° Doc soporte */}
          <div className="absolute right-0 top-12 w-[130px] flex flex-col items-center">
            <div className="text-[11px] font-bold text-black mb-0.5 w-[115px] text-left pl-0.5 font-mono">
              N° Doc soporte
            </div>
            <div className="w-[115px] border-[1.5px] border-black h-7 flex items-center justify-center bg-white">
              {isEditing ? (
                <input
                  type="text"
                  value={formData.docSoporteNro || ''}
                  placeholder=""
                  onChange={(e) => handleFieldChange('docSoporteNro', e.target.value)}
                  className="w-full h-full text-center font-normal text-[12px] bg-amber-50 text-amber-950 rounded-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              ) : (
                <span className="font-normal text-[12px] text-black font-mono">
                  {formData.docSoporteNro || ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Datos Generales con lineas */}
        <div className="flex flex-col gap-1 text-[12px] leading-tight font-mono mb-4 w-full relative">
          
          {/* Ciudad y Fecha */}
          <div className="flex flex-row items-end pr-[32%]">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">Ciudad y Fecha:</div>
             <div className="flex-grow border-b-[1.5px] border-black flex flex-row items-end pb-0 leading-none">
               <div className="w-[45%] text-center font-mono">
                 {isEditing ? (
                   <input type="text" value={formData.ciudad} onChange={(e) => handleFieldChange('ciudad', e.target.value)} className="w-full text-center bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
                 ) : <span className="block pb-0 leading-none font-mono font-normal">{formData.ciudad}</span>}
               </div>
               <div className="w-[10%] text-center text-black font-normal font-mono">|</div>
               <div className="w-[45%] text-center font-mono">
                 {isEditing ? (
                   <input type="text" value={formData.fecha} onChange={(e) => handleFieldChange('fecha', e.target.value)} className="w-full text-center bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
                 ) : <span className="block pb-0 leading-none font-mono font-normal">{formData.fecha}</span>}
               </div>
             </div>
          </div>

          {/* Nombres y Apellidos */}
          <div className="flex flex-row items-end pr-[32%]">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">Nombres y Apellidos:</div>
             <div className="flex-grow border-b-[1.5px] border-black text-center pb-0 leading-none">
                {isEditing ? (
                  <input type="text" value={formData.nombresApellidos} onChange={(e) => handleFieldChange('nombresApellidos', e.target.value)} className="w-full text-center uppercase bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
                ) : <span className="block pb-0 leading-none uppercase font-mono font-normal">{formData.nombresApellidos}</span>}
             </div>
          </div>

          {/* Cédula */}
          <div className="flex flex-row items-end pr-[32%]">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">N° Cédula de Ciudadanía:</div>
             <div className="flex-grow border-b-[1.5px] border-black text-right pr-4 pb-0 leading-none">
                {isEditing ? (
                  <input type="text" value={formData.cedula} onChange={(e) => handleFieldChange('cedula', e.target.value)} className="w-full text-right pr-4 bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
                ) : <span className="block pb-0 leading-none font-mono font-normal pr-4">{formData.cedula}</span>}
             </div>
          </div>

          {/* Dirección */}
          <div className="flex flex-row items-end pr-[32%]">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">Dirección:</div>
             <div className="flex-grow border-b-[1.5px] border-black text-center uppercase pb-0 leading-none">
                {isEditing ? (
                  <input type="text" value={formData.direccion} onChange={(e) => handleFieldChange('direccion', e.target.value)} className="w-full text-center uppercase bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
                ) : <span className="block pb-0 leading-none uppercase font-mono font-normal">{formData.direccion}</span>}
             </div>
          </div>

          {/* Teléfono */}
          <div className="flex flex-row items-end pr-[32%]">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">Teléfono:</div>
             <div className="flex-grow border-b-[1.5px] border-black text-center pb-0 leading-none">
                {isEditing ? (
                 <input type="text" value={formData.telefono} onChange={(e) => handleFieldChange('telefono', e.target.value)} className="w-full text-center bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
               ) : <span className="block pb-0 leading-none font-mono font-normal">{formData.telefono}</span>}
             </div>
          </div>

          {/* La suma total */}
          <div className="flex flex-row items-end pr-[32%]">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">La suma total:</div>
             <div className="flex-grow border-b-[1.5px] border-black text-right pr-4 pb-0 leading-none">
                {isEditing ? (
                 <input type="text" value={formData.sumaTotal} onChange={(e) => handleFieldChange('sumaTotal', e.target.value)} className="w-full text-right pr-4 bg-amber-50 outline-none pb-0 leading-none font-mono font-normal" />
               ) : <span className="block pb-0 leading-none font-mono font-normal pr-4">{formData.sumaTotal}</span>}
             </div>
          </div>

          {/* Valor en letras (Toma todo el ancho disponible) */}
          <div className="flex flex-row items-end mt-1.5 w-full">
             <div className="whitespace-nowrap text-left pb-0.5 pr-2 font-mono font-normal">(Valor en letras)</div>
             <div className="flex-grow border-b-[1.5px] border-black text-center uppercase pb-0 leading-none flex flex-col justify-end">
                {isEditing ? (
                  <textarea rows={2} value={formData.valorLetras} onChange={(e) => handleFieldChange('valorLetras', e.target.value)} className="w-full text-center bg-amber-50 outline-none resize-none overflow-hidden uppercase pb-0 leading-tight font-mono font-normal" />
                ) : (
                  <span className="block w-full leading-tight pb-0.5 uppercase font-mono font-normal text-[11px] sm:text-[11.5px]">{formData.valorLetras}</span>
                )}
             </div>
          </div>
        </div>

        {/* Texto Legal */}
        <div className="text-[8px] text-center leading-tight mb-3 text-black w-full px-2 mt-5 font-mono font-normal">
          Tener en cuenta que para el caso de las adquisición de bienes o servicios del Regimen Comun debe generarse Factura de Venta con el<br />cumplimiento de los requisitos establecidos en el Art. 617 del Estatuto Tributario Y si esta obligado a facturar electronicamente con las<br />condiciones del D..U.R 358 DE 2020.
        </div>

        {/* Tabla */}
        <table className="w-full border-collapse text-[11px] mb-3 text-center font-mono">
          <thead>
            <tr className="bg-[#d9d9d9] font-bold uppercase text-black">
              <th className="border-[1.5px] border-black p-2 w-[14%] text-center align-middle">CANTIDAD</th>
              <th className="border-[1.5px] border-l-0 border-black p-2 text-center align-middle">DESCRIPCION DEL BIEN O SERVICIO</th>
              <th className="border-[1.5px] border-l-0 border-black p-2 w-[18%] align-middle text-center">SUB TOTAL</th>
              <th className="border-[1.5px] border-l-0 border-black p-2 w-[18%] align-middle text-center">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-black h-[180px]">
              <td className="border-[1.5px] border-t-0 border-black p-3 text-center align-middle font-normal">
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.cantidad}
                    onChange={(e) => handleFieldChange('cantidad', e.target.value)}
                    className="w-full text-center bg-amber-50 outline-none font-normal"
                  />
                ) : (
                  formData.cantidad
                )}
              </td>
              <td className="border-[1.5px] border-t-0 border-l-0 border-black p-4 text-center uppercase leading-normal align-middle">
                {isEditing ? (
                  <textarea
                    value={formData.descripcionBienServicio}
                    onChange={(e) => handleFieldChange('descripcionBienServicio', e.target.value)}
                    rows={5}
                    className="w-full h-[140px] bg-amber-50 text-center outline-none resize-none overflow-hidden uppercase font-mono font-normal text-[11px]"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full max-w-[440px] mx-auto">
                    <span className="inline-block align-middle font-normal text-[11px] leading-relaxed">{formData.descripcionBienServicio}</span>
                  </div>
                )}
              </td>
              <td className="border-[1.5px] border-t-0 border-l-0 border-black p-3 text-center align-middle font-normal">
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.subTotal}
                    onChange={(e) => handleFieldChange('subTotal', e.target.value)}
                    className="w-full text-center bg-amber-50 outline-none font-normal"
                  />
                ) : (
                  formData.subTotal
                )}
              </td>
              <td className="border-[1.5px] border-t-0 border-l-0 border-black p-3 text-center align-middle font-normal">
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.total}
                    onChange={(e) => handleFieldChange('total', e.target.value)}
                    className="w-full text-center bg-amber-50 outline-none font-normal"
                  />
                ) : (
                  formData.total
                )}
              </td>
            </tr>
            {/* Fila de Totales */}
            <tr className="font-normal text-black h-[28px]">
              <td colSpan={2} className="border-0 bg-transparent"></td>
              <td className="border-[1.5px] border-t-0 border-black bg-[#d9d9d9] p-1.5 text-center uppercase text-[11px] font-bold">
                TOTAL GENERAL
              </td>
              <td className="border-[1.5px] border-t-0 border-l-0 border-black bg-[#d9d9d9] p-0">
                <div className="flex w-full h-full min-h-[28px] items-stretch">
                  <div className="w-[18%] p-1.5 flex items-center justify-center font-normal text-[11px]">
                    $
                  </div>
                  <div className="w-[82%] p-1.5 pr-3 flex items-center justify-end font-normal text-[11px]">
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.totalGeneral}
                        onChange={(e) => handleFieldChange('totalGeneral', e.target.value)}
                        className="w-full text-right bg-[#d9d9d9] outline-none font-normal"
                      />
                    ) : (
                      formData.totalGeneral
                    )}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Nota RUT adjunto */}
        <div className="flex items-center justify-between text-[11px] text-black font-mono">
          <div className="italic underline underline-offset-2 font-normal">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <span>Nota:</span>
                <input
                  type="text"
                  value={formData.nota}
                  onChange={(e) => handleFieldChange('nota', e.target.value)}
                  className="bg-amber-50 outline-none font-normal"
                />
              </div>
            ) : (
              <span>Nota: {formData.nota}</span>
            )}
          </div>
          <div></div>
        </div>

        </div>
      </div>
    </div>
  );
}

