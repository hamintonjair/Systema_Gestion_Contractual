import React, { useState, useEffect, useRef } from 'react';
import { AuthUser, Notificacion } from '../types';
import { supabaseService } from '../services/supabaseService';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Info, 
  Award, 
  Check, 
  CheckCheck, 
  ChevronRight,
  ExternalLink,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  onOpenReport?: (informeNro: string) => void;
}

export default function NotificationBell({ currentUser, onOpenReport }: Props) {
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    if (!currentUser) return;
    try {
      const list = await supabaseService.getNotificaciones(currentUser.id, currentUser.documentoIdentidad);
      setNotifications(list);
    } catch (e) {
      console.warn('Error loading notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifs();

    const handleUpdate = () => {
      fetchNotifs();
    };

    window.addEventListener('notificaciones_actualizadas', handleUpdate);
    window.addEventListener('informe_comments_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    // Click fuera para cerrar dropdown
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('notificaciones_actualizadas', handleUpdate);
      window.removeEventListener('informe_comments_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [currentUser.id, currentUser.documentoIdentidad]);

  const unreadCount = notifications.filter(n => !n.leida).length;
  const filteredNotifs = activeFilter === 'unread' 
    ? notifications.filter(n => !n.leida) 
    : notifications;

  const handleMarkAsRead = async (e: React.MouseEvent, notif: Notificacion) => {
    e.stopPropagation();
    await supabaseService.marcarNotificacionLeida(notif.id, currentUser.documentoIdentidad);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    await supabaseService.marcarTodasNotificacionesLeidas(currentUser.id, currentUser.documentoIdentidad);
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notif: Notificacion) => {
    e.stopPropagation();
    await supabaseService.eliminarNotificacion(notif.id, currentUser.documentoIdentidad, currentUser.id);
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
  };

  const handleClearAll = async () => {
    if (window.confirm('¿Deseas eliminar todas las notificaciones de tu buzón?')) {
      await supabaseService.limpiarTodasNotificaciones(currentUser.id, currentUser.documentoIdentidad);
      setNotifications([]);
    }
  };

  const handleItemClick = async (notif: Notificacion) => {
    if (!notif.leida) {
      await supabaseService.marcarNotificacionLeida(notif.id, currentUser.documentoIdentidad);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
    }
    setIsOpen(false);

    const fullText = `${notif.titulo || ''} ${notif.mensaje || ''}`.toLowerCase();
    if (fullText.includes('certificado de supervisión') || fullText.includes('certificado de cumplimiento') || fullText.includes('supervisión')) {
      window.dispatchEvent(new CustomEvent('switch_contractor_tab', {
        detail: { tab: 'supervision', informeNro: notif.informe_nro }
      }));
    } else if (fullText.includes('soporte fiduciaria') || fullText.includes('fiduciaria') || fullText.includes('seguridad social')) {
      window.dispatchEvent(new CustomEvent('switch_contractor_tab', {
        detail: { tab: 'fiduciaria', informeNro: notif.informe_nro }
      }));
    } else if (fullText.includes('declaración') || fullText.includes('juramento') || fullText.includes('renta')) {
      window.dispatchEvent(new CustomEvent('switch_contractor_tab', {
        detail: { tab: 'juramento', informeNro: notif.informe_nro }
      }));
    } else if (fullText.includes('desembolso') || fullText.includes('documento equivalente')) {
      window.dispatchEvent(new CustomEvent('switch_contractor_tab', {
        detail: { tab: 'desembolso', informeNro: notif.informe_nro }
      }));
    } else if (notif.informe_nro && onOpenReport) {
      onOpenReport(notif.informe_nro);
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'Reciente';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Ahora mismo';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;

      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    } catch {
      return 'Reciente';
    }
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'aprobacion':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
            <Award size={16} />
          </div>
        );
      case 'devolucion':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle size={16} />
          </div>
        );
      case 'radicado':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
            <FileText size={16} />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 shadow-xs">
            <Info size={16} />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de Campana */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
        title="Notificaciones del Sistema"
        aria-label="Abrir panel de notificaciones"
      >
        <Bell size={18} className={unreadCount > 0 ? 'text-amber-300' : 'text-emerald-200'} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-gray-950 font-black text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-md border-2 border-[#042813] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Desplegable de Notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-gray-900 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          
          {/* Encabezado */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-900 to-emerald-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-emerald-300" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                Notificaciones
              </h4>
              {unreadCount > 0 && (
                <span className="bg-amber-400 text-gray-950 font-bold text-[10px] px-2 py-0.2 rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] text-emerald-200 hover:text-white font-semibold flex items-center gap-1 transition-colors bg-emerald-800/40 hover:bg-emerald-800/80 px-2 py-0.5 rounded-md"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={13} />
                  <span>Leídas</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-red-200 hover:text-red-100 font-semibold flex items-center gap-1 transition-colors bg-red-900/40 hover:bg-red-900/80 px-2 py-0.5 rounded-md"
                  title="Vaciar todas las notificaciones"
                >
                  <Trash2 size={12} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="flex border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                activeFilter === 'all' 
                  ? 'bg-emerald-800 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                activeFilter === 'unread' 
                  ? 'bg-emerald-800 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              No leídas ({unreadCount})
            </button>
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell size={28} className="mx-auto mb-2 opacity-30 text-slate-500" />
                <p className="text-xs font-semibold text-slate-600">No hay notificaciones {activeFilter === 'unread' ? 'pendientes' : ''}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Te avisaremos sobre cambios y aprobaciones de tus informes.</p>
              </div>
            ) : (
              filteredNotifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3 sm:p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-50 relative group ${
                    !n.leida ? 'bg-emerald-50/40' : 'bg-white'
                  }`}
                >
                  {/* Icono por tipo */}
                  {getIcon(n.tipo)}

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-bold truncate ${!n.leida ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>
                        {n.titulo || (n.tipo === 'aprobacion' ? '¡Informe Aprobado!' : n.tipo === 'devolucion' ? 'Informe con Observaciones' : 'Aviso Institucional')}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatTimestamp(n.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {n.mensaje}
                    </p>

                    {n.informe_nro && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          Informe #{n.informe_nro}
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la notificación */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.leida && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(e, n)}
                        title="Marcar como leída"
                        className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-full transition-colors"
                      >
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(e, n)}
                      title="Eliminar notificación"
                      className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-80 group-hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pie */}
          <div className="p-2 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-medium">
            Alcaldía de Quibdó • Sistema de Notificaciones
          </div>

        </div>
      )}
    </div>
  );
}
