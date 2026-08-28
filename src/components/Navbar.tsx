import React, { useState, useEffect } from 'react';
import { AuthUser, UserRole, DEMO_USERS } from '../types';
import { 
  FileText, 
  Building2, 
  ShieldCheck, 
  Database, 
  Printer, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  LayoutDashboard,
  FileEdit,
  LogOut,
  User,
  ChevronDown,
  ArrowLeft,
  Download
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { SUPABASE_CONFIG } from '../lib/supabase';
import QuibdoLogo from './QuibdoLogo';
import NotificationBell from './NotificationBell';

interface Props {
  currentUser: AuthUser;
  currentView: 'dashboard' | 'editor' | 'admin' | 'superadmin';
  onViewChange: (view: 'dashboard' | 'editor' | 'admin' | 'superadmin') => void;
  onLogout: () => void;
  onSwitchUser: (user: AuthUser) => void;
  onPrint?: () => void;
  onDownloadPDF?: () => void;
  onSaveToSupabase?: () => void;
  onOpenReport?: (informeNro: string) => void;
  isSaving?: boolean;
  isGeneratingPDF?: boolean;
  hasUnsavedChanges?: boolean;
}

export default function Navbar({
  currentUser,
  currentView,
  onViewChange,
  onLogout,
  onSwitchUser,
  onPrint,
  onDownloadPDF,
  onSaveToSupabase,
  onOpenReport,
  isSaving = false,
  isGeneratingPDF = false,
  hasUnsavedChanges = false,
}: Props) {
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string }>({
    connected: true,
    message: 'Conectando a Supabase...',
  });
  const [showDbModal, setShowDbModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    supabaseService.checkConnection().then((res) => {
      setDbStatus(res);
    });
  }, []);

  return (
    <header className="bg-[#042813] text-white shadow-md border-b border-emerald-900/80 sticky top-0 z-30 print:hidden">
      {/* Franja Superior Institucional Tricolor */}
      <div className="w-full h-1 flex">
        <div className="w-1/2 bg-[#006b33]"></div>
        <div className="w-1/3 bg-[#c8102e]"></div>
        <div className="w-1/6 bg-[#f59e0b]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo y Nombre de la Plataforma */}
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-full p-0.5 shadow-xs shrink-0">
              <QuibdoLogo variant="shield-only" size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white leading-none">
                  Alcaldía de Quibdó
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  {currentUser.role === 'contratista' ? 'Portal Contratista' : currentUser.role === 'secretaria_admin' ? 'Supervisión Secretaría' : 'Super Admin'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/80 mt-0.5 flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
                <span>{currentUser.secretariaNombre || 'Gestión Municipal Central'}</span>
                {currentUser.secretariaCodigo && (
                  <>
                    <span className="text-emerald-500">•</span>
                    <span className="font-mono text-emerald-400">Cód. {currentUser.secretariaCodigo}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Navegación y Perfil de Usuario */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Botón para regresar a "Mis Informes" si el contratista está editando */}
            {currentUser.role === 'contratista' && currentView === 'editor' && (
              <button
                onClick={() => onViewChange('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-700/60 transition-colors"
                title="Volver al panel principal de informes"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Mis Informes</span>
              </button>
            )}

            {/* Acciones de Edición (Si está en el Editor) */}
            {currentView === 'editor' && (
              <div className="flex items-center gap-1.5">
                {onSaveToSupabase && (
                  <button
                    onClick={onSaveToSupabase}
                    disabled={isSaving}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 ${
                      hasUnsavedChanges 
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white ring-2 ring-amber-400 animate-pulse'
                        : 'bg-emerald-800/90 hover:bg-emerald-700 border border-emerald-600/60 text-white'
                    }`}
                    title="Guardar informe, obligaciones y fotos en Supabase"
                  >
                    <Save size={14} className={hasUnsavedChanges ? 'text-amber-300' : 'text-white'} />
                    <span className="hidden sm:inline">
                      {isSaving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar Cambios' : 'Guardar'}
                    </span>
                  </button>
                )}

                {onPrint && (
                  <button
                    onClick={onPrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 transition-all shadow-xs"
                  >
                    <Printer size={14} />
                    <span className="hidden sm:inline">Imprimir / Descargar PDF</span>
                  </button>
                )}
              </div>
            )}

            {/* Campana de Notificaciones Institucionales */}
            <NotificationBell 
              currentUser={currentUser} 
              onOpenReport={onOpenReport} 
            />

            {/* Selector / Menú de Usuario */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-700/60 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  {currentUser.nombreCompleto.charAt(0)}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">
                    {currentUser.nombreCompleto}
                  </p>
                  <p className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">
                    {currentUser.role === 'contratista' ? 'Contratista' : currentUser.role === 'secretaria_admin' ? 'Admin Secretaría' : 'Super Admin'}
                  </p>
                </div>
                <ChevronDown size={14} className="text-emerald-400" />
              </button>

              {/* Menú Desplegable de Usuario */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white text-gray-900 rounded-xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  
                  {/* Encabezado del Perfil */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#006b33] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                        {currentUser.nombreCompleto.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-gray-900 leading-tight truncate">{currentUser.nombreCompleto}</p>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">C.C. {currentUser.documentoIdentidad}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md truncate max-w-[170px]">
                        {currentUser.secretariaNombre || 'Alcaldía de Quibdó'}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {currentUser.role === 'contratista' ? 'Contratista' : currentUser.role === 'secretaria_admin' ? 'Supervisor' : 'Super Admin'}
                      </span>
                    </div>
                  </div>

                  {/* Información de Cuenta */}
                  <div className="px-4 py-2.5 border-b border-gray-100 text-xs text-slate-600 space-y-1 bg-slate-50/40">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Correo:</span>
                      <span className="font-mono text-slate-700 truncate max-w-[160px]">{currentUser.email}</span>
                    </div>
                    {currentUser.contratoNro && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Contrato Activo:</span>
                        <span className="font-semibold text-emerald-800">#{currentUser.contratoNro.replace(/\D/g, '')} de 2026</span>
                      </div>
                    )}
                  </div>

                  {/* Botón Cerrar Sesión */}
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={15} />
                      <span>Cerrar Sesión Segura</span>
                    </button>
                  </div>

                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Modal de Conexión a Supabase */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200">
            <div className="flex items-start justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-emerald-800">
                <Database size={22} />
                <h3 className="text-lg font-bold">Conexión a Supabase Activa</h3>
              </div>
              <button 
                onClick={() => setShowDbModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-900 text-xs">Instancia Vinculada</p>
                  <p className="text-xs text-emerald-700 break-all font-mono">{SUPABASE_CONFIG.url}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-xs text-gray-600 uppercase tracking-wider mb-1.5">Tablas de la Arquitectura Multi-Tenant:</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">● sec_secretarias</div>
                  <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">● profiles</div>
                  <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">● contratos</div>
                  <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">● informes_mensuales</div>
                  <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">● informe_obligaciones</div>
                  <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">● informe_anexos</div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 leading-relaxed">
                El sistema lee y escribe automáticamente en tus tablas de PostgreSQL con políticas RLS de tres niveles. Los datos se mantienen respaldados tanto en la nube como en tu almacenamiento local del navegador.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowDbModal(false)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
