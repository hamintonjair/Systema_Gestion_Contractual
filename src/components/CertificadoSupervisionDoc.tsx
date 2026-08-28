import React, { useState, useEffect } from 'react';
import { CertificadoSupervisionData, ReportData, createDefaultCertificadoData, FieldComment } from '../types';
import { supabaseService } from '../services/supabaseService';
import { getDatosLiquidacionPeriodo, limpiarNumeroMoneda } from '../utils/paymentPlanUtils';
import { formatDateSlash, quitarDecimales } from '../utils/formatters';
import QuibdoLogo from './QuibdoLogo';
import FieldCommentModal from './FieldCommentModal';
import { Printer, Download, Edit3, Check, Save, RotateCcw, Sparkles, Image as ImageIcon, Calculator, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  data?: CertificadoSupervisionData;
  reportData?: ReportData;
  onChange?: (updated: CertificadoSupervisionData) => void;
  onSave?: (saved: CertificadoSupervisionData) => void;
  isEditable?: boolean;
  onPrint?: () => void;
  storageKey?: string;
  hideGuide?: boolean;
  isReviewMode?: boolean;
  onSaveComment?: (fieldId: string, fieldName: string, comentario: string) => void;
  onDeleteComment?: (fieldId: string) => void;
  authorName?: string;
}

export default function CertificadoSupervisionDoc({
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
  const getInitialData = (): CertificadoSupervisionData => {
    let baseData: CertificadoSupervisionData;
    const key = storageKey || (reportData ? `cert_data_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}` : 'cert_data_global');
    
    let hasSaved = false;
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          baseData = JSON.parse(saved);
          hasSaved = true;
        } catch (e) {
          baseData = data || createDefaultCertificadoData(reportData);
        }
      } else {
        baseData = data || createDefaultCertificadoData(reportData);
      }
    } else {
      baseData = data || createDefaultCertificadoData(reportData);
    }

    if (reportData) {
      return {
        ...baseData,
        reportId: reportData.id || baseData.reportId,
        contratistaNombre: reportData.contratistaNombre || baseData.contratistaNombre,
        contratistaDocumento: reportData.contratistaDocumento || baseData.contratistaDocumento,
        contratoNro: reportData.contratoNro || baseData.contratoNro,
        supervisorNombre: reportData.supervisorNombre || baseData.supervisorNombre,
        objeto: reportData.objeto || baseData.objeto,
        cdpNro: reportData.cdpNro || baseData.cdpNro,
        crpNro: reportData.crpNro || baseData.crpNro,
        fechaInicio: reportData.fechaInicio || baseData.fechaInicio,
        fechaTerminacion: reportData.fechaTerminacion || baseData.fechaTerminacion,
        valorInicial: reportData.valorContrato || baseData.valorInicial,
        periodoDesde: reportData.periodoDesde || baseData.periodoDesde,
        periodoHasta: reportData.periodoHasta || baseData.periodoHasta,
      };
    }
    return baseData;
  };

  const [formData, setFormData] = useState<CertificadoSupervisionData>(getInitialData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    let baseData: CertificadoSupervisionData;
    if (data) {
      baseData = data;
    } else if (reportData) {
      const key = storageKey || `cert_data_${reportData.contratistaDocumento || ''}_${reportData.informeNro || '1'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          baseData = JSON.parse(saved);
        } catch (e) {
          baseData = createDefaultCertificadoData(reportData);
        }
      } else {
        baseData = createDefaultCertificadoData(reportData);
      }
    } else {
      return;
    }

    if (reportData) {
      setFormData({
        ...baseData,
        reportId: reportData.id || baseData.reportId,
        contratistaNombre: reportData.contratistaNombre || baseData.contratistaNombre,
        contratistaDocumento: reportData.contratistaDocumento || baseData.contratistaDocumento,
        contratoNro: reportData.contratoNro || baseData.contratoNro,
        supervisorNombre: reportData.supervisorNombre || baseData.supervisorNombre,
        objeto: reportData.objeto || baseData.objeto,
        cdpNro: reportData.cdpNro || baseData.cdpNro,
        crpNro: reportData.crpNro || baseData.crpNro,
        fechaInicio: reportData.fechaInicio || baseData.fechaInicio,
        fechaTerminacion: reportData.fechaTerminacion || baseData.fechaTerminacion,
        valorInicial: reportData.valorContrato || baseData.valorInicial,
        periodoDesde: reportData.periodoDesde || baseData.periodoDesde,
        periodoHasta: reportData.periodoHasta || baseData.periodoHasta,
      });
    } else {
      setFormData(baseData);
    }
  }, [data, reportData, storageKey]);

  // Utilidad para parsear strings monetarios colombianos a números
  const parseColombianCurrency = (val: string | undefined): number => {
    if (!val || val === '-' || val === '') return 0;
    const withoutCents = val.split(',')[0];
    const clean = withoutCents.replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  const formatColombianCurrency = (val: number): string => {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatThousandSeparated = (val: string | undefined): string => {
    if (!val || val.trim() === '' || val === '-') return '-';
    const num = parseColombianCurrency(val);
    if (num === 0) return '-';
    return new Intl.NumberFormat('es-CO').format(num);
  };

  const processCloneInputsAndTextareas = (cloneEl: HTMLElement) => {
    cloneEl.querySelectorAll('input').forEach(input => {
      const inputEl = input as HTMLInputElement;
      const val = inputEl.value || '';
      const div = document.createElement('div');
      div.textContent = val;
      div.className = inputEl.className.replace(/bg-amber-50/g, '');
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
        font-weight: bold;
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
      div.style.cssText = `
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        box-shadow: none;
        color: #000000;
        font-weight: bold;
        padding: 2px;
        margin: 0;
        box-sizing: border-box;
        line-height: 1.2;
      `;
      textarea.parentNode?.replaceChild(div, textarea);
    });
  };

  const handleFieldChange = (field: keyof CertificadoSupervisionData, value: string) => {
    let formattedVal = value;
    
    // Si es adición y el usuario digita números, formatear con separadores de miles
    if (['adicion1', 'adicion2', 'adicion3'].includes(field)) {
      if (value && value !== '-' && /^\d[\d.]*$/.test(value)) {
        const rawDigits = value.replace(/\D/g, '');
        if (rawDigits) {
          const num = parseInt(rawDigits, 10);
          formattedVal = new Intl.NumberFormat('es-CO').format(num);
        }
      }
    }

    const updated = { ...formData, [field]: formattedVal };

    // Si se modifica valorInicial, adicion1, adicion2 o adicion3, recalcular automáticamente valorTotal
    if (['valorInicial', 'adicion1', 'adicion2', 'adicion3'].includes(field)) {
      const vInicial = parseColombianCurrency(field === 'valorInicial' ? formattedVal : formData.valorInicial);
      const vAdic1 = parseColombianCurrency(field === 'adicion1' ? formattedVal : formData.adicion1);
      const vAdic2 = parseColombianCurrency(field === 'adicion2' ? formattedVal : formData.adicion2);
      const vAdic3 = parseColombianCurrency(field === 'adicion3' ? formattedVal : formData.adicion3);
      const totalNum = vInicial + vAdic1 + vAdic2 + vAdic3;
      updated.valorTotal = formatColombianCurrency(totalNum);
    }

    setFormData(updated);
    if (onChange) {
      onChange(updated);
    }
  };

  // Función para autocalcular y sincronizar la tabla 6 (Liquidación del pago) con el plan de pagos matemático
  const handleAutoCalcularPlanPagos = () => {
    const numValTotal = limpiarNumeroMoneda(formData.valorTotal || formData.valorInicial || reportData?.valorContrato || '$ 20.029.800');
    const fInicio = formData.fechaInicio || reportData?.fechaInicio || '14/01/2026';
    const fFin = formData.fechaTerminacion || reportData?.fechaTerminacion || '14/07/2026';
    const nPago = formData.pagoNro || reportData?.informeNro || '1';

    if (numValTotal > 0 && fInicio && fFin) {
      const valMensual = reportData?.valorMensual ? limpiarNumeroMoneda(reportData.valorMensual) : undefined;
      const autoLiq = getDatosLiquidacionPeriodo({
        valor_total_contrato: numValTotal,
        valor_mensual: valMensual,
        fecha_inicio: fInicio,
        fecha_fin: fFin,
      }, nPago);

      if (autoLiq) {
        const updated: CertificadoSupervisionData = {
          ...formData,
          pagoNro: autoLiq.pagoNro,
          periodoDesde: autoLiq.periodoDesde,
          periodoHasta: autoLiq.periodoHasta,
          porcentajeEjecucion: autoLiq.porcentajeEjecucion,
          valorPagadoAcumulado: autoLiq.valorPagadoAcumulado,
          valorAPagarSinIva: autoLiq.valorAPagarSinIva,
          iva: autoLiq.iva,
          valorTotalAPagar: autoLiq.valorTotalAPagar,
          saldoPorPagar: autoLiq.saldoPorPagar,
          valorRubro: autoLiq.valorAPagarSinIva,
          valorAvalado: `$ ${autoLiq.valorTotalAPagar}`,
        };
        setFormData(updated);
        if (onChange) onChange(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    }
  };

  const certComment = reportData?.comentariosCampos?.['certificado_supervision'] || 
    Object.values(reportData?.comentariosCampos || {}).find((c: any) => 
      c.campoId === 'certificado_supervision' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('certificado de supervisión'))
    );

  const handleMarkCommentAsFixed = async () => {
    if (!reportData) return;
    const currentComments = { ...(reportData.comentariosCampos || {}) };
    const targetKey = Object.keys(currentComments).find(k => 
      k === 'certificado_supervision' || 
      (currentComments[k]?.nombreCampo && currentComments[k]?.nombreCampo.toLowerCase().includes('certificado de supervisión'))
    ) || 'certificado_supervision';

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
    const key = storageKey || (reportData ? `cert_data_${reportData.contratistaDocumento || ''}_${reportData.informeNro || formData.pagoNro || '1'}` : `cert_data_${formData.contratistaDocumento || ''}_${formData.pagoNro || '1'}`);
    localStorage.setItem(key, JSON.stringify(formData));
    localStorage.setItem(`cert_data_${formData.pagoNro || '1'}`, JSON.stringify(formData));
    
    // Guardar y sincronizar en Supabase
    await supabaseService.saveCertificadoSupervision(formData, reportData?.id);

    if (certComment && !certComment.corregido) {
      await handleMarkCommentAsFixed();
    }

    if (onSave) {
      onSave(formData);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDirectPrint = () => {
    const element = document.getElementById('certificado-supervision-document');
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

      // Clonar estilos existentes
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
            <title>Certificado de Supervisión - Alcaldía de Quibdó</title>
            ${styles}
            <style>
              @page {
                size: letter;
                margin-top: 5mm;
                margin-bottom: 0mm;
                margin-left: 5mm;
                margin-right: 5mm;
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
                font-family: "Times New Roman", Times, Georgia, serif !important;
                width: 215.9mm !important;
                height: 279.4mm !important;
              }
              #certificado-supervision-document {
                width: 205.9mm !important;
                height: 269.4mm !important;
                border: 2px solid #000000 !important;
                padding: 10px 14px !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                overflow: hidden !important;
              }
              th, .bg-\\[\\#d1d5db\\] {
                background-color: #d1d5db !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }
      }, 350);
    } catch (e) {
      window.print();
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('certificado-supervision-document');
    if (!element) {
      handleDirectPrint();
      setIsExporting(false);
      return;
    }

    const cleanName = formData.contratistaNombre
      ? formData.contratistaNombre.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_').toUpperCase()
      : 'CONTRATISTA';
    const filename = `CERTIFICADO_SUPERVISION_PAGO_${formData.pagoNro}_${cleanName}.pdf`;

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '816px';
    clone.style.margin = '0';
    clone.style.padding = '10px 14px';
    clone.style.backgroundColor = '#ffffff';

    processCloneInputsAndTextareas(clone);

    const styleOverridePdf = document.createElement('style');
    styleOverridePdf.textContent = `
      * {
        color: #000000 !important;
        border-color: #000000 !important;
      }
      th, .bg-\\[\\#d1d5db\\] {
        background-color: #d1d5db !important;
      }
      #certificado-supervision-document {
        background-color: #ffffff !important;
        color: #000000 !important;
        width: 816px !important;
        height: 1020px !important;
        overflow: hidden !important;
        box-shadow: none !important;
      }
    `;
    clone.appendChild(styleOverridePdf);

    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const margin = 6; // 6mm margin
      
      const usableWidth = pageWidth - (margin * 2);
      const usableHeight = pageHeight - (margin * 2);

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const canvasAspect = canvasWidth / canvasHeight;

      let renderWidth = usableWidth;
      let renderHeight = renderWidth / canvasAspect;

      if (renderHeight > usableHeight) {
        renderHeight = usableHeight;
        renderWidth = renderHeight * canvasAspect;
      }

      const x = margin + (usableWidth - renderWidth) / 2;
      const y = margin + (usableHeight - renderHeight) / 2;

      pdf.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight);
      pdf.save(filename);
    } finally {
      if (document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    setIsExportingImage(true);
    const element = document.getElementById('certificado-supervision-document');
    if (!element) {
      setIsExportingImage(false);
      return;
    }

    const cleanName = formData.contratistaNombre
      ? formData.contratistaNombre.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_').toUpperCase()
      : 'CONTRATISTA';
    const filename = `CERTIFICADO_SUPERVISION_PAGO_${formData.pagoNro}_${cleanName}.png`;

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '816px';
    clone.style.margin = '0';
    clone.style.padding = '10px 14px';
    clone.style.backgroundColor = '#ffffff';

    processCloneInputsAndTextareas(clone);

    const styleOverrideImg = document.createElement('style');
    styleOverrideImg.textContent = `
      * {
        color: #000000 !important;
        border-color: #000000 !important;
      }
      th, .bg-\\[\\#d1d5db\\] {
        background-color: #d1d5db !important;
      }
      #certificado-supervision-document {
        background-color: #ffffff !important;
        color: #000000 !important;
        width: 816px !important;
        height: 1020px !important;
        overflow: hidden !important;
        box-shadow: none !important;
      }
    `;
    clone.appendChild(styleOverrideImg);

    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generando imagen del certificado:', error);
    } finally {
      if (document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
      setIsExportingImage(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center select-text">
      {/* Barra de Acciones Superior (Oculta al imprimir) */}
      <div className="w-full max-w-[850px] bg-white border border-slate-300 rounded-xl p-3 mb-2 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#006b33]"></span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide font-serif">
            Certificado de Supervisión y Autorización de Desembolso
          </span>
          <span className="text-[11px] font-mono bg-emerald-100 text-[#006b33] font-bold px-2 py-0.5 rounded border border-emerald-300">
            Pago #{formData.pagoNro}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditable && (
            <button
              onClick={handleAutoCalcularPlanPagos}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Calcular automáticamente fechas, días base 30, porcentaje de ejecución y saldo a pagar de este período"
            >
              <Calculator size={14} className="text-[#006b33]" />
              <span>Autocalcular Liquidación</span>
            </button>
          )}

          {isEditable && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isEditing 
                  ? 'bg-amber-400 text-gray-950 hover:bg-amber-300 shadow-xs' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
              <span>{isEditing ? 'Modo Visualización' : 'Llenar / Editar Campos'}</span>
            </button>
          )}

          {isEditable && (
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-[#006b33] hover:bg-[#005729] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {saveSuccess ? <Check size={14} className="text-amber-300" /> : <Save size={14} />}
              <span>{saveSuccess ? '¡Guardado con Éxito!' : 'Guardar Cambios'}</span>
            </button>
          )}

          <button
            onClick={onPrint || handleDirectPrint}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Printer size={14} />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Guía Paso a Paso para Edición de Campos (Oculta al imprimir) */}
      {!hideGuide && (
        <div className="w-full max-w-[850px] bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/60 border border-emerald-200 rounded-xl p-3 mb-4 text-slate-700 shadow-xs print:hidden">
          <div className="flex items-start gap-2.5">
            <div className="bg-[#006b33] text-white p-1 rounded-md mt-0.5 shrink-0 shadow-xs">
              <Sparkles size={14} />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-950">
                  Guía para Diligenciar y Editar este Certificado:
                </span>
                <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {isEditing ? 'Modo Edición Activado' : 'Modo Lectura'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-snug">
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">1. Habilitar Edición:</span>
                  Haga clic en <strong className="text-amber-900 bg-amber-100 px-1 py-0.5 rounded">«Llenar / Editar Campos»</strong> para habilitar las casillas editables del documento (resaltadas en amarillo suave).
                </div>
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">2. Calcular o Modificar:</span>
                  Use <strong className="text-emerald-900 bg-emerald-100 px-1 py-0.5 rounded">«Autocalcular Liquidación»</strong> para autocompletar días y saldos, o ajuste los rubros, fechas y firmas directamente.
                </div>
                <div className="bg-white/90 border border-emerald-100 p-2 rounded-lg">
                  <span className="font-bold text-emerald-900 block mb-0.5">3. Guardar e Imprimir:</span>
                  Presione <strong className="text-emerald-900 bg-emerald-200 px-1 py-0.5 rounded">«Guardar Cambios»</strong> para registrar los datos y luego <strong className="text-slate-900 bg-slate-200 px-1 py-0.5 rounded">«Imprimir»</strong> para obtener el PDF oficial.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER OBSERVACIONES PARA EL CONTRATISTA (PENDIENTE DE CORREGIR) */}
      {!isReviewMode && certComment && !certComment.corregido && (
        <div className="w-full max-w-[850px] mb-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[10.5px] uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                  Observación de Supervisión (Pendiente)
                </span>
                <span className="text-[10.5px] text-amber-800 font-semibold">
                  {certComment.fecha || 'Reciente'} • {certComment.autor || 'Supervisora'}
                </span>
              </div>
              <p className="text-xs font-bold text-amber-950 mt-1">
                "{certComment.comentario}"
              </p>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Modifique los campos correspondientes y presione <strong>"Guardar Cambios"</strong> o <strong>"Marcar como Subsanado"</strong> para enviar la corrección.
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
      {!isReviewMode && certComment && certComment.corregido && (
        <div className="w-full max-w-[850px] mb-3 p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm print:hidden">
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
                Has corregido la observación: <span className="italic font-bold">"{certComment.comentario}"</span>. Tu documento actualizado está registrado y en espera de validación final por la supervisora.
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
        certComment ? (
          certComment.corregido ? (
            <div className="w-full max-w-[850px] mb-3 p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm print:hidden">
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
                    Observación atendida: "{certComment.comentario}"
                  </p>
                  <p className="text-[11px] text-emerald-900 mt-0.5">
                    El contratista ha modificado y marcado como subsanado este certificado. Verifique los datos y presione <strong>"Validar y Quitar Observación"</strong> si es conforme.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteComment) {
                      onDeleteComment('certificado_supervision');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Validar y Quitar Observación</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCommentModal('certificado_supervision', 'Certificado de Supervisión', 'Certificado Oficial de Supervisión')}
                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors"
                  title="Editar observación"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[850px] mb-3 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10.5px] uppercase bg-amber-200 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                      ⚠️ Observación Activa (Pendiente de Corrección)
                    </span>
                    <span className="text-[10.5px] text-amber-800 font-semibold">
                      {certComment.fecha || 'Reciente'} • {certComment.autor || 'Supervisora'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-amber-950 mt-1">
                    "{certComment.comentario}"
                  </p>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    El contratista aún <strong>NO</strong> ha modificado ni marcado como subsanado este documento.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openCommentModal('certificado_supervision', 'Certificado de Supervisión', 'Certificado Oficial de Supervisión')}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Editar Observación</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="w-full max-w-[850px] mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-xs print:hidden">
            <div className="flex items-center gap-2 font-bold">
              <MessageSquare size={16} className="text-amber-700" />
              <span>Modo Revisión: Haga clic en el botón para dejar observaciones y comentarios sobre este certificado.</span>
            </div>
            <button
              type="button"
              onClick={() => openCommentModal('certificado_supervision', 'Certificado de Supervisión', 'Certificado Oficial de Supervisión')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
            >
              <MessageSquare size={13} />
              <span>Comentar Certificado</span>
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

      {/* DOCUMENTO OFICIAL EXACTO - Times New Roman */}
      <div className="w-full max-w-full overflow-x-auto pb-4 flex justify-start sm:justify-center">
        <div 
          id="certificado-supervision-document"
          className="min-w-[760px] max-w-[850px] w-full bg-white border-2 border-black p-4 sm:p-6 text-black shrink-0 print:p-2.5 print:border-2 print:border-black print:w-[205.9mm] print:h-[269.4mm] print:overflow-hidden print:mx-auto text-[10px] sm:text-[10.5px] leading-tight select-text"
          style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
        >
        <style>{`
          @media print {
            @page {
              size: letter;
              margin-top: 5mm !important;
              margin-bottom: 0mm !important;
              margin-left: 5mm !important;
              margin-right: 5mm !important;
            }
            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              width: 215.9mm !important;
              height: 279.4mm !important;
            }
            input, textarea {
              appearance: none !important;
              -webkit-appearance: none !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              background: transparent !important;
              outline: none !important;
              box-shadow: none !important;
              text-align: inherit !important;
              font-size: inherit !important;
              font-family: inherit !important;
              font-weight: inherit !important;
              color: #000000 !important;
              min-height: 0 !important;
              line-height: inherit !important;
            }
            /* Asegurar altura exacta de campos rellenables en impresión */
            .min-h-\\[23px\\], .min-h-\\[19px\\] {
              min-height: 18px !important;
              height: 18px !important;
            }
          }
        `}</style>
        
        {/* CABECERA CON LOGO OFICIAL Y TÍTULO */}
        <div className="relative flex items-center justify-center pb-2 mb-2 w-full min-h-[96px] print:min-h-[85px]">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 shrink-0 flex items-center">
            <QuibdoLogo variant="full" size="lg" className="scale-100 print:scale-90 origin-left" />
          </div>
          <div className="text-center px-4 w-full max-w-[580px] print:max-w-[580px]">
            <h1 className="text-[14px] sm:text-[15.5px] print:text-[13.5px] font-bold tracking-tight uppercase text-black leading-tight whitespace-normal md:whitespace-nowrap print:whitespace-nowrap">
              CERTIFICADO DE SUPERVISIÓN Y AUTORIZACIÓN DE DESEMBOLSO
            </h1>
          </div>
        </div>

        {/* 1. INFORMACIÓN CONTRACTUAL */}
        <div className="w-full mb-1">
          {/* Franja gris institucional */}
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black">
            INFORMACIÓN CONTRACTUAL
          </div>

          <div className="flex gap-2 text-[10px] items-stretch">
            
            {/* Columna Izquierda: Datos del Contratista y Supervisor (58% del ancho) */}
            <div className="w-[58%] flex flex-col justify-between space-y-0.5">
              
              {/* Fila Nombre Contratista */}
              <div className="flex items-center">
                <span className="w-[145px] font-normal text-[10px] shrink-0">Nombre del (la) Contratista</span>
                <div className="flex-1 border border-black px-1.5 py-0 font-bold uppercase min-h-[19px] flex items-center">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.contratistaNombre}
                      onChange={(e) => handleFieldChange('contratistaNombre', e.target.value)}
                      className="w-full bg-amber-50 text-black font-bold uppercase text-[10px] focus:outline-none"
                    />
                  ) : (
                    formData.contratistaNombre
                  )}
                </div>
              </div>

              {/* Fila Tipo de Contrato */}
              <div className="flex items-center">
                <span className="w-[145px] font-normal text-[10px] shrink-0">Tipo de Contrato</span>
                <div className="flex-1 border border-black px-1.5 py-0 font-bold uppercase min-h-[19px] flex items-center">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.tipoContrato}
                      onChange={(e) => handleFieldChange('tipoContrato', e.target.value)}
                      className="w-full bg-amber-50 text-black font-bold uppercase text-[10px] focus:outline-none"
                    />
                  ) : (
                    formData.tipoContrato
                  )}
                </div>
              </div>

              {/* Fila Contrato Nº y Año (Alineados a la derecha con los demás cuadros, 'DE' centrado) */}
              <div className="flex items-center justify-between">
                <span className="w-[145px] font-normal text-[10px] shrink-0">Contrato Nº</span>
                <div className="flex-1 flex items-center justify-end">
                  <div className="w-[72px] border border-black px-1 py-0 text-center font-bold min-h-[19px] flex items-center justify-center">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.contratoNro}
                        onChange={(e) => handleFieldChange('contratoNro', e.target.value)}
                        className="w-full bg-amber-50 text-center font-bold text-[10px] focus:outline-none"
                      />
                    ) : (
                      formData.contratoNro
                    )}
                  </div>
                  <span className="font-bold text-[10px] flex-1 text-center">DE</span>
                  <div className="w-[85px] border border-black px-1 py-0 text-center font-bold min-h-[19px] flex items-center justify-center">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.contratoAno}
                        onChange={(e) => handleFieldChange('contratoAno', e.target.value)}
                        className="w-full bg-amber-50 text-center font-bold text-[10px] focus:outline-none"
                      />
                    ) : (
                      formData.contratoAno
                    )}
                  </div>
                </div>
              </div>

              {/* Fila Documento de Identidad (Cédula y número alineados a la derecha con los demás cuadros) */}
              <div className="flex items-center justify-between">
                <span className="w-[145px] font-normal text-[10px] shrink-0 text-black">Documento de Identidad</span>
                <div className="flex-1 flex items-center justify-end">
                  <div className="w-[50px] border border-black px-1 py-0 text-center font-bold text-black min-h-[19px] flex items-center justify-center">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.tipoDocumento}
                        onChange={(e) => handleFieldChange('tipoDocumento', e.target.value)}
                        className="w-full bg-amber-50 text-center font-bold text-black text-[10px] focus:outline-none"
                      />
                    ) : (
                      formData.tipoDocumento
                    )}
                  </div>
                  <span className="font-bold text-[10px] px-2 text-center text-black">Nº</span>
                  <div className="flex-1 border border-black px-2 py-0 text-right font-bold text-black min-h-[19px] flex items-center justify-end">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.contratistaDocumento}
                        onChange={(e) => handleFieldChange('contratistaDocumento', e.target.value)}
                        className="w-full bg-amber-50 text-right font-bold text-black text-[10px] focus:outline-none"
                      />
                    ) : (
                      formData.contratistaDocumento
                    )}
                  </div>
                </div>
              </div>

              {/* Fila Nombre de Supervisor */}
              <div className="flex items-center">
                <span className="w-[145px] font-normal text-[9.5px] sm:text-[10px] shrink-0 leading-tight pr-1">
                  Nombre de Supervisor(a) o Interventor(a)
                </span>
                <div className="flex-1 border border-black px-1.5 py-0 text-center font-bold uppercase min-h-[19px] flex items-center justify-center">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.supervisorNombre}
                      onChange={(e) => handleFieldChange('supervisorNombre', e.target.value)}
                      className="w-full bg-amber-50 text-center font-bold uppercase text-[10px] focus:outline-none"
                    />
                  ) : (
                    formData.supervisorNombre
                  )}
                </div>
              </div>

              {/* Fila Cargo Supervisor */}
              <div className="flex items-center">
                <span className="w-[145px] font-normal text-[9.5px] sm:text-[10px] shrink-0 leading-tight pr-1">
                  Cargo Supervisor(a) o Interventor(a)
                </span>
                <div className="flex-1 border border-black px-1.5 py-0 text-center font-normal text-[9.5px] sm:text-[10px] min-h-[19px] flex items-center justify-center">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.supervisorCargo}
                      onChange={(e) => handleFieldChange('supervisorCargo', e.target.value)}
                      className="w-full bg-amber-50 text-center text-[9.5px] sm:text-[10px] focus:outline-none"
                    />
                  ) : (
                    formData.supervisorCargo
                  )}
                </div>
              </div>

            </div>

            {/* Columna Derecha: OBJETO (42% del ancho, más amplio para textos largos) */}
            <div className="w-[42%] flex items-stretch gap-1">
              <span className="font-normal text-[10px] pt-0.5 shrink-0">OBJETO</span>
              <div className="flex-1 border border-black p-1 text-justify text-[9px] sm:text-[9.5px] leading-snug uppercase flex flex-col justify-start">
                {isEditing ? (
                  <textarea 
                    rows={6}
                    value={formData.objeto}
                    onChange={(e) => handleFieldChange('objeto', e.target.value)}
                    className="w-full h-full bg-amber-50 text-black uppercase text-[9px] sm:text-[9.5px] focus:outline-none resize-none leading-snug"
                  />
                ) : (
                  <p className="m-0 leading-snug">{formData.objeto}</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* 2. MANIFESTACIÓN DE INTENCIÓN */}
        <div className="w-full mb-1">
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black/30">
            MANIFESTACIÓN DE INTENCIÓN
          </div>
          
          <div className="text-justify text-[10px] leading-relaxed pt-0.5">
            Una vez revisada la documentación enviada por el señor{' '}
            <span className="inline-block border-b border-black font-bold uppercase px-3 text-center min-w-[280px] print:border-b-[1px]">
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.contratistaNombre}
                  onChange={(e) => handleFieldChange('contratistaNombre', e.target.value)}
                  className="bg-amber-50 font-bold uppercase text-center text-[10px] focus:outline-none w-full print:appearance-none print:p-0 print:m-0 print:border-none print:bg-transparent print:outline-none"
                />
              ) : (
                formData.contratistaNombre
              )}
            </span>
            {' '}en su calidad de contratista/convenido del Municipio de Quibdó de acuerdo con el contrato (convenio) No{' '}
            <span className="inline-block border-b border-black font-bold px-2 text-center min-w-[60px] print:border-b-[1px]">
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.contratoNro}
                  onChange={(e) => handleFieldChange('contratoNro', e.target.value)}
                  className="bg-amber-50 font-bold text-center text-[10px] focus:outline-none w-full print:appearance-none print:p-0 print:m-0 print:border-none print:bg-transparent print:outline-none"
                />
              ) : (
                formData.contratoNro
              )}
            </span>
            {' '}en cumplimiento de la cláusula{' '}
            <span className="inline-block border-b border-black font-bold px-2 text-center min-w-[50px] print:border-b-[1px]">
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.clausulaNro}
                  onChange={(e) => handleFieldChange('clausulaNro', e.target.value)}
                  className="bg-amber-50 font-bold text-center text-[10px] focus:outline-none w-full print:appearance-none print:p-0 print:m-0 print:border-none print:bg-transparent print:outline-none"
                />
              ) : (
                formData.clausulaNro
              )}
            </span>
            {' '}del convenio/contrato en mención, solicito respetuosamente realizar el trámite de pago (o desembolso), con base en la siguiente información y anexos de cumplimiento.
          </div>
        </div>

        {/* 3. INFORMACIÓN FINANCIERA */}
        <div className="w-full mb-1">
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black/30">
            INFORMACIÓN FINANCIERA
          </div>
          
          <div className="space-y-0.5 text-[10px]">
            {/* Fila 1: Cuenta Bancaria, Banco y Tipo cuenta */}
            <div className="flex items-center">
              <span className="w-[150px] shrink-0 font-normal">Número cuenta del (a) Contratista</span>
              <div className="w-[170px] border border-black px-1.5 py-0 text-right font-bold min-h-[19px] flex items-center justify-end">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.numeroCuenta ?? ''}
                    onChange={(e) => handleFieldChange('numeroCuenta', e.target.value)}
                    className="w-full bg-amber-50 text-right text-black font-bold text-[10px] focus:outline-none"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.numeroCuenta
                )}
              </div>
              <span className="font-normal px-2">Banco</span>
              <div className="w-[130px] border border-black px-1.5 py-0 text-right font-normal min-h-[19px] flex items-center justify-end">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.banco ?? ''}
                    onChange={(e) => handleFieldChange('banco', e.target.value)}
                    className="w-full bg-amber-50 text-right text-black font-normal text-[10px] focus:outline-none"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.banco
                )}
              </div>
              <span className="font-normal px-2">Tipo cuenta</span>
              <div className="flex-1 border border-black px-1.5 py-0 text-center font-normal min-h-[19px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.tipoCuenta ?? ''}
                    onChange={(e) => handleFieldChange('tipoCuenta', e.target.value)}
                    className="w-full bg-amber-50 text-center text-black font-normal text-[10px] focus:outline-none"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.tipoCuenta
                )}
              </div>
            </div>

            {/* Fila 2: Fecha de Inicio y Plazo */}
            <div className="flex items-center">
              <span className="w-[150px] shrink-0 font-normal text-black">Fecha de inicio (Según Acta)</span>
              <div className="w-[100px] border border-black px-1.5 py-0 text-right font-normal text-black min-h-[19px] flex items-center justify-end bg-white">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaInicio ?? ''}
                    onChange={(e) => handleFieldChange('fechaInicio', e.target.value)}
                    className="w-full bg-amber-50 text-right text-black font-semibold text-[10px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000', WebkitTextFillColor: '#000000', opacity: 1 }}
                  />
                ) : (
                  formData.fechaInicio
                )}
              </div>
              <div className="flex items-center ml-8">
                <span className="font-normal pr-2 text-black">Plazo de Ejecución</span>
                <div className="w-[35px] border border-black px-1 py-0 text-center font-bold text-black min-h-[19px] flex items-center justify-center">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.plazoMeses}
                      onChange={(e) => handleFieldChange('plazoMeses', e.target.value)}
                      className="w-full bg-amber-50 text-center font-bold text-black text-[10px] focus:outline-none"
                      style={{ color: '#000000', WebkitTextFillColor: '#000000', opacity: 1 }}
                    />
                  ) : (
                    formData.plazoMeses
                  )}
                </div>
                <span className="px-1.5 font-normal text-black">meses, y</span>
                <div className="w-[24px] border border-black px-1 py-0 text-center font-bold text-black min-h-[19px] flex items-center justify-center">
                  {isEditing ? (
                    <input 
                      type="text"
                      value={formData.plazoDias}
                      onChange={(e) => handleFieldChange('plazoDias', e.target.value)}
                      className="w-full bg-amber-50 text-center font-bold text-black text-[10px] focus:outline-none"
                      style={{ color: '#000000', WebkitTextFillColor: '#000000', opacity: 1 }}
                    />
                  ) : (
                    formData.plazoDias
                  )}
                </div>
                <span className="pl-1 font-normal text-black">días</span>
              </div>
            </div>

            {/* Fila 3: Fecha de Terminación */}
            <div className="flex items-center">
              <span className="w-[150px] shrink-0 font-normal text-black">Fecha de terminación (Incluye prórrogas)</span>
              <div className="w-[100px] border border-black px-1.5 py-0 text-right font-normal text-black min-h-[19px] flex items-center justify-end bg-white">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaTerminacion ?? ''}
                    onChange={(e) => handleFieldChange('fechaTerminacion', e.target.value)}
                    className="w-full bg-amber-50 text-right text-black font-semibold text-[10px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000', WebkitTextFillColor: '#000000', opacity: 1 }}
                  />
                ) : (
                  formData.fechaTerminacion
                )}
              </div>
            </div>

            {/* Tablas dobles lado a lado: más estrechas y alineadas hacia la izquierda */}
            <div className="flex items-start gap-4 pt-0.5 justify-start">
              
              {/* Tabla Izquierda: Valores (Más estrecha ~220px) */}
              <div className="w-[210px] border border-black">
                <table className="w-full border-collapse text-[9.5px]">
                  <tbody>
                    <tr className="border-b border-black font-bold">
                      <td className="p-0.5 px-1 border-r border-black w-[45%] text-[9px]">VALOR INICIAL</td>
                      <td className="p-0.5 px-1 text-right font-mono flex items-center justify-between">
                        <span className="font-bold">$</span>
                        <span className="font-bold text-[9.5px]">
                          {isEditing ? (
                            <input 
                              type="text"
                              value={(formData.valorInicial || '').replace(/^[$\s]+/, '')}
                              onChange={(e) => handleFieldChange('valorInicial', e.target.value)}
                              className="bg-amber-50 text-right text-black font-mono font-bold text-[9.5px] focus:outline-none w-full"
                              style={{ color: '#000000' }}
                            />
                          ) : (
                            (formData.valorInicial || '').replace(/^[$\s]+/, '')
                          )}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">Adición 1</td>
                      <td className="p-0.5 px-1 text-right font-mono text-[9px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.adicion1 || ''}
                            onChange={(e) => handleFieldChange('adicion1', e.target.value)}
                            className="bg-amber-50 text-right text-black font-mono text-[9px] focus:outline-none w-full pr-0.5"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          <span className="text-right block w-full pr-0.5 text-black">
                            {formData.adicion1 === '-' || !formData.adicion1 ? '-' : formatThousandSeparated(formData.adicion1)}
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">Adición 2</td>
                      <td className="p-0.5 px-1 text-right font-mono text-[9px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.adicion2 || ''}
                            onChange={(e) => handleFieldChange('adicion2', e.target.value)}
                            className="bg-amber-50 text-right text-black font-mono text-[9px] focus:outline-none w-full pr-0.5"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          <span className="text-right block w-full pr-0.5 text-black">
                            {formData.adicion2 === '-' || !formData.adicion2 ? '-' : formatThousandSeparated(formData.adicion2)}
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">Adición 3</td>
                      <td className="p-0.5 px-1 text-right font-mono text-[9px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.adicion3 || ''}
                            onChange={(e) => handleFieldChange('adicion3', e.target.value)}
                            className="bg-amber-50 text-right text-black font-mono text-[9px] focus:outline-none w-full pr-0.5"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          <span className="text-right block w-full pr-0.5 text-black">
                            {formData.adicion3 === '-' || !formData.adicion3 ? '-' : formatThousandSeparated(formData.adicion3)}
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="font-bold">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">VALOR TOTAL</td>
                      <td className="p-0.5 px-1 text-right font-mono flex items-center justify-between">
                        <span className="font-bold">$</span>
                        <span className="font-bold text-[9.5px]">
                          {isEditing ? (
                            <input 
                              type="text"
                              value={(formData.valorTotal || '').replace(/^[$\s]+/, '')}
                              onChange={(e) => handleFieldChange('valorTotal', e.target.value)}
                              className="bg-amber-50 text-right text-black font-mono font-bold text-[9.5px] focus:outline-none w-full"
                              style={{ color: '#000000' }}
                            />
                          ) : (
                            (formData.valorTotal || '').replace(/^[$\s]+/, '')
                          )}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tabla Derecha: Prórrogas (Más estrecha ~240px) */}
              <div className="w-[220px] border border-black">
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr className="border-b border-black font-bold">
                      <th className="p-0.5 px-1 text-left border-r border-black w-3/5 font-bold text-[9px]">Prórrogas</th>
                      <th className="p-0.5 px-1 text-center font-bold text-[9px]">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">Prórroga 1</td>
                      <td className="p-0.5 px-1 text-center font-mono text-[9px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.prorroga1Dias}
                            onChange={(e) => handleFieldChange('prorroga1Dias', e.target.value)}
                            className="bg-amber-50 text-center font-mono text-[9px] focus:outline-none w-full"
                          />
                        ) : (
                          formData.prorroga1Dias
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">Prórroga 2</td>
                      <td className="p-0.5 px-1 text-center font-mono text-[9px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.prorroga2Dias}
                            onChange={(e) => handleFieldChange('prorroga2Dias', e.target.value)}
                            className="bg-amber-50 text-center font-mono text-[9px] focus:outline-none w-full"
                          />
                        ) : (
                          formData.prorroga2Dias
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-0.5 px-1 border-r border-black text-[9px]">Prórroga 3</td>
                      <td className="p-0.5 px-1 text-center font-mono text-[9px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.prorroga3Dias}
                            onChange={(e) => handleFieldChange('prorroga3Dias', e.target.value)}
                            className="bg-amber-50 text-center font-mono text-[9px] focus:outline-none w-full"
                          />
                        ) : (
                          formData.prorroga3Dias
                        )}
                      </td>
                    </tr>
                    <tr className="h-[15px]">
                      <td className="p-0.5 px-1 border-r border-black"></td>
                      <td className="p-0.5 px-1"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        </div>

        {/* 4. INFORMACIÓN PRESUPUESTAL */}
        <div className="w-full mb-1">
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black">
            INFORMACIÓN PRESUPUESTAL
          </div>
          
          {/* Cuadro principal enmarcado con separaciones limpias y columnas individuales con todas las 5 filas siempre visibles */}
          <div className="border-[2px] border-black bg-white flex items-stretch justify-between px-2.5 py-0">
            {/* Columna 1: No. Certificado Disponibilidad Presupuestal */}
            <div className="w-[14%] border-x border-black flex flex-col bg-white">
              <div className="p-1 print:p-0.5 text-center font-bold text-[9px] print:text-[8.5px] leading-tight print:leading-none border-b border-black h-[38px] print:h-[28px] flex items-center justify-center">
                No. Certificado Disponibilidad Presupuestal
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.cdpNro ?? ''}
                    onChange={(e) => handleFieldChange('cdpNro', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.cdpNro || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.cdpNro2 ?? ''}
                    onChange={(e) => handleFieldChange('cdpNro2', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.cdpNro2 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.cdpNro3 ?? ''}
                    onChange={(e) => handleFieldChange('cdpNro3', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.cdpNro3 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.cdpNro4 ?? ''}
                    onChange={(e) => handleFieldChange('cdpNro4', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.cdpNro4 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.cdpNro5 ?? ''}
                    onChange={(e) => handleFieldChange('cdpNro5', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.cdpNro5 || ''
                )}
              </div>
            </div>

            {/* Columna 2: No. Registro Presupuestal */}
            <div className="w-[13.5%] border-x border-black flex flex-col bg-white">
              <div className="p-1 print:p-0.5 text-center font-bold text-[9px] print:text-[8.5px] leading-tight print:leading-none border-b border-black h-[38px] print:h-[28px] flex items-center justify-center">
                No. Registro Presupuestal
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.crpNro ?? ''}
                    onChange={(e) => handleFieldChange('crpNro', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.crpNro || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.crpNro2 ?? ''}
                    onChange={(e) => handleFieldChange('crpNro2', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.crpNro2 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.crpNro3 ?? ''}
                    onChange={(e) => handleFieldChange('crpNro3', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.crpNro3 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.crpNro4 ?? ''}
                    onChange={(e) => handleFieldChange('crpNro4', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.crpNro4 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.crpNro5 ?? ''}
                    onChange={(e) => handleFieldChange('crpNro5', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.crpNro5 || ''
                )}
              </div>
            </div>

            {/* Columna 3: Fecha Registro Presupuestal */}
            <div className="w-[17%] border-x border-black flex flex-col bg-white">
              <div className="p-1 print:p-0.5 text-center font-bold text-[9px] print:text-[8.5px] leading-tight print:leading-none border-b border-black h-[38px] print:h-[28px] flex items-center justify-center">
                Fecha Registro Presupuestal
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaRegistroPresupuestal ?? ''}
                    onChange={(e) => handleFieldChange('fechaRegistroPresupuestal', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.fechaRegistroPresupuestal || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaRegistroPresupuestal2 ?? ''}
                    onChange={(e) => handleFieldChange('fechaRegistroPresupuestal2', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.fechaRegistroPresupuestal2 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaRegistroPresupuestal3 ?? ''}
                    onChange={(e) => handleFieldChange('fechaRegistroPresupuestal3', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.fechaRegistroPresupuestal3 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaRegistroPresupuestal4 ?? ''}
                    onChange={(e) => handleFieldChange('fechaRegistroPresupuestal4', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.fechaRegistroPresupuestal4 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.fechaRegistroPresupuestal5 ?? ''}
                    onChange={(e) => handleFieldChange('fechaRegistroPresupuestal5', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.fechaRegistroPresupuestal5 || ''
                )}
              </div>
            </div>

            {/* Columna 4: Código Rubro Presupuestal */}
            <div className="w-[23%] border-x border-black flex flex-col bg-white">
              <div className="p-1 print:p-0.5 text-center font-bold text-[9px] print:text-[8.5px] leading-tight print:leading-none border-b border-black h-[38px] print:h-[28px] flex items-center justify-center">
                Código Rubro Presupuestal
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[9.5px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.codigoRubro ?? ''}
                    onChange={(e) => handleFieldChange('codigoRubro', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[9.5px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.codigoRubro || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[9.5px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.codigoRubro2 ?? ''}
                    onChange={(e) => handleFieldChange('codigoRubro2', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[9.5px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.codigoRubro2 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[9.5px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.codigoRubro3 ?? ''}
                    onChange={(e) => handleFieldChange('codigoRubro3', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[9.5px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.codigoRubro3 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[9.5px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.codigoRubro4 ?? ''}
                    onChange={(e) => handleFieldChange('codigoRubro4', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[9.5px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.codigoRubro4 || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] text-center font-mono text-[9.5px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.codigoRubro5 ?? ''}
                    onChange={(e) => handleFieldChange('codigoRubro5', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[9.5px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.codigoRubro5 || ''
                )}
              </div>
            </div>

            {/* Columna 5: Valor a pagar por Rubro Presupuestal */}
            <div className="w-[18%] border-x border-black flex flex-col bg-white">
              <div className="p-1 print:p-0.5 text-center font-bold text-[8.5px] leading-tight print:leading-none border-b border-black h-[38px] print:h-[28px] flex items-center justify-center">
                Valor a pagar por Rubro Presupuestal en el presente pago
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={quitarDecimales(formData.valorRubro ?? '')}
                    onChange={(e) => handleFieldChange('valorRubro', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  quitarDecimales(formData.valorRubro) || ''
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={quitarDecimales(formData.valorRubro2 ?? '')}
                    onChange={(e) => handleFieldChange('valorRubro2', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  quitarDecimales(formData.valorRubro2 || '')
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={quitarDecimales(formData.valorRubro3 ?? '')}
                    onChange={(e) => handleFieldChange('valorRubro3', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  quitarDecimales(formData.valorRubro3 || '')
                )}
              </div>
              <div className="h-[18px] print:h-[14px] border-b border-black text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={quitarDecimales(formData.valorRubro4 ?? '')}
                    onChange={(e) => handleFieldChange('valorRubro4', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  quitarDecimales(formData.valorRubro4 || '')
                )}
              </div>
              <div className="h-[18px] print:h-[14px] text-center font-mono text-[10px] print:text-[8.5px] flex items-center justify-center">
                {isEditing ? (
                  <input 
                    type="text"
                    value={quitarDecimales(formData.valorRubro5 ?? '')}
                    onChange={(e) => handleFieldChange('valorRubro5', e.target.value)}
                    className="w-full h-full bg-amber-50 text-center font-mono text-black text-[10px] print:text-[8.5px] focus:outline-none focus:bg-amber-100"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  quitarDecimales(formData.valorRubro5 || '')
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. INFORMACIÓN DE APORTES A SEGURIDAD SOCIAL */}
        <div className="w-full mb-1">
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black/30">
            INFORMACIÓN DE APORTES A SEGURIDAD SOCIAL
          </div>
          
          {/* Cuadro principal más corto con doble borde exterior y 3 bloques separados por espacios */}
          <div className="w-[93%] mx-auto border-[2.5px] border-double border-black p-[2px] bg-white">
            <div className="flex items-stretch justify-between gap-2.5 text-[9.5px]">
              
              {/* Bloque 1: Salud / Pensión / ARP valores */}
              <div className="w-[28%] border border-black bg-white">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="py-0 px-1.5 border-r border-black font-normal w-[46%] text-center text-[9.5px]">Salud</td>
                      <td className="py-0 px-2 font-mono text-right w-[54%] text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.saludValor}
                            onChange={(e) => handleFieldChange('saludValor', e.target.value)}
                            className="bg-amber-50 text-right font-mono text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.saludValor
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="py-0 px-1.5 border-r border-black font-normal text-center text-[9.5px]">Pension</td>
                      <td className="py-0 px-2 font-mono text-right text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.pensionValor}
                            onChange={(e) => handleFieldChange('pensionValor', e.target.value)}
                            className="bg-amber-50 text-right font-mono text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.pensionValor
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0 px-1.5 border-r border-black font-normal text-center text-[9.5px]">A.R.P</td>
                      <td className="py-0 px-2 font-mono text-right text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.arpValor}
                            onChange={(e) => handleFieldChange('arpValor', e.target.value)}
                            className="bg-amber-50 text-right font-mono text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.arpValor
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bloque 2: EPS, Fondo Pensiones, ARP Entidades */}
              <div className="w-[38%] border border-black bg-white">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="py-0 px-1.5 border-r border-black font-normal w-[46%] text-center text-[9.5px]">EPS</td>
                      <td className="py-0 px-2 font-normal uppercase text-right w-[54%] text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.saludEps}
                            onChange={(e) => handleFieldChange('saludEps', e.target.value)}
                            className="bg-amber-50 text-right uppercase text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.saludEps
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="py-0 px-1.5 border-r border-black font-normal text-center text-[9.5px]">Fondo Pensiones</td>
                      <td className="py-0 px-2 font-normal uppercase text-right text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.pensionFondo}
                            onChange={(e) => handleFieldChange('pensionFondo', e.target.value)}
                            className="bg-amber-50 text-right uppercase text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.pensionFondo
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0 px-1.5 border-r border-black font-normal text-center text-[9.5px]">A.R.P</td>
                      <td className="py-0 px-2 font-normal uppercase text-right text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.arpAseguradora}
                            onChange={(e) => handleFieldChange('arpAseguradora', e.target.value)}
                            className="bg-amber-50 text-right uppercase text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.arpAseguradora
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bloque 3: Número de planilla */}
              <div className="w-[34%] border border-black bg-white">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="py-0 px-1.5 border-r border-black font-normal w-[52%] text-center text-[9.5px]">Número de planilla</td>
                      <td className="py-0 px-2 font-mono text-right w-[48%] text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.saludPlanilla}
                            onChange={(e) => handleFieldChange('saludPlanilla', e.target.value)}
                            className="bg-amber-50 text-right font-mono text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.saludPlanilla
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="py-0 px-1.5 border-r border-black font-normal text-center text-[9.5px]">Número de planilla</td>
                      <td className="py-0 px-2 font-mono text-right text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.pensionPlanilla}
                            onChange={(e) => handleFieldChange('pensionPlanilla', e.target.value)}
                            className="bg-amber-50 text-right font-mono text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.pensionPlanilla
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0 px-1.5 border-r border-black font-normal text-center text-[9.5px]">Número de planilla</td>
                      <td className="py-0 px-2 font-mono text-right text-[9.5px]">
                        {isEditing ? (
                          <input 
                            type="text"
                            value={formData.arpPlanilla}
                            onChange={(e) => handleFieldChange('arpPlanilla', e.target.value)}
                            className="bg-amber-50 text-right font-mono text-[9.5px] focus:outline-none w-full"
                            style={{ color: '#000000' }}
                          />
                        ) : (
                          formData.arpPlanilla
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          <div className="pt-0.5 text-[8.5px] text-center font-normal text-black w-[93%] mx-auto leading-tight">
            ***Nota: El pago del Fondo de Solidaridad Pensional - FSP, aplica únicamente cuando la base de cotizacion es mayor a 4 SMMLV.
          </div>
        </div>

        {/* 6. INFORMACIÓN PARA LA LIQUIDACIÓN DEL PAGO */}
        <div className="w-full mb-1">
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black/30">
            INFORMACIÓN PARA LA LIQUIDACIÓN DEL PAGO
          </div>
          
          <div className="border-2 border-black">
            <table className="w-full border-collapse text-center text-[9.5px]">
              <thead className="bg-[#d1d5db]">
                <tr className="border-b border-black font-bold">
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[7%] bg-[#d1d5db]">No. PAGO</th>
                  <th colSpan={2} className="p-0.5 print:py-0 print:px-0.5 print:text-[8px] print:leading-none border-r border-b border-black bg-[#d1d5db]">PERÍODO DE PAGO</th>
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[13%] leading-tight print:leading-none bg-[#d1d5db]">PORCENTAJE DE EJECUCIÓN</th>
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[13%] bg-[#d1d5db]">VALOR PAGADO</th>
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[14%] leading-tight print:leading-none bg-[#d1d5db]">VALOR A PAGAR SIN IVA</th>
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[8%] bg-[#d1d5db]">IVA</th>
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[14%] leading-tight print:leading-none bg-[#d1d5db]">VALOR TOTAL A PAGAR</th>
                  <th rowSpan={2} className="p-1 print:py-0.5 print:px-0.5 print:text-[8px] print:leading-none w-[12%] leading-tight print:leading-none bg-[#d1d5db]">SALDO POR PAGAR</th>
                </tr>
                <tr className="border-b border-black font-bold">
                  <th className="p-0.5 print:py-0 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[10%] bg-[#d1d5db]">DESDE</th>
                  <th className="p-0.5 print:py-0 print:px-0.5 print:text-[8px] print:leading-none border-r border-black w-[10%] bg-[#d1d5db]">HASTA</th>
                </tr>
              </thead>
              <tbody className="font-mono bg-white">
                <tr className="border-b border-black">
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black font-bold">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.pagoNro}
                        onChange={(e) => handleFieldChange('pagoNro', e.target.value)}
                        className="bg-amber-50 text-center font-mono font-bold text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formData.pagoNro
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formatDateSlash(formData.periodoDesde)}
                        onChange={(e) => handleFieldChange('periodoDesde', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formatDateSlash(formData.periodoDesde)
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formatDateSlash(formData.periodoHasta)}
                        onChange={(e) => handleFieldChange('periodoHasta', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formatDateSlash(formData.periodoHasta)
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.porcentajeEjecucion}
                        onChange={(e) => handleFieldChange('porcentajeEjecucion', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formData.porcentajeEjecucion
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={quitarDecimales(formData.valorPagadoAcumulado)}
                        onChange={(e) => handleFieldChange('valorPagadoAcumulado', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      quitarDecimales(formData.valorPagadoAcumulado)
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={quitarDecimales(formData.valorAPagarSinIva)}
                        onChange={(e) => handleFieldChange('valorAPagarSinIva', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      quitarDecimales(formData.valorAPagarSinIva)
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.iva}
                        onChange={(e) => handleFieldChange('iva', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formData.iva
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px] border-r border-black font-bold">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={quitarDecimales(formData.valorTotalAPagar)}
                        onChange={(e) => handleFieldChange('valorTotalAPagar', e.target.value)}
                        className="bg-amber-50 text-center font-mono font-bold text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      quitarDecimales(formData.valorTotalAPagar)
                    )}
                  </td>
                  <td className="p-1 print:py-0.5 print:px-0.5 print:text-[8.5px]">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={quitarDecimales(formData.saldoPorPagar)}
                        onChange={(e) => handleFieldChange('saldoPorPagar', e.target.value)}
                        className="bg-amber-50 text-center font-mono text-[9.5px] print:text-[8.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      quitarDecimales(formData.saldoPorPagar)
                    )}
                  </td>
                </tr>
                <tr className="h-2 sm:h-4 bg-[#d1d5db] print:hidden">
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cuadro independiente vacío tal como en el formato oficial */}
          <div className="mt-1 w-full border border-black min-h-[28px] bg-white p-0.5">
            {isEditing ? (
              <textarea
                value={formData.observacionesLiquidacion || ''}
                onChange={(e) => handleFieldChange('observacionesLiquidacion', e.target.value)}
                placeholder="(Espacio para observaciones u otros detalles si aplica...)"
                rows={1}
                className="w-full bg-amber-50 text-[9.5px] p-0.5 font-sans focus:outline-none resize-none leading-snug"
                style={{ color: '#000000' }}
              />
            ) : (
              <div className="text-[9.5px] text-black min-h-[20px] whitespace-pre-wrap leading-snug">
                {formData.observacionesLiquidacion || ''}
              </div>
            )}
          </div>
        </div>

        {/* 7. CERTIFICACIÓN */}
        <div className="w-full mb-1">
          <div className="bg-[#d1d5db] text-center font-bold py-0.5 text-[10px] uppercase tracking-wide text-black mb-1 border-y border-black/30">
            CERTIFICACIÓN
          </div>
          
          <div className="text-[9.5px] leading-snug space-y-1 text-black">
            <p className="font-normal m-0">
              El / la suscrito (a) supervisor (a) / interventor (a) certifica:
            </p>
            
            {/* Fila 1: Nombre, identificación, documento */}
            <div className="flex items-end justify-between gap-1 w-full flex-wrap sm:flex-nowrap">
              <span className="whitespace-nowrap">Que,</span>
              <span className="flex-1 min-w-[240px] border-b border-black text-center font-bold uppercase pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.contratistaNombre}
                    onChange={(e) => handleFieldChange('contratistaNombre', e.target.value)}
                    className="bg-amber-50 text-center font-bold uppercase text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.contratistaNombre
                )}
              </span>
              <span className="whitespace-nowrap">, identificado(a) con</span>
              <span className="w-14 border-b border-black text-center font-bold pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.tipoDocumento}
                    onChange={(e) => handleFieldChange('tipoDocumento', e.target.value)}
                    className="bg-amber-50 text-center font-bold text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.tipoDocumento
                )}
              </span>
              <span className="whitespace-nowrap">N°</span>
              <span className="min-w-[120px] flex-1 border-b border-black text-center font-bold font-mono pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.contratistaDocumento}
                    onChange={(e) => handleFieldChange('contratistaDocumento', e.target.value)}
                    className="bg-amber-50 text-center font-bold font-mono text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.contratistaDocumento
                )}
              </span>
              <span className="whitespace-nowrap">cumplió a satisfacción con el objeto del (la)</span>
            </div>

            {/* Fila 2: Tipo contrato, número, año */}
            <div className="flex items-end justify-between gap-1 w-full flex-wrap sm:flex-nowrap">
              <span className="flex-1 min-w-[280px] border-b border-black text-center font-bold uppercase pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.tipoContrato}
                    onChange={(e) => handleFieldChange('tipoContrato', e.target.value)}
                    className="bg-amber-50 text-center font-bold uppercase text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.tipoContrato
                )}
              </span>
              <span className="whitespace-nowrap">N°</span>
              <span className="w-16 border-b border-black text-center font-bold pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.contratoNro}
                    onChange={(e) => handleFieldChange('contratoNro', e.target.value)}
                    className="bg-amber-50 text-center font-bold text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.contratoNro
                )}
              </span>
              <span className="whitespace-nowrap">de</span>
              <span className="w-16 border-b border-black text-center font-bold pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.contratoAno}
                    onChange={(e) => handleFieldChange('contratoAno', e.target.value)}
                    className="bg-amber-50 text-center font-bold text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000' }}
                  />
                ) : (
                  formData.contratoAno
                )}
              </span>
              <span className="whitespace-nowrap">, de acuerdo con el informe presentado.</span>
            </div>

            <p className="text-justify m-0">
              Que se verificaron los pagos efectuados por el (la) contratista al Sistema General de Seguridad Social y/o aportes parafiscales, correspondiente al presente periodo de pago, los cuales se
            </p>

            <p className="flex items-baseline gap-2 flex-wrap m-0">
              <span>Que, con base en lo anterior se avala el pago por un valor de:</span>
              <span className="border-b border-black font-bold px-4 min-w-[170px] text-center pb-0.5 print:border-b-[1px]">
                {isEditing ? (
                  <input 
                    type="text"
                    value={formData.valorAvalado}
                    onChange={(e) => handleFieldChange('valorAvalado', e.target.value)}
                    className="bg-amber-50 font-bold text-center text-[9.5px] focus:outline-none w-full"
                    style={{ color: '#000000', fontStyle: 'normal' }}
                  />
                ) : (
                  <span className="font-bold">{formData.valorAvalado}</span>
                )}
              </span>
              <span>incluido IVA.</span>
            </p>

            {/* Fecha de Expedición: con líneas más largas distribuidas hacia la derecha tal como la imagen 2 */}
            <div className="pt-0 flex items-start justify-start gap-8 text-[9.5px]">
              <span className="pt-0.5">Fecha de expedición:</span>
              
              <div className="flex items-start gap-6">
                {/* Día */}
                <div className="flex flex-col items-center">
                  <span className="border-b border-black w-16 text-center font-bold pb-0.5 print:border-b-[1px]">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.expedicionDia}
                        onChange={(e) => handleFieldChange('expedicionDia', e.target.value)}
                        className="bg-amber-50 font-bold text-center text-[9.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formData.expedicionDia
                    )}
                  </span>
                  <span className="text-[8.5px] text-black pt-0.5">Día</span>
                </div>

                {/* Mes */}
                <div className="flex flex-col items-center">
                  <span className="border-b border-black w-24 text-center font-bold pb-0.5 print:border-b-[1px]">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.expedicionMes}
                        onChange={(e) => handleFieldChange('expedicionMes', e.target.value)}
                        className="bg-amber-50 font-bold text-center text-[9.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formData.expedicionMes
                    )}
                  </span>
                  <span className="text-[8.5px] text-black pt-0.5">Mes</span>
                </div>

                {/* Año */}
                <div className="flex flex-col items-center">
                  <span className="border-b border-black w-16 text-center font-bold pb-0.5 print:border-b-[1px]">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={formData.expedicionAno}
                        onChange={(e) => handleFieldChange('expedicionAno', e.target.value)}
                        className="bg-amber-50 font-bold text-center text-[9.5px] focus:outline-none w-full"
                        style={{ color: '#000000' }}
                      />
                    ) : (
                      formData.expedicionAno
                    )}
                  </span>
                  <span className="text-[8.5px] text-black pt-0.5">Año</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 8. LÍNEA DE FIRMA DEL SUPERVISOR (Exacto a la imagen) */}
        <div className="w-full flex flex-col items-center justify-center pt-12 print:pt-12 pb-0">
          <div className="w-56 border-t border-black text-center pt-0.5">
            <p className="font-bold uppercase tracking-wider text-[10px]">SUPERVISOR</p>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
