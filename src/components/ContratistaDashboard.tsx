import React, { useState, useEffect, useMemo } from 'react';
import { AuthUser, ReportData, EstadoInforme, initialMockData, Obligacion, CertificadoSupervisionData, createDefaultCertificadoData, SoporteFiduciariaData, createDefaultFiduciariaData } from '../types';
import { formatColombianCurrency, formatFechaAplicacion } from '../utils/formatters';
import { supabaseService } from '../services/supabaseService';
import CertificadoSupervisionDoc from './CertificadoSupervisionDoc';
import SoporteFiduciariaDoc from './SoporteFiduciariaDoc';
import DeclaracionRentaDoc from './DeclaracionRentaDoc';
import AutorizacionDesembolsoDoc from './AutorizacionDesembolsoDoc';
import ValidationAlertModal from './ValidationAlertModal';
import { validateReportForRadicacion, RadicacionValidationError } from '../utils/validationUtils';
import { 
  FileText, 
  Plus, 
  FileEdit, 
  Printer, 
  CheckCircle2, 
  Clock, 
  Send, 
  User, 
  Calendar, 
  Trash2,
  Database,
  RefreshCw,
  Check,
  ShieldCheck,
  Building,
  Landmark,
  Scale,
  CreditCard,
  FileCheck,
  AlertCircle,
  AlertTriangle,
  Download,
  Info,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Bell,
  BellRing,
  Sparkles,
  Award,
  X,
  Loader2
} from 'lucide-react';

interface Props {
  user: AuthUser;
  onOpenReportEditor: (report: ReportData) => void;
  onDirectPrint: (report: ReportData) => void;
}

export type ContratistaModuleTab = 'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso';

export default function ContratistaDashboard({ user, onOpenReportEditor, onDirectPrint }: Props) {
  const [activeModuleTab, setActiveModuleTab] = useState<ContratistaModuleTab>('informe');
  const [reportsList, setReportsList] = useState<ReportData[]>([]);
  const [selectedCertReport, setSelectedCertReport] = useState<ReportData | null>(null);
  const [selectedFidReport, setSelectedFidReport] = useState<ReportData | null>(null);
  const [selectedJuramentoReport, setSelectedJuramentoReport] = useState<ReportData | null>(null);
  const [selectedDesembolsoReport, setSelectedDesembolsoReport] = useState<ReportData | null>(null);
  const [loadingDb, setLoadingDb] = useState(true);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  const [successSavedId, setSuccessSavedId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportData | null>(null);
  const [newInformeNro, setNewInformeNro] = useState('1');
  const [newPeriodoDesde, setNewPeriodoDesde] = useState('');
  const [newPeriodoHasta, setNewPeriodoHasta] = useState('');
  const [newTipoInforme, setNewTipoInforme] = useState<'Mensual' | 'Final'>('Mensual');
  const [newValorMensual, setNewValorMensual] = useState('');

  // Helper para convertir DD/MM/YYYY a YYYY-MM-DD (para inputs tipo date)
  const convertDDMMYYYYtoYYYYMMDD = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  // Campos base del contrato para el INFORME
  // En el 1er informe: los campos contractuales se cargan únicamente si están en 'user', de lo contrario van en blanco ("")
  // Los datos de administración/supervisión SIEMPRE cargan por defecto
  const [newContratoNro, setNewContratoNro] = useState(user.contratoNro || '');
  const [newObjeto, setNewObjeto] = useState(user.objetoContrato || '');
  const [newValorContrato, setNewValorContrato] = useState(user.valorContrato || '');
  const [newCdpNro, setNewCdpNro] = useState(user.cdpNro || '');
  const [newCrpNro, setNewCrpNro] = useState(user.crpNro || '');
  const [newPlazo, setNewPlazo] = useState(user.plazo || '');
  const [newFechaInicio, setNewFechaInicio] = useState(convertDDMMYYYYtoYYYYMMDD(user.fechaInicio));
  const [newFechaTerminacion, setNewFechaTerminacion] = useState(convertDDMMYYYYtoYYYYMMDD(user.fechaTerminacion));
  const [newPolizaNro, setNewPolizaNro] = useState(user.polizaNro || '');
  const [newFechaPoliza, setNewFechaPoliza] = useState(convertDDMMYYYYtoYYYYMMDD(user.fechaPoliza));

  // Datos del Administrador / Supervisor (SIEMPRE se cargan en el primer informe)
  const [newSupervisorNombre, setNewSupervisorNombre] = useState(user.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA');
  const [newSecretariaNombre, setNewSecretariaNombre] = useState(user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social');
  const [newSecretariaCodigo, setNewSecretariaCodigo] = useState(user.secretariaCodigo || '170');

  const handleOpenCreateModal = () => {
    const lastReport = reportsList[0];
    setNewInformeNro(reportsList.length > 0 ? String(reportsList.length + 1) : '1');
    setNewPeriodoDesde('');
    setNewPeriodoHasta('');
    setNewTipoInforme('Mensual');

    if (lastReport) {
      // SEGUNDO INFORME EN ADELANTE: Carga automáticamente todo del último informe guardado
      setNewValorMensual(lastReport.valorMensual || user.valorMensual || '');
      setNewContratoNro(lastReport.contratoNro || user.contratoNro || '');
      setNewObjeto(lastReport.objeto || user.objetoContrato || '');
      setNewValorContrato(lastReport.valorContrato || user.valorContrato || '');
      setNewCdpNro(lastReport.cdpNro || user.cdpNro || '');
      setNewCrpNro(lastReport.crpNro || user.crpNro || '');
      setNewPlazo(lastReport.plazo || user.plazo || '');
      setNewFechaInicio(convertDDMMYYYYtoYYYYMMDD(lastReport.fechaInicio || user.fechaInicio));
      setNewFechaTerminacion(convertDDMMYYYYtoYYYYMMDD(lastReport.fechaTerminacion || user.fechaTerminacion));
      setNewSupervisorNombre(lastReport.supervisorNombre || user.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA');
      setNewSecretariaNombre(lastReport.secretariaNombre || user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social');
      setNewSecretariaCodigo(lastReport.secretariaCodigo || user.secretariaCodigo || '170');
      setNewPolizaNro(lastReport.polizaNro || user.polizaNro || '');
      setNewFechaPoliza(convertDDMMYYYYtoYYYYMMDD(lastReport.fechaPoliza || user.fechaPoliza));
    } else {
      // PRIMER INFORME:
      // Campos de contrato específicos: Se cargan únicamente si existen en el perfil 'user', de lo contrario van en blanco ("")
      setNewValorMensual(user.valorMensual || '');
      setNewContratoNro(user.contratoNro || '');
      setNewObjeto(user.objetoContrato || '');
      setNewValorContrato(user.valorContrato || '');
      setNewCdpNro(user.cdpNro || '');
      setNewCrpNro(user.crpNro || '');
      setNewPlazo(user.plazo || '');
      setNewFechaInicio(convertDDMMYYYYtoYYYYMMDD(user.fechaInicio));
      setNewFechaTerminacion(convertDDMMYYYYtoYYYYMMDD(user.fechaTerminacion));
      setNewPolizaNro(user.polizaNro || '');
      setNewFechaPoliza(convertDDMMYYYYtoYYYYMMDD(user.fechaPoliza));

      // Datos de Administración y Supervisión: SI O SI cargan siempre
      setNewSupervisorNombre(user.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA');
      setNewSecretariaNombre(user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social');
      setNewSecretariaCodigo(user.secretariaCodigo || '170');
    }

    setShowCreateModal(true);
  };

  // Modal de Validación de Radicación
  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    errors: RadicacionValidationError[];
    reportNro?: string;
  } | null>(null);

  const [lastActionTimestamp, setLastActionTimestamp] = useState<number>(0);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  const handleDismissAllApproved = () => {
    unseenApprovedReports.forEach(r => {
      if (r.informeNro) {
        const key = `notified_approved_${user.documentoIdentidad || ''}_${r.informeNro}`;
        localStorage.setItem(key, 'seen');
      }
    });
    setLastActionTimestamp(Date.now());
  };

  const handleInterceptOpenReport = (report: ReportData) => {
    if (report.informeNro) {
      const key = `notified_approved_${user.documentoIdentidad || ''}_${report.informeNro}`;
      localStorage.setItem(key, 'seen');
    }
    setLastActionTimestamp(Date.now());
    onOpenReportEditor(report);
  };

  const handleToggleBell = () => {
    const nextState = !showNotificationsMenu;
    setShowNotificationsMenu(nextState);
    if (nextState) {
      if (unseenApprovedReports.length > 0) {
        unseenApprovedReports.forEach(r => {
          if (r.informeNro) {
            const key = `notified_approved_${user.documentoIdentidad || ''}_${r.informeNro}`;
            localStorage.setItem(key, 'seen');
          }
        });
      }
      if (allUnseenObservations.length > 0) {
        allUnseenObservations.forEach(obs => {
          const key = `notified_obs_${user.documentoIdentidad || ''}_${obs.report.informeNro || ''}_${obs.key}`;
          localStorage.setItem(key, 'seen');
        });
      }
      setLastActionTimestamp(Date.now());
    }
  };

  const handleInterceptDirectPrint = (report: ReportData) => {
    setLastActionTimestamp(Date.now());
    onDirectPrint(report);
  };

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Cargar datos reales desde Supabase (ESTRICTAMENTE FILTRADO POR USER DE SUPABASE)
  const loadContractorData = async () => {
    setLoadingDb(true);
    let finalReports: ReportData[] = [];
    
    try {
      const dbReports = await supabaseService.getContractorReports(user.documentoIdentidad, user.id);
      if (dbReports) {
        finalReports = dbReports.map(rep => {
          if (rep.estado === 'Borrador') {
            rep.comentariosCampos = {};
          } else if (rep.comentariosCampos && Object.keys(rep.comentariosCampos).length > 0 && rep.estado !== 'Aprobado') {
            rep.estado = 'Devuelto';
          }
          return rep;
        });
      }
    } catch (e) {
      console.warn('Error loading reports from Supabase:', e);
    }

    // Ordenar y limpiar informes expirados
    finalReports.sort((a, b) => parseInt(b.informeNro || '0', 10) - parseInt(a.informeNro || '0', 10));
    const { validReports } = await supabaseService.cleanupExpiredReports(finalReports, user.documentoIdentidad);

    setReportsList(validReports);
    const maxNro = Math.max(...validReports.map(r => parseInt(r.informeNro || '0', 10)), 0);
    setNewInformeNro((maxNro + 1).toString());
    setLoadingDb(false);
  };

  useEffect(() => {
    loadContractorData();

    const handleDataUpdate = () => {
      loadContractorData();
    };

    const handleSwitchTab = (e: any) => {
      if (e.detail?.tab) {
        setActiveModuleTab(e.detail.tab);
        if (e.detail.informeNro) {
          const found = reportsList.find(r => String(r.informeNro) === String(e.detail.informeNro));
          if (found) {
            if (e.detail.tab === 'supervision') setSelectedCertReport(found);
            if (e.detail.tab === 'fiduciaria') setSelectedFidReport(found);
            if (e.detail.tab === 'juramento') setSelectedJuramentoReport(found);
            if (e.detail.tab === 'desembolso') setSelectedDesembolsoReport(found);
          }
        }
      }
    };

    window.addEventListener('storage', handleDataUpdate);
    window.addEventListener('informe_comments_updated', handleDataUpdate);
    window.addEventListener('notificaciones_actualizadas', handleDataUpdate);
    window.addEventListener('switch_contractor_tab', handleSwitchTab);
    window.addEventListener('focus', handleDataUpdate);

    return () => {
      window.removeEventListener('storage', handleDataUpdate);
      window.removeEventListener('informe_comments_updated', handleDataUpdate);
      window.removeEventListener('notificaciones_actualizadas', handleDataUpdate);
      window.removeEventListener('switch_contractor_tab', handleSwitchTab);
      window.removeEventListener('focus', handleDataUpdate);
    };
  }, [user.documentoIdentidad, user.id, reportsList]);

  // Guardar / Sincronizar informe en Supabase
  const handleSaveToDatabase = async (report: ReportData) => {
    setSavingReportId(report.informeNro);
    const result = await supabaseService.saveFullInforme(report, user);
    if (result.success) {
      setSuccessSavedId(report.informeNro);
      setTimeout(() => setSuccessSavedId(null), 3500);
      await loadContractorData();
    }
    setSavingReportId(null);
  };

  // Helper para formatear YYYY-MM-DD a DD/MM/YYYY
  const formatDateToDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return dateStr;
  };

  const existingValorMensual = reportsList.find(r => r.valorMensual)?.valorMensual || user.valorMensual;

  // Crear nuevo informe con lógica de Precarga Inteligente (Primer Informe vs. Siguientes)
  const handleCreateNewReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingReport) return;
    setIsCreatingReport(true);

    try {
      // 1. Consultar el último informe guardado por este usuario en Supabase
      const lastSavedReport = await supabaseService.getLastSavedReport(user.documentoIdentidad, user.id) 
        || (reportsList.length > 0 ? reportsList[0] : null);

      const isFirstReport = !lastSavedReport;

      let templateObligaciones: Obligacion[] = [];
      let baseGeneralData: Partial<ReportData> = {};

      if (isFirstReport) {
        // CASO 1: PRIMER INFORME (0 registros previos en Supabase)
        // Inicializar estrictamente UNA (1) SOLA OBLIGACIÓN COMPLETAMENTE VACÍA
        templateObligaciones = [
          {
            id: `obs-${Date.now()}-1`,
            num: 1,
            descripcion: '', // Completamente vacio
            actividades: '', // Completamente vacio
            fotos: [],       // Array de fotos vacio
            soportes: 'Anexo fotográfico',
            isClonedStructure: false,
            isUpdated: false,
            isTouched: true  // Resaltado "Campo a actualizar"
          }
        ];

        baseGeneralData = {
          objeto: newObjeto || user.objetoContrato || '',
          contratoNro: newContratoNro || user.contratoNro || '',
          valorContrato: newValorContrato ? formatColombianCurrency(newValorContrato) : (user.valorContrato || ''),
          valorMensual: newValorMensual ? formatColombianCurrency(newValorMensual) : (existingValorMensual || ''),
          cdpNro: newCdpNro || user.cdpNro || '',
          crpNro: newCrpNro || user.crpNro || '',
          polizaNro: newPolizaNro || user.polizaNro || '',
          fechaPoliza: formatDateToDDMMYYYY(newFechaPoliza) || newFechaPoliza || '',
          plazo: newPlazo || user.plazo || '',
          fechaInicio: formatDateToDDMMYYYY(newFechaInicio) || user.fechaInicio || '',
          fechaTerminacion: formatDateToDDMMYYYY(newFechaTerminacion) || user.fechaTerminacion || '',
          supervisorNombre: newSupervisorNombre || user.supervisorNombre || '',
          supervisorDocumento: user.supervisorDocumento || '',
          apoyoSupervisionNombre: user.apoyoSupervisionNombre || '',
          apoyoSupervisionDocumento: user.apoyoSupervisionDocumento || '',
          secretariaNombre: newSecretariaNombre || user.secretariaNombre || '',
          secretariaCodigo: newSecretariaCodigo || user.secretariaCodigo || '',
          secretariaNit: '891.680.029-7',
          isClonedFromPrevious: false
        };
      } else {
        // CASO 2: SEGUNDO INFORME EN ADELANTE (Hereda datos del último informe)
        baseGeneralData = {
          objeto: lastSavedReport.objeto || user.objetoContrato || '',
          contratoNro: lastSavedReport.contratoNro || user.contratoNro || '',
          valorContrato: lastSavedReport.valorContrato || user.valorContrato || '',
          valorMensual: lastSavedReport.valorMensual || existingValorMensual || '',
          cdpNro: lastSavedReport.cdpNro || '',
          crpNro: lastSavedReport.crpNro || '',
          polizaNro: lastSavedReport.polizaNro || '',
          fechaPoliza: lastSavedReport.fechaPoliza || '',
          plazo: lastSavedReport.plazo || user.plazo || '',
          fechaInicio: lastSavedReport.fechaInicio || user.fechaInicio || '',
          fechaTerminacion: lastSavedReport.fechaTerminacion || user.fechaTerminacion || '',
          supervisorNombre: lastSavedReport.supervisorNombre || user.supervisorNombre || '',
          supervisorDocumento: lastSavedReport.supervisorDocumento || user.supervisorDocumento || '',
          apoyoSupervisionNombre: lastSavedReport.apoyoSupervisionNombre || user.apoyoSupervisionNombre || '',
          apoyoSupervisionDocumento: lastSavedReport.apoyoSupervisionDocumento || user.apoyoSupervisionDocumento || '',
          secretariaNombre: lastSavedReport.secretariaNombre || user.secretariaNombre || '',
          secretariaCodigo: lastSavedReport.secretariaCodigo || user.secretariaCodigo || '',
          secretariaNit: lastSavedReport.secretariaNit || '891.680.029-7',
          valorPagar: lastSavedReport.valorPagar,
          isClonedFromPrevious: true
        };

        // Clonar la lista de obligaciones contractuales conservando la descripción
        // OBLIGATORIO: LIMPIAR las actividades realizadas y los anexos fotográficos
        const sourceObligations = (lastSavedReport.obligaciones && lastSavedReport.obligaciones.length > 0)
          ? lastSavedReport.obligaciones
          : [];

        templateObligaciones = sourceObligations.map((o, idx) => ({
          id: `obs-${Date.now()}-${idx + 1}`,
          num: idx + 1,
          descripcion: o.descripcion,
          actividades: '', // Limpio para el nuevo periodo
          fotos: [],       // Limpio para el nuevo periodo
          soportes: o.soportes || 'Anexo fotográfico',
          isClonedStructure: true,
          isUpdated: false,
          isTouched: true  // Resaltado de campo a actualizar
        }));
      }

      const formattedDesde = formatDateToDDMMYYYY(newPeriodoDesde);
      const formattedHasta = formatDateToDDMMYYYY(newPeriodoHasta);

      // Eliminar de Supabase cualquier borrador duplicado con este mismo número
      const existingReportWithSameNro = reportsList.find(r => parseInt(r.informeNro || '0', 10) === parseInt(newInformeNro || '0', 10));
      if (existingReportWithSameNro && existingReportWithSameNro.id && existingReportWithSameNro.id.includes('-')) {
        await supabaseService.deleteFullInforme(
          existingReportWithSameNro.id,
          newInformeNro,
          user.documentoIdentidad,
          existingReportWithSameNro.anexos
        );
      }

      const newReport: ReportData = {
        ...initialMockData,
        ...baseGeneralData,
        id: `inf-${Date.now()}`,
        informeNro: newInformeNro,
        tipoInforme: newTipoInforme,
        fechaPresentacion: new Date().toLocaleDateString('es-CO'),
        periodoDesde: formattedDesde,
        periodoHasta: formattedHasta,
        fechaAplicacion: formatFechaAplicacion(formattedHasta, formattedDesde),
        estado: 'Borrador',
        comentariosCampos: {},
        observaciones: '',
        obligaciones: templateObligaciones,
        anexos: [], // Fotos limpias para el nuevo periodo
        contratistaNombre: user.nombreCompleto,
        contratistaDocumento: user.documentoIdentidad,
        contratistaCorreo: user.email,
        contratistaTelefono: user.telefono || '3104567890',
        valorMensual: baseGeneralData.valorMensual || '$ 3.338.300',
        syncedToDb: false,
      };

      // Guardar en Supabase
      await supabaseService.saveFullInforme(newReport, user);
      await loadContractorData();
      setShowCreateModal(false);

      // Abrir directamente en el editor
      onOpenReportEditor(newReport);
    } catch (err) {
      console.error('Error al crear informe:', err);
    } finally {
      setIsCreatingReport(false);
    }
  };

  const handleSendToReview = async (report: ReportData) => {
    // Validaciones estrictas antes de radicar
    const validation = validateReportForRadicacion(report);
    if (!validation.isValid) {
      setValidationModal({
        isOpen: true,
        errors: validation.errors,
        reportNro: report.informeNro
      });
      return;
    }

    const updated: ReportData = { ...report, estado: 'Enviado' };
    setReportsList(prev => prev.map(r => r.informeNro === report.informeNro ? updated : r));
    await supabaseService.saveFullInforme(updated, user);
    await supabaseService.crearNotificacion({
      user_id: user.supervisorDocumento || 'supervisor',
      titulo: `Nuevo Informe Radicado #${report.informeNro}`,
      mensaje: `El contratista ${user.nombreCompleto} ha radicado el Informe #${report.informeNro} correspondiente al período ${report.periodoDesde} - ${report.periodoHasta}.`,
      tipo: 'radicado',
      leida: false,
      informe_nro: report.informeNro,
      report_id: report.id
    }).catch(e => console.warn('Error creating notification:', e));

    window.dispatchEvent(new CustomEvent('informe_radicado_event'));
    await loadContractorData();
  };

  const handleDeleteReport = (report: ReportData) => {
    setReportToDelete(report);
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
    setLoadingDb(true);
    try {
      // 1. Eliminar completamente el informe de Supabase, tablas vinculadas (obligaciones, anexos, certificaciones, notificaciones) y archivos de Storage
      await supabaseService.deleteFullInforme(
        reportToDelete.id, 
        reportToDelete.informeNro, 
        user.documentoIdentidad, 
        reportToDelete.anexos
      );

      // 2. Ejecutar la rutina depuradora de tareas/informes vencidos (mayores a 7 meses / 210 días)
      const remainingReports = reportsList.filter(r => r.informeNro !== reportToDelete.informeNro);
      await supabaseService.cleanupExpiredReports(remainingReports, user.documentoIdentidad);

      setReportsList(remainingReports);
      setReportToDelete(null);

      // 3. Recargar datos del contratista y notificar actualización al sistema
      window.dispatchEvent(new CustomEvent('informe_radicado_event'));
      await loadContractorData();
    } catch (e) {
      console.warn('Error al eliminar informe:', e);
    } finally {
      setLoadingDb(false);
    }
  };

  const totalAprobados = reportsList.filter(r => r.estado === 'Aprobado').length;
  
  // Informes aprobados que el contratista aún NO ha marcado como vistos/ingresados
  const allUnseenApproved = reportsList.filter(r => {
    if (r.estado !== 'Aprobado') return false;
    const key = `notified_approved_${user.documentoIdentidad || ''}_${r.informeNro}`;
    return localStorage.getItem(key) !== 'seen';
  });

  // Mostramos únicamente el último informe aprobado (el más reciente, número de informe más alto) para no acumular alertas antiguas
  const unseenApprovedReports = allUnseenApproved.length > 0
    ? [allUnseenApproved.reduce((max, cur) => (Number(cur.informeNro || 0) > Number(max.informeNro || 0) ? cur : max))]
    : [];

  const totalAprobadosUnseen = unseenApprovedReports.length;

  // Agrupar comentarios de supervisión pendientes por módulo
  const pendingCommentsByModule = useMemo(() => {
    const supervision: { report: ReportData; comment: any; key: string }[] = [];
    const fiduciaria: { report: ReportData; comment: any; key: string }[] = [];
    const juramento: { report: ReportData; comment: any; key: string }[] = [];
    const desembolso: { report: ReportData; comment: any; key: string }[] = [];
    const informe: { report: ReportData; comment: any; key: string }[] = [];

    reportsList.forEach(r => {
      if (r.estado === 'Aprobado') return;
      const comms = r.comentariosCampos || {};
      Object.entries(comms).forEach(([key, comm]) => {
        const c = comm as any;
        if (c.corregido) return;
        const fn = (c.nombreCampo || c.fieldName || key).toLowerCase();
        const fid = (c.campoId || key).toLowerCase();

        if (fid === 'certificado_supervision' || fid.startsWith('cert_') || fn.includes('certificado de supervisión') || fn.includes('certificado de cumplimiento') || fn.includes('supervisión')) {
          supervision.push({ report: r, comment: c, key });
        } else if (fid === 'soporte_fiduciaria' || fid.startsWith('fid_') || fn.includes('soporte fiduciaria') || fn.includes('fiduciaria')) {
          fiduciaria.push({ report: r, comment: c, key });
        } else if (fid === 'declaracion_juramento' || fid.startsWith('dec_') || fn.includes('declaración') || fn.includes('juramento') || fn.includes('renta')) {
          juramento.push({ report: r, comment: c, key });
        } else if (fid === 'autorizacion_desembolso' || fid.startsWith('desemb_') || fn.includes('autorización de desembolso') || fn.includes('desembolso') || fn.includes('documento equivalente')) {
          desembolso.push({ report: r, comment: c, key });
        } else {
          informe.push({ report: r, comment: c, key });
        }
      });
    });

    return { supervision, fiduciaria, juramento, desembolso, informe };
  }, [reportsList]);

  // Observaciones pendientes que aún no se han visto en la campana
  const allUnseenObservations = useMemo(() => {
    const list: {
      report: ReportData;
      comment: any;
      key: string;
      moduleTab: 'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso';
      moduleLabel: string;
    }[] = [];

    const addIfUnseen = (
      items: { report: ReportData; comment: any; key: string }[],
      moduleTab: 'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso',
      moduleLabel: string
    ) => {
      items.forEach(item => {
        const storageKey = `notified_obs_${user.documentoIdentidad || ''}_${item.report.informeNro || ''}_${item.key}`;
        if (localStorage.getItem(storageKey) !== 'seen') {
          list.push({ ...item, moduleTab, moduleLabel });
        }
      });
    };

    addIfUnseen(pendingCommentsByModule.informe, 'informe', 'Informe Mensual');
    addIfUnseen(pendingCommentsByModule.supervision, 'supervision', 'Certificado de Supervisión');
    addIfUnseen(pendingCommentsByModule.fiduciaria, 'fiduciaria', 'Soporte Fiduciaria');
    addIfUnseen(pendingCommentsByModule.juramento, 'juramento', 'Declaración Bajo Juramento');
    addIfUnseen(pendingCommentsByModule.desembolso, 'desembolso', 'Autorización de Desembolso');

    return list;
  }, [pendingCommentsByModule, user.documentoIdentidad, lastActionTimestamp]);

  const totalNotificationsUnseen = totalAprobadosUnseen + allUnseenObservations.length;
  
  // Informes devueltos con observaciones PENDIENTES por corregir
  const reportsWithPendingObs = reportsList.filter(r => {
    if (r.estado === 'Aprobado') return false;
    const comms = Object.values(r.comentariosCampos || {});
    if (comms.length === 0) return r.estado === 'Devuelto';
    return comms.some((c: any) => !c.corregido);
  });

  // Informes devueltos cuyas observaciones ya fueron TODAS corregidas por el contratista
  const reportsCorregidosListo = reportsList.filter(r => {
    if (r.estado === 'Aprobado' || r.estado === 'Enviado') return false;
    const comms = Object.values(r.comentariosCampos || {});
    return comms.length > 0 && comms.every((c: any) => c.corregido);
  });

  const totalDevueltosPendientes = reportsWithPendingObs.length;
  const totalDevueltosCorregidos = reportsCorregidosListo.length;
  const totalEnviados = reportsList.filter(r => r.estado === 'Enviado').length;
  const totalBorradores = reportsList.filter(r => (!r.estado || r.estado === 'Borrador') && !(r.comentariosCampos && Object.keys(r.comentariosCampos).length > 0)).length;

  const activeContractNro = user.contratoNro || reportsList[0]?.contratoNro || '015';
  const activeValor = user.valorContrato || reportsList[0]?.valorContrato || '$ 20.029.800';
  const activeSupervisor = user.supervisorNombre || reportsList[0]?.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA';

  // Paginación de Informes del Contratista
  const totalPages = Math.ceil(reportsList.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, reportsList.length);
  const paginatedReports = reportsList.slice(startIndex, startIndex + pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Banner Principal del Contratista */}
      <div className="relative z-20 bg-gradient-to-br from-[#00381a] via-[#005226] to-[#012612] text-white p-6 sm:p-8 rounded-2xl border border-emerald-800 shadow-xl">
        {/* Franja Superior Tricolor */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex overflow-hidden rounded-t-2xl">
          <div className="w-1/2 bg-[#006b33]"></div>
          <div className="w-1/3 bg-[#c8102e]"></div>
          <div className="w-1/6 bg-[#f59e0b]"></div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Portal de Gestión Contractual • Alcaldía de Quibdó</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {user.nombreCompleto}
            </h2>
            
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-emerald-200">
              <span className="font-mono bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-700/50">
                C.C. {user.documentoIdentidad}
              </span>
              <span>•</span>
              <span className="font-medium text-emerald-100">
                {user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social'}
              </span>
              <span className="text-[11px] text-emerald-300 font-mono">
                (Cód. {user.secretariaCodigo || '170'})
              </span>
            </div>

            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="bg-emerald-950/90 px-3 py-1 rounded-lg border border-emerald-600/60 text-emerald-200 font-bold font-mono shadow-xs">
                Contrato #{activeContractNro} de 2026
              </span>
              <span className="bg-emerald-950/90 px-3 py-1 rounded-lg border border-emerald-600/60 text-emerald-200 font-medium shadow-xs">
                Valor: <strong className="text-white font-bold">{activeValor}</strong>
              </span>
              <span className="bg-emerald-950/90 px-3 py-1 rounded-lg border border-emerald-600/60 text-emerald-200 font-medium shadow-xs">
                Supervisor: <strong className="text-white">{activeSupervisor}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 relative">
            {/* Botón Campana de Notificaciones */}
            <div className="relative">
              <button
                onClick={handleToggleBell}
                className={`p-3 rounded-xl border transition-all relative ${
                  totalNotificationsUnseen > 0
                    ? 'bg-emerald-800/90 hover:bg-emerald-700 text-amber-300 border-amber-400/80 shadow-md ring-2 ring-amber-400/30 animate-pulse'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border-emerald-700/80'
                }`}
                title={totalNotificationsUnseen > 0 ? `Tienes ${totalNotificationsUnseen} notificación(es) de supervisión` : 'Centro de Notificaciones'}
              >
                {totalNotificationsUnseen > 0 ? (
                  <BellRing size={18} className="text-amber-300" />
                ) : (
                  <Bell size={18} />
                )}
                {totalNotificationsUnseen > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-gray-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-emerald-950">
                    {totalNotificationsUnseen}
                  </span>
                )}
              </button>

              {/* Menú Desplegable de Notificaciones */}
              {showNotificationsMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <BellRing size={16} className="text-emerald-700" />
                      <h4 className="font-bold text-xs text-slate-900">Notificaciones de Supervisión</h4>
                    </div>
                    <button
                      onClick={() => setShowNotificationsMenu(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto">
                    {/* SECCIÓN 1: Observaciones y Devoluciones por Módulo */}
                    {allUnseenObservations.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle size={13} className="text-amber-600" />
                          <span>Observaciones pendientes ({allUnseenObservations.length})</span>
                        </div>
                        {allUnseenObservations.map((obs, idx) => (
                          <div key={idx} className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-300">
                                  {obs.moduleLabel} • Inf #{obs.report.informeNro}
                                </span>
                                <p className="text-xs font-bold text-slate-900 mt-1">
                                  "{obs.comment?.comentario || 'Se requiere ajuste en el documento'}"
                                </p>
                                <p className="text-[10px] text-amber-800 font-medium mt-0.5">
                                  Por: {obs.comment?.autor || activeSupervisor} {obs.comment?.fecha ? `• ${obs.comment.fecha}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                              <button
                                onClick={() => {
                                  setShowNotificationsMenu(false);
                                  setActiveModuleTab(obs.moduleTab);
                                  if (obs.moduleTab === 'supervision') setSelectedCertReport(obs.report);
                                  if (obs.moduleTab === 'fiduciaria') setSelectedFidReport(obs.report);
                                  if (obs.moduleTab === 'juramento') setSelectedJuramentoReport(obs.report);
                                  if (obs.moduleTab === 'desembolso') setSelectedDesembolsoReport(obs.report);
                                  if (obs.moduleTab === 'informe') handleInterceptOpenReport(obs.report);
                                }}
                                className="w-full py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                              >
                                <FileEdit size={12} />
                                <span>Ver {obs.moduleLabel}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SECCIÓN 2: Informes Aprobados */}
                    {reportsList.some(r => r.estado === 'Aprobado') && (
                      <div className="space-y-2 pt-1">
                        <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={13} className="text-emerald-600" />
                          <span>Informes aprobados para pago</span>
                        </div>
                        {reportsList.filter(r => r.estado === 'Aprobado').map(r => (
                          <div key={r.id || r.informeNro} className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Sparkles size={11} className="text-emerald-600" /> ¡Informe Aprobado!
                                </span>
                                <h5 className="font-black text-slate-900 text-xs mt-1">
                                  Informe Nro. {r.informeNro} ({r.tipoInforme})
                                </h5>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  Período: {r.periodoDesde} al {r.periodoHasta}
                                </p>
                                <p className="text-[10px] text-emerald-800 font-medium mt-0.5">
                                  Aprobado por: {r.supervisorNombre || activeSupervisor}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 border-t border-emerald-100">
                              <button
                                onClick={() => {
                                  setShowNotificationsMenu(false);
                                  handleInterceptOpenReport(r);
                                }}
                                className="w-full py-1.5 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                              >
                                <FileEdit size={12} />
                                <span>Consultar Informe</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {allUnseenObservations.length === 0 && totalAprobados === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        <CheckCircle2 size={24} className="mx-auto mb-1 text-slate-300" />
                        <p>No tienes notificaciones u observaciones pendientes.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={loadContractorData}
              disabled={loadingDb}
              className="p-3 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 rounded-xl border border-emerald-700/80 transition-colors shadow-sm"
              title="Recargar informes y sincronización con Supabase"
            >
              <RefreshCw size={18} className={loadingDb ? 'animate-spin text-emerald-400' : ''} />
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-gray-950 font-black px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <Plus size={18} className="stroke-[3]" />
              <span>Crear Nuevo Informe</span>
            </button>
          </div>
        </div>
      </div>

      {/* Menú de Módulos de la Suite Contractual */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          
          <button
            onClick={() => setActiveModuleTab('informe')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
              activeModuleTab === 'informe'
                ? 'bg-[#006b33] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText size={16} />
            <span>1. Informe Mensual de Actividades</span>
            {pendingCommentsByModule.informe.length > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400 text-amber-950 animate-pulse border border-amber-500 shadow-xs">
                ⚠️ {pendingCommentsByModule.informe.length} Obs
              </span>
            ) : (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeModuleTab === 'informe' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {reportsList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveModuleTab('supervision')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
              activeModuleTab === 'supervision'
                ? 'bg-[#006b33] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={16} />
            <span>2. Certificado de Supervisión</span>
            {pendingCommentsByModule.supervision.length > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400 text-amber-950 animate-pulse border border-amber-500 shadow-xs">
                ⚠️ {pendingCommentsByModule.supervision.length} Obs
              </span>
            ) : (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeModuleTab === 'supervision' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {totalAprobados > 0 ? `${totalAprobados} Listo` : 'En trámite'}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveModuleTab('fiduciaria')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
              activeModuleTab === 'fiduciaria'
                ? 'bg-[#006b33] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Landmark size={16} />
            <span>3. Soporte Fiduciaria / Pagos</span>
            {pendingCommentsByModule.fiduciaria.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400 text-amber-950 animate-pulse border border-amber-500 shadow-xs">
                ⚠️ {pendingCommentsByModule.fiduciaria.length} Obs
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveModuleTab('juramento')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
              activeModuleTab === 'juramento'
                ? 'bg-[#006b33] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scale size={16} />
            <span>4. Declaración Bajo Juramento</span>
            {pendingCommentsByModule.juramento.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400 text-amber-950 animate-pulse border border-amber-500 shadow-xs">
                ⚠️ {pendingCommentsByModule.juramento.length} Obs
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveModuleTab('desembolso')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
              activeModuleTab === 'desembolso'
                ? 'bg-[#006b33] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard size={16} />
            <span>5. Autorización de Desembolso</span>
            {pendingCommentsByModule.desembolso.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-400 text-amber-950 animate-pulse border border-amber-500 shadow-xs">
                ⚠️ {pendingCommentsByModule.desembolso.length} Obs
              </span>
            )}
          </button>

        </div>
      </div>

      {/* Guía Rápida de Edición de Módulos Contractuales */}
      {activeModuleTab !== 'informe' && (
        <div className="bg-gradient-to-r from-emerald-950 via-[#004d25] to-emerald-900 text-white px-4 py-3 rounded-2xl shadow-sm border border-emerald-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="bg-amber-400 text-slate-950 p-1.5 rounded-lg shrink-0 font-bold mt-0.5 sm:mt-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="font-bold text-emerald-100 text-[12.5px]">
                {activeModuleTab === 'supervision' && 'Instrucciones: ¿Cómo diligenciar y editar el Certificado de Supervisión?'}
                {activeModuleTab === 'fiduciaria' && 'Instrucciones: ¿Cómo diligenciar y editar el Soporte Fiduciario?'}
                {activeModuleTab === 'juramento' && 'Instrucciones: ¿Cómo diligenciar y editar la Declaración Bajo Juramento?'}
                {activeModuleTab === 'desembolso' && 'Instrucciones: ¿Cómo diligenciar y editar la Autorización de Desembolso?'}
              </p>
              <p className="text-[11.5px] text-emerald-200/90 mt-0.5">
                <span className="font-semibold text-white">Paso 1:</span> Clic en <strong className="text-amber-300 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-amber-400/40">«Llenar / Editar Campos»</strong> ➔ <span className="font-semibold text-white">Paso 2:</span> Modifique los campos resaltados {activeModuleTab === 'supervision' ? '(o presione «Autocalcular Liquidación»)' : ''} ➔ <span className="font-semibold text-white">Paso 3:</span> Clic en <strong className="text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-400/40">«Guardar Cambios»</strong>.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[10.5px] bg-emerald-800/90 text-emerald-200 border border-emerald-600/60 px-2.5 py-1 rounded-full font-bold">
              Edición en Línea
            </span>
          </div>
        </div>
      )}

      {/* VISTA DEL MÓDULO 1: INFORME MENSUAL DE ACTIVIDADES */}
      {activeModuleTab === 'informe' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Banner de Notificación de Informe Aprobado para Cobro */}
          {totalAprobadosUnseen > 0 && (
            <div className="bg-gradient-to-r from-emerald-900 via-[#005226] to-[#00381a] text-white p-4 sm:p-5 pr-12 rounded-2xl border border-emerald-500 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in relative">
              {/* Botón de descartar alerta */}
              <button
                onClick={() => handleDismissAllApproved()}
                className="absolute top-3.5 right-3.5 text-emerald-300 hover:text-white hover:bg-emerald-800/40 p-1.5 rounded-xl transition-all"
                title="Quitar esta alerta permanentemente"
              >
                <X size={16} />
              </button>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/25 border border-emerald-400/60 flex items-center justify-center shrink-0 text-emerald-300">
                  <Award size={22} className="text-amber-300 animate-bounce" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-400 text-gray-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      🎉 Aprobación Confirmada
                    </span>
                    <span className="text-xs text-emerald-200 font-semibold">
                      Supervisión Alcaldía de Quibdó
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-50 leading-snug">
                    Tienes <strong className="text-amber-300">{totalAprobadosUnseen} informe(s) APROBADO(S)</strong> por tu supervisor(a) <strong>{activeSupervisor}</strong>. La certificación de pago está emitida y lista para su trámite.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {unseenApprovedReports.map(apRep => (
                  <button
                    key={apRep.id || apRep.informeNro}
                    onClick={() => handleInterceptOpenReport(apRep)}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-gray-950 rounded-xl font-black text-xs inline-flex items-center gap-1.5 shadow-md transition-all hover:scale-105"
                    title={`Consultar Informe #${apRep.informeNro}`}
                  >
                    <FileEdit size={14} />
                    <span>Consultar Informe #{apRep.informeNro}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Banner de Alerta de Informes Devueltos con Observaciones (Solo si hay observaciones PENDIENTES) */}
          {totalDevueltosPendientes > 0 && (
            <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-600/20 border-2 border-amber-400 p-4 sm:p-5 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-950 animate-in fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-200 border border-amber-400 flex items-center justify-center shrink-0 text-amber-900 shadow-xs">
                  <AlertTriangle size={22} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-400 text-amber-950 font-black text-[10.5px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs border border-amber-500">
                      ⚠️ Observaciones Pendientes de Supervisión
                    </span>
                    <span className="text-xs text-amber-900 font-bold">
                      Correcciones Requeridas
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-950 font-medium leading-snug">
                    Tienes <strong className="text-amber-900 font-extrabold">{totalDevueltosPendientes} informe(s) DEVUELTO(S)</strong> con notas y observaciones pendientes por corregir. Los campos a corregir están resaltados en <strong className="underline">amarillo</strong> dentro del editor.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {reportsWithPendingObs.map(devRep => (
                  <button
                    key={devRep.id || devRep.informeNro}
                    onClick={() => onOpenReportEditor(devRep)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md transition-all hover:scale-105"
                    title={`Abrir y corregir observaciones del Informe #${devRep.informeNro}`}
                  >
                    <FileEdit size={14} />
                    <span>Corregir Informe #{devRep.informeNro}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tarjetas de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Informes</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-[#006b33]">
                  <FileText size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{reportsList.length}</p>
              <p className="text-xs text-slate-500 mt-1">Vigencia Fiscal 2026</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Aprobados para Pago</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-[#006b33]">{totalAprobados}</p>
              <p className="text-xs text-emerald-700 mt-1">Con certificación emitida</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Devueltos (Pendientes)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-amber-800">{totalDevueltosPendientes}</p>
              <p className="text-xs text-amber-700 mt-1">
                {totalDevueltosPendientes > 0 ? 'Requieren corregir casillas' : totalDevueltosCorregidos > 0 ? '🟢 Correcciones listas' : 'Sin observaciones pendientes'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">En Revisión / Borrador</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Clock size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-blue-700">{totalEnviados + totalBorradores}</p>
              <p className="text-xs text-blue-600 mt-1">{totalEnviados} en secretaría, {totalBorradores} borrador</p>
            </div>

          </div>

          {/* Nota Institucional de Retención y Depuración (7 Meses) */}
          <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-amber-950 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-200/80 border border-amber-300 flex items-center justify-center shrink-0 text-amber-900">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-1 flex-1 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-amber-950 uppercase tracking-wide text-[10px] bg-amber-200 px-2 py-0.5 rounded">
                  Política de Retención y Depuración (7 Meses)
                </span>
                <span className="text-amber-800 font-semibold text-[11px]">• Alcaldía de Quibdó</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                Por política de optimización y depuración de almacenamiento institucional, los <strong>informes mensuales radicados, sus evidencias de actividades y los anexos fotográficos</strong> permanecerán disponibles en el portal durante un período máximo de <strong>7 meses (210 días)</strong>. Cumplido este plazo, los registros con fotos de informes revisados y tramitados son eliminados automáticamente del sistema.
              </p>
              <p className="text-amber-800 font-medium pt-0.5">
                💡 <strong>Nota para el contratista:</strong> Se recomienda consultar y conservar en su archivo digital personal la copia oficial en PDF de cada informe aprobado.
              </p>
            </div>
          </div>

          {/* Listado de Informes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <FileText size={18} className="text-[#006b33]" />
                  <span>Historial de Informes Mensuales Radicados</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Contrato de Prestación de Servicios #{activeContractNro} de 2026</p>
              </div>

              <div className="flex items-center gap-3">
                {reportsList.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Por pág:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-[#006b33]"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={handleOpenCreateModal}
                  className="px-3.5 py-2 bg-[#006b33] hover:bg-[#005729] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs self-start sm:self-auto"
                >
                  <Plus size={15} />
                  <span>Nuevo Informe</span>
                </button>
              </div>
            </div>

            {reportsList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <FileText size={44} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">No tienes informes registrados actualmente</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Haz clic en «Crear Nuevo Informe» para comenzar a diligenciar tu primer informe mensual y guardarlo en la base de datos de la Alcaldía de Quibdó.
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-2 px-4 py-2 bg-[#006b33] hover:bg-[#005729] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={15} />
                  <span>Crear mi primer informe</span>
                </button>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {paginatedReports.map((report) => (
                    <div 
                      key={report.id || report.informeNro} 
                      className="p-5 hover:bg-slate-50/70 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900">
                            Informe Nro. {report.informeNro} ({report.tipoInforme})
                          </span>

                          {(() => {
                            const comms = report.comentariosCampos || {};
                            const commList = Object.values(comms);
                            const pendingComms = commList.filter((c: any) => !c.corregido);
                            const isDevuelto = report.estado === 'Devuelto' || (commList.length > 0 && report.estado !== 'Aprobado');
                            const allCorregidos = commList.length > 0 && pendingComms.length === 0;

                            if (report.estado === 'Aprobado') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check size={11} className="text-emerald-700" />
                                  Aprobado
                                </span>
                              );
                            }

                            if (isDevuelto) {
                              if (allCorregidos) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
                                    <CheckCircle2 size={11} className="text-emerald-700" />
                                    Devuelto (Corregido)
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-400 font-extrabold shadow-xs">
                                  <AlertTriangle size={11} className="text-amber-800 shrink-0" />
                                  Devuelto ({pendingComms.length} obs. pendiente{pendingComms.length > 1 ? 's' : ''})
                                </span>
                              );
                            }

                            if (report.estado === 'Enviado') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Clock size={11} className="text-blue-600" />
                                  Enviado (En Revisión)
                                </span>
                              );
                            }

                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                                {report.estado || 'Borrador'}
                              </span>
                            );
                          })()}

                          {report.syncedToDb ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Database size={11} />
                              <span>En Base de Datos (Supabase)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
                              <Clock size={11} />
                              <span>Borrador Local</span>
                            </span>
                          )}

                          {successSavedId === report.informeNro && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white animate-bounce">
                              <Check size={11} />
                              <span>¡Guardado en BD Exitosamente!</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-slate-400" />
                            <strong>Período:</strong> {report.periodoDesde} al {report.periodoHasta}
                          </span>
                          <span>•</span>
                          <span><strong>Obligaciones:</strong> {report.obligaciones.length}</span>
                          <span>•</span>
                          <span><strong>Fotos:</strong> {report.anexos.length}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Fecha de Presentación: {report.fechaPresentacion} • Radicación: {report.secretariaNombre}
                        </p>

                        {/* Listado de Casillas Observadas por la Supervisión (Solo PENDIENTES) */}
                        {report.comentariosCampos && Object.entries(report.comentariosCampos).filter(([_, c]) => !(c as any).corregido).length > 0 && (
                          <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                              Casillas con observación pendiente:
                            </span>
                            {Object.entries(report.comentariosCampos)
                              .filter(([_, c]) => !(c as any).corregido)
                              .map(([key, comm]) => {
                                const c = comm as any;
                                const label = c.nombreCampo || c.fieldName || key;
                                return (
                                  <span 
                                    key={key} 
                                    className="text-[10.5px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 border bg-amber-50 text-amber-900 border-amber-300"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    {label}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        
                        {/* Botón Guardar en Base de Datos */}
                        {!report.syncedToDb && (
                          <button
                            onClick={() => handleSaveToDatabase(report)}
                            disabled={savingReportId === report.informeNro}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                            title="Guardar este informe y sus obligaciones directamente en Supabase"
                          >
                            <Database size={14} />
                            <span>{savingReportId === report.informeNro ? 'Guardando...' : 'Guardar en BD'}</span>
                          </button>
                        )}

                        {/* 1. Botón Editar / Consultar según el estado */}
                        {(() => {
                          const comms = Object.values(report.comentariosCampos || {});
                          const hasPendingObs = report.estado !== 'Aprobado' && (
                            (comms.length > 0 && comms.some((c: any) => !c.corregido)) ||
                            (comms.length === 0 && report.estado === 'Devuelto')
                          );

                          return (
                            <button
                              onClick={() => handleInterceptOpenReport(report)}
                              className={`px-3.5 py-2 rounded-xl border font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs ${
                                report.estado === 'Aprobado'
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : hasPendingObs
                                  ? 'bg-amber-500 hover:bg-amber-600 text-amber-950 border-amber-600 font-extrabold shadow-sm'
                                  : report.estado === 'Enviado'
                                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-[#006b33] border-emerald-300'
                              }`}
                              title={
                                report.estado === 'Aprobado'
                                  ? 'Consultar informe aprobado'
                                  : hasPendingObs
                                  ? 'Abrir editor para corregir observaciones de la supervisora'
                                  : report.estado === 'Enviado'
                                  ? 'Ver o modificar informe radicado'
                                  : 'Diligenciar informe y obligaciones'
                              }
                            >
                              <FileEdit size={14} />
                              <span>
                                {report.estado === 'Aprobado'
                                  ? 'Consultar Aprobado'
                                  : hasPendingObs
                                  ? '⚠️ Corregir Observaciones'
                                  : report.estado === 'Enviado'
                                  ? 'Ver / Editar Radicado'
                                  : 'Editar / Diligenciar'}
                              </span>
                            </button>
                          );
                        })()}



                        {/* 3. Botón Radicar (Solo para borradores iniciales) */}
                        {report.estado === 'Borrador' && (
                          <button
                            onClick={() => handleSendToReview(report)}
                            className="px-3.5 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors bg-[#006b33] hover:bg-[#005729] text-white"
                            title="Radicar oficialmente para revisión de la supervisora"
                          >
                            <Send size={14} />
                            <span>Radicar</span>
                          </button>
                        )}

                        {/* 4. Eliminar si es Borrador */}
                        {report.estado === 'Borrador' && (
                          <button
                            onClick={() => handleDeleteReport(report)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                            title="Eliminar de la lista y de la base de datos"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                      </div>
                    </div>
                  ))}
                </div>

                {/* Barra de Paginación */}
                {reportsList.length > 0 && (
                  <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                    <div>
                      Mostrando <span className="font-bold text-slate-900">{startIndex + 1}</span> a{' '}
                      <span className="font-bold text-slate-900">{endIndex}</span> de{' '}
                      <span className="font-bold text-slate-900">{reportsList.length}</span> informes
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={validCurrentPage === 1}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 transition-colors"
                      >
                        <ChevronLeft size={14} />
                        <span className="hidden sm:inline">Anterior</span>
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                            validCurrentPage === pageNum
                              ? 'bg-[#006b33] text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={validCurrentPage === totalPages}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white flex items-center gap-1 transition-colors"
                      >
                        <span className="hidden sm:inline">Siguiente</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

        </div>
      )}

      {/* VISTA DEL MÓDULO 2: CERTIFICADO DE SUPERVISIÓN */}
      {activeModuleTab === 'supervision' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck size={18} />
                  <span>Módulo de Certificación Contractual y Autorización de Desembolso</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Certificado de Cumplimiento & Autorización de Desembolso
                </h3>
                <p className="text-xs text-slate-500">
                  Documento oficial expedido por el Supervisor(a) del Contrato para radicar la cuenta de cobro ante Tesorería Municipal.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Vigencia 2026
                </span>
              </div>
            </div>

            {/* Selector de Informes radicados para generar / ver su certificado */}
            {reportsList.length > 0 && (
              <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs w-full sm:w-auto min-w-0">
                  <span className="font-bold text-slate-700 shrink-0">Seleccionar Informe para Certificado:</span>
                  <select
                    value={(selectedCertReport || reportsList[0])?.informeNro}
                    onChange={(e) => {
                      const found = reportsList.find(r => String(r.informeNro) === e.target.value);
                      if (found) setSelectedCertReport(found);
                    }}
                    className="w-full sm:w-auto max-w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none truncate"
                  >
                    {reportsList.map(r => (
                      <option key={r.id || r.informeNro} value={r.informeNro}>
                        Informe #{r.informeNro} ({r.tipoInforme}) - Estado: {r.estado || 'Enviado'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    (selectedCertReport || reportsList[0])?.estado === 'Aprobado'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    <CheckCircle2 size={13} />
                    <span>
                      {(selectedCertReport || reportsList[0])?.estado === 'Aprobado' 
                        ? 'Certificación Avalada por Supervisión' 
                        : 'En Trámite de Supervisión'}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTO OFICIAL CERTIFICADO DE SUPERVISIÓN */}
          <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center w-full max-w-full overflow-x-auto scrollbar-thin">
            <CertificadoSupervisionDoc
              reportData={selectedCertReport || reportsList[0] || initialMockData}
              storageKey={`cert_data_${user.documentoIdentidad || ''}_${(selectedCertReport || reportsList[0])?.informeNro || '1'}`}
              isEditable={true}
            />
          </div>
        </div>
      )}

      {/* VISTA DEL MÓDULO 3: SOPORTE FIDUCIARIA / PAGOS */}
      {activeModuleTab === 'fiduciaria' && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Tarjeta de Control del Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                  <Landmark size={18} />
                  <span>Gestión Fiduciaria y Tesorería</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Soporte Fiduciaria, Bancario y Seguridad Social
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Documento soporte en adquisiciones efectuadas a no obligados a facturar, validación de planilla PILA y radicación fiduciaria.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Vigencia 2026
                </span>
              </div>
            </div>

            {/* Selector de Informes radicados para generar / ver su soporte fiduciario */}
            {reportsList.length > 0 && (
              <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs w-full sm:w-auto min-w-0">
                  <span className="font-bold text-slate-700 shrink-0">Seleccionar Informe para Soporte:</span>
                  <select
                    value={(selectedFidReport || reportsList[0])?.informeNro}
                    onChange={(e) => {
                      const found = reportsList.find(r => String(r.informeNro) === e.target.value);
                      if (found) setSelectedFidReport(found);
                    }}
                    className="w-full sm:w-auto max-w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none truncate"
                  >
                    {reportsList.map(r => (
                      <option key={r.id || r.informeNro} value={r.informeNro}>
                        Informe #{r.informeNro} ({r.tipoInforme}) - Estado: {r.estado || 'Enviado'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    (selectedFidReport || reportsList[0])?.estado === 'Aprobado'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    <CheckCircle2 size={13} />
                    <span>
                      {(selectedFidReport || reportsList[0])?.estado === 'Aprobado' 
                        ? 'Soporte Avalado por Supervisión' 
                        : 'En Trámite de Supervisión'}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTO OFICIAL SOPORTE FIDUCIARIA */}
          <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center w-full max-w-full overflow-x-auto scrollbar-thin">
            <SoporteFiduciariaDoc
              reportData={selectedFidReport || reportsList[0] || initialMockData}
              storageKey={`fid_data_${user.documentoIdentidad || ''}_${(selectedFidReport || reportsList[0])?.informeNro || '1'}`}
              isEditable={true}
            />
          </div>

          {/* Bloque Guía Informativo Inferior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Landmark size={16} className="text-[#006b33]" />
                <span>Datos de Radicación Bancaria y Fiduciaria</span>
              </h4>
              <div className="space-y-2 text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Beneficiario:</span>
                  <span className="font-bold">{user.nombreCompleto}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Cédula de Ciudadanía:</span>
                  <span className="font-mono font-bold">{user.documentoIdentidad}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Entidad Bancaria:</span>
                  <span className="font-bold">Convenio Fiduciario / Alcaldía de Quibdó</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">RUT Institucional:</span>
                  <span className="font-mono text-emerald-800 font-bold">Activo Vigencia 2026</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileCheck size={16} className="text-[#006b33]" />
                <span>Planilla PILA y Seguridad Social</span>
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Verificación de pago oportuno de aportes a Salud, Pensión y ARL conforme al Decreto 1273 de 2018 para contratos de prestación de servicios.
              </p>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-800 font-mono text-[11px] font-bold">
                Estado PILA: Validado conforme al periodo contractual reportado.
              </div>
            </div>
          </div>

        </div>
      )}

            {/* VISTA DEL MÓDULO 4: DECLARACIÓN BAJO JURAMENTO */}
      {activeModuleTab === 'juramento' && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Tarjeta de Control del Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                  <Scale size={18} />
                  <span>Régimen de Contratación Pública</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Declaración Bajo la Gravedad de Juramento (Retención en la fuente)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Certificación para efectos de retención en la fuente ley 1819 de 2016 - Rentas de Trabajo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Vigencia 2026
                </span>
              </div>
            </div>

            {/* Selector de Informes radicados para generar / ver su declaracion */}
            {reportsList.length > 0 && (
              <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs w-full sm:w-auto min-w-0">
                  <span className="font-bold text-slate-700 shrink-0">Seleccionar Informe para Soporte:</span>
                  <select
                    value={(selectedJuramentoReport || reportsList[0])?.informeNro}
                    onChange={(e) => {
                      const found = reportsList.find(r => String(r.informeNro) === e.target.value);
                      if (found) setSelectedJuramentoReport(found);
                    }}
                    className="w-full sm:w-auto max-w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none truncate"
                  >
                    {reportsList.map(r => (
                      <option key={r.id || r.informeNro} value={r.informeNro}>
                        Informe #{r.informeNro} ({r.tipoInforme}) - Estado: {r.estado || 'Enviado'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(selectedJuramentoReport || reportsList[0])?.estado === 'Aprobado' 
                    ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                        <CheckCircle2 size={14} />
                        <span>Soporte Avalado por Supervisión</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
                        <AlertCircle size={14} />
                        <span>Requiere Aprobación Previa</span>
                      </div>
                    )
                  }
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTO OFICIAL DECLARACIÓN RENTA */}
          <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center w-full max-w-full overflow-x-auto scrollbar-thin">
            <DeclaracionRentaDoc
              reportData={selectedJuramentoReport || reportsList[0] || initialMockData}
              storageKey={`dec_renta_${user.documentoIdentidad || ''}_${(selectedJuramentoReport || reportsList[0])?.informeNro || '1'}`}
              isEditable={true}
            />
          </div>

        </div>
      )}

      {/* VISTA DEL MÓDULO 5: AUTORIZACIÓN DE DESEMBOLSO */}
      {activeModuleTab === 'desembolso' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Tarjeta de Control del Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                  <CreditCard size={18} />
                  <span>Trámite Financiero y Cuenta de Cobro</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Documento Equivalente a la Factura (Autorización de Desembolso)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Aplica para personas naturales no comerciantes NO RESPONSABLES DEL IMPUESTO A LAS VENTAS - Artículo 3 Decreto 522/2003.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Vigencia 2026
                </span>
              </div>
            </div>

            {/* Selector de Informes radicados para generar / ver su desembolso */}
            {reportsList.length > 0 && (
              <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs w-full sm:w-auto min-w-0">
                  <span className="font-bold text-slate-700 shrink-0">Seleccionar Informe para Desembolso:</span>
                  <select
                    value={(selectedDesembolsoReport || reportsList[0])?.informeNro}
                    onChange={(e) => {
                      const found = reportsList.find(r => String(r.informeNro) === e.target.value);
                      if (found) setSelectedDesembolsoReport(found);
                    }}
                    className="w-full sm:w-auto max-w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none truncate"
                  >
                    {reportsList.map(r => (
                      <option key={r.id || r.informeNro} value={r.informeNro}>
                        Informe #{r.informeNro} ({r.tipoInforme}) - Estado: {r.estado || 'Enviado'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(selectedDesembolsoReport || reportsList[0])?.estado === 'Aprobado' 
                    ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                        <CheckCircle2 size={14} />
                        <span>Soporte Avalado por Supervisión</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
                        <AlertCircle size={14} />
                        <span>Requiere Aprobación Previa</span>
                      </div>
                    )
                  }
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTO OFICIAL AUTORIZACION DESEMBOLSO */}
          <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center w-full max-w-full overflow-x-auto scrollbar-thin">
            <AutorizacionDesembolsoDoc
              reportData={selectedDesembolsoReport || reportsList[0] || initialMockData}
              storageKey={`desembolso_${user.documentoIdentidad || ''}_${(selectedDesembolsoReport || reportsList[0])?.informeNro || '1'}`}
              isEditable={true}
            />
          </div>
        </div>
      )}

      {/* Modal para Crear Nuevo Informe */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className={`bg-white rounded-2xl shadow-2xl ${reportsList.length === 0 ? 'max-w-3xl' : 'max-w-md'} w-full border border-slate-200 animate-in fade-in zoom-in-95 my-auto max-h-[90vh] flex flex-col my-3 sm:my-8`}>
            
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 text-[#006b33]">
                <Plus size={20} />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {reportsList.length === 0 ? 'Crear Primer Informe de Ejecución' : 'Crear Nuevo Informe'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewReport} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              
              {reportsList.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <p className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600 shrink-0" />
                    <span>Configuración Inicial (Primer Informe de Ejecución)</span>
                  </p>
                  <p className="text-amber-900 text-[11px]">
                    Al ser tu <strong>primer informe</strong> en el sistema, es obligatorio diligenciar los datos contractuales base y del período. Los informes subsecuentes heredarán automáticamente esta información.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="font-bold text-emerald-950">Generación con Base en Contrato #{user.contratoNro || reportsList[0]?.contratoNro || '015'}:</p>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    El nuevo informe heredará automáticamente los datos contractuales de tu último informe guardado en Supabase.
                  </p>
                </div>
              )}

              {/* SECCIÓN 1: PERÍODO E IDENTIFICACIÓN */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1 flex items-center gap-1 text-[#006b33]">
                  <Calendar size={13} />
                  <span>Datos del Período de Ejecución</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Número de Informe *</label>
                    <input
                      type="text"
                      required
                      value={newInformeNro}
                      onChange={(e) => setNewInformeNro(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipo de Informe *</label>
                    <select
                      value={newTipoInforme}
                      onChange={(e) => setNewTipoInforme(e.target.value as any)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                    >
                      <option value="Mensual">Mensual</option>
                      <option value="Final font-medium">Final</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                      <Calendar size={13} className="text-[#006b33]" />
                      <span>Período Desde *</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newPeriodoDesde}
                      onChange={(e) => setNewPeriodoDesde(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-800 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5 text-xs">
                      <Calendar size={13} className="text-[#006b33]" />
                      <span>Período Hasta *</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newPeriodoHasta}
                      onChange={(e) => setNewPeriodoHasta(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-800 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: DATOS BASE DEL CONTRATO (SOLO SI ES EL PRIMER INFORME) */}
              {reportsList.length === 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1 flex items-center gap-1 text-[#006b33]">
                    <FileText size={13} />
                    <span>Datos Base del Contrato (Obligatorio para el Primer Informe)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Número de Contrato *</label>
                      <input
                        type="text"
                        required
                        value={newContratoNro}
                        onChange={(e) => setNewContratoNro(e.target.value)}
                        placeholder="Ej. 015 de 2026"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Valor Total Contrato *</label>
                      <input
                        type="text"
                        required
                        value={newValorContrato}
                        onChange={(e) => setNewValorContrato(e.target.value)}
                        onBlur={() => {
                          if (newValorContrato) setNewValorContrato(formatColombianCurrency(newValorContrato));
                        }}
                        placeholder="Ej. $ 20.029.800"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Honorario Mensual *</label>
                      <input
                        type="text"
                        required
                        value={newValorMensual}
                        onChange={(e) => setNewValorMensual(e.target.value)}
                        onBlur={() => {
                          if (newValorMensual) setNewValorMensual(formatColombianCurrency(newValorMensual));
                        }}
                        placeholder="Ej. $ 3.338.300"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none text-emerald-800 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Objeto del Contrato *</label>
                    <textarea
                      required
                      rows={2}
                      value={newObjeto}
                      onChange={(e) => setNewObjeto(e.target.value)}
                      placeholder="Ingrese el objeto exacto del contrato..."
                      className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">CDP Nro *</label>
                      <input
                        type="text"
                        required
                        value={newCdpNro}
                        onChange={(e) => setNewCdpNro(e.target.value)}
                        placeholder="Ej. 356"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">CRP Nro *</label>
                      <input
                        type="text"
                        required
                        value={newCrpNro}
                        onChange={(e) => setNewCrpNro(e.target.value)}
                        placeholder="Ej. 123"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Plazo Contrato *</label>
                      <input
                        type="text"
                        required
                        value={newPlazo}
                        onChange={(e) => setNewPlazo(e.target.value)}
                        placeholder="Ej. 6 MESES"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Póliza Nro *</label>
                      <input
                        type="text"
                        required
                        value={newPolizaNro}
                        onChange={(e) => setNewPolizaNro(e.target.value)}
                        placeholder="Ej. N/A"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fecha Inicio Contrato *</label>
                      <input
                        type="date"
                        required
                        value={newFechaInicio}
                        onChange={(e) => setNewFechaInicio(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fecha Terminación *</label>
                      <input
                        type="date"
                        required
                        value={newFechaTerminacion}
                        onChange={(e) => setNewFechaTerminacion(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fecha Acta de Aprobación Póliza: *</label>
                      <input
                        type="text"
                        required
                        value={newFechaPoliza}
                        onChange={(e) => setNewFechaPoliza(e.target.value)}
                        placeholder="Ej. N/A o 14/01/2026"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Supervisor *</label>
                    <input
                      type="text"
                      required
                      value={newSupervisorNombre}
                      onChange={(e) => setNewSupervisorNombre(e.target.value)}
                      placeholder="Ej. DIANA ANDREA MOSQUERA GARCIA"
                      className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Secretaría u Ordenador *</label>
                      <input
                        type="text"
                        required
                        value={newSecretariaNombre}
                        onChange={(e) => setNewSecretariaNombre(e.target.value)}
                        placeholder="Ej. Secretaría de Inclusión y Cohesión Social"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Código Secretaría *</label>
                      <input
                        type="text"
                        required
                        value={newSecretariaCodigo}
                        onChange={(e) => setNewSecretariaCodigo(e.target.value)}
                        placeholder="Ej. 170"
                        className="w-full border border-slate-300 rounded-xl p-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="sticky -bottom-5 bg-white pt-3 pb-2 border-t border-slate-200 flex justify-end gap-2 shrink-0 z-10 -mx-4 -mb-4 px-4 sm:-mx-5 sm:-mb-5 sm:px-5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingReport}
                  className="px-4 py-2 bg-[#006b33] hover:bg-[#005729] disabled:opacity-50 text-white rounded-xl font-bold shadow-xs flex items-center gap-2"
                >
                  {isCreatingReport ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <span>Crear e Iniciar Diligenciamiento</span>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL DE VALIDACIÓN ESTRICTA DE RADICACIÓN */}
      {validationModal && (
        <ValidationAlertModal
          isOpen={validationModal.isOpen}
          onClose={() => setValidationModal(null)}
          errors={validationModal.errors}
          reportNro={validationModal.reportNro}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR INFORME */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Eliminar Informe</h3>
                <p className="text-xs text-slate-500">Informe Nro. {reportToDelete.informeNro} ({reportToDelete.tipoInforme})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar este informe de la base de datos y de tu lista? Esta acción es irreversible.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteReport}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 size={14} />
                Sí, Eliminar de la Base de Datos
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
