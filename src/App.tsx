import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import LoginView from './components/LoginView';
import ContratistaDashboard from './components/ContratistaDashboard';
import ReportEditor from './components/ReportEditor';
import ReportPreview from './components/ReportPreview';
import SecretariaAdminView from './components/SecretariaAdminView';
import SuperAdminView from './components/SuperAdminView';
import { AuthUser, DEMO_USERS, ReportData, InformeSummary, initialMockData, createDefaultCertificadoData, createDefaultFiduciariaData, createDefaultAutorizacionDesembolsoData } from './types';
import { supabaseService } from './services/supabaseService';
import { exportInformeToPDF } from './utils/pdfGenerator';
import { formatFechaAplicacion, formatDateSlash } from './utils/formatters';
import { validateReportForRadicacion, RadicacionValidationError } from './utils/validationUtils';
import ValidationAlertModal from './components/ValidationAlertModal';
import { CheckCircle2, AlertCircle, AlertTriangle, Save, LogOut, ArrowLeft, X } from 'lucide-react';

export default function App() {
  // Estado del usuario autenticado
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('alcaldia_quibdo_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Vista activa según el rol
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor' | 'admin' | 'superadmin'>('dashboard');

  // Informe activo para edición o impresión
  const [activeReportData, setActiveReportData] = useState<ReportData>(initialMockData);
  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    errors: RadicacionValidationError[];
    reportNro?: string;
  } | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedExitModal, setShowUnsavedExitModal] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Advertir al usuario si intenta cerrar o recargar la pestaña del navegador con cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && currentView === 'editor') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, currentView]);

  // Al cambiar de usuario, redirigir a su vista correspondiente
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'contratista') {
        setCurrentView('dashboard');
      } else if (currentUser.role === 'secretaria_admin') {
        setCurrentView('admin');
      } else if (currentUser.role === 'super_admin') {
        setCurrentView('superadmin');
      }
      setHasUnsavedChanges(false);
    }
  }, [currentUser?.role]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('alcaldia_quibdo_user', JSON.stringify(user));
    setHasUnsavedChanges(false);
    showToast(`Bienvenido(a), ${user.nombreCompleto}`);
  };

  // Interceptar navegación para proteger cambios sin guardar
  const requestNavigation = (action: () => void) => {
    if (currentView === 'editor' && hasUnsavedChanges) {
      setPendingNavigationAction(() => action);
      setShowUnsavedExitModal(true);
    } else {
      action();
    }
  };

  const handleLogout = () => {
    requestNavigation(() => {
      setCurrentUser(null);
      localStorage.removeItem('alcaldia_quibdo_user');
      setHasUnsavedChanges(false);
    });
  };

  const handleSwitchUser = (user: AuthUser) => {
    requestNavigation(() => {
      setCurrentUser(user);
      localStorage.setItem('alcaldia_quibdo_user', JSON.stringify(user));
      setHasUnsavedChanges(false);
      showToast(`Sesión cambiada a: ${user.nombreCompleto} (${user.role})`);
    });
  };

  const handleUserUpdated = (updatedUser: AuthUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('alcaldia_quibdo_user', JSON.stringify(updatedUser));
    showToast('¡Perfil de usuario actualizado exitosamente!');
  };

  const handleViewChange = (newView: 'dashboard' | 'editor' | 'admin' | 'superadmin') => {
    requestNavigation(() => {
      setCurrentView(newView);
      setHasUnsavedChanges(false);
    });
  };

  const handleReportDataChange = (newData: ReportData) => {
    setActiveReportData(newData);
    setHasUnsavedChanges(true);
  };

  const handleOpenReportEditor = (report: ReportData) => {
    let reportToLoad: ReportData = { ...report };

    if (reportToLoad.estado === 'Borrador') {
      reportToLoad.comentariosCampos = {};
    } else if (reportToLoad.comentariosCampos && Object.keys(reportToLoad.comentariosCampos).length > 0 && reportToLoad.estado !== 'Aprobado') {
      reportToLoad.estado = 'Devuelto';
    }

    setActiveReportData(reportToLoad);
    if (reportToLoad.estado === 'Borrador' && !reportToLoad.syncedToDb) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
    setCurrentView('editor');
  };

  const handleDirectPrint = (report: ReportData) => {
    // 1. Cargar el informe completo con todos sus datos, anexos y estado en el visor/editor
    handleOpenReportEditor(report);
    
    // 2. Ejecutar la función oficial de descarga PDF con el formato exacto
    setTimeout(() => {
      handleDownloadPDF(report);
    }, 600);
  };

  const handlePrint = () => {
    try {
      const oldTitle = document.title;
      if (currentView === 'editor') {
        document.title = "Formato Informe De Cumplimiento";
      }
      setTimeout(() => {
        window.print();
        if (currentView === 'editor') {
          document.title = oldTitle;
        }
      }, 50);
    } catch (e) {
      console.warn('Error al invocar window.print():', e);
    } finally {
      setTimeout(() => {
        window.focus();
        document.body?.focus();
        window.dispatchEvent(new Event('resize'));
      }, 350);
    }
  };

  const handleDownloadPDF = async (reportOverride?: ReportData) => {
    const reportToExport = reportOverride || activeReportData;
    setIsGeneratingPDF(true);
    showToast('Generando archivo PDF oficial...');
    try {
      await exportInformeToPDF({
        informeNro: reportToExport.informeNro,
        contratistaNombre: reportToExport.contratistaNombre,
        contratoNro: reportToExport.contratoNro
      });
      showToast('¡PDF descargado exitosamente!');
    } catch (e) {
      showToast('Abriendo ventana de impresión...');
      try {
        const oldTitle = document.title;
        if (currentView === 'editor') {
          document.title = "Formato Informe De Cumplimiento";
        }
        setTimeout(() => {
          window.print();
          if (currentView === 'editor') {
            document.title = oldTitle;
          }
        }, 50);
      } catch (err) {
        console.warn('Error en print fallback:', err);
      }
    } finally {
      setIsGeneratingPDF(false);
      setTimeout(() => {
        window.focus();
        document.body?.focus();
        window.dispatchEvent(new Event('resize'));
      }, 350);
    }
  };

  const handleSaveToSupabase = async () => {
    setIsSaving(true);
    // Si el informe estaba devuelto, al guardar se reenvía a revisión automáticamente
    const newStatus = activeReportData.estado === 'Devuelto' ? 'Enviado' : activeReportData.estado;
    const reportToSave: ReportData = {
      ...activeReportData,
      estado: newStatus
    };
    
    const result = await supabaseService.saveFullInforme(reportToSave, currentUser || undefined);
    setIsSaving(false);

    // Sincronizar Certificado de Supervisión, Soporte Fiduciaria y Autorización de Desembolso
    try {
      const resolvedId = result.id || reportToSave.id;
      const savedReportWithId: ReportData = {
        ...reportToSave,
        id: resolvedId
      };
      
      const liveCert = createDefaultCertificadoData(savedReportWithId);
      const liveFid = createDefaultFiduciariaData(savedReportWithId);
      const liveDesembolso = createDefaultAutorizacionDesembolsoData(savedReportWithId);

      const docKey = savedReportWithId.contratistaDocumento || '';
      const nroKey = savedReportWithId.informeNro || '1';

      localStorage.setItem(`cert_data_${docKey}_${nroKey}`, JSON.stringify(liveCert));
      localStorage.setItem(`cert_data_${nroKey}`, JSON.stringify(liveCert));

      localStorage.setItem(`fid_data_${docKey}_${nroKey}`, JSON.stringify(liveFid));
      localStorage.setItem(`fid_data_${nroKey}`, JSON.stringify(liveFid));

      localStorage.setItem(`desembolso_${docKey}_${nroKey}`, JSON.stringify(liveDesembolso));
      localStorage.setItem(`desembolso_${nroKey}`, JSON.stringify(liveDesembolso));

      if (resolvedId) {
        localStorage.setItem(`cert_data_${resolvedId}_${nroKey}`, JSON.stringify(liveCert));
        localStorage.setItem(`fid_data_${resolvedId}_${nroKey}`, JSON.stringify(liveFid));
        localStorage.setItem(`desembolso_${resolvedId}_${nroKey}`, JSON.stringify(liveDesembolso));
      }

      supabaseService.saveCertificadoSupervision(liveCert, resolvedId, undefined, savedReportWithId.contratoId).catch(() => {});
      supabaseService.saveSoporteFiduciaria(resolvedId || '', liveFid, docKey, String(nroKey), savedReportWithId.contratoId).catch(() => {});
      supabaseService.saveAutorizacionDesembolso(resolvedId || '', liveDesembolso, docKey, String(nroKey), savedReportWithId.contratoId).catch(() => {});

      window.dispatchEvent(new CustomEvent('certificado_updated_event', { detail: liveCert }));
      window.dispatchEvent(new CustomEvent('fiduciaria_updated_event', { detail: liveFid }));
      window.dispatchEvent(new CustomEvent('desembolso_updated_event', { detail: liveDesembolso }));
    } catch (e) {
      console.warn('Error sincronizando certificados en guardado:', e);
    }

    if (result.success) {
      setHasUnsavedChanges(false);
      setActiveReportData(prev => ({
        ...prev,
        id: result.id,
        estado: newStatus,
        anexos: prev.anexos.map(a => ({ ...a, file: undefined, isPendingUpload: false })),
        syncedToDb: true
      }));
      showToast(newStatus === 'Enviado' ? '¡Informe guardado y reenviado a la secretaría exitosamente!' : '¡Informe y fotografías guardados en Supabase exitosamente!');
      window.dispatchEvent(new CustomEvent('informe_radicado_event'));
    } else {
      setHasUnsavedChanges(false);
      setActiveReportData(prev => ({
        ...prev,
        syncedToDb: true
      }));
      showToast('Informe guardado en el almacenamiento local.');
    }
    return result;
  };

  const handleRadicarToSupabase = async () => {
    // Validar de forma estricta antes de radicar
    const validation = validateReportForRadicacion(activeReportData);
    if (!validation.isValid) {
      setValidationModal({
        isOpen: true,
        errors: validation.errors,
        reportNro: activeReportData.informeNro,
      });
      return { success: false, error: 'Validación de radicación no superada' };
    }

    setIsSaving(true);
    const updatedData: ReportData = {
      ...activeReportData,
      estado: 'Enviado'
    };
    setActiveReportData(updatedData);
    const result = await supabaseService.saveFullInforme(updatedData, currentUser || undefined);
    setIsSaving(false);
    if (result.success) {
      setHasUnsavedChanges(false);
      setActiveReportData(prev => ({
        ...prev,
        id: result.id,
        estado: 'Enviado',
        anexos: prev.anexos.map(a => ({ ...a, file: undefined, isPendingUpload: false })),
        syncedToDb: true
      }));
      showToast('🚀 ¡Informe Radicado y Reenviado a la Secretaría Exitosamente!');
      // Notificar en tiempo real al panel del administrador
      window.dispatchEvent(new CustomEvent('informe_radicado_event'));
    } else {
      showToast('Error al radicar el informe. Revisa tu conexión.');
    }
    return result;
  };

  // Acciones dentro del modal de confirmación de salida
  const handleConfirmSaveAndExit = async () => {
    const res = await handleSaveToSupabase();
    setShowUnsavedExitModal(false);
    if (pendingNavigationAction) {
      pendingNavigationAction();
      setPendingNavigationAction(null);
    }
  };

  const handleConfirmDiscardAndExit = () => {
    setHasUnsavedChanges(false);
    setShowUnsavedExitModal(false);
    if (pendingNavigationAction) {
      pendingNavigationAction();
      setPendingNavigationAction(null);
    }
  };

  const handleCancelExitModal = () => {
    setShowUnsavedExitModal(false);
    setPendingNavigationAction(null);
  };

  const handleSelectInformeToView = async (informe: InformeSummary) => {
    // 1. Intentar cargar directamente desde Supabase si tiene ID de base de datos
    if (informe.id) {
      const fullReport = await supabaseService.getReportById(informe.id);
      if (fullReport) {
        setActiveReportData(fullReport);
        setHasUnsavedChanges(false);
        setCurrentView('editor');
        showToast(`Cargando informe Nro. ${informe.informe_nro} de ${informe.contratista_nombre}`);
        return;
      }
    }

    // 2. Intentar buscar en almacenamiento local del contratista específico
    const userDocKey = informe.contratista_documento ? `_${informe.contratista_documento}` : '';
    const saved = localStorage.getItem(`informe_data${userDocKey}_${informe.informe_nro}`) ||
                  localStorage.getItem(`informe_data_${informe.informe_nro}`);
    if (saved) {
      try {
        setActiveReportData(JSON.parse(saved));
        setHasUnsavedChanges(false);
        setCurrentView('editor');
        showToast(`Cargando informe Nro. ${informe.informe_nro} de ${informe.contratista_nombre}`);
        return;
      } catch (e) {}
    }

    // 3. Si es un informe nuevo de base de datos sin cache local
    setActiveReportData({
      id: informe.id,
      contratoId: informe.contrato_id,
      secretariaId: currentUser?.secretariaId,
      secretariaNombre: informe.secretaria_nombre || currentUser?.secretariaNombre || 'Secretaría Municipal',
      secretariaCodigo: currentUser?.secretariaCodigo || '170',
      secretariaNit: '891680011-0',
      fechaAplicacion: formatFechaAplicacion(informe.periodo_hasta, informe.periodo_desde),
      tipoInforme: informe.tipo_informe || 'Mensual',
      informeNro: informe.informe_nro.toString(),
      fechaPresentacion: informe.fecha_presentacion || new Date().toLocaleDateString('es-CO'),
      periodoDesde: informe.periodo_desde || '',
      periodoHasta: informe.periodo_hasta || '',
      contratistaNombre: informe.contratista_nombre,
      contratistaDocumento: informe.contratista_documento,
      contratistaCorreo: '',
      contratistaTelefono: '',
      supervisorNombre: currentUser?.nombreCompleto || 'SUPERVISOR(A) MUNICIPAL',
      supervisorDocumento: currentUser?.documentoIdentidad || '',
      apoyoSupervisionNombre: 'N/A',
      apoyoSupervisionDocumento: 'N/A',
      valorContrato: '$ N/A',
      valorAdicion: '$ N/A',
      contratoNro: informe.contrato_nro,
      objeto: 'Prestación de servicios profesionales y de apoyo a la gestión',
      cdpNro: 'N/A',
      crpNro: 'N/A',
      polizaNro: 'N/A',
      fechaPoliza: 'N/A',
      plazo: 'N/A',
      fechaInicio: formatDateSlash(informe.periodo_desde) || '',
      fechaTerminacion: formatDateSlash(informe.periodo_hasta) || '',
      modificaciones: 'N/A',
      observaciones: 'Informe oficial radicado en el sistema de gestión municipal.',
      obligaciones: [],
      anexos: [],
      valorPagar: '$ N/A',
      estado: informe.estado,
      syncedToDb: true,
    });
    setHasUnsavedChanges(false);
    setCurrentView('editor');
  };

  const handlePrintFromAdmin = async (informe: InformeSummary) => {
    await handleSelectInformeToView(informe);
    setTimeout(() => {
      const oldTitle = document.title;
      document.title = "Formato Informe De Cumplimiento";
      setTimeout(() => {
        window.print();
        document.title = oldTitle;
      }, 50);
    }, 400);
  };

  // SI NO HAY USUARIO AUTENTICADO: MOSTRAR PANTALLA DE LOGIN
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100 print:bg-white print:h-auto print:overflow-visible font-sans text-gray-900">
      
      {/* Barra de Navegación Superior */}
      <Navbar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        onUserUpdated={handleUserUpdated}
        onPrint={handlePrint}
        onDownloadPDF={handleDownloadPDF}
        onSaveToSupabase={handleSaveToSupabase}
        isSaving={isSaving}
        isGeneratingPDF={isGeneratingPDF}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Notificación Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-bounce border border-emerald-500 print:hidden">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal de Advertencia de Cambios sin Guardar */}
      {showUnsavedExitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95 space-y-4">
            
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-950">
                  ¿Deseas guardar los cambios antes de salir?
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Has agregado o modificado obligaciones, fotografías o datos en este informe que <strong>aún no han sido guardados</strong> en la base de datos de Supabase.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-amber-700" />
              <span>Si sales sin guardar, las fotos subidas y los nuevos registros no quedarán vinculados al informe.</span>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelExitModal}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Seguir Editando
              </button>

              <button
                type="button"
                onClick={handleConfirmDiscardAndExit}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
              >
                Salir sin Guardar
              </button>

              <button
                type="button"
                onClick={handleConfirmSaveAndExit}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#006b33] hover:bg-[#005729] shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSaving ? 'Guardando...' : 'Guardar y Salir'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CUERPO PRINCIPAL SEGÚN EL ROL Y LA VISTA ACTIVA */}
      <div className="flex-1 overflow-hidden flex flex-col print:overflow-visible">
        
        {/* VISTA 1: DASHBOARD DEL CONTRATISTA (Gestión de todos sus informes) */}
        {currentView === 'dashboard' && currentUser.role === 'contratista' && (
          <div className="flex-1 overflow-y-auto bg-gray-50 print:hidden">
            <ContratistaDashboard
              user={currentUser}
              onOpenReportEditor={handleOpenReportEditor}
              onDirectPrint={handleDirectPrint}
              onUserUpdated={handleUserUpdated}
            />
          </div>
        )}

        {/* VISTA 2: EDITOR DINÁMICO Y PREVIEW A4 (Para diligenciar el informe activo) */}
        {currentView === 'editor' && (
          <div className="flex flex-1 h-full overflow-hidden print:h-auto print:overflow-visible">
            
            {/* Panel Izquierdo: Formulario de Redacción */}
            <div className="w-full lg:w-[420px] xl:w-[460px] h-full overflow-hidden border-r border-gray-300 bg-white print:hidden z-10 shadow-sm">
              <ReportEditor 
                data={activeReportData} 
                onChange={handleReportDataChange} 
                onPrint={handlePrint}
                onDownloadPDF={handleDownloadPDF}
                onSave={handleSaveToSupabase}
                onRadicar={handleRadicarToSupabase}
                isSaving={isSaving}
                isGeneratingPDF={isGeneratingPDF}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            </div>

            {/* Panel Derecho: Visualizador Hoja A4 con Reglas Estrictas de Impresión */}
            <div className={`${isGeneratingPDF ? 'flex absolute inset-0 z-0 opacity-0 lg:static lg:opacity-100 lg:z-auto' : 'hidden lg:flex'} flex-1 h-full overflow-y-auto p-6 xl:p-8 bg-gray-200 justify-center print:block print:p-0 print:overflow-visible print:bg-white print:w-full`}>
              <div className={`w-full max-w-[215mm] min-h-[279mm] ${isGeneratingPDF ? 'min-w-[800px]' : ''} bg-white shadow-2xl p-[14mm] print:shadow-none print:p-0 print:mx-0 print:w-full border border-gray-300 print:border-none`}>
                <ReportPreview data={activeReportData} />
              </div>
            </div>

          </div>
        )}

        {/* VISTA 3: PANEL DEL ADMINISTRADOR DE SECRETARÍA */}
        {currentView === 'admin' && (
          <div className="flex-1 overflow-y-auto bg-gray-50 print:hidden">
            <SecretariaAdminView
              user={currentUser}
              onSelectInformeToView={handleSelectInformeToView}
              onPrintInforme={handlePrintFromAdmin}
            />
          </div>
        )}

        {/* VISTA 4: PANEL DEL SUPER ADMINISTRADOR (Gestión Central del Municipio) */}
        {currentView === 'superadmin' && (
          <div className="flex-1 overflow-y-auto bg-gray-50 print:hidden">
            <SuperAdminView user={currentUser} />
          </div>
        )}

      </div>

      {/* MODAL DE VALIDACIÓN ESTRICTA DE RADICACIÓN */}
      {validationModal && (
        <ValidationAlertModal
          isOpen={validationModal.isOpen}
          onClose={() => setValidationModal(null)}
          errors={validationModal.errors}
          reportNro={validationModal.reportNro}
        />
      )}

    </div>
  );
}
