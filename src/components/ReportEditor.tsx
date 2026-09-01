import React, { useState, useEffect, useMemo } from 'react';
import ReportPreview from './ReportPreview';
import { createPortal } from 'react-dom';
import { Obligacion, ReportData, Anexo, EstadoInforme, FieldComment, extractContratoNroOnly, createDefaultCertificadoData, createDefaultFiduciariaData, createDefaultAutorizacionDesembolsoData } from '../types';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Printer, 
  Save, 
  Send,
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Sparkles, 
  RotateCcw,
  Building,
  User,
  FileSignature,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Download,
  Loader2,
  Info,
  MessageSquare,
  Camera,
  Layers,
  Calculator,
  Hash,
  X
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import imageCompression from 'browser-image-compression';
import { formatColombianCurrency, formatValorAdicion, formatPlazoLetraYNumero, formatDateSlash, formatFechaAplicacion } from '../utils/formatters';
import { calcularLiquidacionEstatal, generarPlanDePagos, calcularDiasComerciales, formatearMonedaCol, formatearNumeroTablaCol, limpiarNumeroMoneda, LiquidacionDetalladaResult } from '../utils/paymentPlanUtils';
import { convertirNumeroALetras } from '../utils/numberToWords';
import CalculadoraLiquidacion from './CalculadoraLiquidacion';
import DatePickerInput from './DatePickerInput';

interface Props {
  data: ReportData;
  onChange: (data: ReportData) => void;
  onPrint?: () => void;
  onDownloadPDF?: () => void;
  onSave?: () => void;
  onRadicar?: () => void;
  isSaving?: boolean;
  isGeneratingPDF?: boolean;
  hasUnsavedChanges?: boolean;
}

export default function ReportEditor({ 
  data, 
  onChange, 
  onPrint, 
  onDownloadPDF, 
  onSave, 
  onRadicar,
  isSaving = false,
  isGeneratingPDF = false,
  hasUnsavedChanges = false
}: Props) {
  const [activeTab, setActiveTab] = useState<'general' | 'obligaciones' | 'anexos' | 'suscripcion' | 'impresion'>('general');

  useEffect(() => {
    setActiveTab('general');
  }, [data.id, data.informeNro]);
  const [isUploadingFotos, setIsUploadingFotos] = useState(false);
  const [isUploadingMembrete, setIsUploadingMembrete] = useState(false);
  const [hasGlobalMembrete, setHasGlobalMembrete] = useState(false);
  const [isFetchingGlobalMembrete, setIsFetchingGlobalMembrete] = useState(true);
  const [lastUploadedCount, setLastUploadedCount] = useState(0);
  const [limitModal, setLimitModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    type?: 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    const fetchGlobalMembrete = async () => {
      setIsFetchingGlobalMembrete(true);
      const url = await supabaseService.getGlobalMembreteUrl();
      if (url) {
        setHasGlobalMembrete(true);
        if (!data.watermarkImage) {
          onChange({ ...data, watermarkImage: url });
        }
      }
      setIsFetchingGlobalMembrete(false);
    };
    fetchGlobalMembrete();
  }, []);

  const markCommentCorrected = (fieldKey: string, customComments?: Record<string, FieldComment>) => {
    const commentsMap = customComments || (data.comentariosCampos ? { ...data.comentariosCampos } : undefined);
    if (!commentsMap) return undefined;

    let modified = false;
    Object.keys(commentsMap).forEach(k => {
      if (k === fieldKey || k.startsWith(fieldKey)) {
        if (!commentsMap[k].corregido) {
          commentsMap[k] = {
            ...commentsMap[k],
            corregido: true,
            fechaCorreccion: new Date().toLocaleDateString('es-CO')
          };
          modified = true;
        }
      }
    });

    return modified ? commentsMap : undefined;
  };

  // Pagos acumulados anteriores basados en certificados previos o en el plan de pagos matemático
  const pagosPreviosCalculados = useMemo(() => {
    let pagosPrevios = 0;
    try {
      const numInf = parseInt(data.informeNro || '1', 10);
      if (numInf > 1) {
        // 1. Intentar sumar los valores pagados de certificados anteriores en localStorage
        let sumaDesdeStorage = 0;
        let encontradosEnStorage = 0;
        const docKey = data.contratistaDocumento || '';

        for (let p = 1; p < numInf; p++) {
          const rawCert = localStorage.getItem(`cert_data_${docKey}_${p}`) || 
                          localStorage.getItem(`cert_data_${p}`) ||
                          (data.id ? localStorage.getItem(`cert_data_${data.id}_${p}`) : null);
          if (rawCert) {
            try {
              const parsed = JSON.parse(rawCert);
              const val = limpiarNumeroMoneda(parsed.valorAPagarSinIva || parsed.valorTotalAPagar || parsed.valorAvalado);
              if (val > 0) {
                sumaDesdeStorage += val;
                encontradosEnStorage++;
              }
            } catch {
              // Ignorar error de parsing
            }
          }
        }

        if (encontradosEnStorage === (numInf - 1) && sumaDesdeStorage > 0) {
          return sumaDesdeStorage;
        }

        // 2. Si no están en storage, usar el plan de pagos matemático comercial
        if (data.fechaInicio && data.fechaTerminacion) {
          const plan = generarPlanDePagos({
            valor_total_contrato: data.valorContrato || '$ 16.200.000',
            valor_mensual: data.valorMensual || '$ 3.600.000',
            fecha_inicio: data.fechaInicio,
            fecha_fin: data.fechaTerminacion,
          });
          const targetIdx = Math.min(numInf - 1, plan.length - 1);
          if (targetIdx > 0 && plan[targetIdx - 1]) {
            pagosPrevios = plan[targetIdx - 1].valor_acumulado;
          }
        }
      }
    } catch {
      pagosPrevios = 0;
    }
    return pagosPrevios;
  }, [data.informeNro, data.fechaInicio, data.fechaTerminacion, data.valorContrato, data.valorMensual, data.contratistaDocumento, data.id]);

  // Cálculo dinámico en tiempo real bajo norma comercial colombiana (meses de 30 días)
  const liquidacionDinamica = useMemo(() => {
    const vTotal = data.valorContrato || '$ 16.200.000';
    let vMensual = data.valorMensual || '';
    
    // Si el valor mensual no está configurado o tiene el valor de muestra ($ 3.338.300) que no coincide con el contrato actual
    if ((!vMensual || vMensual === '$ 3.338.300') && data.valorContrato) {
      const vTotalNum = limpiarNumeroMoneda(data.valorContrato);
      if (vTotalNum === 16200000) {
        vMensual = '$ 3.600.000';
      } else if (data.fechaInicio && data.fechaTerminacion) {
        const diasTotales = calcularDiasComerciales(data.fechaInicio, data.fechaTerminacion);
        if (diasTotales > 0) {
          const meses = diasTotales / 30;
          vMensual = formatearMonedaCol(Math.round(vTotalNum / meses));
        }
      }
    }
    const fInicio = data.periodoDesde || data.fechaInicio || '13/08/2026';
    const fFin = data.periodoHasta || data.fechaTerminacion || '31/08/2026';

    return calcularLiquidacionEstatal({
      valorTotalContrato: vTotal,
      valorMensual: vMensual || undefined,
      fechaInicioPago: fInicio,
      fechaFinPago: fFin,
      pagosAcumuladosAnteriores: pagosPreviosCalculados,
      fechaFinContrato: data.fechaTerminacion || undefined,
    });
  }, [data.valorContrato, data.valorMensual, data.periodoDesde, data.periodoHasta, data.fechaInicio, data.fechaTerminacion, pagosPreviosCalculados]);

  const handleAplicarLiquidacionCalculada = (resOverride?: LiquidacionDetalladaResult, textoOverride?: string) => {
    const res = resOverride || liquidacionDinamica;
    if (!res) return;
    const formattedStr = textoOverride || `${convertirNumeroALetras(res.valorAPagarSinIva).toUpperCase()} ($${res.valorAPagarTabla})`;
    
    // 1. Actualizar el informe en el estado
    handleChange('valorPagar', formattedStr);

    // 2. Construir y guardar inmediatamente en LocalStorage y Supabase el Certificado sincronizado
    try {
      const nextData: ReportData = {
        ...data,
        valorPagar: formattedStr,
      };
      const liveCert = createDefaultCertificadoData(nextData);
      liveCert.valorRubro = res.valorAPagarTabla;
      liveCert.valorAPagarSinIva = res.valorAPagarTabla;
      liveCert.valorTotalAPagar = res.valorAPagarTabla;
      liveCert.porcentajeEjecucion = res.porcentajeEjecucionFormateado || `${res.porcentajeEjecucion.toFixed(2).replace('.', ',')} %`;
      liveCert.valorPagadoAcumulado = res.pagosAcumuladosFormateado ? res.pagosAcumuladosFormateado.replace('$', '').trim() : '0';
      liveCert.saldoPorPagar = res.saldoPorPagarTabla;
      liveCert.valorAvalado = `$ ${res.valorAPagarTabla}`;
      liveCert.pagoNro = String(data.informeNro || '1');
      liveCert.periodoDesde = data.periodoDesde || res.fechaInicioPago || '13/08/2026';
      liveCert.periodoHasta = data.periodoHasta || res.fechaFinPago || '31/08/2026';

      const docKey = data.contratistaDocumento || '';
      const nroKey = data.informeNro || '1';
      localStorage.setItem(`cert_data_${docKey}_${nroKey}`, JSON.stringify(liveCert));
      localStorage.setItem(`cert_data_${nroKey}`, JSON.stringify(liveCert));
      if (data.id) {
        localStorage.setItem(`cert_data_${data.id}_${nroKey}`, JSON.stringify(liveCert));
      }

      // Sincronizar Certificado de Supervisión con Supabase en background
      supabaseService.saveCertificadoSupervision(liveCert, data.id, undefined, data.contratoId).catch(e => {
        console.warn('Error sincronizando certificado con Supabase:', e);
      });

      // 3. Construir y guardar Soporte Fiduciaria (soportes_fiduciaria)
      const liveFid = createDefaultFiduciariaData(nextData);
      localStorage.setItem(`fid_data_${docKey}_${nroKey}`, JSON.stringify(liveFid));
      localStorage.setItem(`fid_data_${nroKey}`, JSON.stringify(liveFid));
      if (data.id) {
        localStorage.setItem(`fid_data_${data.id}_${nroKey}`, JSON.stringify(liveFid));
      }
      supabaseService.saveSoporteFiduciaria(data.id || '', liveFid, docKey, String(nroKey), data.contratoId).catch(e => {
        console.warn('Error sincronizando soporte fiduciaria con Supabase:', e);
      });

      // 4. Construir y guardar Autorización de Desembolso (autorizaciones_desembolso)
      const liveDesembolso = createDefaultAutorizacionDesembolsoData(nextData);
      localStorage.setItem(`desembolso_${docKey}_${nroKey}`, JSON.stringify(liveDesembolso));
      localStorage.setItem(`desembolso_${nroKey}`, JSON.stringify(liveDesembolso));
      if (data.id) {
        localStorage.setItem(`desembolso_${data.id}_${nroKey}`, JSON.stringify(liveDesembolso));
      }
      supabaseService.saveAutorizacionDesembolso(data.id || '', liveDesembolso, docKey, String(nroKey), data.contratoId).catch(e => {
        console.warn('Error sincronizando autorización de desembolso con Supabase:', e);
      });

      // Disparar eventos para actualizar instantáneamente las tres vistas
      window.dispatchEvent(new CustomEvent('certificado_updated_event', { detail: liveCert }));
      window.dispatchEvent(new CustomEvent('fiduciaria_updated_event', { detail: liveFid }));
      window.dispatchEvent(new CustomEvent('desembolso_updated_event', { detail: liveDesembolso }));
      window.dispatchEvent(new CustomEvent('informe_radicado_event'));
    } catch (e) {
      console.warn('Error al sincronizar certificado en localStorage:', e);
    }
  };

  const handleChange = (field: keyof ReportData, value: any) => {
    let finalValue = value;
    if (field === 'fechaAplicacion' && typeof value === 'string') {
      finalValue = value.toUpperCase();
    } else if (field === 'contratoNro' && typeof value === 'string') {
      finalValue = extractContratoNroOnly(value);
    }

    const updatedComms = markCommentCorrected(field as string);
    const updatedTouched = { ...(data.touchedFields || {}), [field]: true };
    const updatedUpdated = { ...(data.updatedFields || {}), [field]: true };

    let nextData: ReportData = { 
      ...data, 
      [field]: finalValue,
      isUpdated: true,
      isTouched: true,
      touchedFields: updatedTouched,
      updatedFields: updatedUpdated
    };
    
    if (updatedComms) {
      nextData.comentariosCampos = updatedComms;
    }

    // Si cambia el período, actualizar automáticamente la Fecha de Aplicación al mes correspondiente y la Fecha de Presentación
    if (field === 'periodoHasta' && typeof value === 'string' && value) {
      nextData.fechaAplicacion = formatFechaAplicacion(value, data.periodoDesde);
      nextData.fechaPresentacion = value;
    } else if (field === 'periodoDesde' && typeof value === 'string' && value && !data.periodoHasta) {
      nextData.fechaAplicacion = formatFechaAplicacion(data.periodoHasta, value);
    }

    onChange(nextData);
  };

  const handleObligacionChange = (id: string, field: keyof Obligacion, value: string) => {
    const obsIdx = data.obligaciones.findIndex(o => o.id === id);
    const updated = data.obligaciones.map((obs) => {
      if (obs.id === id) {
        return { 
          ...obs, 
          [field]: value,
          isUpdated: true,
          isTouched: true
        };
      }
      return obs;
    });

    if (data.comentariosCampos && obsIdx !== -1) {
      const obsComms = getObligacionComments(data.obligaciones[obsIdx], obsIdx);
      if (obsComms.length > 0) {
        const commsMap = { ...data.comentariosCampos };
        let modified = false;

        obsComms.forEach(item => {
          if (item.subfield === field || item.subfield === 'general') {
            if (!commsMap[item.key]?.corregido) {
              commsMap[item.key] = {
                ...commsMap[item.key],
                corregido: true,
                fechaCorreccion: new Date().toLocaleDateString('es-CO')
              };
              modified = true;
            }
          }
        });

        if (modified) {
          onChange({
            ...data,
            isUpdated: true,
            isTouched: true,
            obligaciones: updated,
            comentariosCampos: commsMap
          });
          return;
        }
      }
    }

    handleChange('obligaciones', updated);
  };

  const addObligacion = () => {
    const newObs: Obligacion = {
      id: `obs-${Date.now()}`,
      descripcion: '',
      actividades: '',
      soportes: 'Anexo fotográfico'
    };
    handleChange('obligaciones', [...data.obligaciones, newObs]);
  };

  const removeObligacion = (id: string) => {
    if (data.obligaciones.length <= 1) return;
    handleChange('obligaciones', data.obligaciones.filter(o => o.id !== id));
  };

  // Sincronizador de obligaciones y fotos anexas
  const syncObligacionesAndAnexos = (updatedObligaciones: Obligacion[], extraAnexos?: Anexo[]) => {
    const flatAnexos: Anexo[] = [];
    updatedObligaciones.forEach((obs, idx) => {
      (obs.fotos || []).slice(0, 5).forEach((foto, fIdx) => {
        flatAnexos.push({
          ...foto,
          obligacionId: obs.id,
          obligacionIndex: idx + 1,
          titulo: foto.titulo || `Evidencia fotográfica ${fIdx + 1}`
        });
      });
    });

    if (extraAnexos && extraAnexos.length > 0) {
      extraAnexos.forEach(a => {
        if (!flatAnexos.some(fa => fa.id === a.id || fa.imagenUrl === a.imagenUrl)) {
          flatAnexos.push(a);
        }
      });
    }

    onChange({
      ...data,
      obligaciones: updatedObligaciones,
      anexos: flatAnexos
    });
  };

  // Subir hasta 5 fotos para una obligación específica
  const handleObligacionImageUpload = async (obsId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const obsIdx = data.obligaciones.findIndex(o => o.id === obsId);
    if (obsIdx === -1) return;

    const currentObs = data.obligaciones[obsIdx];
    const currentFotos = currentObs.fotos || [];
    const availableSlots = 5 - currentFotos.length;

    if (availableSlots <= 0) {
      setLimitModal({
        isOpen: true,
        title: 'Límite de Fotografías Alcanzado',
        message: `La Obligación #${obsIdx + 1} ya cuenta con el máximo permitido de 5 fotografías.`,
        details: 'Para adjuntar una nueva foto a esta obligación, primero debes eliminar alguna de las fotos ya cargadas.',
        type: 'warning'
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, availableSlots);
    if (files.length > availableSlots) {
      setLimitModal({
        isOpen: true,
        title: 'Límite de 5 Fotos por Obligación',
        message: `Solo se cargaron ${availableSlots} fotografía(s) para la Obligación #${obsIdx + 1}.`,
        details: `Seleccionaste ${files.length} archivos, pero el sistema permite un máximo de 5 fotografías por obligación contractual. Las imágenes restantes fueron omitidas.`,
        type: 'info'
      });
    }

    setIsUploadingFotos(true);
    const newFotos: Anexo[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      let file = filesToProcess[i];
      try {
        const options = {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        };
        file = await imageCompression(file, options);
      } catch (error) {
        console.error('Compresión local previa:', error);
      }

      const reader = new FileReader();
      const localDataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newFotos.push({
        id: `anx-obs-${obsId}-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        titulo: `Evidencia fotográfica ${currentFotos.length + i + 1}`,
        imagenUrl: localDataUrl,
        file: file,
        obligacionId: obsId,
        obligacionIndex: obsIdx + 1,
        isPendingUpload: true
      });
    }

    if (newFotos.length > 0) {
      const updatedObligaciones = data.obligaciones.map(o => {
        if (o.id === obsId) {
          const combined = [...(o.fotos || []), ...newFotos].slice(0, 5);
          return { ...o, fotos: combined };
        }
        return o;
      });

      syncObligacionesAndAnexos(updatedObligaciones);
      setLastUploadedCount(newFotos.length);
    }

    setIsUploadingFotos(false);
  };

  // Modificar título o descripción de una foto dentro de una obligación
  const handleObligacionImageTitleChange = (obsId: string, fotoId: string, newTitle: string) => {
    const updatedObligaciones = data.obligaciones.map(o => {
      if (o.id === obsId && o.fotos) {
        return {
          ...o,
          fotos: o.fotos.map(f => f.id === fotoId ? { ...f, titulo: newTitle } : f)
        };
      }
      return o;
    });
    syncObligacionesAndAnexos(updatedObligaciones);
  };

  // Eliminar una foto de una obligación
  const removeObligacionImage = async (obsId: string, fotoId: string) => {
    const targetObs = data.obligaciones.find(o => o.id === obsId);
    const fotoToRemove = targetObs?.fotos?.find(f => f.id === fotoId);

    if (fotoToRemove && fotoToRemove.imagenUrl && !fotoToRemove.isPendingUpload) {
      await supabaseService.deleteImageFromStorage(fotoToRemove.imagenUrl);
    }

    const updatedObligaciones = data.obligaciones.map(o => {
      if (o.id === obsId && o.fotos) {
        return {
          ...o,
          fotos: o.fotos.filter(f => f.id !== fotoId)
        };
      }
      return o;
    });

    syncObligacionesAndAnexos(updatedObligaciones);
  };

  // Manejador general de subida (asigna a la primera obligación con espacio o crea anexos)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Buscar si hay una obligación activa con espacio
    const obsWithSpace = data.obligaciones.find(o => (o.fotos?.length || 0) < 5);
    if (obsWithSpace) {
      await handleObligacionImageUpload(obsWithSpace.id, files);
    } else {
      setLimitModal({
        isOpen: true,
        title: 'Capacidad Máxima de Fotos Alcanzada',
        message: 'Todas las obligaciones contractuales registradas ya alcanzaron el límite de 5 fotografías.',
        details: 'Para agregar nuevas evidencias fotográficas, puedes crear una nueva obligación contractual o eliminar alguna de las fotos ya cargadas en las obligaciones existentes.',
        type: 'warning'
      });
    }
  };

  const removeAnexo = async (id: string) => {
    const anexoToRemove = data.anexos.find(a => a.id === id);
    if (anexoToRemove && anexoToRemove.imagenUrl && !anexoToRemove.isPendingUpload) {
      await supabaseService.deleteImageFromStorage(anexoToRemove.imagenUrl);
    }

    // Remover de obligaciones si está asignada
    const updatedObs = data.obligaciones.map(o => ({
      ...o,
      fotos: (o.fotos || []).filter(f => f.id !== id)
    }));

    syncObligacionesAndAnexos(updatedObs);
  };

  // Helpers para resolver y resaltar campos observados por la supervisora y campos a actualizar en informe nuevo
  const isNewReportPendingSave = data.estado === 'Borrador' && !data.syncedToDb;

  const isFieldToUpdateInNewReport = (fieldKey: string) => {
    if (!fieldKey) return false;
    const k = fieldKey.toLowerCase();
    return (
      k === 'fechaaplicacion' ||
      k === 'tipoinforme' ||
      k === 'tipoinforme_mensual' ||
      k === 'tipoinforme_final' ||
      k === 'fechapresentacion' ||
      k === 'valorpagar' ||
      k === 'supervisordocumento' ||
      k === 'supervisornombre' ||
      k.includes('actividades') ||
      k.includes('descripcion') ||
      k.includes('descrip')
    );
  };

  const renderNewReportBadge = (fieldKey: string) => {
    if (isNewReportPendingSave && isFieldToUpdateInNewReport(fieldKey) && !data.comentariosCampos?.[fieldKey]) {
      return (
        <span className="text-[9px] leading-tight font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-300 inline-flex items-center gap-0.5 shrink-0 whitespace-nowrap shadow-2xs">
          <Sparkles size={9} className="text-sky-600" />
          Actualizar
        </span>
      );
    }
    return null;
  };

  const renderCommentAlert = (fieldKey: string, customComment?: FieldComment) => {
    const comment = customComment || data.comentariosCampos?.[fieldKey];
    if (!comment) return null;

    if (comment.corregido) {
      return (
        <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-400 rounded-lg text-emerald-950 text-xs flex items-start gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 size={15} className="text-emerald-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-bold text-emerald-950">🟢 Corrección Realizada</span>
              {comment.fechaCorreccion && <span className="text-[10px] text-emerald-800 font-semibold">{comment.fechaCorreccion}</span>}
            </div>
            <p className="mt-0.5 font-medium leading-relaxed text-emerald-900 text-[11px]">
              Has modificado este campo tras la observación: "{comment.comentario}". Se muestra en verde para verificación de la supervisora.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-1.5 p-2.5 bg-amber-100/95 border border-amber-400 rounded-lg text-amber-950 text-xs flex items-start gap-2 shadow-xs animate-in fade-in">
        <AlertTriangle size={15} className="text-amber-800 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="font-bold text-amber-950">Observación ({comment.autor || 'Supervisora / Administradora'}):</span>
            {comment.fecha && <span className="text-[10px] text-amber-800 opacity-80">{comment.fecha}</span>}
          </div>
          <p className="mt-0.5 font-medium leading-relaxed text-amber-900">{comment.comentario}</p>
        </div>
      </div>
    );
  };

  const getFieldHighlightClass = (fieldKey: string, customComment?: FieldComment) => {
    const comm = customComment || data.comentariosCampos?.[fieldKey];
    if (comm) {
      if (comm.corregido) {
        return 'bg-emerald-50/90 border-2 border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500 font-medium';
      }
      return 'bg-amber-50/90 border-2 border-amber-400 focus:ring-amber-500 focus:border-amber-500 font-medium';
    }

    if (isNewReportPendingSave && isFieldToUpdateInNewReport(fieldKey)) {
      return 'bg-sky-50/90 border-2 border-sky-400 focus:ring-sky-500 focus:border-sky-500 font-medium ring-1 ring-sky-200';
    }

    return '';
  };

  // Resolver de comentarios para una obligación específica (por ID o por número de obligación 1-based)
  const getObligacionComments = (obs: { id: string; descripcion: string; actividades: string; soportes: string }, idx: number) => {
    const allComments = data.comentariosCampos || {};
    const commentsList: { key: string; subfield: 'descripcion' | 'actividades' | 'soportes' | 'general'; comment: FieldComment }[] = [];
    const targetIdx = idx + 1; // Número humano de la obligación (Obligación #1, #2, #3, ...)

    Object.entries(allComments).forEach(([key, comm]) => {
      const k = key.toLowerCase();
      const fn = (comm.nombreCampo || comm.fieldName || '').toLowerCase();

      // Extraer el número de obligación si está presente en el nombre del campo o en la clave
      let numInField: number | null = null;
      const matchNumFn = fn.match(/obligaci[oó]n\s*#?\s*(\d+)/i);
      if (matchNumFn && matchNumFn[1]) {
        numInField = parseInt(matchNumFn[1], 10);
      } else {
        const matchNumK = k.match(/(?:obligacion|ob)_(\d+)/i);
        if (matchNumK && matchNumK[1]) {
          numInField = parseInt(matchNumK[1], 10);
        }
      }

      // Coincidencias estrictas:
      // 1. Por ID exacto de la obligación (si obs.id existe y tiene longitud representativa)
      // 2. Por número de obligación extraído que coincida con targetIdx (1-based)
      // 3. Por clave explícita de la obligación 1-based (ej: obligacion_1_actividades)
      const isMatchById = Boolean(obs.id && obs.id.length > 5 && k.includes(obs.id.toLowerCase()));
      const isMatchByNum = numInField !== null && numInField === targetIdx;
      const isMatchByTargetKey = 
        k.includes(`obligacion_${targetIdx}_`) ||
        k.includes(`ob_${targetIdx}_`) ||
        k === `obligacion_${targetIdx}`;

      if (isMatchById || isMatchByNum || isMatchByTargetKey) {
        let subfield: 'descripcion' | 'actividades' | 'soportes' | 'general' = 'general';
        if (k.includes('actividad') || fn.includes('actividad')) subfield = 'actividades';
        else if (k.includes('descrip') || fn.includes('descrip')) subfield = 'descripcion';
        else if (k.includes('soporte') || fn.includes('soporte')) subfield = 'soportes';

        commentsList.push({ key, subfield, comment: comm });
      }
    });

    return commentsList;
  };

  const getObligacionSubfieldComment = (
    obs: { id: string; descripcion: string; actividades: string; soportes: string }, 
    idx: number, 
    subfield: 'descripcion' | 'actividades' | 'soportes'
  ): FieldComment | null => {
    const list = getObligacionComments(obs, idx);
    const matched = list.find(item => item.subfield === subfield);
    if (matched) return matched.comment;

    // Buscar clave directa alternativa usando índice 1-based (targetIdx)
    const targetIdx = idx + 1;
    const directKey = `obligacion_${obs.id}_${subfield}`;
    const idxKey = `obligacion_${targetIdx}_${subfield}`;
    const rawDirect = data.comentariosCampos?.[directKey] || data.comentariosCampos?.[idxKey];
    return rawDirect || null;
  };

  // Conteo de comentarios totales, corregidos y pendientes
  const allCommentsList = Object.values(data.comentariosCampos || {}) as FieldComment[];
  const totalComments = allCommentsList.length;
  const corregidosCount = allCommentsList.filter(c => c.corregido).length;
  const pendientesCount = totalComments - corregidosCount;
  const allCorregidos = totalComments > 0 && pendientesCount === 0;

  const getSectionCounts = (keysFilter: (key: string) => boolean) => {
    const sectionComms = Object.entries(data.comentariosCampos || {}).filter(([k]) => keysFilter(k));
    const total = sectionComms.length;
    const corregidos = sectionComms.filter(([_, comm]) => comm.corregido).length;
    const pendientes = total - corregidos;
    return { total, corregidos, pendientes };
  };

  const generalStats = getSectionCounts(k => [
    'secretariaNombre', 'secretariaCodigo', 'tipoInforme_mensual', 'tipoInforme_final', 
    'informeNro', 'fechaPresentacion', 'periodo', 'periodoDesde', 'periodoHasta', 
    'contratistaNombre', 'contratistaDocumento', 'contratistaCorreo', 'contratistaTelefono',
    'supervisorNombre', 'supervisorDocumento', 'apoyoSupervisionNombre', 'apoyoSupervisionDocumento',
    'valorContrato', 'valorMensual', 'valorAdicion', 'contratoNro', 'objeto', 'cdpNro', 'crpNro', 
    'polizaNro', 'fechaPoliza', 'plazo', 'fechaInicio', 'fechaTerminacion', 'modificaciones', 'fechaAplicacion'
  ].includes(k));

  const obligacionesStats = getSectionCounts(k => {
    const lk = k.toLowerCase();
    const fn = (data.comentariosCampos?.[k]?.nombreCampo || data.comentariosCampos?.[k]?.fieldName || '').toLowerCase();
    return lk.startsWith('obligacion_') || lk.includes('obligacion') || fn.includes('obligación') || fn.includes('obligacion');
  });

  const anexosStats = getSectionCounts(k => k.startsWith('anexo_'));
  const suscripcionStats = getSectionCounts(k => ['observaciones', 'valorPagar'].includes(k));

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      
      {/* Barra Superior del Editor */}
      <div className="p-3.5 bg-white border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-gray-900 truncate">Editor del Informe</h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              data.estado === 'Aprobado' 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : data.estado === 'Devuelto'
                ? (allCorregidos ? 'bg-emerald-100 text-emerald-900 border border-emerald-400 font-extrabold' : 'bg-amber-100 text-amber-900 border border-amber-400 font-extrabold animate-pulse')
                : data.estado === 'Enviado'
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              {data.estado === 'Devuelto' ? (allCorregidos ? '🟢 Correcciones Realizadas' : 'Devuelto con Observaciones') : data.estado === 'Enviado' ? 'Radicado / Enviado' : data.estado || 'Borrador'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">
            Informe mensual #{data.informeNro} • Contrato #{data.contratoNro}
          </p>
        </div>

        {/* Indicador de Estado de Guardado en Supabase */}
        <div className="flex items-center gap-2 shrink-0">
          {onSave && hasUnsavedChanges && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
              title="Guardar cambios directamente en la base de datos"
            >
              <Save size={13} />
              <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
            </button>
          )}

          {hasUnsavedChanges ? (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse shadow-xs"
              title="Hay modificaciones pendientes por guardar en Supabase. Usa el botón 'Guardar'."
            >
              <AlertTriangle size={13} className="text-amber-700 shrink-0" />
              <span className="hidden sm:inline">Sin guardar</span>
            </div>
          ) : (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
              title="Todos los datos y fotografías están guardados y sincronizados."
            >
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Sincronizado</span>
            </div>
          )}
        </div>
      </div>

      {/* BANNER DE OBSERVACIONES DE SUPERVISIÓN */}
      {totalComments > 0 && (
        pendientesCount > 0 ? (
          <div className="bg-amber-50 border-b-2 border-amber-400 p-4 animate-in fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-amber-950 text-sm md:text-base flex items-center gap-2">
                    {pendientesCount} Campo(s) con Observaciones de la Supervisora
                  </h3>
                  <p className="text-amber-900 text-xs mt-1 leading-relaxed max-w-3xl">
                    La supervisora ha revisado este informe y dejó comentarios para que realices correcciones. Los campos señalados están resaltados en <strong className="font-bold underline">amarillo</strong> en las pestañas correspondientes.
                  </p>
                  
                  {/* Resumen de campos */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(data.comentariosCampos || {})
                      .filter(([_, comm]) => !comm.corregido)
                      .map(([key, comm]) => (
                        <span key={key} className="inline-flex items-center gap-1 bg-amber-200 text-amber-950 text-[10px] px-2.5 py-1 rounded-md font-bold shadow-sm">
                          ⚠️ {comm.nombreCampo || comm.fieldName || key}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex shrink-0">
                <span className="bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">
                  Ajuste Requerido
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b border-emerald-300 p-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
              <div>
                <strong className="font-black text-emerald-950 text-sm">
                  🟢 {corregidosCount} Corrección(es) Realizada(s) • Todas las observaciones ajustadas
                </strong>
                <p className="text-emerald-900 text-xs mt-0.5">
                  Los campos corregidos se destacan en verde. Guarda los cambios para que la supervisora los re-verifique.
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Selector de Pestañas con indicadores de observaciones pendientes */}
      <div className="grid grid-cols-5 bg-gray-100 p-1 border-b border-gray-200 text-xs font-medium text-gray-600">
        <button
          onClick={() => setActiveTab('general')}
          className={`py-2 text-center rounded transition-all flex flex-col items-center gap-1 relative ${
            activeTab === 'general' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'hover:text-gray-900'
          }`}
        >
          <div className="relative">
            <Building size={14} />
            {generalStats.pendientes > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center font-bold">
                {generalStats.pendientes}
              </span>
            )}
          </div>
          <span>General</span>
        </button>

        <button
          onClick={() => setActiveTab('obligaciones')}
          className={`py-2 text-center rounded transition-all flex flex-col items-center gap-1 relative ${
            activeTab === 'obligaciones' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'hover:text-gray-900'
          }`}
        >
          <div className="relative">
            <FileText size={14} />
            {obligacionesStats.pendientes > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center font-bold">
                {obligacionesStats.pendientes}
              </span>
            )}
          </div>
          <span>Obligaciones ({data.obligaciones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('anexos')}
          className={`py-2 text-center rounded transition-all flex flex-col items-center gap-1 relative ${
            activeTab === 'anexos' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'hover:text-gray-900'
          }`}
        >
          <div className="relative">
            <ImageIcon size={14} />
            {anexosStats.pendientes > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center font-bold">
                {anexosStats.pendientes}
              </span>
            )}
          </div>
          <span>Fotos ({data.anexos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suscripcion')}
          className={`py-2 text-center rounded transition-all flex flex-col items-center gap-1 relative ${
            activeTab === 'suscripcion' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'hover:text-gray-900'
          }`}
        >
          <div className="relative">
            <FileSignature size={14} />
            {suscripcionStats.total > 0 && (
              <span className={`absolute -top-1 -right-2 text-white rounded-full w-3.5 h-3.5 text-[8px] flex items-center justify-center font-bold ${
                suscripcionStats.pendientes > 0 ? 'bg-amber-500' : 'bg-emerald-600'
              }`}>
                {suscripcionStats.pendientes > 0 ? suscripcionStats.pendientes : '✓'}
              </span>
            )}
          </div>
          <span>Firmas</span>
        </button>

        <button
          onClick={() => setActiveTab('impresion')}
          className={`py-2 text-center rounded transition-all flex flex-col items-center gap-1 ${
            activeTab === 'impresion' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'hover:text-gray-900'
          }`}
        >
          <Printer size={14} />
          <span>Diseño PDF</span>
        </button>
      </div>

      {/* Contenido de la Pestaña Activa */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* TAB 1: DATOS GENERALES Y CONTRATO */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            
            {/* Dependencia & Informe */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
              <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="flex items-center gap-1.5">
                  <Building size={14} className="text-emerald-700" />
                  Dependencia y Período
                </span>
                {isNewReportPendingSave && (
                  <span className="text-[10px] font-extrabold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-300 flex items-center gap-1 normal-case">
                    <Sparkles size={11} className="text-sky-600" />
                    Borrador nuevo: Campos a actualizar destacados en azul
                  </span>
                )}
              </h3>

              {isNewReportPendingSave && (
                <div className="p-3 bg-sky-50 border border-sky-300 rounded-xl flex items-start gap-2.5 text-xs text-sky-950 shadow-xs">
                  <Sparkles size={18} className="text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sky-950">
                      🔹 Campos que debes actualizar en este nuevo informe
                    </p>
                    <p className="text-sky-900 mt-0.5 leading-relaxed text-[11px]">
                      Los campos resaltados en <strong className="text-sky-800 underline font-black">azul claro</strong> (Tipo de Informe, Fecha de Presentación, Fecha Aplicación, Actividades en Obligaciones y Monto Certificado) corresponden a la información variable a actualizar. Al hacer clic en <strong className="text-emerald-800">"Guardar"</strong>, todos los resaltes desaparecerán.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Secretaría</label>
                  <input
                    type="text"
                    value={data.secretariaNombre}
                    onChange={(e) => handleChange('secretariaNombre', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('secretariaNombre')}`}
                  />
                  {renderCommentAlert('secretariaNombre')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Código Dependencia</label>
                  <input
                    type="text"
                    value={data.secretariaCodigo}
                    onChange={(e) => handleChange('secretariaCodigo', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('secretariaCodigo')}`}
                  />
                  {renderCommentAlert('secretariaCodigo')}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700">Tipo de Informe</label>
                    {renderNewReportBadge('tipoInforme')}
                  </div>
                  <select
                    value={data.tipoInforme}
                    onChange={(e) => handleChange('tipoInforme', e.target.value as any)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 bg-white ${getFieldHighlightClass('tipoInforme') || getFieldHighlightClass('tipoInforme_mensual') || getFieldHighlightClass('tipoInforme_final')}`}
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Final">Final</option>
                  </select>
                  {renderCommentAlert('tipoInforme_mensual')}
                  {renderCommentAlert('tipoInforme_final')}
                </div>

                {/* Informe Nro. Resaltado */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-gray-900 flex items-center gap-1">
                      <Hash size={13} className="text-emerald-700" />
                      <span>Informe Nro.</span>
                    </label>
                    <span className="text-[9px] font-extrabold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                      N° Consecutivo
                    </span>
                  </div>
                  <input
                    type="text"
                    value={data.informeNro}
                    onChange={(e) => handleChange('informeNro', e.target.value)}
                    placeholder="Ej. 1"
                    className={`w-full border-2 border-emerald-500 bg-emerald-50/50 text-emerald-950 font-black text-sm rounded p-1.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white shadow-2xs transition-all ${getFieldHighlightClass('informeNro')}`}
                  />
                  {renderCommentAlert('informeNro')}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700 flex items-center gap-1">
                      <Calendar size={13} className="text-emerald-700" />
                      <span>Fecha de Presentación</span>
                    </label>
                    {renderNewReportBadge('fechaPresentacion')}
                  </div>
                  <DatePickerInput
                    value={data.fechaPresentacion}
                    onChange={(val) => handleChange('fechaPresentacion', val)}
                    placeholder="DD/MM/AAAA"
                    className={`border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs ${getFieldHighlightClass('fechaPresentacion')}`}
                  />
                  {renderCommentAlert('fechaPresentacion')}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700 truncate">
                      Fecha Aplicación Formato
                    </label>
                    {renderNewReportBadge('fechaAplicacion')}
                  </div>
                  <input
                    type="text"
                    value={data.fechaAplicacion || ''}
                    onChange={(e) => handleChange('fechaAplicacion', e.target.value.toUpperCase())}
                    placeholder="Ej: FEBRERO DE 2026"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold uppercase ${getFieldHighlightClass('fechaAplicacion')}`}
                  />
                  {renderCommentAlert('fechaAplicacion')}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700 flex items-center gap-1">
                      <Calendar size={13} className="text-emerald-700" />
                      <span>Período Desde</span>
                    </label>
                    {renderNewReportBadge('periodoDesde')}
                  </div>
                  <DatePickerInput
                    value={data.periodoDesde}
                    onChange={(val) => handleChange('periodoDesde', val)}
                    placeholder="DD/MM/AAAA"
                    className={`border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs ${getFieldHighlightClass('periodo') || getFieldHighlightClass('periodoDesde')}`}
                  />
                  {renderCommentAlert('periodoDesde')}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700 flex items-center gap-1">
                      <Calendar size={13} className="text-emerald-700" />
                      <span>Período Hasta</span>
                    </label>
                    {renderNewReportBadge('periodoHasta')}
                  </div>
                  <DatePickerInput
                    value={data.periodoHasta}
                    onChange={(val) => handleChange('periodoHasta', val)}
                    placeholder="DD/MM/AAAA"
                    className={`border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs ${getFieldHighlightClass('periodo') || getFieldHighlightClass('periodoHasta')}`}
                  />
                  {renderCommentAlert('periodoHasta')}
                  {renderCommentAlert('periodo')}
                </div>
              </div>
            </div>

            {/* Datos del Contratista */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
              <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
                <User size={14} className="text-emerald-700" />
                Contratista y Supervisión
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block font-medium text-gray-700 mb-1">Nombre Contratista</label>
                  <input
                    type="text"
                    value={data.contratistaNombre}
                    onChange={(e) => handleChange('contratistaNombre', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-semibold ${getFieldHighlightClass('contratistaNombre')}`}
                  />
                  {renderCommentAlert('contratistaNombre')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">C.C. Contratista</label>
                  <input
                    type="text"
                    value={data.contratistaDocumento}
                    onChange={(e) => handleChange('contratistaDocumento', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('contratistaDocumento')}`}
                  />
                  {renderCommentAlert('contratistaDocumento')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={data.contratistaTelefono}
                    onChange={(e) => handleChange('contratistaTelefono', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('contratistaTelefono')}`}
                  />
                  {renderCommentAlert('contratistaTelefono')}
                </div>

                <div className="col-span-2">
                  <label className="block font-medium text-gray-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={data.contratistaCorreo}
                    onChange={(e) => handleChange('contratistaCorreo', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('contratistaCorreo')}`}
                  />
                  {renderCommentAlert('contratistaCorreo')}
                </div>

                <div className="col-span-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700">Supervisor(a) del Contrato</label>
                    {renderNewReportBadge('supervisorNombre')}
                  </div>
                  <input
                    type="text"
                    value={data.supervisorNombre}
                    onChange={(e) => handleChange('supervisorNombre', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-semibold ${getFieldHighlightClass('supervisorNombre')}`}
                  />
                  {renderCommentAlert('supervisorNombre')}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-gray-700">C.C. Supervisor</label>
                    {renderNewReportBadge('supervisorDocumento')}
                  </div>
                  <input
                    type="text"
                    value={data.supervisorDocumento}
                    onChange={(e) => handleChange('supervisorDocumento', e.target.value)}
                    placeholder="Ej. 35.602.521"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-medium ${getFieldHighlightClass('supervisorDocumento')}`}
                  />
                  {renderCommentAlert('supervisorDocumento')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Apoyo Supervisión</label>
                  <input
                    type="text"
                    value={data.apoyoSupervisionNombre}
                    onChange={(e) => handleChange('apoyoSupervisionNombre', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('apoyoSupervisionNombre')}`}
                  />
                  {renderCommentAlert('apoyoSupervisionNombre')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">C.C. Apoyo Supervisión</label>
                  <input
                    type="text"
                    value={data.apoyoSupervisionDocumento}
                    onChange={(e) => handleChange('apoyoSupervisionDocumento', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('apoyoSupervisionDocumento')}`}
                  />
                  {renderCommentAlert('apoyoSupervisionDocumento')}
                </div>
              </div>
            </div>

            {/* Datos Contractuales */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
              <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
                <FileText size={14} className="text-emerald-700" />
                Datos Contractuales
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Contrato Nro.</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={extractContratoNroOnly(data.contratoNro)}
                    onChange={(e) => handleChange('contratoNro', e.target.value)}
                    placeholder="Ej. 590"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-bold ${getFieldHighlightClass('contratoNro')}`}
                  />
                  {renderCommentAlert('contratoNro')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Valor Contrato</label>
                  <input
                    type="text"
                    value={data.valorContrato}
                    onChange={(e) => handleChange('valorContrato', e.target.value)}
                    onBlur={() => {
                      if (data.valorContrato) {
                        handleChange('valorContrato', formatColombianCurrency(data.valorContrato));
                      }
                    }}
                    placeholder="$ 20.029.800"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-800 ${getFieldHighlightClass('valorContrato')}`}
                  />
                  {renderCommentAlert('valorContrato')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Valor de Adición</label>
                  <input
                    type="text"
                    value={data.valorAdicion || '$ N/A'}
                    onChange={(e) => handleChange('valorAdicion', e.target.value)}
                    onBlur={() => {
                      handleChange('valorAdicion', formatValorAdicion(data.valorAdicion));
                    }}
                    placeholder="$ N/A"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-medium ${getFieldHighlightClass('valorAdicion')}`}
                  />
                  {renderCommentAlert('valorAdicion')}
                </div>

                {/* Campo de Valor Mensual Pactado: Se solicita una única vez en el primer informe o si no está configurado */}
                {(data.informeNro === '1' || !data.valorMensual) ? (
                  <div>
                    <label className="block font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <span>Valor Mensual del Contrato</span>
                      <span className="text-[9px] text-emerald-800 bg-emerald-100 font-bold px-1.5 py-0.5 rounded">
                        Registro único
                      </span>
                    </label>
                    <input
                      type="text"
                      value={data.valorMensual || ''}
                      onChange={(e) => {
                        handleChange('valorMensual', e.target.value);
                      }}
                      onBlur={() => {
                        if (data.valorMensual) {
                          const formatted = formatColombianCurrency(data.valorMensual);
                          handleChange('valorMensual', formatted);
                        }
                      }}
                      placeholder="ej. $ 2.300.250"
                      className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-800 ${getFieldHighlightClass('valorMensual')}`}
                    />
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Honorario mensual pactado. Se usa para calcular los pagos y no se imprime en el informe.
                    </p>
                    {renderCommentAlert('valorMensual')}
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-950">
                      <CheckCircle2 size={13} className="text-emerald-700 shrink-0" />
                      <span className="text-[11px]"><strong>Honorario Mensual:</strong> {data.valorMensual}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nuevo = prompt("Modificar valor mensual pactado del contrato:", data.valorMensual || '');
                        if (nuevo !== null) {
                          const formatted = nuevo.trim() ? formatColombianCurrency(nuevo) : '';
                          handleChange('valorMensual', formatted);
                        }
                      }}
                      className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline"
                    >
                      Editar
                    </button>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block font-medium text-gray-700 mb-1">Objeto Contractual</label>
                  <textarea
                    rows={4}
                    value={data.objeto}
                    onChange={(e) => handleChange('objeto', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-emerald-500 text-xs leading-relaxed min-h-[90px] ${getFieldHighlightClass('objeto')}`}
                  />
                  {renderCommentAlert('objeto')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">CDP Nro.</label>
                  <input
                    type="text"
                    value={data.cdpNro}
                    onChange={(e) => handleChange('cdpNro', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('cdpNro')}`}
                  />
                  {renderCommentAlert('cdpNro')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">CRP Nro.</label>
                  <input
                    type="text"
                    value={data.crpNro}
                    onChange={(e) => handleChange('crpNro', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('crpNro')}`}
                  />
                  {renderCommentAlert('crpNro')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Póliza Nro.</label>
                  <input
                    type="text"
                    value={data.polizaNro || 'N/A'}
                    onChange={(e) => handleChange('polizaNro', e.target.value)}
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('polizaNro')}`}
                  />
                  {renderCommentAlert('polizaNro')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-emerald-700" />
                    <span>Fecha Acta de Aprobación Póliza:</span>
                  </label>
                  <input
                    type="text"
                    value={data.fechaPoliza || ''}
                    onChange={(e) => handleChange('fechaPoliza', e.target.value)}
                    placeholder="Ej. 01/07/2026 o N/A"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs ${getFieldHighlightClass('fechaPoliza')}`}
                  />
                  {renderCommentAlert('fechaPoliza')}
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Plazo del Contrato</label>
                  <input
                    type="text"
                    value={data.plazo}
                    onChange={(e) => handleChange('plazo', e.target.value)}
                    onBlur={() => {
                      if (data.plazo) {
                        handleChange('plazo', formatPlazoLetraYNumero(data.plazo));
                      }
                    }}
                    placeholder="Ej. 6 MESES o 6 MESES 8 DÍAS"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 font-bold uppercase ${getFieldHighlightClass('plazo')}`}
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Se formatea en letra y número (Ej. SEIS(6) MESES Y OCHO(8) DÍAS)</p>
                  {renderCommentAlert('plazo')}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar size={13} className="text-emerald-700" />
                      <span>Fecha Inicio</span>
                    </label>
                    <DatePickerInput
                      value={data.fechaInicio}
                      onChange={(val) => handleChange('fechaInicio', val)}
                      placeholder="DD/MM/AAAA"
                      className={`border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs ${getFieldHighlightClass('fechaInicio')}`}
                    />
                    {renderCommentAlert('fechaInicio')}
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar size={13} className="text-emerald-700" />
                      <span>Fecha Terminación</span>
                    </label>
                    <DatePickerInput
                      value={data.fechaTerminacion}
                      onChange={(val) => handleChange('fechaTerminacion', val)}
                      placeholder="DD/MM/AAAA"
                      className={`border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 text-xs ${getFieldHighlightClass('fechaTerminacion')}`}
                    />
                    {renderCommentAlert('fechaTerminacion')}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block font-medium text-gray-700 mb-1">Modificaciones al Contrato</label>
                  <input
                    type="text"
                    value={data.modificaciones || ''}
                    onChange={(e) => handleChange('modificaciones', e.target.value)}
                    placeholder="(Relacione aquí todo lo correspondiente a una prórroga, adición y/o suspensión, si es el caso)"
                    className={`w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500 italic text-xs ${getFieldHighlightClass('modificaciones')}`}
                  />
                  {renderCommentAlert('modificaciones')}
                </div>
              </div>
            </div>

            {/* Componente CalculadoraLiquidacion con Algoritmo Dinámico Norma Comercial 30 Días */}
            <CalculadoraLiquidacion
              valorTotalContrato={data.valorContrato || '$ 16.200.000'}
              valorMensual={liquidacionDinamica.valorMensualFormateado || data.valorMensual || '$ 3.600.000'}
              fechaInicioPago={data.periodoDesde || data.fechaInicio || '13/08/2026'}
              fechaFinPago={data.periodoHasta || data.fechaTerminacion || '31/08/2026'}
              pagosAcumuladosAnteriores={pagosPreviosCalculados}
              informeNro={data.informeNro || '1'}
              fechaFinContrato={data.fechaTerminacion}
              onAplicar={(res, texto) => handleAplicarLiquidacionCalculada(res, texto)}
              permitirEdicionDirecta={false}
              titulo="Calculadora de Liquidación Contractual del Período (Norma 30 Días)"
            />

          </div>
        )}

        {/* TAB 2: OBLIGACIONES Y ACTIVIDADES */}
        {activeTab === 'obligaciones' && (
          <div className="space-y-4">
            
            {/* Aviso de Observaciones en Obligaciones (Solo si hay observaciones pendientes) */}
            {obligacionesStats.pendientes > 0 && (
              <div className="p-3.5 bg-amber-100 border-2 border-amber-400 rounded-xl flex items-start gap-2.5 text-xs text-amber-950 shadow-xs animate-in fade-in">
                <AlertTriangle size={18} className="text-amber-800 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-extrabold text-amber-950 text-sm">
                    ⚠️ Tienes {obligacionesStats.pendientes} observación(es) pendiente(s) por corregir
                  </p>
                  <p className="text-amber-900 mt-1 leading-relaxed">
                    La supervisora ha dejado observaciones específicas en las obligaciones señaladas abajo. Revisa los recuadros resaltados en <strong className="text-amber-950 underline font-bold">amarillo</strong> y realiza las correcciones solicitadas en las actividades o soportes.
                  </p>
                </div>
              </div>
            )}

            {/* Aviso de Guardado de Obligaciones */}
            {hasUnsavedChanges && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-950 shadow-xs">
                <AlertTriangle size={17} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Obligaciones contractuales modificadas</p>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    Has realizado cambios o agregado obligaciones. Recuerda hacer clic en el botón <strong>"Guardar"</strong> de la barra superior para sincronizar las actividades y soportes con Supabase.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <span className="text-xs text-emerald-900 font-medium">
                {data.obligaciones.length} Obligaciones Contractuales registradas
              </span>
              <button
                onClick={addObligacion}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                Añadir Obligación
              </button>
            </div>

            <div className="space-y-3">
              {data.obligaciones.map((obs, idx) => {
                const obsComments = getObligacionComments(obs, idx);
                const descComment = getObligacionSubfieldComment(obs, idx, 'descripcion');
                const actComment = getObligacionSubfieldComment(obs, idx, 'actividades');
                const sopComment = getObligacionSubfieldComment(obs, idx, 'soportes');
                const hasAnyComment = obsComments.length > 0;

                return (
                  <div 
                    key={obs.id} 
                    className={`p-3.5 rounded-lg border shadow-xs relative space-y-2.5 transition-colors ${
                      hasAnyComment 
                        ? 'bg-amber-50/70 border-2 border-amber-400 ring-2 ring-amber-300/60' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-emerald-800">
                          Obligación #{idx + 1}
                        </span>
                        {obs.isClonedStructure && (!obs.actividades || obs.actividades.trim() === '') && (
                          <span className="bg-sky-100 text-sky-900 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-300 flex items-center gap-1">
                            <span>📋 Estructura Clonada</span>
                          </span>
                        )}
                        {obs.actividades && obs.actividades.trim().length > 0 && (
                          <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-emerald-700" />
                            <span>Actividades Registradas</span>
                          </span>
                        )}
                        {obs.isUpdated && (
                          <span className="bg-blue-50 text-blue-800 text-[10px] font-semibold px-1.5 py-0.2 rounded border border-blue-200">
                            ✏️ Editado
                          </span>
                        )}
                        {hasAnyComment && (
                          <span className="bg-amber-200 text-amber-950 text-[10px] font-black px-2.5 py-0.5 rounded-md border border-amber-400 flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={11} className="text-amber-800" />
                            Requiere Corrección ({obsComments.length} observación{obsComments.length > 1 ? 'es' : ''})
                          </span>
                        )}
                      </div>
                      {data.obligaciones.length > 1 && (
                        <button
                          onClick={() => removeObligacion(obs.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Eliminar esta obligación"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {/* Banner destacado de observación si existe para esta obligación */}
                    {hasAnyComment && (
                      <div className="p-2.5 bg-amber-100/90 border border-amber-400 rounded-lg text-amber-950 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-950">
                          <AlertTriangle size={14} className="text-amber-800 shrink-0" />
                          <span>Observación de Supervisión para Obligación #{idx + 1}:</span>
                        </div>
                        {obsComments.map(({ key, comment }) => (
                          <div key={key} className="bg-amber-200/80 p-2 rounded border border-amber-300/80 text-[11px]">
                            <div className="flex items-center justify-between font-bold text-amber-950 mb-0.5">
                              <span>{comment.nombreCampo || comment.fieldName || 'Observación general'}:</span>
                              {comment.fecha && <span className="text-[10px] text-amber-800 opacity-80">{comment.fecha}</span>}
                            </div>
                            <p className="text-amber-900 leading-relaxed font-medium">{comment.comentario}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-gray-700">
                          Descripción de la Obligación Contractual:
                        </label>
                        {renderNewReportBadge(`obligacion_${obs.id}_descripcion`)}
                      </div>
                      <textarea
                        rows={2}
                        value={obs.descripcion}
                        onChange={(e) => handleObligacionChange(obs.id, 'descripcion', e.target.value)}
                        placeholder="Redacte la obligación..."
                        className={`w-full border border-gray-300 rounded p-2 text-xs leading-relaxed focus:ring-1 focus:ring-emerald-500 min-h-[60px] ${getFieldHighlightClass(`obligacion_${obs.id}_descripcion`, descComment || undefined) || 'bg-slate-50/70 border-emerald-200/80 font-medium'}`}
                      />
                      {renderCommentAlert(`obligacion_${obs.id}_descripcion`, descComment || undefined)}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-gray-700">
                          Actividades realizadas y/o productos entregados:
                        </label>
                        {renderNewReportBadge(`obligacion_${obs.id}_actividades`)}
                      </div>
                      <textarea
                        rows={10}
                        value={obs.actividades}
                        onChange={(e) => handleObligacionChange(obs.id, 'actividades', e.target.value)}
                        placeholder="Detalle los logros, entregables y actividades del mes..."
                        className={`w-full border border-gray-300 rounded p-2.5 text-xs leading-relaxed focus:ring-1 focus:ring-emerald-500 min-h-[220px] ${getFieldHighlightClass(`obligacion_${obs.id}_actividades`, actComment || undefined)}`}
                      />
                      {renderCommentAlert(`obligacion_${obs.id}_actividades`, actComment || undefined)}
                    </div>

                    <div className="pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Soporte asociado:</span>
                        <input
                          type="text"
                          value={obs.soportes}
                          onChange={(e) => handleObligacionChange(obs.id, 'soportes', e.target.value)}
                          className={`text-[11px] border border-gray-200 rounded px-2 py-0.5 text-right w-56 focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass(`obligacion_${obs.id}_soportes`, sopComment || undefined)}`}
                        />
                      </div>
                      {renderCommentAlert(`obligacion_${obs.id}_soportes`, sopComment || undefined)}
                    </div>

                    {/* SECCIÓN DE FOTOS POR OBLIGACIÓN (Máximo 5 imágenes) */}
                    <div className="mt-3 pt-3 border-t border-emerald-100 bg-emerald-50/40 -mx-3.5 -mb-3.5 p-3.5 rounded-b-lg space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Camera size={14} className="text-emerald-700" />
                          <span className="font-bold text-xs text-emerald-950">
                            Evidencias Fotográficas (Obligación #{idx + 1})
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          (obs.fotos?.length || 0) >= 5
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : (obs.fotos?.length || 0) > 0
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {obs.fotos?.length || 0} / 5 fotos
                        </span>
                      </div>

                      {/* Botón de Carga de Fotos para esta Obligación */}
                      {(obs.fotos?.length || 0) < 5 ? (
                        <label className={`cursor-pointer border-2 border-dashed rounded-lg p-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-center transition-all ${
                          isUploadingFotos 
                            ? 'bg-gray-100 border-gray-300 text-gray-500' 
                            : 'bg-white border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-900 shadow-xs'
                        }`}>
                          {isUploadingFotos ? (
                            <Loader2 size={16} className="animate-spin text-gray-500" />
                          ) : (
                            <Upload size={16} className="text-emerald-700" />
                          )}
                          <div className="text-left sm:flex-1">
                            <p className="text-xs font-bold text-emerald-950">
                              {isUploadingFotos ? 'Comprimiendo y subiendo...' : `Subir fotos para Obligación #${idx + 1}`}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              Puedes subir hasta {5 - (obs.fotos?.length || 0)} foto(s) más para esta obligación (JPG, PNG, WebP)
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px] font-semibold hover:bg-emerald-800 shrink-0">
                            Examinar
                          </span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            disabled={isUploadingFotos}
                            onChange={(e) => handleObligacionImageUpload(obs.id, e.target.files)}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="p-2 bg-emerald-100/70 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-center justify-between">
                          <span className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-700" />
                            Límite de 5 fotografías completado para esta obligación
                          </span>
                          <span className="text-[10px] text-emerald-800">
                            Para cambiar una foto, elimina una existente
                          </span>
                        </div>
                      )}

                      {/* Galería de Fotos de la Obligación */}
                      {obs.fotos && obs.fotos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                          {obs.fotos.map((foto, fIdx) => {
                            const fotoKey = `anexo_${foto.id || fIdx}`;
                            const hasFotoComment = Boolean(data.comentariosCampos?.[fotoKey]);

                            return (
                              <div 
                                key={foto.id || fIdx}
                                className={`bg-white rounded-lg border p-2 shadow-xs flex flex-col justify-between relative group transition-colors ${
                                  hasFotoComment 
                                    ? 'border-amber-400 bg-amber-50/70 ring-1 ring-amber-300' 
                                    : 'border-gray-200'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => removeObligacionImage(obs.id, foto.id)}
                                  className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-sm z-10 opacity-90 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar esta fotografía"
                                >
                                  <Trash2 size={11} />
                                </button>

                                <div className="h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center mb-1.5 border border-gray-100">
                                  <img 
                                    src={foto.imagenUrl} 
                                    alt={foto.titulo || `Evidencia ${fIdx + 1}`} 
                                    className="w-full h-full object-cover"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[9px] text-gray-500 font-semibold">
                                    <span>Foto #{fIdx + 1}</span>
                                    <span className="text-emerald-700">Obligación #{idx + 1}</span>
                                  </div>
                                  <input
                                    type="text"
                                    value={foto.titulo}
                                    onChange={(e) => handleObligacionImageTitleChange(obs.id, foto.id, e.target.value)}
                                    placeholder={`Obligación #${idx + 1} - Evidencia ${fIdx + 1}`}
                                    className="w-full text-[10px] font-medium border-b border-gray-200 py-0.5 focus:border-emerald-600 focus:outline-none bg-transparent"
                                  />
                                  {renderCommentAlert(fotoKey)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addObligacion}
              className="w-full py-2 border-2 border-dashed border-emerald-300 rounded-lg text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-50 transition-colors"
            >
              <Plus size={16} />
              Agregar Otra Obligación Contractual
            </button>
          </div>
        )}

        {/* TAB 3: ANEXOS FOTOGRÁFICOS */}
        {activeTab === 'anexos' && (
          <div className="space-y-4">
            
            {/* Banner Informativo */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950 shadow-xs">
              <Info size={18} className="text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-950">Gestión de Evidencias Fotográficas por Obligación</p>
                <p className="text-emerald-800 mt-0.5 leading-relaxed">
                  Puedes cargar hasta <strong>5 imágenes para cada una de tus obligaciones contractuales</strong>. Las fotos se asocian automáticamente a su respectiva obligación y se organizan de forma elegante en el informe impreso.
                </p>
              </div>
            </div>

            {hasUnsavedChanges && data.anexos.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-950 animate-pulse shadow-xs">
                <AlertTriangle size={17} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Fotografías pendientes por sincronizar en Supabase</p>
                  <p className="text-amber-800 mt-0.5">
                    Tienes {data.anexos.length} fotografía(s) en este informe. Presiona <strong>"Guardar"</strong> en la barra superior para procesarlas y almacenarlas de forma segura en la base de datos.
                  </p>
                </div>
              </div>
            )}

            {/* Resumen Estadístico de Fotos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Fotografías</span>
                <span className="text-lg font-black text-emerald-800">{data.anexos.length}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">en el informe</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Obligaciones con Fotos</span>
                <span className="text-lg font-black text-emerald-800">
                  {data.obligaciones.filter(o => o.fotos && o.fotos.length > 0).length} / {data.obligaciones.length}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">obligaciones documentadas</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs col-span-2 sm:col-span-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Límite Permitido</span>
                <span className="text-lg font-black text-emerald-800">Hasta 5</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">fotos por obligación</span>
              </div>
            </div>

            {/* Secciones de Fotos Agrupadas por Obligación */}
            <div className="space-y-4">
              {data.obligaciones.map((obs, idx) => {
                const obsFotos = obs.fotos || [];
                const available = 5 - obsFotos.length;

                return (
                  <div key={obs.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                            Obligación #{idx + 1}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            obsFotos.length >= 5
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : obsFotos.length > 0
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {obsFotos.length} / 5 fotos
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 font-medium line-clamp-1">
                          {obs.descripcion || 'Sin descripción redactada...'}
                        </p>
                      </div>

                      {available > 0 && (
                        <label className={`cursor-pointer px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
                          isUploadingFotos ? 'opacity-50 pointer-events-none' : ''
                        }`}>
                          <Upload size={13} />
                          <span>Subir fotos ({available} disp.)</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            disabled={isUploadingFotos}
                            onChange={(e) => handleObligacionImageUpload(obs.id, e.target.files)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {obsFotos.length === 0 ? (
                      <div className="py-4 border-2 border-dashed border-gray-200 rounded-lg text-center">
                        <Camera size={22} className="text-gray-300 mx-auto mb-1" />
                        <p className="text-xs text-gray-500 font-medium">No has adjuntado evidencias para esta obligación</p>
                        <label className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer mt-1 inline-block">
                          Adjuntar fotos ahora (hasta 5)
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            disabled={isUploadingFotos}
                            onChange={(e) => handleObligacionImageUpload(obs.id, e.target.files)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                        {obsFotos.map((foto, fIdx) => {
                          const fotoKey = `anexo_${foto.id || fIdx}`;
                          const hasFotoComment = Boolean(data.comentariosCampos?.[fotoKey]);

                          return (
                            <div 
                              key={foto.id || fIdx} 
                              className={`p-2 rounded-lg border relative group flex flex-col justify-between transition-colors ${
                                hasFotoComment 
                                  ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300' 
                                  : 'bg-gray-50/60 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => removeObligacionImage(obs.id, foto.id)}
                                className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-sm transition-colors z-10 opacity-90 group-hover:opacity-100"
                                title="Eliminar foto"
                              >
                                <Trash2 size={11} />
                              </button>

                              <div className="h-24 bg-white rounded overflow-hidden flex items-center justify-center mb-1.5 border border-gray-200">
                                <img
                                  src={foto.imagenUrl}
                                  alt={foto.titulo || `Foto ${fIdx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              <div>
                                <input
                                  type="text"
                                  value={foto.titulo}
                                  onChange={(e) => handleObligacionImageTitleChange(obs.id, foto.id, e.target.value)}
                                  className={`w-full text-[10px] font-semibold text-center border-b border-gray-300 py-0.5 focus:border-emerald-600 focus:outline-none bg-transparent ${getFieldHighlightClass(fotoKey)}`}
                                />
                                <p className="text-[8px] text-center text-gray-400 mt-0.5 font-mono">Foto #{fIdx + 1}</p>
                                {renderCommentAlert(fotoKey)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sección de fotos sin obligación (para compatibilidad previa) */}
            {(() => {
              const unassignedFotos = data.anexos.filter(a => !a.obligacionId && (!a.obligacionIndex || a.obligacionIndex <= 0));
              if (unassignedFotos.length === 0) return null;

              return (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-700">
                      Otras Fotografías Generales ({unassignedFotos.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {unassignedFotos.map((anexo, idx) => (
                      <div key={anexo.id || idx} className="bg-white p-2 rounded border border-gray-200 relative group">
                        <button
                          type="button"
                          onClick={() => removeAnexo(anexo.id)}
                          className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 z-10"
                        >
                          <Trash2 size={11} />
                        </button>
                        <div className="h-24 bg-gray-100 rounded overflow-hidden mb-1.5">
                          <img src={anexo.imagenUrl} alt={anexo.titulo} className="w-full h-full object-cover" />
                        </div>
                        <input
                          type="text"
                          value={anexo.titulo}
                          onChange={(e) => {
                            const newAnexos = data.anexos.map(a => a.id === anexo.id ? { ...a, titulo: e.target.value } : a);
                            handleChange('anexos', newAnexos);
                          }}
                          className="w-full text-[10px] text-center border-b border-gray-300 py-0.5 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {data.anexos.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs">
                No hay fotografías cargadas aún en este informe. Puedes agregarlas directamente en cada obligación.
              </div>
            )}

          </div>
        )}

        {/* TAB 4: SUSCRIPCIÓN Y OBSERVACIONES */}
        {activeTab === 'suscripcion' && (
          <div className="space-y-4">
            
            {/* Observaciones */}
            <div className={`p-4 rounded-lg border shadow-xs space-y-2 ${
              data.comentariosCampos?.['observaciones'] ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-300' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <label className="block font-bold text-xs text-gray-800 uppercase tracking-wider">
                  Observaciones y Recomendaciones:
                </label>
                <span className="text-[10px] text-gray-400 font-mono">
                  {data.observaciones ? `${data.observaciones.length} caracteres` : 'Sin observaciones'}
                </span>
              </div>
              <textarea
                rows={4}
                value={data.observaciones || ''}
                onChange={(e) => handleChange('observaciones', e.target.value)}
                placeholder="Escribe las observaciones de ejecución, cumplimiento de compromisos, recomendaciones..."
                className={`w-full border border-gray-300 rounded p-2.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white ${getFieldHighlightClass('observaciones')}`}
              />
              {renderCommentAlert('observaciones')}
              <p className="text-[10px] text-gray-500">
                Las observaciones quedan plasmadas en la sección de suscripción y firmas del informe oficial.
              </p>
            </div>

            {/* Certificación de Pago */}
            <div className={`p-4 rounded-lg border shadow-xs space-y-3 ${
              data.comentariosCampos?.['valorPagar'] ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-300' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 flex-wrap gap-2">
                <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSignature size={14} className="text-emerald-700" />
                  Certificación del Valor a Pagar
                </h3>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                  Norma 30 Días: ${liquidacionDinamica.valorAPagarTabla}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-emerald-950">
                    <span className="font-bold">Liquidación Calculada:</span>{' '}
                    <strong className="text-emerald-800 font-mono text-sm">${liquidacionDinamica.valorAPagarTabla}</strong>
                    <span className="text-[11px] text-emerald-800 ml-1">
                      ({liquidacionDinamica.diasLiquidados} días a {formatearMonedaCol(liquidacionDinamica.valorDiario)}/día)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAplicarLiquidacionCalculada}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="Insertar automáticamente en letras y números en el recuadro"
                  >
                    <Sparkles size={13} />
                    <span>Autocompletar en Letras y Números</span>
                  </button>
                </div>
                <div className="text-[10px] text-gray-600 flex items-center gap-3 flex-wrap">
                  <span><strong>% Ejecución:</strong> {liquidacionDinamica.porcentajeEjecucionFormatted}</span>
                  <span>•</span>
                  <span><strong>Saldo Restante:</strong> {formatearMonedaCol(liquidacionDinamica.saldoPorPagar)}</span>
                  <span>•</span>
                  <span><strong>Período:</strong> {liquidacionDinamica.fechaInicioPeriodo} - {liquidacionDinamica.fechaFinPeriodo}</span>
                </div>
              </div>

              <div className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-gray-700">
                    Monto Certificado (En letras y números, se mostrará en cursiva en el documento):
                  </label>
                  {renderNewReportBadge('valorPagar')}
                </div>
                <textarea
                  rows={3}
                  value={data.valorPagar}
                  onChange={(e) => handleChange('valorPagar', e.target.value)}
                  className={`w-full border border-gray-300 rounded p-2 text-xs italic uppercase focus:ring-1 focus:ring-emerald-500 ${getFieldHighlightClass('valorPagar')}`}
                  placeholder="Ej: UN MILLÓN QUINIENTOS CINCUENTA Y SIETE MIL OCHOCIENTOS SETENTA Y TRES PESOS M/CTE ($1.557.873)"
                />
                {renderCommentAlert('valorPagar')}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-950 flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Seguridad de Firmas (Anti-Fraude):</strong> Las firmas del contratista y supervisor están blindadas con CSS <code>break-inside: avoid</code> para que nunca se impriman en una hoja aislada.
                </p>
              </div>
            </div>

            {/* Botón de Guardado directo en la pestaña de firmas */}
            {onSave && (
              <div className="pt-2">
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Guardando en la base de datos...' : 'Guardar Observaciones y Datos del Informe'}</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* TAB 5: DISEÑO E IMPRESIÓN */}
        {activeTab === 'impresion' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
              <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
                <Printer size={14} className="text-emerald-700" />
                Configuración de Impresión y Membrete
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">NIT Alcaldía / Institución</label>
                  <input
                    type="text"
                    value={data.nitAlcaldia || '891680011-0'}
                    onChange={(e) => handleChange('nitAlcaldia', e.target.value)}
                    className="w-full border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ej. 891680011-0"
                  />
                </div>
                
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Fondo / Membrete Institucional</label>
                  {isFetchingGlobalMembrete ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 size={16} className="animate-spin" /> Verificando membrete global...
                    </div>
                  ) : hasGlobalMembrete ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
                      <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm mb-1">
                        <ImageIcon size={16} /> Membrete Institucional Aplicado
                      </div>
                      <p className="text-[11px] text-emerald-600">Este informe utiliza el fondo global de la entidad. No es necesario cargarlo nuevamente.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded px-3 py-1.5 flex items-center gap-2 transition-colors">
                          {isUploadingMembrete ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                          <span className="font-semibold">{isUploadingMembrete ? 'Subiendo...' : 'Cargar Imagen de Fondo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              let file = e.target.files?.[0];
                              if (!file) return;
                              
                              setIsUploadingMembrete(true);

                              if (file.size > 3 * 1024 * 1024) {
                                try {
                                  const options = {
                                    maxSizeMB: 2.5,
                                    maxWidthOrHeight: 1920,
                                    useWebWorker: true,
                                  };
                                  file = await imageCompression(file, options);
                                } catch (error) {
                                  console.error('Error al comprimir la imagen:', error);
                                }
                              }

                              const publicUrl = await supabaseService.uploadImageToStorage(file, 'membretes');
                              if (publicUrl) {
                                handleChange('watermarkImage', publicUrl);
                                setHasGlobalMembrete(true);
                              }
                              setIsUploadingMembrete(false);
                            }}
                          />
                        </label>
                        {data.watermarkImage && !isUploadingMembrete && (
                          <button
                            onClick={async () => {
                              if (data.watermarkImage) {
                                await supabaseService.deleteImageFromStorage(data.watermarkImage);
                              }
                              handleChange('watermarkImage', '');
                            }}
                            className="text-red-600 hover:text-red-700 font-medium px-2 py-1 flex items-center gap-1"
                          >
                            <Trash2 size={14} /> Quitar
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Sube el fondo institucional (hoja membretada). Una vez subido, será el mismo para todos los contratistas.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="lg:hidden bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
               <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="flex items-center gap-1.5"><Printer size={14} className="text-emerald-700" /> Vista Previa (Móvil)</span>
               </h3>
               <p className="text-[10px] text-gray-500">
                  Usa el botón "Imprimir / Descargar PDF" de la barra superior. Si tu navegador móvil no soporta la descarga directa, usa esta vista para revisar.
               </p>
               <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 py-4 relative h-[450px] overflow-y-auto overflow-x-hidden flex justify-center">
                  <div className="w-[75mm] min-[400px]:w-[86mm] sm:w-[107.5mm] shrink-0 origin-top-left">
                     <div className="transform origin-top-left scale-[0.35] min-[400px]:scale-[0.4] sm:scale-[0.5] w-[215mm] bg-white shadow-sm">
                        <ReportPreview data={data} />
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE NOTIFICACIÓN DE LÍMITE DE FOTOGRAFÍAS (Renderizado en document.body para evitar solapamientos) */}
      {limitModal?.isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          id="modal-limite-fotos-backdrop"
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLimitModal(null)}
        >
          <div 
            id="modal-limite-fotos-content"
            className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-emerald-300 animate-in zoom-in-95 duration-200 relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera institucional con franja tricolor */}
            <div className="relative bg-gradient-to-br from-[#00381a] via-[#005226] to-[#012612] text-white p-5 sm:p-6">
              <div className="absolute top-0 left-0 right-0 h-1.5 flex">
                <div className="w-1/2 bg-[#006b33]"></div>
                <div className="w-1/3 bg-[#c8102e]"></div>
                <div className="w-1/6 bg-[#f59e0b]"></div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-center shadow-md shrink-0">
                    {limitModal.type === 'warning' ? (
                      <AlertTriangle size={24} className="text-gray-950" />
                    ) : (
                      <Camera size={24} className="text-gray-950" />
                    )}
                  </div>
                  <div>
                    <span className="bg-emerald-800 text-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                      Control de Evidencias
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5 leading-tight">
                      {limitModal.title}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-cerrar-modal-limite-x"
                  onClick={() => setLimitModal(null)}
                  className="text-emerald-300 hover:text-white p-1 rounded-lg hover:bg-emerald-800/60 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-5 sm:p-6 space-y-4 text-xs bg-white">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-amber-950 text-xs font-semibold leading-relaxed">
                  {limitModal.message}
                </p>
              </div>

              {limitModal.details && (
                <p className="text-gray-600 text-xs leading-relaxed">
                  {limitModal.details}
                </p>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5 text-[11px] text-gray-600">
                <p className="font-bold text-gray-800 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  Regla de Evidencias en Informes Mensuales:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Máximo <strong>5 fotografías</strong> por cada obligación contractual.</li>
                  <li>Las fotos se previsualizan y solo se envían al servidor al pulsar <strong>"Guardar"</strong>.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  id="btn-entendido-modal-limite"
                  onClick={() => setLimitModal(null)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
