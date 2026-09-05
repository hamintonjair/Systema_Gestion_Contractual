import React, { useState, useEffect } from 'react';
import { ReportData, FieldComment } from '../types';
import QuibdoLogo from './QuibdoLogo';
import { formatColombianCurrency, formatValorAdicion, formatPlazoLetraYNumero, formatDateSlash, formatFechaAplicacion } from '../utils/formatters';
import { MessageSquare, AlertTriangle, Edit3, CheckCircle2 } from 'lucide-react';
import FieldCommentModal from './FieldCommentModal';
import { supabaseService } from '../services/supabaseService';

interface Props {
  data: ReportData;
  isReviewMode?: boolean;
  onSaveComment?: (fieldId: string, fieldName: string, comentario: string) => void;
  onDeleteComment?: (fieldId: string) => void;
  authorName?: string;
}

export default function ReportPreview({ 
  data, 
  isReviewMode = false, 
  onSaveComment, 
  onDeleteComment,
  authorName = 'Supervisora / Administradora'
}: Props) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    fieldId: string;
    fieldName: string;
    fieldValuePreview?: string;
    initialComment?: FieldComment;
  }>({
    isOpen: false,
    fieldId: '',
    fieldName: '',
  });

  const [globalMembrete, setGlobalMembrete] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!data.watermarkImage) {
      supabaseService.getGlobalMembreteUrl().then(url => {
        if (isMounted && url) {
          setGlobalMembrete(url);
        }
      }).catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [data.watermarkImage]);

  const watermarkUrl = data.watermarkImage || globalMembrete;

  const findCommentForField = (fieldId: string, fieldName: string): { key: string; comment: FieldComment } | null => {
    if (!data.comentariosCampos || Object.keys(data.comentariosCampos).length === 0) return null;
    
    // 1. Coincidencia directa por ID exacto
    if (data.comentariosCampos[fieldId]) {
      return { key: fieldId, comment: data.comentariosCampos[fieldId] };
    }

    const lowerFieldId = fieldId.toLowerCase().trim();
    const lowerFieldName = fieldName.toLowerCase().trim();
    const cleanFieldId = lowerFieldId.replace(/[^a-z0-9]/g, '');
    const cleanFieldName = lowerFieldName.replace(/[^a-z0-9]/g, '');

    // Determinar si el campo actual es una sub-sección de una obligación
    const isTargetObligacion = lowerFieldId.includes('obligacion') || lowerFieldId.includes('ob_') || lowerFieldName.includes('obligaci');
    
    let targetSubfield: 'descripcion' | 'actividades' | 'soportes' | null = null;
    if (isTargetObligacion) {
      if (lowerFieldId.includes('actividad') || lowerFieldName.includes('actividad')) {
        targetSubfield = 'actividades';
      } else if (lowerFieldId.includes('descrip') || lowerFieldName.includes('descrip')) {
        targetSubfield = 'descripcion';
      } else if (lowerFieldId.includes('soporte') || lowerFieldName.includes('soporte')) {
        targetSubfield = 'soportes';
      }
    }

    // Extraer número de obligación del campo actual (1-based)
    const matchNumTarget = lowerFieldName.match(/obligaci[oó]n\s*#?\s*(\d+)/i) || lowerFieldId.match(/(?:obligacion|ob)_(\d+)/i);
    const targetNum = matchNumTarget ? parseInt(matchNumTarget[1], 10) : null;

    for (const [k, comm] of Object.entries(data.comentariosCampos)) {
      if (!comm) continue;
      const lowerK = k.toLowerCase().trim();
      const lowerCommFn = (comm.nombreCampo || comm.fieldName || '').toLowerCase().trim();
      const cleanK = lowerK.replace(/[^a-z0-9]/g, '');
      const cleanCommFn = lowerCommFn.replace(/[^a-z0-9]/g, '');

      // Coincidencia directa por id o nombre normalizado (para campos no dependientes de subcampos)
      if (lowerK === lowerFieldId || cleanK === cleanFieldId) return { key: k, comment: comm };
      if (!isTargetObligacion && (lowerCommFn === lowerFieldName || (cleanCommFn && cleanCommFn === cleanFieldName))) {
        return { key: k, comment: comm };
      }

      // Si el campo objetivo es una obligación
      if (isTargetObligacion) {
        const isCommObligacion = lowerK.includes('obligacion') || lowerK.includes('ob_') || lowerCommFn.includes('obligaci');
        if (!isCommObligacion) continue;

        // Determinar subcampo del comentario almacenado
        let commSubfield: 'descripcion' | 'actividades' | 'soportes' | null = null;
        if (lowerK.includes('actividad') || lowerCommFn.includes('actividad')) {
          commSubfield = 'actividades';
        } else if (lowerK.includes('descrip') || lowerCommFn.includes('descrip')) {
          commSubfield = 'descripcion';
        } else if (lowerK.includes('soporte') || lowerCommFn.includes('soporte')) {
          commSubfield = 'soportes';
        }

        // Si los subcampos no coinciden exactamente, no resaltar (ej. si la observación es solo en descripción, no resaltar actividades ni soportes)
        if (targetSubfield !== commSubfield) {
          continue;
        }

        // Extraer número de obligación del comentario
        const matchNumComm = lowerCommFn.match(/obligaci[oó]n\s*#?\s*(\d+)/i) || lowerK.match(/(?:obligacion|ob)_(\d+)/i);
        const commNum = matchNumComm ? parseInt(matchNumComm[1], 10) : null;

        const isNumMatch = targetNum !== null && commNum !== null && targetNum === commNum;
        const isKeyNumMatch = targetNum !== null && (
          lowerK.includes(`obligacion_${targetNum}_`) ||
          lowerK.includes(`ob_${targetNum}_`) ||
          lowerCommFn.includes(`obligación #${targetNum}`) ||
          lowerCommFn.includes(`obligacion #${targetNum}`) ||
          lowerCommFn.includes(`obligación ${targetNum}`)
        );

        if (isNumMatch || isKeyNumMatch) {
          return { key: k, comment: comm };
        }
      }
    }
    return null;
  };

  const openCommentModal = (fieldId: string, fieldName: string, fieldValuePreview?: string) => {
    if (!isReviewMode) return;
    const found = findCommentForField(fieldId, fieldName);
    const initialComment = found?.comment || data.comentariosCampos?.[fieldId];
    const effectiveKey = found?.key || fieldId;
    setModalState({
      isOpen: true,
      fieldId: effectiveKey,
      fieldName,
      fieldValuePreview: fieldValuePreview || '',
      initialComment,
    });
  };

  const handleSaveComment = (fieldId: string, fieldName: string, comentario: string) => {
    if (onSaveComment) {
      onSaveComment(fieldId, fieldName, comentario);
    }
  };

  const handleDeleteComment = (fieldId: string) => {
    if (onDeleteComment) {
      onDeleteComment(fieldId);
    }
  };

  // Helper para renderizar celdas revisables con resaltado amarillo
  const renderReviewedTd = (
    fieldId: string,
    fieldName: string,
    fieldValuePreview: string,
    content: React.ReactNode,
    className: string = '',
    colSpan?: number,
    rowSpan?: number
  ) => {
    const found = findCommentForField(fieldId, fieldName);
    const comment = found?.comment;
    const effectiveKey = found?.key || fieldId;
    const hasComment = Boolean(comment);
    const isCorregido = Boolean(comment?.corregido);

    const baseClass = `border border-black px-2 py-1 relative print:static ${className}`;
    const highlightClass = hasComment 
      ? (isCorregido
          ? 'bg-emerald-100/90 text-emerald-950 font-medium border-emerald-500 ring-2 ring-emerald-400 print:bg-transparent print:ring-0'
          : 'bg-amber-100/90 text-amber-950 font-medium border-amber-500 ring-1 ring-amber-400 print:bg-transparent print:ring-0') 
      : (isReviewMode ? 'hover:bg-amber-50/50 cursor-pointer group' : '');

    return (
      <td
        colSpan={colSpan}
        rowSpan={rowSpan}
        className={`${baseClass} ${highlightClass}`}
        onClick={isReviewMode ? () => openCommentModal(effectiveKey, fieldName, fieldValuePreview) : undefined}
        title={isReviewMode ? (isCorregido ? `Corrección realizada por contratista en: ${fieldName}` : `Clic para dejar observación en: ${fieldName}`) : undefined}
      >
        <div className="relative print:static">
          {content}

          {/* Botón flotante para la administradora en Modo Revisión */}
          {isReviewMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openCommentModal(effectiveKey, fieldName, fieldValuePreview);
              }}
              className={`print:hidden absolute -top-1 -right-1 p-0.5 rounded shadow-xs text-[10px] transition-all z-20 ${
                hasComment 
                  ? (isCorregido ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-1 ring-emerald-300' : 'bg-amber-500 text-white hover:bg-amber-600')
                  : 'bg-emerald-700 text-white opacity-0 group-hover:opacity-100 hover:scale-110'
              }`}
              title={hasComment ? (isCorregido ? 'Validar / Editar corrección' : 'Editar observación') : 'Agregar observación a este campo'}
            >
              {isCorregido ? <CheckCircle2 size={11} /> : <MessageSquare size={11} />}
            </button>
          )}

          {/* Banner con el texto de la observación si existe */}
          {hasComment && (
            <div className={`print:hidden mt-1 p-1 rounded text-[9.5px] leading-tight font-medium flex items-start gap-1 shadow-xs ${
              isCorregido 
                ? 'bg-emerald-200 border border-emerald-400 text-emerald-950' 
                : 'bg-amber-200 border border-amber-400 text-amber-950'
            }`}>
              {isCorregido ? (
                <CheckCircle2 size={11} className="text-emerald-800 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={11} className="text-amber-800 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold">
                  {isCorregido ? '🟢 CORRECCIÓN REALIZADA: ' : 'Observación: '}
                </span>
                <span>{comment.comentario}</span>
              </div>
            </div>
          )}
        </div>
      </td>
    );
  };

  return (
    <div 
      id="informe-printable-document" 
      className="text-[11px] leading-tight text-black print:text-black relative"
      style={{ fontFamily: 'Calibri, "Segoe UI", Candara, Arial, sans-serif' }}
    >
      
      {/* Modal para dejar comentarios en campos específicos */}
      <FieldCommentModal
        isOpen={modalState.isOpen}
        fieldId={modalState.fieldId}
        fieldName={modalState.fieldName}
        fieldValuePreview={modalState.fieldValuePreview}
        initialComment={modalState.initialComment}
        authorName={authorName}
        onSave={handleSaveComment}
        onDelete={handleDeleteComment}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* FONDO / MEMBRETE INSTITUCIONAL (PREVIEW) */}
      {watermarkUrl && (
        <div 
          className="print:hidden absolute inset-0 w-full z-0 pointer-events-none opacity-100"
          style={{
            backgroundImage: `url(${watermarkUrl})`,
            backgroundSize: '100% 279.4mm',
            backgroundRepeat: 'repeat-y',
            backgroundPosition: 'top center'
          }}
        />
      )}

      {/* HEADER REPETITIVO EN CADA PÁGINA */}
      <table className="w-full relative z-10">
        <thead className="table-header-group">
          <tr>
            <th className="px-8 align-top relative border-none pb-3">
              {watermarkUrl && (
                <img 
                  src={watermarkUrl}
                  alt="Membrete"
                  className="hidden print:block absolute max-w-none"
                  style={{
                    top: '0',
                    left: '-10mm',
                    width: '215.9mm',
                    height: '279.4mm',
                    objectFit: 'fill',
                    zIndex: -1,
                    pointerEvents: 'none'
                  }}
                />
              )}

              {/* Espaciador para el logo superior */}
              <div className="h-[98px] w-full relative">
                {!watermarkUrl && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4">
                    <img 
                      src="https://usdsynzkedjydlynkala.supabase.co/storage/v1/object/public/anexos/logo/logo%20alcaldia.png" 
                      alt="Alcaldía de Quibdó" 
                      className="h-[80px] w-auto object-contain bg-transparent mix-blend-multiply"
                      crossOrigin="anonymous"
                    />
                  </div>
                )}
                <div className="absolute w-full left-0 right-0 bottom-0 flex justify-between items-end">
                  <div className="text-left text-[#006b33] font-bold text-[13px] tracking-wide">
                    NIT: {data.nitAlcaldia || '891680011-0'}
                  </div>
                  <div className="text-right text-[#006b33] flex flex-col items-end">
                    <div className="font-extrabold text-[11px] uppercase tracking-wide mb-0.5">
                      CÓDIGO: {data.secretariaCodigo || '170'}
                    </div>
                    <div className="font-bold text-[13px] uppercase">
                      {data.secretariaNombre || 'SECRETARÍA DE INCLUSIÓN Y COHESIÓN SOCIAL'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formato Informe */}
              <table className="w-full border-collapse border border-black mt-2.5 bg-white">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="border border-black w-[16%]"></td>
                    <td className="border border-black font-bold text-center text-xs py-1 bg-white uppercase tracking-wide">
                      FORMATO INFORME DE ACTIVIDADES
                    </td>
                  </tr>
                  <tr>
                    {renderReviewedTd(
                      'fechaAplicacion',
                      'Fecha de Aplicación del Formato',
                      data.fechaAplicacion,
                      <span className="font-bold text-[10px] uppercase text-left">
                        FECHA DE APLICACIÓN: {(data.fechaAplicacion || formatFechaAplicacion(data.periodoHasta, data.periodoDesde)).toUpperCase()}
                      </span>,
                      'py-1 px-2 text-left'
                    )}
                  </tr>
                </tbody>
              </table>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-8 pb-4">
              {/* DATOS DEL INFORME */}
              <table className="w-full border-collapse border border-black mb-3">
                <tbody>
                  <tr>
                    <td colSpan={6} className="border border-black bg-gray-200 text-center font-bold py-1 text-xs uppercase">
                      DATOS DEL INFORME
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1 font-bold text-center">Mensual</td>
                    {renderReviewedTd(
                      'tipoInforme_mensual',
                      'Tipo de Informe (Mensual)',
                      data.tipoInforme,
                      <span className="font-bold">{data.tipoInforme === 'Mensual' ? 'X' : ''}</span>,
                      'text-center'
                    )}
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1 font-bold text-center">Final</td>
                    {renderReviewedTd(
                      'tipoInforme_final',
                      'Tipo de Informe (Final)',
                      data.tipoInforme,
                      <span className="font-bold">{data.tipoInforme === 'Final' ? 'X' : ''}</span>,
                      'text-center'
                    )}
                  </tr>
                  <tr>
                    {renderReviewedTd(
                      'informeNro',
                      'Número de Informe',
                      data.informeNro,
                      <div className="font-bold">
                        Informe mensual de actividades Nro. <span className="text-sm font-extrabold ml-1">{data.informeNro}</span>
                      </div>,
                      'py-1.5 font-bold',
                      6
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold w-[16%]">Fecha de Presentación:</td>
                    {renderReviewedTd(
                      'fechaPresentacion',
                      'Fecha de Presentación',
                      data.fechaPresentacion,
                      formatDateSlash(data.fechaPresentacion),
                      'w-[20%]'
                    )}
                    <td className="border border-black px-2 py-1 font-bold w-[15%]">Período del informe:</td>
                    {renderReviewedTd(
                      'periodo',
                      'Período del Informe (Desde - Hasta)',
                      `DESDE: ${formatDateSlash(data.periodoDesde)} HASTA: ${formatDateSlash(data.periodoHasta)}`,
                      <span className="uppercase font-bold text-[10px]">
                        DESDE: {formatDateSlash(data.periodoDesde)} HASTA: {formatDateSlash(data.periodoHasta)}
                      </span>,
                      '',
                      3
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">Nombre del Contratista:</td>
                    {renderReviewedTd(
                      'contratistaNombre',
                      'Nombre del Contratista',
                      data.contratistaNombre,
                      <span className="font-bold uppercase">{data.contratistaNombre}</span>,
                      '',
                      3
                    )}
                    <td className="border border-black px-2 py-1 font-bold leading-tight text-[10px]">Nro. de documento de identidad:</td>
                    {renderReviewedTd(
                      'contratistaDocumento',
                      'Documento del Contratista',
                      data.contratistaDocumento,
                      <span className="font-bold text-xs">{data.contratistaDocumento}</span>,
                      ''
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">Correo Electrónico:</td>
                    {renderReviewedTd(
                      'contratistaCorreo',
                      'Correo Electrónico del Contratista',
                      data.contratistaCorreo,
                      <span className="text-[10px]">{data.contratistaCorreo}</span>,
                      '',
                      3
                    )}
                    <td className="border border-black px-2 py-1 font-bold text-[10px]">Nro. de teléfono:</td>
                    {renderReviewedTd(
                      'contratistaTelefono',
                      'Teléfono del Contratista',
                      data.contratistaTelefono,
                      <span className="text-[10px]">{data.contratistaTelefono}</span>,
                      ''
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold leading-tight text-[10px]">Nombre Interventor(a) o Supervisor(a):</td>
                    {renderReviewedTd(
                      'supervisorNombre',
                      'Nombre del Supervisor',
                      data.supervisorNombre,
                      <span className="font-bold uppercase">{data.supervisorNombre}</span>,
                      '',
                      3
                    )}
                    <td className="border border-black px-2 py-1 font-bold leading-tight text-[10px]">Nro. de documento de identidad:</td>
                    {renderReviewedTd(
                      'supervisorDocumento',
                      'Documento del Supervisor',
                      data.supervisorDocumento,
                      <span className="text-xs font-semibold">{data.supervisorDocumento}</span>,
                      ''
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold leading-tight text-[10px]">Nombre del Apoyo a la Supervisión:</td>
                    {renderReviewedTd(
                      'apoyoSupervisionNombre',
                      'Nombre del Apoyo a la Supervisión',
                      data.apoyoSupervisionNombre,
                      <span className="text-gray-600 italic uppercase text-[10px]">
                        {data.apoyoSupervisionNombre && data.apoyoSupervisionNombre !== 'N/A' ? data.apoyoSupervisionNombre : '(Relacione aquí el nombre de la persona encargada del apoyo a la supervisión del contrato, si es el caso)'}
                      </span>,
                      '',
                      3
                    )}
                    <td className="border border-black px-2 py-1 font-bold leading-tight text-[10px]">Nro. de documento de identidad:</td>
                    {renderReviewedTd(
                      'apoyoSupervisionDocumento',
                      'Documento del Apoyo a la Supervisión',
                      data.apoyoSupervisionDocumento,
                      <span className="text-[10px]">{data.apoyoSupervisionDocumento || 'N/A'}</span>,
                      ''
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">Valor del Contrato:</td>
                    {renderReviewedTd(
                      'valorContrato',
                      'Valor del Contrato',
                      data.valorContrato,
                      <span className="font-bold text-xs">{formatColombianCurrency(data.valorContrato)}</span>,
                      '',
                      2
                    )}
                    <td className="border border-black px-2 py-1 font-bold leading-tight text-[10px]">Valor de Adición:</td>
                    {renderReviewedTd(
                      'valorAdicion',
                      'Valor de Adición',
                      data.valorAdicion,
                      <span className="font-bold text-xs">{formatValorAdicion(data.valorAdicion)}</span>,
                      '',
                      2
                    )}
                  </tr>
                </tbody>
              </table>

              {/* DATOS DEL CONTRATO */}
              <table className="w-full border-collapse border border-black mb-3">
                <tbody>
                  <tr>
                    <td colSpan={6} className="border border-black bg-gray-200 text-center font-bold py-1 text-xs uppercase">
                      DATOS DEL CONTRATO
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold w-[16%]">Contrato Nro.</td>
                    {renderReviewedTd(
                      'contratoNro',
                      'Número de Contrato',
                      data.contratoNro ? data.contratoNro.replace(/\D/g, '') : '',
                      <span className="font-bold text-xs">{data.contratoNro ? data.contratoNro.replace(/\D/g, '') : ''}</span>,
                      '',
                      5
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">Objeto:</td>
                    {renderReviewedTd(
                      'objeto',
                      'Objeto del Contrato',
                      data.objeto,
                      <span className="uppercase text-justify text-[10px] leading-tight font-medium block">
                        {data.objeto}
                      </span>,
                      'py-1.5',
                      5
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">CDP Nro.</td>
                    {renderReviewedTd(
                      'cdpNro',
                      'CDP Nro.',
                      data.cdpNro,
                      data.cdpNro,
                      '',
                      2
                    )}
                    <td className="border border-black px-2 py-1 font-bold">CRP Nro.</td>
                    {renderReviewedTd(
                      'crpNro',
                      'CRP Nro.',
                      data.crpNro,
                      data.crpNro,
                      '',
                      2
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">Póliza Nro.</td>
                    {renderReviewedTd(
                      'polizaNro',
                      'Póliza Nro.',
                      data.polizaNro,
                      data.polizaNro,
                      '',
                      2
                    )}
                    <td colSpan={2} className="border border-black px-2 py-1 font-bold text-[10px]">Fecha Acta de Aprobación Póliza:</td>
                    {renderReviewedTd(
                      'fechaPoliza',
                      'Fecha Acta de Aprobación Póliza:',
                      data.fechaPoliza,
                      formatDateSlash(data.fechaPoliza),
                      ''
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold">Plazo:</td>
                    {renderReviewedTd(
                      'plazo',
                      'Plazo del Contrato',
                      data.plazo,
                      <span className="font-bold text-xs">{formatPlazoLetraYNumero(data.plazo)}</span>,
                      ''
                    )}
                    <td className="border border-black px-2 py-1 font-bold text-[10px] leading-tight">Fecha de Iniciación:</td>
                    {renderReviewedTd(
                      'fechaInicio',
                      'Fecha de Inicio',
                      data.fechaInicio,
                      <span className="font-bold text-xs">{formatDateSlash(data.fechaInicio)}</span>,
                      'text-center'
                    )}
                    <td className="border border-black px-2 py-1 font-bold text-[10px] leading-tight">Fecha de Terminación:</td>
                    {renderReviewedTd(
                      'fechaTerminacion',
                      'Fecha de Terminación',
                      data.fechaTerminacion,
                      <span className="font-bold text-xs">{formatDateSlash(data.fechaTerminacion)}</span>,
                      'text-center'
                    )}
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-1 font-bold text-[10px] leading-tight">Modificaciones al Contrato:</td>
                    {renderReviewedTd(
                      'modificaciones',
                      'Modificaciones al Contrato',
                      data.modificaciones,
                      <span className="text-gray-700 italic text-[10px]">
                        {data.modificaciones && data.modificaciones !== 'N/A' ? data.modificaciones : '(Relacione aquí todo lo correspondiente a una prórroga, adición y/o suspensión, si es el caso)'}
                      </span>,
                      '',
                      5
                    )}
                  </tr>
                </tbody>
              </table>

              {/* EJECUCIÓN DE ACTIVIDADES */}
              <table className="w-full border-collapse border border-black mb-3 tabla-obligaciones print:break-inside-auto">
                <thead>
                  <tr>
                    <th colSpan={3} className="border border-black bg-gray-200 text-center font-bold py-1 text-xs uppercase font-century-gothic">
                      EJECUCIÓN DE ACTIVIDADES FRENTE A LAS OBLIGACIONES DURANTE EL PERÍODO REPORTADO
                    </th>
                  </tr>
                  <tr className="bg-gray-100 text-[11px] font-century-gothic">
                    <th className="border border-black px-2 py-1 text-center w-[38%] font-bold font-century-gothic">Obligaciones Contractuales</th>
                    <th className="border border-black px-2 py-1 text-center w-[47%] font-bold font-century-gothic">Actividades realizadas y/o productos entregados</th>
                    <th className="border border-black px-2 py-1 text-center w-[15%] font-bold font-century-gothic">Soportes</th>
                  </tr>
                </thead>
                <tbody className="print:break-inside-auto">
                  {data.obligaciones.map((obs, idx) => (
                    <tr key={obs.id} className="break-inside-auto print:break-inside-auto">
                      {renderReviewedTd(
                        `obligacion_${obs.id}_descripcion`,
                        `Obligación #${idx + 1} (Descripción)`,
                        obs.descripcion,
                        <div className="text-justify whitespace-pre-wrap text-[12pt] leading-snug font-century-gothic-12 print:break-inside-auto print:static">
                          {obs.descripcion}
                        </div>,
                        'align-top font-century-gothic-12'
                      )}
                      {renderReviewedTd(
                        `obligacion_${obs.id}_actividades`,
                        `Obligación #${idx + 1} (Actividades Desarrolladas)`,
                        obs.actividades,
                        <div className="text-justify whitespace-pre-wrap text-[12pt] leading-snug font-century-gothic-12 print:break-inside-auto print:static">
                          {obs.actividades}
                        </div>,
                        'align-top font-century-gothic-12'
                      )}
                      {renderReviewedTd(
                        `obligacion_${obs.id}_soportes`,
                        `Obligación #${idx + 1} (Soportes)`,
                        obs.soportes,
                        <div className="text-center text-[12pt] font-medium font-century-gothic-12 print:break-inside-auto print:static">
                          {obs.soportes}
                        </div>,
                        'align-top text-center font-century-gothic-12'
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* BLOQUE: OBSERVACIONES Y SUSCRIPCIÓN */}
              <div>
                {/* OBSERVACIONES Y RECOMENDACIONES */}
                <table className="w-full border-collapse border border-black mb-3">
                  <tbody>
                    <tr>
                      <td className="border border-black bg-gray-200 text-center font-bold py-1 uppercase text-xs">
                        OBSERVACIONES Y RECOMENDACIONES
                      </td>
                    </tr>
                    <tr>
                      {renderReviewedTd(
                        'observaciones',
                        'Observaciones y Recomendaciones Generales',
                        data.observaciones,
                        <div className="text-justify min-h-8 align-top whitespace-pre-wrap text-[10px] leading-snug">
                          {data.observaciones || ''}
                        </div>,
                        'px-2 py-2'
                      )}
                    </tr>
                  </tbody>
                </table>

                {/* SUSCRIPCIÓN DEL INFORME */}
                <div className="border border-black mb-4 bg-white relative break-inside-avoid">
                  {/* 1. Título con fondo gris */}
                  <div className="bg-gray-200 border-b border-black text-center font-bold py-1 uppercase text-[11px] tracking-wide text-black">
                    SUSCRIPCIÓN DEL INFORME
                  </div>
                  
                  {/* 2. Párrafo de certificación con el MISMO fondo gris que el título */}
                  <div 
                    className={`bg-gray-200 border-b border-black p-3 text-justify text-[11px] leading-relaxed italic text-black relative ${
                      data.comentariosCampos?.['valorPagar'] ? 'ring-2 ring-amber-400 bg-amber-100/90' : (isReviewMode ? 'hover:bg-gray-300/80 cursor-pointer group' : '')
                    }`}
                    onClick={isReviewMode ? () => openCommentModal('valorPagar', 'Texto de Certificación y Valor a Pagar', data.valorPagar) : undefined}
                  >
                    El supervisor con la firma del presente documento certifica que verificó el cumplimiento de las obligaciones contractuales para el período de presentación de este informe, como el pago de los aportes respectivos al Sistema de Seguridad Social, por concepto de salud, pensiones y ARL, por tal razón, se autoriza el pago al Contratista de la suma de{' '}
                    <span className="italic uppercase">
                      {data.valorPagar ? data.valorPagar.trim().replace(/\.$/, '') : ''}
                    </span>.
                    
                    {isReviewMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCommentModal('valorPagar', 'Texto de Certificación y Valor a Pagar', data.valorPagar);
                        }}
                        className={`print:hidden absolute top-2 right-2 p-1 rounded text-white text-[10px] ${
                          data.comentariosCampos?.['valorPagar'] ? 'bg-amber-500' : 'bg-emerald-700 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Dejar observación sobre certificación y valor"
                      >
                        <MessageSquare size={11} />
                      </button>
                    )}

                    {data.comentariosCampos?.['valorPagar'] && (
                      <div className="print:hidden mt-1.5 p-1 bg-amber-100 border border-amber-300 rounded text-amber-950 text-[9.5px] font-bold not-italic flex items-center gap-1">
                        <AlertTriangle size={11} className="text-amber-700 shrink-0" />
                        <span>Observación sobre valor a pagar: {data.comentariosCampos['valorPagar'].comentario}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 3. Cuadro de Firmas en 2 Columnas con división central */}
                  <div className="grid grid-cols-2 divide-x divide-black text-center min-h-[160px] bg-white">
                    {/* Columna Contratista */}
                    <div className="p-3 pt-6 flex flex-col justify-between">
                      <div className="h-20 flex items-end justify-center pb-2">
                        {/* Espacio para firma visual */}
                        <div className="text-[10px] text-gray-300 italic"></div>
                      </div>
                      <div>
                        <div className="w-[85%] mx-auto border-t border-black pt-1 mb-1">
                          <p className="font-bold text-[11px] text-black">Firma del contratista</p>
                        </div>
                        <div 
                          className="mt-3 px-1 relative group"
                          onClick={isReviewMode ? () => openCommentModal('contratistaNombre', 'Nombre del Contratista', data.contratistaNombre) : undefined}
                        >
                          <div className="bg-gray-300 py-1 px-2 text-[11px] font-semibold italic uppercase text-black w-full text-center shadow-xs">
                            {data.contratistaNombre}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Columna Supervisor */}
                    <div className="p-3 pt-6 flex flex-col justify-between">
                      <div className="h-20 flex items-end justify-center pb-2">
                        {/* Espacio para firma visual */}
                        <div className="text-[10px] text-gray-300 italic"></div>
                      </div>
                      <div>
                        <div className="w-[85%] mx-auto border-t border-black pt-1 mb-1">
                          <p className="font-bold text-[11px] text-black">Firma Supervisor</p>
                        </div>
                        <div 
                          className="mt-3 px-1 relative group"
                          onClick={isReviewMode ? () => openCommentModal('supervisorNombre', 'Nombre del Supervisor', data.supervisorNombre) : undefined}
                        >
                          <div className="bg-gray-300 py-1 px-2 text-[11px] font-semibold italic uppercase text-black w-full text-center shadow-xs">
                            {data.supervisorNombre}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          
          {/* ANEXOS FOTOGRÁFICOS */}
          {data.anexos && data.anexos.length > 0 && (
            <tr>
              <td className="px-8 pt-2 pb-4">
                <div className="text-center mb-3">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-900">ANEXOS FOTOGRÁFICOS</h3>
                  <div className="w-14 h-0.5 bg-[#2a7a38] mx-auto mt-0.5"></div>
                </div>
                
                <div className="space-y-6">
                  {/* Agrupamiento inteligente por Obligación */}
                  {data.obligaciones.some(o => o.fotos && o.fotos.length > 0) ? (
                    data.obligaciones.map((obs, oIdx) => {
                      const obsFotos = obs.fotos || [];
                      if (obsFotos.length === 0) return null;

                      return (
                        <div key={obs.id} className="space-y-3 break-inside-avoid">
                          {/* ÚNICO ENCABEZADO PARA LA OBLIGACIÓN Y TODAS SUS FOTOS */}
                          <div className="bg-[#f0f7f2] border border-[#b8dec2] px-3 py-1.5 rounded text-center print:bg-[#f0f7f2]">
                            <span className="font-bold text-[11.5px] uppercase text-[#005226] tracking-wide block">
                              OBLIGACIÓN Nº {oIdx + 1}
                            </span>
                            {obs.descripcion && (
                              <p className="text-[10pt] font-century-gothic text-gray-700 italic mt-0.5 leading-snug">
                                {obs.descripcion}
                              </p>
                            )}
                          </div>

                          {/* TODAS LAS FOTOS DE ESTA OBLIGACIÓN DEBAJO DEL ENCABEZADO */}
                          <div className="space-y-3">
                            {obsFotos.map((anexo, aIdx) => {
                              const anexoKey = `anexo_${anexo.id || aIdx}`;
                              const hasAnexoComment = Boolean(data.comentariosCampos?.[anexoKey]);

                              return (
                                <div 
                                  key={anexo.id || aIdx} 
                                  className={`break-inside-avoid flex flex-col items-center p-1.5 rounded mb-1 transition-colors ${
                                    hasAnexoComment 
                                      ? 'bg-amber-100/90 border-2 border-amber-400 print:bg-transparent print:border-none' 
                                      : 'bg-transparent'
                                  }`}
                                  onClick={isReviewMode ? () => openCommentModal(anexoKey, `Evidencia Fotográfica - Obligación #${oIdx + 1}`, anexo.titulo) : undefined}
                                >
                                  {isReviewMode && (
                                    <div className="flex items-center justify-end w-full mb-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCommentModal(anexoKey, `Evidencia Fotográfica - Obligación #${oIdx + 1}`, anexo.titulo);
                                        }}
                                        className={`px-2 py-0.5 rounded text-white text-[10px] font-semibold flex items-center gap-1 ${hasAnexoComment ? 'bg-amber-500' : 'bg-emerald-700'}`}
                                        title="Dejar observación sobre este anexo"
                                      >
                                        <MessageSquare size={11} />
                                        <span>{hasAnexoComment ? 'Observación' : 'Observar'}</span>
                                      </button>
                                    </div>
                                  )}

                                  {hasAnexoComment && (
                                    <div className="print:hidden w-full mb-2 p-1.5 bg-amber-200 border border-amber-400 rounded text-amber-950 text-xs font-medium flex items-center gap-1.5">
                                      <AlertTriangle size={13} className="text-amber-800 shrink-0" />
                                      <span>Observación: {data.comentariosCampos?.[anexoKey].comentario}</span>
                                    </div>
                                  )}

                                  <div className="w-full flex justify-center items-center bg-white/95 p-2 border border-gray-300 rounded shadow-xs relative z-10">
                                    <img 
                                      src={anexo.imagenUrl} 
                                      alt={`Obligación ${oIdx + 1} - Foto ${aIdx + 1}`} 
                                      crossOrigin="anonymous"
                                      className="max-w-full max-h-[295px] w-auto h-auto object-contain rounded"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    data.anexos.map((anexo, aIdx) => {
                      const anexoKey = `anexo_${anexo.id || aIdx}`;
                      const hasAnexoComment = Boolean(data.comentariosCampos?.[anexoKey]);

                      return (
                        <div 
                          key={anexo.id || aIdx} 
                          className={`break-inside-avoid flex flex-col items-center p-2 rounded mb-2 transition-colors ${
                            hasAnexoComment 
                              ? 'bg-amber-100/90 border-2 border-amber-400 print:bg-transparent print:border-none' 
                              : 'bg-transparent'
                          }`}
                          onClick={isReviewMode ? () => openCommentModal(anexoKey, `Anexo Fotográfico`, anexo.titulo) : undefined}
                        >
                          {isReviewMode && (
                            <div className="flex items-center justify-end w-full mb-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCommentModal(anexoKey, `Anexo Fotográfico`, anexo.titulo);
                                }}
                                className={`p-1 rounded text-white text-[10px] ${hasAnexoComment ? 'bg-amber-500' : 'bg-emerald-700'}`}
                                title="Dejar observación sobre este anexo"
                              >
                                <MessageSquare size={12} />
                              </button>
                            </div>
                          )}

                          {hasAnexoComment && (
                            <div className="print:hidden mb-2 p-1.5 bg-amber-200 border border-amber-400 rounded text-amber-950 text-xs font-medium flex items-center gap-1.5">
                              <AlertTriangle size={13} className="text-amber-800 shrink-0" />
                              <span>Observación: {data.comentariosCampos?.[anexoKey].comentario}</span>
                            </div>
                          )}

                          <div className="w-full flex justify-center items-center bg-white/95 p-2 border border-gray-300 rounded shadow-xs relative z-10">
                            <img 
                              src={anexo.imagenUrl} 
                              alt={anexo.titulo || `Foto ${aIdx + 1}`} 
                              crossOrigin="anonymous"
                              className="max-w-full max-h-[295px] w-auto h-auto object-contain rounded"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="table-footer-group print:table-footer-group">
          <tr>
            <td className="border-none p-0 m-0" style={{ height: '28mm', minHeight: '28mm' }}>
              <div style={{ height: '28mm', minHeight: '28mm', width: '100%' }} className="pointer-events-none">&nbsp;</div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
