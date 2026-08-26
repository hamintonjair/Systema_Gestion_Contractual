import React from 'react';
import { AlertTriangle, X, CheckCircle2, Image, FileText } from 'lucide-react';
import { RadicacionValidationError } from '../utils/validationUtils';

interface ValidationAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: RadicacionValidationError[];
  reportNro?: string;
}

export default function ValidationAlertModal({
  isOpen,
  onClose,
  errors,
  reportNro
}: ValidationAlertModalProps) {
  if (!isOpen) return null;

  const generalErrors = errors.filter(e => e.type === 'general');
  const actividadErrors = errors.filter(e => e.type === 'actividades');
  const fotoErrors = errors.filter(e => e.type === 'fotos');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
        
        {/* Encabezado */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                No es posible radicar el informe {reportNro ? `#${reportNro}` : ''}
              </h3>
              <p className="text-xs text-slate-500">
                Verifica los siguientes requisitos obligatorios antes de enviar:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de Errores por Categoría */}
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 text-xs">
          
          {/* 1. Errores Generales */}
          {generalErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-900">
                <FileText size={15} className="text-red-700" />
                <span>Datos Generales Incompletos:</span>
              </div>
              <ul className="list-disc list-inside text-red-800 space-y-1 pl-1">
                {generalErrors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. Actividades de Obligaciones Incompletas */}
          {actividadErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle size={15} className="text-amber-700" />
                <span>Actividades Realizadas Pendientes:</span>
              </div>
              <ul className="list-disc list-inside text-amber-900 space-y-1 pl-1">
                {actividadErrors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 3. Requisito Indispensable: Fotos por Obligación */}
          {fotoErrors.length > 0 && (
            <div className="p-3 bg-red-50/80 border border-red-300 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-950">
                <Image size={15} className="text-red-700" />
                <span>Evidencias Fotográficas Faltantes (Requisito Indispensable):</span>
              </div>
              <p className="text-[11px] text-red-900 font-medium">
                Cada obligación debe tener al menos una (1) imagen adjunta que demuestre el cumplimiento de la actividad.
              </p>
              <ul className="list-disc list-inside text-red-900 space-y-1 pl-1 font-semibold">
                {fotoErrors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Pie y Acción */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#006b33] hover:bg-[#005729] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={16} />
            <span>Entendido, volver a la edición</span>
          </button>
        </div>

      </div>
    </div>
  );
}
