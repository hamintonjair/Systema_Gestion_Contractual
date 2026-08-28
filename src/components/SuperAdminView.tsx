import React, { useState, useEffect } from 'react';
import { Secretaria, AuthUser, InformeSummary } from '../types';
import { supabaseService } from '../services/supabaseService';
import { 
  ShieldCheck, 
  Building2, 
  Plus, 
  Check, 
  Users, 
  FileCheck, 
  TrendingUp, 
  Mail, 
  UserCheck, 
  Shield, 
  Phone, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Search, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Lock, 
  X, 
  RefreshCw, 
  LayoutDashboard,
  Filter
} from 'lucide-react';

interface Props {
  user: AuthUser;
}

export default function SuperAdminView({ user }: Props) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'secretarias' | 'usuarios'>('dashboard');
  
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);
  const [allReports, setAllReports] = useState<InformeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | 'secretaria_admin' | 'contratista'>('todos');
  const [secFilter, setSecFilter] = useState<'todas' | string>('todas');

  // Modals & Alerts
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSec, setEditingSec] = useState<Secretaria | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AuthUser | null>(null);

  const [alertNotice, setAlertNotice] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; sec: Secretaria | null; message?: string; blocked?: boolean }>({ open: false, sec: null });

  // Form Fields - Crear Nueva Secretaría
  const [newNombre, setNewNombre] = useState('');
  const [newCodigo, setNewCodigo] = useState('');
  const [newNit, setNewNit] = useState('891680011-0');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminCedula, setAdminCedula] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('Admin2026*');
  const [adminCargo, setAdminCargo] = useState('Secretaria de Despacho / Supervisora');
  const [adminTelefono, setAdminTelefono] = useState('3100000000');

  // Form Fields - Editar Secretaría
  const [editNombre, setEditNombre] = useState('');
  const [editCodigo, setEditCodigo] = useState('');
  const [editNit, setEditNit] = useState('891680011-0');
  const [editAdminNombre, setEditAdminNombre] = useState('');
  const [editAdminCedula, setEditAdminCedula] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editAdminCargo, setEditAdminCargo] = useState('Secretaria de Despacho / Supervisora');
  const [editAdminTelefono, setEditAdminTelefono] = useState('3100000000');

  const loadData = async () => {
    setLoading(true);
    try {
      const [secs, users, reports] = await Promise.all([
        supabaseService.getSecretarias(),
        supabaseService.getAllUsers(),
        supabaseService.getInformes()
      ]);
      setSecretarias(secs || []);
      setAllUsers(users || []);
      setAllReports(reports || []);
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error' | 'warning', text: string) => {
    setAlertNotice({ type, text });
    setTimeout(() => {
      setAlertNotice(null);
    }, 4500);
  };

  // Crear Secretaría + Admin
  const handleCreateSecretaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre || !newCodigo || !adminNombre || !adminCedula || !adminEmail || !adminPassword) {
      showNotification('warning', 'Por favor complete todos los campos obligatorios del formulario.');
      return;
    }

    const result = await supabaseService.createSecretariaWithAdmin(
      {
        nombre: newNombre,
        codigo: newCodigo,
        nit: newNit,
      },
      {
        nombreCompleto: adminNombre,
        documentoIdentidad: adminCedula,
        email: adminEmail,
        password: adminPassword,
        cargo: adminCargo,
        telefono: adminTelefono,
      }
    );

    if (result.success) {
      await loadData();
      setShowAddModal(false);
      showNotification('success', `Secretaría "${newNombre}" y su administrador creados exitosamente.`);
      
      // Reset form
      setNewNombre('');
      setNewCodigo('');
      setAdminNombre('');
      setAdminCedula('');
      setAdminEmail('');
      setAdminPassword('Admin2026*');
      setAdminCargo('Secretaria de Despacho / Supervisora');
      setAdminTelefono('3100000000');
    } else {
      showNotification('error', 'Error al crear la secretaría. Intente nuevamente.');
    }
  };

  // Abrir modal de edición
  const handleOpenEditModal = (sec: Secretaria) => {
    const admin = getAdminForSecretaria(sec);
    setEditingSec(sec);
    setEditingAdmin(admin || null);

    setEditNombre(sec.nombre);
    setEditCodigo(sec.codigo);
    setEditNit(sec.nit || '891680011-0');

    if (admin) {
      setEditAdminNombre(admin.nombreCompleto);
      setEditAdminCedula(admin.documentoIdentidad);
      setEditAdminEmail(admin.email);
      setEditAdminCargo(admin.cargo || 'Secretaria de Despacho / Supervisora');
      setEditAdminTelefono(admin.telefono || '3100000000');
      setEditAdminPassword('');
    } else {
      setEditAdminNombre('');
      setEditAdminCedula('');
      setEditAdminEmail('');
      setEditAdminCargo('Secretaria de Despacho / Supervisora');
      setEditAdminTelefono('3100000000');
      setEditAdminPassword('');
    }

    setShowEditModal(true);
  };

  // Guardar Edición
  const handleSaveEditSecretaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSec) return;

    if (!editNombre || !editCodigo || !editAdminNombre || !editAdminCedula || !editAdminEmail) {
      showNotification('warning', 'Complete los campos obligatorios para guardar la edición.');
      return;
    }

    const res = await supabaseService.updateSecretariaWithAdmin(
      editingSec.id,
      { nombre: editNombre, codigo: editCodigo, nit: editNit },
      {
        id: editingAdmin?.id,
        nombreCompleto: editAdminNombre,
        documentoIdentidad: editAdminCedula,
        email: editAdminEmail,
        password: editAdminPassword || undefined,
        cargo: editAdminCargo,
        telefono: editAdminTelefono,
      }
    );

    if (res.success) {
      await loadData();
      setShowEditModal(false);
      showNotification('success', `La secretaría "${editNombre}" fue actualizada correctamente.`);
    } else {
      showNotification('error', res.message || 'No se pudo actualizar la secretaría.');
    }
  };

  // Solicitar eliminación de Secretaría
  const handleRequestDelete = (sec: Secretaria) => {
    const contractorsCount = getContractorsCount(sec);
    const reportsCount = getReportsCount(sec);

    if (contractorsCount > 0 || reportsCount > 0) {
      setDeleteModal({
        open: true,
        sec,
        blocked: true,
        message: `No es posible eliminar la dependencia "${sec.nombre}". Tiene ${contractorsCount} contratista(s) vinculado(s) y ${reportsCount} informe(s) registrado(s). Para eliminar una secretaría, primero debe reasignar o eliminar sus contratistas e informes.`
      });
    } else {
      setDeleteModal({
        open: true,
        sec,
        blocked: false,
        message: `¿Está seguro de eliminar permanentemente la secretaría "${sec.nombre}" (Código: ${sec.codigo}) y su cuenta administrativa? Esta acción no se puede deshacer.`
      });
    }
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!deleteModal.sec || deleteModal.blocked) return;

    const res = await supabaseService.deleteSecretaria(
      deleteModal.sec.id,
      deleteModal.sec.codigo,
      deleteModal.sec.nombre
    );

    setDeleteModal({ open: false, sec: null });

    if (res.success) {
      await loadData();
      showNotification('success', res.message || 'Dependencia eliminada con éxito.');
    } else {
      showNotification('error', res.message || 'Error al eliminar la dependencia.');
    }
  };

  // Helpers de Búsqueda
  const getAdminForSecretaria = (sec: Secretaria) => {
    return allUsers.find(
      u => u.role === 'secretaria_admin' && (u.secretariaId === sec.id || u.secretariaCodigo === sec.codigo || u.secretariaNombre?.toLowerCase() === sec.nombre.toLowerCase())
    );
  };

  const getContractorsCount = (sec: Secretaria) => {
    return allUsers.filter(
      u => u.role === 'contratista' && (u.secretariaId === sec.id || u.secretariaCodigo === sec.codigo || u.secretariaNombre?.toLowerCase() === sec.nombre.toLowerCase())
    ).length;
  };

  const getReportsCount = (sec: Secretaria) => {
    return allReports.filter(
      r => r.secretariaId === sec.id || r.secretariaNombre?.toLowerCase() === sec.nombre.toLowerCase()
    ).length;
  };

  const getReportsForSecretaria = (sec: Secretaria) => {
    const reports = allReports.filter(
      r => r.secretariaId === sec.id || r.secretariaNombre?.toLowerCase() === sec.nombre.toLowerCase()
    );

    const aprobados = reports.filter(r => r.estado === 'Aprobado').length;
    const devueltos = reports.filter(r => r.estado === 'Devuelto').length;
    const pendientes = reports.filter(r => r.estado === 'Enviado').length;
    const total = reports.length;
    const cumplimientoPercent = total > 0 ? Math.round((aprobados / total) * 100) : 0;

    return { total, aprobados, devueltos, pendientes, cumplimientoPercent };
  };

  // Totales Globales
  const totalSecretarias = secretarias.length;
  const totalAdmins = allUsers.filter(u => u.role === 'secretaria_admin').length;
  const totalContratistas = allUsers.filter(u => u.role === 'contratista').length;

  const totalRadicados = allReports.length;
  const totalAprobados = allReports.filter(r => r.estado === 'Aprobado').length;
  const totalDevueltos = allReports.filter(r => r.estado === 'Devuelto').length;
  const totalPendientes = allReports.filter(r => r.estado === 'Enviado').length;

  const tasaCumplimientoGlobal = totalRadicados > 0 ? Math.round((totalAprobados / totalRadicados) * 100) : 0;

  // Filtrado de Secretarías para Pestaña de Secretarías
  const filteredSecretarias = secretarias.filter(sec => {
    const matchesSearch = 
      sec.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.codigo.includes(searchTerm) ||
      (sec.nit && sec.nit.includes(searchTerm));
    return matchesSearch;
  });

  // Filtrado de Usuarios para Pestaña Usuarios
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = 
      u.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.documentoIdentidad.includes(searchTerm) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.secretariaNombre && u.secretariaNombre.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'todos' || u.role === roleFilter;
    const matchesSec = secFilter === 'todas' || u.secretariaId === secFilter || u.secretariaCodigo === secFilter;

    return matchesSearch && matchesRole && matchesSec;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Banner Principal del Super Administrador Municipal */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck size={16} />
            <span>Alcaldía Municipal de Quibdó • Super Administrador</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Panel Maestro de Control e Indicadores Municipales
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Supervisa en tiempo real la gestión institucional, métricas de cumplimiento de informes, directorio de dependencias y administración multi-tenant.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Recargar datos"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all shrink-0"
          >
            <Plus size={16} />
            <span>+ Nueva Secretaría y Admin</span>
          </button>
        </div>
      </div>

      {/* Alerta / Notificación Global */}
      {alertNotice && (
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-xs transition-all ${
          alertNotice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
          alertNotice.type === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-900' :
          'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {alertNotice.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
            {alertNotice.type === 'warning' && <AlertTriangle size={18} className="text-amber-600" />}
            {alertNotice.type === 'error' && <AlertTriangle size={18} className="text-rose-600" />}
            <span>{alertNotice.text}</span>
          </div>
          <button onClick={() => setAlertNotice(null)} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* NAVEGACIÓN POR PESTAÑAS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <LayoutDashboard size={18} />
          <span>📊 Módulo Dashboard y Métricas</span>
        </button>

        <button
          onClick={() => setActiveTab('secretarias')}
          className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'secretarias'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Building2 size={18} />
          <span>🏛️ Gestión de Secretarías ({totalSecretarias})</span>
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'usuarios'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users size={18} />
          <span>👥 Directorio General de Usuarios ({allUsers.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: MÓDULO DASHBOARD Y MÉTRICAS */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Tarjetas de Indicadores KPI Principales */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Secretarías Habilitadas</span>
                <Building2 size={20} className="text-emerald-700" />
              </div>
              <p className="text-3xl font-black text-gray-900">{totalSecretarias}</p>
              <p className="text-xs text-emerald-700 font-semibold mt-1">Dependencias activas en Quibdó</p>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Contratistas Totales</span>
                <Users size={20} className="text-amber-600" />
              </div>
              <p className="text-3xl font-black text-gray-900">{totalContratistas}</p>
              <p className="text-xs text-amber-700 font-semibold mt-1">Vinculados a secretarías</p>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Informes Radicados</span>
                <FileCheck size={20} className="text-blue-600" />
              </div>
              <p className="text-3xl font-black text-gray-900">{totalRadicados}</p>
              <p className="text-xs text-blue-700 font-semibold mt-1">En todas las dependencias</p>
            </div>

            <div className="bg-emerald-950 text-white p-4.5 rounded-xl border border-emerald-800 shadow-xs">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Tasa de Cumplimiento</span>
                <TrendingUp size={20} className="text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-white">{tasaCumplimientoGlobal}%</p>
                <span className="text-xs text-emerald-300 font-bold font-mono">({totalAprobados} Aprobados)</span>
              </div>
              <p className="text-xs text-emerald-200 mt-1">Informes con certificación favorable</p>
            </div>

          </div>

          {/* Estado de Informes Municipal */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <BarChart3 size={18} className="text-emerald-700" />
                  Estado Consolidado de Informes Municipales (Vigencia Fiscal 2026)
                </h3>
                <p className="text-xs text-gray-500">Desglose operacional de supervisión y gestión financiera</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-mono font-bold text-xs rounded-full">
                {totalRadicados} Informes Totales
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900 uppercase">Informes Aprobados</span>
                  <p className="text-2xl font-black text-emerald-800 mt-1">{totalAprobados}</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Certificados para pago</p>
                </div>
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>

              <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 uppercase">Devueltos (Con Obs.)</span>
                  <p className="text-2xl font-black text-amber-800 mt-1">{totalDevueltos}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">En subsanación por contratista</p>
                </div>
                <AlertTriangle size={32} className="text-amber-600" />
              </div>

              <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-900 uppercase">Pendientes de Revisión</span>
                  <p className="text-2xl font-black text-blue-800 mt-1">{totalPendientes}</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">Por verificar por supervisora</p>
                </div>
                <Clock size={32} className="text-blue-600" />
              </div>
            </div>
          </div>

          {/* Gráfico / Tarjetas de Desempeño por Secretaría */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Building2 size={18} className="text-emerald-800" />
              Indicadores de Gestión y Cumplimiento por Secretaría
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {secretarias.map((sec) => {
                const admin = getAdminForSecretaria(sec);
                const contractorsCount = getContractorsCount(sec);
                const stats = getReportsForSecretaria(sec);

                const getStatusColor = (percent: number) => {
                  if (percent >= 75) return 'bg-emerald-500 text-emerald-900 border-emerald-200';
                  if (percent >= 40) return 'bg-amber-500 text-amber-900 border-amber-200';
                  return 'bg-blue-500 text-blue-900 border-blue-200';
                };

                return (
                  <div key={sec.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4 flex flex-col justify-between hover:border-emerald-500 transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-mono font-bold text-xs border border-emerald-200">
                          {sec.codigo}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 font-mono">
                          NIT {sec.nit}
                        </span>
                      </div>

                      <h4 className="font-bold text-gray-900 text-sm mt-2 leading-snug">
                        {sec.nombre}
                      </h4>

                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <UserCheck size={13} className="text-emerald-700" />
                        Admin: <span className="font-semibold text-gray-800">{admin ? admin.nombreCompleto : 'Sin asignar'}</span>
                      </p>

                      {/* Barra de Progreso de Cumplimiento */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-700">Tasa de Aprobación</span>
                          <span className="font-black font-mono text-emerald-800">{stats.cumplimientoPercent}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${getStatusColor(stats.cumplimientoPercent).split(' ')[0]}`}
                            style={{ width: `${stats.cumplimientoPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Cuadrícula de Métricas de la Secretaría */}
                      <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                          <span className="text-[10px] text-gray-500 font-bold uppercase block">Contrat.</span>
                          <span className="text-sm font-black text-gray-900 font-mono">{contractorsCount}</span>
                        </div>
                        <div className="p-2 bg-emerald-50/70 rounded-lg border border-emerald-100">
                          <span className="text-[10px] text-emerald-800 font-bold uppercase block">Aprob.</span>
                          <span className="text-sm font-black text-emerald-800 font-mono">{stats.aprobados}</span>
                        </div>
                        <div className="p-2 bg-amber-50/70 rounded-lg border border-amber-100">
                          <span className="text-[10px] text-amber-800 font-bold uppercase block">Devuel.</span>
                          <span className="text-sm font-black text-amber-800 font-mono">{stats.devueltos}</span>
                        </div>
                        <div className="p-2 bg-blue-50/70 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-blue-800 font-bold uppercase block">Pend.</span>
                          <span className="text-sm font-black text-blue-800 font-mono">{stats.pendientes}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSecFilter(sec.id);
                        setActiveTab('secretarias');
                      }}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Building2 size={13} />
                      <span>Gestionar Secretaría</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla Resumen de Gestión Municipal */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h4 className="font-bold text-gray-900 text-sm">Resumen Consolidado de Desempeño por Dependencia</h4>
              <span className="text-xs font-mono font-bold text-gray-500">Vigencia 2026</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Secretaría / Dependencia</th>
                    <th className="px-4 py-3">Administrador Asignado</th>
                    <th className="px-4 py-3 text-center">Contratistas</th>
                    <th className="px-4 py-3 text-center">Radicados</th>
                    <th className="px-4 py-3 text-center text-emerald-800">Aprobados</th>
                    <th className="px-4 py-3 text-center text-amber-800">Devueltos</th>
                    <th className="px-4 py-3 text-center text-blue-800">Pendientes</th>
                    <th className="px-4 py-3 text-right">% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {secretarias.map((sec) => {
                    const admin = getAdminForSecretaria(sec);
                    const contractorsCount = getContractorsCount(sec);
                    const stats = getReportsForSecretaria(sec);

                    return (
                      <tr key={sec.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-800">{sec.codigo}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">{sec.nombre}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {admin ? (
                            <div>
                              <p className="font-semibold text-gray-900">{admin.nombreCompleto}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{admin.email}</p>
                            </div>
                          ) : (
                            <span className="text-amber-700 italic">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold font-mono">{contractorsCount}</td>
                        <td className="px-4 py-3 text-center font-bold font-mono">{stats.total}</td>
                        <td className="px-4 py-3 text-center font-bold font-mono text-emerald-700">{stats.aprobados}</td>
                        <td className="px-4 py-3 text-center font-bold font-mono text-amber-700">{stats.devueltos}</td>
                        <td className="px-4 py-3 text-center font-bold font-mono text-blue-700">{stats.pendientes}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2.5 py-1 rounded-full font-bold font-mono text-[11px] ${
                            stats.cumplimientoPercent >= 75 ? 'bg-emerald-100 text-emerald-800' :
                            stats.cumplimientoPercent >= 40 ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {stats.cumplimientoPercent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: GESTIÓN DE SECRETARÍAS Y ADMINISTRADORES */}
      {/* ========================================================================= */}
      {activeTab === 'secretarias' && (
        <div className="space-y-6">

          {/* Barra de Búsqueda y Filtros */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre de secretaría, código o NIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 font-mono">
                Mostrando {filteredSecretarias.length} de {totalSecretarias} secretarías
              </span>

              <button
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Plus size={15} />
                <span>+ Nueva Secretaría</span>
              </button>
            </div>
          </div>

          {/* Grid de Secretarías */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSecretarias.map((sec) => {
              const admin = getAdminForSecretaria(sec);
              const contractorsCount = getContractorsCount(sec);
              const reportsCount = getReportsCount(sec);
              const hasLinkedRecords = contractorsCount > 0 || reportsCount > 0;

              return (
                <div 
                  key={sec.id} 
                  className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 hover:border-emerald-500 transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 font-mono font-bold text-xs">
                        {sec.codigo}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 font-mono">
                          NIT {sec.nit}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 mt-3 leading-snug">
                      {sec.nombre}
                    </h4>

                    {/* Administrador Oficial Asignado */}
                    <div className="mt-4 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                          <UserCheck size={12} className="text-emerald-700" /> Administrador(a) Oficial
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      </div>

                      {admin ? (
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-gray-900">{admin.nombreCompleto}</p>
                          <p className="text-[11px] text-gray-600 font-mono">C.C. {admin.documentoIdentidad} • {admin.cargo || 'Supervisor(a)'}</p>
                          <p className="text-[11px] text-emerald-800 font-mono pt-1 border-t border-emerald-200/60">
                            📧 {admin.email}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 italic">
                          Sin administrador asignado
                        </p>
                      )}
                    </div>

                    {/* Resumen de Registros Vinculados */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-gray-50 rounded-lg border border-gray-200/80 text-center">
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Contratistas</span>
                        <span className="font-bold text-gray-900 font-mono">{contractorsCount}</span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg border border-gray-200/80 text-center">
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Informes</span>
                        <span className="font-bold text-gray-900 font-mono">{reportsCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Edición y Eliminación */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEditModal(sec)}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      title="Editar secretaría y datos de su administrador"
                    >
                      <Edit size={14} />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleRequestDelete(sec)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        hasLinkedRecords 
                          ? 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 cursor-pointer' 
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                      }`}
                      title={hasLinkedRecords ? `No eliminable: tiene ${contractorsCount} contratistas y ${reportsCount} informes registrados` : 'Eliminar dependencia'}
                    >
                      {hasLinkedRecords ? <Lock size={14} className="text-amber-600" /> : <Trash2 size={14} />}
                      <span>{hasLinkedRecords ? 'Protegida' : 'Eliminar'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: DIRECTORIO GENERAL DE USUARIOS */}
      {/* ========================================================================= */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">

          {/* Filtros de búsqueda para usuarios */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, cédula o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Filtro por Rol */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter size={14} className="text-gray-400" />
                <span className="font-semibold text-gray-600">Rol:</span>
                <select
                  value={roleFilter}
                  onChange={(e: any) => setRoleFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="todos">Todos los Roles</option>
                  <option value="secretaria_admin">Administradores de Secretaría</option>
                  <option value="contratista">Contratistas</option>
                </select>
              </div>

              {/* Filtro por Secretaría */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-gray-600">Secretaría:</span>
                <select
                  value={secFilter}
                  onChange={(e) => setSecFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white max-w-[200px]"
                >
                  <option value="todas">Todas las Secretarías</option>
                  {secretarias.map(s => (
                    <option key={s.id} value={s.id}>{s.codigo} - {s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Tabla General de Usuarios */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Directorio Institucional de Usuarios Registrados</h3>
                <p className="text-xs text-gray-500">Administradores de despacho y contratistas vinculados en el sistema</p>
              </div>
              <span className="text-xs font-bold font-mono bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                Total: {filteredUsers.length} usuarios
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Nombre Completo</th>
                    <th className="px-4 py-3">Cédula</th>
                    <th className="px-4 py-3">Correo Institucional</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Secretaría / Dependencia</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No se encontraron usuarios coincidentes con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900">{u.nombreCompleto}</td>
                        <td className="px-4 py-3 font-mono text-gray-800 font-semibold">{u.documentoIdentidad}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'super_admin' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                            u.role === 'secretaria_admin' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                            'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}>
                            {u.role === 'super_admin' ? 'Super Admin' : u.role === 'secretaria_admin' ? 'Admin Secretaría' : 'Contratista'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {u.secretariaNombre || 'Alcaldía Municipal'}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600">{u.telefono || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR NUEVA SECRETARÍA + ADMIN */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-emerald-800">
                <Building2 size={22} />
                <div>
                  <h3 className="text-lg font-bold">Registrar Nueva Secretaría y Asignar Administrador</h3>
                  <p className="text-xs text-gray-500">Crea la dependencia municipal y el usuario de supervisión oficial</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSecretaria} className="mt-4 space-y-4 text-xs">
              
              {/* Sección 1: Datos de la Secretaría */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-gray-900 uppercase tracking-wide">
                  <Building2 size={16} className="text-emerald-700" />
                  <span>1. Datos de la Secretaría / Dependencia</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Oficial de la Secretaría *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Secretaría de Educación Municipal"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Código Dependencia *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. 140"
                      value={newCodigo}
                      onChange={(e) => setNewCodigo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-gray-700 mb-1">NIT Institucional</label>
                    <input
                      type="text"
                      value={newNit}
                      onChange={(e) => setNewNit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Administrador Oficial de la Secretaría */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-950 uppercase tracking-wide">
                  <Shield size={16} className="text-emerald-700" />
                  <span>2. Administrador(a) de Despacho / Supervisor(a) Asignado(a)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Completo del Administrador(a) *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. MARÍA YANETH PALACIOS PALACIOS"
                      value={adminNombre}
                      onChange={(e) => setAdminNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cédula de Ciudadanía *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. 45.123.789"
                      value={adminCedula}
                      onChange={(e) => setAdminCedula(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Correo Electrónico (Usuario de Acceso) *</label>
                    <input
                      type="email"
                      required
                      placeholder="ej. educacion@quibdo-choco.gov.co"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Contraseña Inicial de Acceso *</label>
                    <input
                      type="text"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cargo / Función</label>
                    <input
                      type="text"
                      value={adminCargo}
                      onChange={(e) => setAdminCargo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Teléfono Institucional</label>
                    <input
                      type="text"
                      value={adminTelefono}
                      onChange={(e) => setAdminTelefono(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Crear Secretaría y Habilitar Acceso</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDITAR SECRETARÍA + ADMIN */}
      {/* ========================================================================= */}
      {showEditModal && editingSec && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-emerald-800">
                <Edit size={22} />
                <div>
                  <h3 className="text-lg font-bold">Editar Secretaría y Administrador</h3>
                  <p className="text-xs text-gray-500">Actualiza los datos de la dependencia y del responsable asignado</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditSecretaria} className="mt-4 space-y-4 text-xs">
              
              {/* Sección 1: Datos de la Secretaría */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-gray-900 uppercase tracking-wide">
                  <Building2 size={16} className="text-emerald-700" />
                  <span>1. Datos de la Secretaría / Dependencia</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Oficial de la Secretaría *</label>
                    <input
                      type="text"
                      required
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Código Dependencia *</label>
                    <input
                      type="text"
                      required
                      value={editCodigo}
                      onChange={(e) => setEditCodigo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-gray-700 mb-1">NIT Institucional</label>
                    <input
                      type="text"
                      value={editNit}
                      onChange={(e) => setEditNit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Administrador Oficial */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-950 uppercase tracking-wide">
                  <Shield size={16} className="text-emerald-700" />
                  <span>2. Administrador(a) de Despacho / Supervisor(a)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Completo del Administrador(a) *</label>
                    <input
                      type="text"
                      required
                      value={editAdminNombre}
                      onChange={(e) => setEditAdminNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cédula de Ciudadanía *</label>
                    <input
                      type="text"
                      required
                      value={editAdminCedula}
                      onChange={(e) => setEditAdminCedula(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Correo Electrónico (Usuario Acceso) *</label>
                    <input
                      type="email"
                      required
                      value={editAdminEmail}
                      onChange={(e) => setEditAdminEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cambiar Contraseña (Opcional)</label>
                    <input
                      type="password"
                      placeholder="Dejar en blanco si no cambia"
                      value={editAdminPassword}
                      onChange={(e) => setEditAdminPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cargo / Función</label>
                    <input
                      type="text"
                      value={editAdminCargo}
                      onChange={(e) => setEditAdminCargo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Teléfono Institucional</label>
                    <input
                      type="text"
                      value={editAdminTelefono}
                      onChange={(e) => setEditAdminTelefono(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Guardar Cambios</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ELIMINACIÓN Y ADVERTENCIA DE SEGURIDAD */}
      {/* ========================================================================= */}
      {deleteModal.open && deleteModal.sec && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              {deleteModal.blocked ? (
                <div className="p-2.5 bg-amber-100 rounded-full text-amber-800">
                  <Lock size={24} />
                </div>
              ) : (
                <div className="p-2.5 bg-rose-100 rounded-full text-rose-700">
                  <AlertTriangle size={24} />
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {deleteModal.blocked ? 'Eliminación Bloqueada' : 'Confirmar Eliminación'}
                </h3>
                <p className="text-xs text-gray-500">Dependencia: {deleteModal.sec.nombre}</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed my-3 p-3 bg-gray-50 rounded-xl border border-gray-200 font-medium">
              {deleteModal.message}
            </p>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
              {deleteModal.blocked ? (
                <button
                  type="button"
                  onClick={() => setDeleteModal({ open: false, sec: null })}
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg font-bold text-xs"
                >
                  Entendido
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: false, sec: null })}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Eliminar Definitivamente</span>
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
