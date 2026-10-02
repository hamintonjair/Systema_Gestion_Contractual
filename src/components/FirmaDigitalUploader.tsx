import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

interface Props {
  userDoc?: string;
  firmaUrl?: string;
  onFirmaChange: (url: string) => void;
  title?: string;
  compact?: boolean;
}

export default function FirmaDigitalUploader({
  userDoc = '',
  firmaUrl,
  onFirmaChange,
  title = 'Firma Digitalizada del Contratista',
  compact = false,
}: Props) {
  const [currentFirma, setCurrentFirma] = useState<string>(firmaUrl || '');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar cuando cambia la prop firmaUrl o al escuchar el evento global
  useEffect(() => {
    if (firmaUrl) {
      setCurrentFirma(firmaUrl);
    } else if (userDoc) {
      supabaseService.getFirmaContratista(userDoc).then((url) => {
        if (url) {
          setCurrentFirma(url);
          onFirmaChange(url);
        }
      });
    }

    const handleGlobalFirmaUpdate = (e: any) => {
      if (e.detail?.url !== undefined) {
        setCurrentFirma(e.detail.url);
        onFirmaChange(e.detail.url);
      }
    };

    window.addEventListener('firma_contratista_actualizada', handleGlobalFirmaUpdate);
    return () => {
      window.removeEventListener('firma_contratista_actualizada', handleGlobalFirmaUpdate);
    };
  }, [firmaUrl, userDoc]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    // Validar tipo de archivo (imagen)
    if (!file.type.startsWith('image/')) {
      setError('Por favor seleccione un archivo de imagen válido (PNG, JPG o WebP).');
      return;
    }

    // Validar tamaño máximo (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen de la firma no debe superar 5MB.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await supabaseService.uploadFirmaContratista(userDoc, file, currentFirma);
      if (res.success && res.url) {
        setCurrentFirma(res.url);
        onFirmaChange(res.url);
        setSuccessMsg('Firma cargada y sincronizada correctamente.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(res.error || 'No se pudo guardar la firma.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al procesar la firma.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFirma = async () => {
    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await supabaseService.deleteFirmaContratista(userDoc, currentFirma);
      setCurrentFirma('');
      onFirmaChange('');
      setConfirmDelete(false);
      setSuccessMsg('Firma eliminada de todos los documentos.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError('Error al eliminar la firma.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`rounded-xl border ${currentFirma ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200 bg-white'} p-4 shadow-xs transition-all`}>
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
            <ImageIcon size={16} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wide">
              {title}
            </h4>
            <p className="text-[10px] text-gray-500">
              Sincronizada en: Informe Mensual, Renta, Desembolso e Informe Final
            </p>
          </div>
        </div>

        {currentFirma && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
            <CheckCircle2 size={12} />
            Firma Activa
          </span>
        )}
      </div>

      {/* Contenido principal */}
      <div className="mt-3">
        {currentFirma ? (
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-lg border border-emerald-200">
            {/* Visualizador de la firma con tamaño por defecto controlado */}
            <div className="w-full sm:w-48 h-20 bg-white border border-gray-200 rounded-md p-2 flex items-center justify-center shadow-xs overflow-hidden">
              <img
                src={currentFirma}
                alt="Firma Digitalizada"
                className="max-h-16 max-w-full object-contain"
              />
            </div>

            {/* Acciones */}
            <div className="flex-1 flex flex-col justify-center space-y-2 w-full">
              <div className="text-[11px] text-gray-700">
                <p className="font-semibold text-gray-900">Firma digital cargada en el sistema</p>
                <p className="text-[10px] text-gray-500">
                  Esta firma aparecerá automáticamente en el tamaño y proporción oficial en todos los formatos.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-xs">
                  <Upload size={13} />
                  <span>Cambiar Firma</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </label>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                    <span className="text-[10px] font-bold text-red-700 pl-1">¿Confirmar?</span>
                    <button
                      type="button"
                      onClick={handleDeleteFirma}
                      disabled={isUploading}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded"
                    >
                      Sí, borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10px] font-bold rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl bg-gray-50/50 hover:bg-emerald-50/20 transition-all text-center">
            <div className="p-2.5 bg-white border border-gray-200 rounded-full shadow-xs mb-2 text-emerald-700">
              <Upload size={20} />
            </div>
            <p className="font-bold text-xs text-gray-800">
              Cargar Imagen de la Firma
            </p>
            <p className="text-[10px] text-gray-500 max-w-xs mt-0.5 mb-3">
              Seleccione una imagen con fondo transparente o blanco (PNG, JPG, WebP)
            </p>

            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors">
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Subiendo a Supabase...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Seleccionar Archivo de Firma</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>
        )}

        {/* Mensajes de error o éxito */}
        {error && (
          <div className="mt-2.5 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-2.5 p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] text-emerald-900 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
