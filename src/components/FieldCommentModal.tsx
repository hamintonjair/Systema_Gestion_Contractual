import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FieldComment } from '../types';

interface Props {
  isOpen: boolean;
  fieldId: string;
  fieldName: string;
  fieldValuePreview?: string;
  initialComment?: FieldComment;
  authorName?: string;
  onSave: (fieldId: string, fieldName: string, comentario: string) => void;
  onDelete?: (fieldId: string) => void;
  onClose: () => void;
}

export default function FieldCommentModal({
  isOpen,
  fieldId,
  fieldName,
  fieldValuePreview,
  initialComment,
  authorName = 'Supervisora / Administradora',
  onSave,
  onDelete,
  onClose
}: Props) {
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (initialComment) {
      setCommentText(initialComment.comentario);
    } else {
      setCommentText('');
    }
  }, [initialComment, fieldId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onSave(fieldId, fieldName, commentText.trim());
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(fieldId);
    }
    onClose();
  };

  const isCorregido = Boolean(initialComment?.corregido);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-gray-200 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-900">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCorregido ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isCorregido ? <CheckCircle2 size={18} /> : <MessageSquare size={17} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {isCorregido ? 'Revisar Corrección del Contratista' : 'Dejar / Editar Observación'}
              </h3>
              <p className={`text-xs font-semibold ${isCorregido ? 'text-emerald-800' : 'text-amber-800'}`}>Campo: {fieldName}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner si el contratista realizó una corrección */}
        {isCorregido && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs flex items-start gap-2.5 shadow-2xs">
            <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-emerald-950 block">🟢 Corrección Realizada por el Contratista</span>
              <p className="text-[11.5px] text-emerald-900 mt-0.5">
                El contratista ha modificado el contenido de este campo. Si el ajuste es correcto, presiona <strong>"Validar y Quitar Observación"</strong>.
              </p>
              {initialComment?.fechaCorreccion && (
                <span className="text-[10px] text-emerald-700 block mt-1">Fecha de modificación: {initialComment.fechaCorreccion}</span>
              )}
            </div>
          </div>
        )}

        {/* Valor actual del campo */}
        {fieldValuePreview && (
          <div className="mt-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs">
            <span className="font-semibold text-gray-500 block mb-0.5 text-[10px] uppercase">Contenido actual del campo:</span>
            <p className="text-gray-800 line-clamp-3 italic font-medium">{fieldValuePreview}</p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Observación o Ajuste Requerido <span className="text-amber-700">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Ej: Por favor ajustar este valor de acuerdo con el Otrosí Nro. 1 y verificar la fecha de inicio..."
              className="w-full border border-amber-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50/40 text-gray-900 placeholder:text-gray-400 font-medium"
              autoFocus
            />
          </div>

          <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              {initialComment && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    isCorregido
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400'
                      : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                  }`}
                >
                  {isCorregido ? <CheckCircle2 size={14} /> : <Trash2 size={13} />}
                  <span>{isCorregido ? 'Validar y Quitar Observación' : 'Eliminar Observación'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Check size={14} />
                <span>Guardar Observación</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
