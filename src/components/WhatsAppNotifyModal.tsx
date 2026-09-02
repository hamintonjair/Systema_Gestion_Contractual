import React, { useState, useEffect } from 'react';
import { 
  WhatsAppNotificationPayload, 
  generateWhatsAppMessage, 
  openWhatsAppNotification, 
  formatColombianPhoneForWhatsApp 
} from '../utils/whatsappNotifier';
import { 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Phone, 
  User, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  ExternalLink
} from 'lucide-react';

interface Props {
  payload: WhatsAppNotificationPayload;
  onClose: () => void;
  onUpdatePhone?: (phone: string) => void;
  onApproveReport?: (payload: WhatsAppNotificationPayload) => void | Promise<void>;
  onStatusChange?: (tipo: 'aprobado' | 'devuelto' | 'recordatorio', payload: WhatsAppNotificationPayload) => void | Promise<void>;
}

export default function WhatsAppNotifyModal({ payload, onClose, onUpdatePhone, onApproveReport, onStatusChange }: Props) {
  const [tipo, setTipo] = useState<'aprobado' | 'devuelto' | 'recordatorio'>(payload.tipo);
  const [telefono, setTelefono] = useState<string>(payload.contratistaTelefono || '');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // Recalcular mensaje cuando cambia el tipo
  useEffect(() => {
    const defaultMsg = generateWhatsAppMessage({
      ...payload,
      tipo,
      contratistaTelefono: telefono
    });
    setCustomMessage(defaultMsg);
  }, [tipo, payload, telefono]);

  const handleSend = () => {
    if (onUpdatePhone && telefono !== payload.contratistaTelefono) {
      onUpdatePhone(telefono);
    }

    // Si el motivo de la notificación es "Aprobado", ejecutar la función de aprobación inmediata
    if (tipo === 'aprobado') {
      if (onApproveReport) {
        onApproveReport(payload);
      }
      if (onStatusChange) {
        onStatusChange('aprobado', payload);
      }
    } else if (tipo === 'devuelto') {
      if (onStatusChange) {
        onStatusChange('devuelto', payload);
      }
    }

    openWhatsAppNotification({
      ...payload,
      tipo,
      contratistaTelefono: telefono
    }, customMessage);

    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedPhone = formatColombianPhoneForWhatsApp(telefono);
  const commentsCount = payload.comentariosCampos ? Object.keys(payload.comentariosCampos).length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden border border-gray-200 max-h-[92vh]">
        
        {/* Header con colores de WhatsApp y Alcaldía */}
        <div className="bg-gradient-to-r from-emerald-800 to-[#128C7E] text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 border border-white/30">
              <MessageSquare size={20} className="text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Notificación Oficial por WhatsApp</span>
                <span className="bg-emerald-500/40 text-emerald-100 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Alcaldía de Quibdó
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90">
                Informe #{payload.informeNro} • {payload.contratistaNombre}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Tipo de Notificación */}
          <div>
            <label className="block font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[11px]">
              Motivo del Mensaje:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTipo('devuelto')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  tipo === 'devuelto'
                    ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <AlertTriangle size={16} className={tipo === 'devuelto' ? 'text-amber-600' : 'text-gray-400'} />
                <span className="text-[11px] text-center">Devolución / Obs. ({commentsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo('aprobado')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  tipo === 'aprobado'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <CheckCircle2 size={16} className={tipo === 'aprobado' ? 'text-emerald-600' : 'text-gray-400'} />
                <span className="text-[11px] text-center">Aprobado para Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo('recordatorio')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  tipo === 'recordatorio'
                    ? 'border-blue-500 bg-blue-50 text-blue-950 font-bold shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <Info size={16} className={tipo === 'recordatorio' ? 'text-blue-600' : 'text-gray-400'} />
                <span className="text-[11px] text-center">Recordatorio</span>
              </button>
            </div>

            {tipo === 'aprobado' && (
              <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-[11px] text-emerald-900 font-medium animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                <span>Al enviar esta notificación, el informe se marcará automáticamente como <strong>Aprobado para Pago</strong> en el sistema institucional.</span>
              </div>
            )}
          </div>

          {/* Teléfono del Contratista */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="font-bold text-gray-700 flex items-center gap-1.5">
                <Phone size={13} className="text-emerald-700" />
                <span>Número de Celular / WhatsApp del Contratista:</span>
              </label>
              {formattedPhone && (
                <span className="text-[10px] font-mono text-emerald-700 font-bold">
                  Destino: +{formattedPhone}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-200 border border-gray-300 rounded-lg px-2.5 py-2 text-gray-600 font-bold shrink-0">
                🇨🇴 +57
              </div>
              <input
                type="tel"
                placeholder="ej. 3105557788"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-mono"
              />
            </div>
            {!telefono && (
              <p className="text-[10.5px] text-amber-700 flex items-center gap-1 font-medium">
                <AlertTriangle size={12} />
                Si no ingresas el número, WhatsApp se abrirá para que selecciones el contacto manualmente de tu agenda.
              </p>
            )}
          </div>

          {/* Vista Previa y Edición del Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                Vista Previa del Mensaje Redactado:
              </label>
              <button
                type="button"
                onClick={() => setIsEditingMessage(!isEditingMessage)}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline"
              >
                {isEditingMessage ? 'Vista Normal' : 'Personalizar Texto'}
              </button>
            </div>

            <textarea
              rows={8}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={!isEditingMessage}
              className={`w-full p-3 rounded-xl border font-mono text-[11px] leading-relaxed transition-all ${
                isEditingMessage 
                  ? 'border-emerald-500 ring-2 ring-emerald-100 bg-white text-gray-900' 
                  : 'border-gray-200 bg-gray-50 text-gray-700 select-all'
              }`}
            />
          </div>

        </div>

        {/* Footer con Botones de Acción */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Texto'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSend}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-98"
            >
              <Send size={15} />
              <span>Abrir WhatsApp y Enviar</span>
              <ExternalLink size={13} className="opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
