import React, { useState, useEffect } from 'react';
import { AuthUser, InformeSummary, EstadoInforme, ReportData, FieldComment, createDefaultCertificadoData, CertificadoSupervisionData } from '../types';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { formatFechaAplicacion, formatDateSlash } from '../utils/formatters';
import CertificadoSupervisionDoc from './CertificadoSupervisionDoc';
import SoporteFiduciariaDoc from './SoporteFiduciariaDoc';
import DeclaracionRentaDoc from './DeclaracionRentaDoc';
import AutorizacionDesembolsoDoc from './AutorizacionDesembolsoDoc';
import ReportPreview from './ReportPreview';
import CertificadoSupervisionModal from './CertificadoSupervisionModal';
import WhatsAppNotifyModal from './WhatsAppNotifyModal';
import { WhatsAppNotificationPayload } from '../utils/whatsappNotifier';
import { 
  Building2, 
  Users, 
  FileCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Eye, 
  EyeOff,
  Search, 
  Filter,
  DollarSign,
  ArrowUpRight,
  Download,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  FileText,
  UserCheck,
  UserPlus,
  KeyRound,
  Mail,
  Phone,
  Calendar,
  FileBadge,
  Copy,
  Check,
  Trash2,
  Edit,
  Shield,
  ShieldCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Landmark,
  Scale,
  CreditCard
} from 'lucide-react';

interface Props {
  user: AuthUser;
  onSelectInformeToView: (informe: InformeSummary) => void;
  onPrintInforme: (informe: InformeSummary) => void;
}

export default function SecretariaAdminView({ user, onSelectInformeToView, onPrintInforme }: Props) {
  const [activeTab, setActiveTab] = useState<'informes' | 'contratistas'>('informes');
  
  // Informes State
  const [informes, setInformes] = useState<InformeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [inspectingInforme, setInspectingInforme] = useState<ReportData | null>(null);
  const [adminModuleTab, setAdminModuleTab] = useState<'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso'>('informe');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Contratistas State
  const [contractors, setContractors] = useState<AuthUser[]>([]);
  const [showAddContractorModal, setShowAddContractorModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState<AuthUser | null>(null);
  const [contractorToDelete, setContractorToDelete] = useState<AuthUser | null>(null);
  const [selectedContractorForReports, setSelectedContractorForReports] = useState<AuthUser | null>(null);

  // Certificado de Supervisión Modal State
  const [selectedCertReportData, setSelectedCertReportData] = useState<ReportData | null>(null);
  const [selectedCertData, setSelectedCertData] = useState<CertificadoSupervisionData | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);

  // WhatsApp Notification State
  const [whatsappPayload, setWhatsappPayload] = useState<WhatsAppNotificationPayload | null>(null);

  const handleOpenWhatsAppModal = (
    item: InformeSummary | ReportData | AuthUser,
    forcedTipo?: 'aprobado' | 'devuelto' | 'recordatorio'
  ) => {
    let contratistaNombre = '';
    let contratistaDocumento = '';
    let contratistaTelefono = '';
    let informeNro = '1';
    let contratoNro = 'Por registrar';
    let periodoDesde = '';
    let periodoHasta = '';
    let comentariosCampos: Record<string, FieldComment> | undefined = undefined;
    let estado = 'Enviado';

    // Si es ReportData (ej. inspectingInforme)
    if ('obligaciones' in item) {
      contratistaNombre = item.contratistaNombre || '';
      contratistaDocumento = item.contratistaDocumento || '';
      contratistaTelefono = item.contratistaTelefono || '';
      informeNro = item.informeNro || '1';
      contratoNro = item.contratoNro || 'Por registrar';
      periodoDesde = item.periodoDesde || '';
      periodoHasta = item.periodoHasta || '';
      comentariosCampos = item.comentariosCampos;
      estado = item.estado || 'Enviado';
    } 
    // Si es InformeSummary (de la tabla de informes)
    else if ('informe_nro' in item) {
      contratistaNombre = item.contratista_nombre || '';
      contratistaDocumento = item.contratista_documento || '';
      informeNro = String(item.informe_nro || '1');
      contratoNro = item.contrato_nro || 'Por registrar';
      periodoDesde = item.periodo_desde || '';
      periodoHasta = item.periodo_hasta || '';
      comentariosCampos = item.comentariosCampos;
      estado = item.estado || 'Enviado';
    } 
    // Si es AuthUser (de la lista de contratistas)
    else {
      contratistaNombre = item.nombreCompleto || '';
      contratistaDocumento = item.documentoIdentidad || '';
      contratistaTelefono = item.telefono || '';
      contratoNro = item.contratoNro || 'Por registrar';
      estado = 'Enviado';
    }

    // Buscar teléfono si no está en el informe
    if (!contratistaTelefono && contratistaDocumento) {
      const found = contractors.find(c => c.documentoIdentidad === contratistaDocumento);
      if (found?.telefono) {
        contratistaTelefono = found.telefono;
      }
    }

    let tipo: 'aprobado' | 'devuelto' | 'recordatorio' = 'recordatorio';
    if (forcedTipo) {
      tipo = forcedTipo;
    } else if (estado === 'Aprobado') {
      tipo = 'aprobado';
    } else if (estado === 'Devuelto' || (comentariosCampos && Object.keys(comentariosCampos).length > 0)) {
      tipo = 'devuelto';
    }

    setWhatsappPayload({
      tipo,
      contratistaNombre,
      contratistaDocumento,
      contratistaTelefono,
      informeNro,
      contratoNro,
      periodoDesde,
      periodoHasta,
      supervisorNombre: user.nombreCompleto || 'Supervisora Municipal',
      secretariaNombre: user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social',
      comentariosCampos,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined
    });
  };

  const handleUpdatePhoneFromWhatsApp = async (newPhone: string) => {
    if (!whatsappPayload?.contratistaDocumento) return;
    const target = contractors.find(c => c.documentoIdentidad === whatsappPayload.contratistaDocumento);
    if (target?.id) {
      await supabaseService.updateContractor(target.id, { telefono: newPhone });
      const updated = await supabaseService.getContractors(user.secretariaId);
      setContractors(updated);
    }
  };

  const handleOpenCertModal = async (item: InformeSummary) => {
    let repData: ReportData | null = null;
    if (item.id) {
      repData = await supabaseService.getReportById(item.id);
    }
    if (!repData) {
      const userDocKey = item.contratista_documento ? `_${item.contratista_documento}` : '';
      const saved = localStorage.getItem(`informe_data${userDocKey}_${item.informe_nro}`) ||
                    localStorage.getItem(`informe_data_${item.informe_nro}`);
      if (saved) {
        try {
          repData = JSON.parse(saved);
        } catch (e) {}
      }
    }
    if (!repData) {
      repData = {
        id: item.id,
        contratoId: item.contrato_id,
        secretariaId: user.secretariaId,
        secretariaNombre: item.secretaria_nombre || user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social',
        secretariaCodigo: user.secretariaCodigo || '170',
        secretariaNit: '891680011-0',
        fechaAplicacion: formatFechaAplicacion(item.periodo_hasta, item.periodo_desde),
        tipoInforme: item.tipo_informe || 'Mensual',
        informeNro: item.informe_nro.toString(),
        fechaPresentacion: item.fecha_presentacion || new Date().toLocaleDateString('es-CO'),
        periodoDesde: item.periodo_desde || '01/07/2026',
        periodoHasta: item.periodo_hasta || '14/07/2026',
        contratistaNombre: item.contratista_nombre || 'HAMINTON MENA MENA',
        contratistaDocumento: item.contratista_documento || '80.772.379',
        contratistaCorreo: '',
        contratistaTelefono: '',
        supervisorNombre: user.nombreCompleto || 'Diana Andrea Mosquera Garcia',
        supervisorDocumento: user.documentoIdentidad || '35.602.521',
        apoyoSupervisionNombre: 'N/A',
        apoyoSupervisionDocumento: 'N/A',
        valorContrato: '$ 20.029.800,00',
        valorAdicion: '$ N/A',
        contratoNro: item.contrato_nro || '025',
        objeto: 'PRESTAR LOS SERVICIOS PROFESIONALES EN EL AREA DE SISTEMAS PARA ADELANTAR, ACOMPAÑAR Y DESARROLLAR LAS ACCIONES QUE SE LLEVAN ACABO EN LA SECRETARIA DE INCLUSIÓN Y COHESIÓN SOCIAL DEL MUNICIPIO DE QUIBDÓ PARA LA POBLACIÓN MIGRANTE.',
        cdpNro: '137',
        crpNro: '191',
        polizaNro: 'N/A',
        fechaPoliza: 'N/A',
        plazo: '6 MESES',
        fechaInicio: formatDateSlash(item.periodo_desde) || '15/01/2026',
        fechaTerminacion: formatDateSlash(item.periodo_hasta) || '14/07/2026',
        modificaciones: 'N/A',
        obligaciones: [],
        observaciones: '',
        anexos: [],
        valorPagar: 'UN MILLON QUINIENTOS CINCUENTA Y SIETE MIL OCHOCIENTOS SETENTA Y TRES PESOS M/CTE ($1.557.873)',
        estado: item.estado,
      };
    }
    
    // Cargar certificado guardado desde Supabase o localStorage
    const savedCert = await supabaseService.getCertificadoSupervision(item.id, item.contratista_documento, item.informe_nro.toString());
    setSelectedCertData(savedCert);
    setSelectedCertReportData(repData);
    setShowCertModal(true);
  };
  const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form New Contractor (Solo datos de usuario y credenciales)
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCedula, setNuevaCedula] = useState('');
  const [nuevoCorreo, setNuevoCorreo] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('Contratista2026*');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoCargo, setNuevoCargo] = useState('Contratista de Prestación de Servicios');

  // Form Edit Contractor
  const [editNombre, setEditNombre] = useState('');
  const [editCedula, setEditCedula] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editCargo, setEditCargo] = useState('');

  const loadData = async () => {
    setLoading(true);
    const infs = await supabaseService.getInformes(user.secretariaId);
    // Filtrar estrictamente: Los borradores son privados del contratista hasta que son radicados
    const officialInfs = infs.filter(i => i.estado !== 'Borrador');
    setInformes(officialInfs);
    const conts = await supabaseService.getContractors(user.secretariaId);
    setContractors(conts);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // 1. Escuchar evento personalizado en tiempo real cuando el contratista radica o reenvía
    const handleRadicadoEvent = () => {
      loadData();
    };
    window.addEventListener('informe_radicado_event', handleRadicadoEvent);

    // 2. Suscripción Supabase Realtime a cambios en informes_mensuales
    const channel = supabase
      .channel('public:informes_mensuales_admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'informes_mensuales' },
        () => {
          loadData();
        }
      )
      .subscribe();

    // 3. Polling de respaldo en segundo plano (cada 4 segundos)
    const pollInterval = setInterval(() => {
      loadData();
    }, 4000);

    return () => {
      window.removeEventListener('informe_radicado_event', handleRadicadoEvent);
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [user.secretariaId]);

  const handleCreateContractorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre || !nuevaCedula || !nuevoCorreo || !nuevaPassword) return;

    setLoading(true);
    const result = await supabaseService.createContractor({
      nombreCompleto: nuevoNombre,
      documentoIdentidad: nuevaCedula,
      email: nuevoCorreo,
      password: nuevaPassword,
      telefono: nuevoTelefono,
      cargo: nuevoCargo || 'Contratista de Prestación de Servicios',
      contratoNro: '',
      secretariaId: user.secretariaId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      secretariaNombre: user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social',
      secretariaCodigo: user.secretariaCodigo || '170',
      supervisorNombre: user.nombreCompleto,
      supervisorDocumento: user.documentoIdentidad,
    });

    if (result.success) {
      const updated = await supabaseService.getContractors(user.secretariaId);
      setContractors(updated);
      setShowAddContractorModal(false);
      // Reset form
      setNuevoNombre('');
      setNuevaCedula('');
      setNuevoCorreo('');
      setNuevaPassword('Contratista2026*');
      setNuevoTelefono('');
      setNuevoCargo('Contratista de Prestación de Servicios');
    }
    setLoading(false);
  };

  const handleOpenEditModal = (c: AuthUser) => {
    setEditingContractor(c);
    setEditNombre(c.nombreCompleto || '');
    setEditCedula(c.documentoIdentidad || '');
    setEditCorreo(c.email || '');
    setEditPassword(c.password || 'Contratista2026*');
    setEditTelefono(c.telefono || '');
    setEditCargo(c.cargo || 'Contratista de Prestación de Servicios');
  };

  const handleUpdateContractorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContractor || !editNombre || !editCedula || !editCorreo) return;

    setLoading(true);
    await supabaseService.updateContractor(editingContractor.id, {
      nombreCompleto: editNombre,
      documentoIdentidad: editCedula,
      email: editCorreo,
      password: editPassword,
      telefono: editTelefono,
      cargo: editCargo,
    });

    const updated = await supabaseService.getContractors(user.secretariaId);
    setContractors(updated);
    setEditingContractor(null);
    setLoading(false);
  };

  const handleDeleteContractor = async (contractor: AuthUser) => {
    setContractorToDelete(contractor);
  };

  const confirmDeleteContractor = async () => {
    if (!contractorToDelete) return;
    setLoading(true);
    const id = contractorToDelete.id;
    setContractorToDelete(null);
    await supabaseService.deleteContractor(id);
    const updated = await supabaseService.getContractors(user.secretariaId);
    setContractors(updated);
    setLoading(false);
  };

  const handleCopyCredentials = (c: AuthUser) => {
    const credText = `🏛️ ALCALDÍA DE QUIBDÓ - CREDENCIALES DE ACCESO
Contratista: ${c.nombreCompleto}
Cédula: ${c.documentoIdentidad}
Secretaría: ${c.secretariaNombre || user.secretariaNombre}
Contrato: ${c.contratoNro ? '#' + c.contratoNro : 'A registrar por el contratista'}

🔐 Usuario / Correo: ${c.email}
🔑 Contraseña: ${c.password || 'Contratista2026*'}`;

    navigator.clipboard.writeText(credText);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateStatus = async (id: string, newStatus: EstadoInforme) => {
    await supabaseService.updateEstado(id, newStatus);
    
    // Si se aprueba el informe, limpiar las observaciones de la base de datos
    if (newStatus === 'Aprobado' && inspectingInforme) {
      await supabaseService.saveReportComments(
        inspectingInforme.id || id,
        inspectingInforme.informeNro,
        inspectingInforme.contratistaDocumento || '',
        {},
        'Aprobado'
      );
    }

    setInformes(prev => prev.map(inf => inf.id === id ? { ...inf, estado: newStatus, comentariosCampos: newStatus === 'Aprobado' ? {} : inf.comentariosCampos } : inf));
    if (inspectingInforme) {
      setInspectingInforme({ 
        ...inspectingInforme, 
        estado: newStatus,
        comentariosCampos: newStatus === 'Aprobado' ? {} : inspectingInforme.comentariosCampos 
      });
      // Sincronizar en almacenamiento local para reflejo inmediato en el panel del contratista
      const userDocKey = inspectingInforme.contratistaDocumento ? `_${inspectingInforme.contratistaDocumento}` : '';
      const localKey = `informe_data${userDocKey}_${inspectingInforme.informeNro}`;
      const saved = localStorage.getItem(localKey) || localStorage.getItem(`informe_data_${inspectingInforme.informeNro}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.estado = newStatus;
          if (newStatus === 'Aprobado') {
            parsed.comentariosCampos = {};
          }
          localStorage.setItem(localKey, JSON.stringify(parsed));
          localStorage.setItem(`informe_data_${inspectingInforme.informeNro}`, JSON.stringify(parsed));
        } catch (e) {}
      }
    }
  };

  const handleSaveComment = async (fieldId: string, fieldName: string, comentario: string) => {
    if (!inspectingInforme) return;
    const nowFormatted = new Date().toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const updatedComments = {
      ...(inspectingInforme.comentariosCampos || {}),
      [fieldId]: {
        campoId: fieldId,
        nombreCampo: fieldName,
        comentario: comentario.trim(),
        autor: user.nombreCompleto || 'Supervisora / Administradora',
        fecha: nowFormatted
      }
    };

    const updatedInforme: ReportData = {
      ...inspectingInforme,
      comentariosCampos: updatedComments,
      estado: 'Devuelto'
    };

    setInspectingInforme(updatedInforme);

    // Guardar en Supabase / LocalStorage
    await supabaseService.saveReportComments(
      inspectingInforme.id || '',
      inspectingInforme.informeNro,
      inspectingInforme.contratistaDocumento || '',
      updatedComments,
      'Devuelto'
    );

    // Actualizar lista en estado local
    setInformes(prev => prev.map(inf => 
      inf.id === inspectingInforme.id || 
      (inf.contratista_documento === inspectingInforme.contratistaDocumento && String(inf.informe_nro) === String(inspectingInforme.informeNro))
        ? { ...inf, estado: 'Devuelto' }
        : inf
    ));
  };

  const handleDeleteComment = async (fieldId: string) => {
    if (!inspectingInforme || !inspectingInforme.comentariosCampos) return;
    const updatedComments = { ...inspectingInforme.comentariosCampos };

    // Eliminar clave exacta
    const targetComm = updatedComments[fieldId];
    const targetName = (targetComm?.nombreCampo || targetComm?.fieldName || '').toLowerCase();
    delete updatedComments[fieldId];

    // Eliminar claves alias o duplicados que pertenezcan al mismo campo u obligación
    Object.keys(updatedComments).forEach(key => {
      const comm = updatedComments[key];
      const fn = (comm?.nombreCampo || comm?.fieldName || '').toLowerCase();

      const isExactMatch = key === fieldId || (comm && comm.campoId === fieldId);
      const isNameMatch = Boolean(targetName && fn && targetName === fn);

      // Si es un campo de obligación, buscar por coincidencia de número y subcampo
      let isObligationMatch = false;
      if (fieldId.includes('obligacion_') || key.includes('obligacion_')) {
        let subfield = '';
        if (fieldId.includes('actividades') || key.includes('actividades')) subfield = 'actividades';
        else if (fieldId.includes('descripcion') || key.includes('descripcion')) subfield = 'descripcion';
        else if (fieldId.includes('soportes') || key.includes('soportes')) subfield = 'soportes';

        const matchNum1 = fieldId.match(/(\d+)/) || targetName.match(/(\d+)/);
        const matchNum2 = key.match(/(\d+)/) || fn.match(/(\d+)/);

        if (subfield && matchNum1 && matchNum2 && matchNum1[1] === matchNum2[1]) {
          if (
            (fieldId.includes(subfield) || targetName.includes(subfield)) &&
            (key.includes(subfield) || fn.includes(subfield))
          ) {
            isObligationMatch = true;
          }
        }
      }

      if (isExactMatch || isNameMatch || isObligationMatch) {
        delete updatedComments[key];
      }
    });

    const hasRemainingComments = Object.keys(updatedComments).length > 0;
    const newStatus: EstadoInforme = hasRemainingComments ? 'Devuelto' : 'Enviado';

    const updatedInforme: ReportData = {
      ...inspectingInforme,
      comentariosCampos: updatedComments,
      estado: newStatus
    };

    setInspectingInforme(updatedInforme);

    await supabaseService.saveReportComments(
      inspectingInforme.id || '',
      inspectingInforme.informeNro,
      inspectingInforme.contratistaDocumento || '',
      updatedComments,
      newStatus
    );

    setInformes(prev => prev.map(inf => 
      inf.id === inspectingInforme.id || 
      (inf.contratista_documento === inspectingInforme.contratistaDocumento && String(inf.informe_nro) === String(inspectingInforme.informeNro))
        ? { ...inf, estado: newStatus, comentariosCampos: updatedComments }
        : inf
    ));
  };

  const handleOpenInspectModal = async (item: InformeSummary) => {
    if (item.estado === 'Borrador') return; // Protección: Los borradores no radicados no son inspeccionables por la supervisora
    setAdminModuleTab('informe');

    // 1. Intentar cargar desde Supabase si tiene un ID válido
    if (item.id) {
      const fullReport = await supabaseService.getReportById(item.id);
      if (fullReport && fullReport.estado !== 'Borrador') {
        setInspectingInforme(fullReport);
        return;
      }
    }

    // 2. Intentar buscar en almacenamiento local del informe específico (Solo si ya fue radicado/enviado)
    const userDocKey = item.contratista_documento ? `_${item.contratista_documento}` : '';
    const saved = localStorage.getItem(`informe_data${userDocKey}_${item.informe_nro}`) ||
                  localStorage.getItem(`informe_data_${item.informe_nro}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.estado && parsed.estado !== 'Borrador') {
          setInspectingInforme(parsed);
          return;
        }
      } catch (e) {}
    }

    // 3. Si no existe en BD completa ni en local, armar objeto dinámico con datos reales de la fila
    setInspectingInforme({
      id: item.id,
      contratoId: item.contrato_id,
      secretariaId: user.secretariaId,
      secretariaNombre: item.secretaria_nombre || user.secretariaNombre || 'Secretaría Municipal',
      secretariaCodigo: user.secretariaCodigo || '170',
      secretariaNit: '891680011-0',
      fechaAplicacion: formatFechaAplicacion(item.periodo_hasta, item.periodo_desde),
      tipoInforme: item.tipo_informe || 'Mensual',
      informeNro: item.informe_nro.toString(),
      fechaPresentacion: item.fecha_presentacion || new Date().toLocaleDateString('es-CO'),
      periodoDesde: item.periodo_desde || '',
      periodoHasta: item.periodo_hasta || '',
      contratistaNombre: item.contratista_nombre,
      contratistaDocumento: item.contratista_documento,
      contratistaCorreo: '',
      contratistaTelefono: '',
      supervisorNombre: user.nombreCompleto || 'SUPERVISOR(A) MUNICIPAL',
      supervisorDocumento: user.documentoIdentidad || '',
      apoyoSupervisionNombre: 'N/A',
      apoyoSupervisionDocumento: 'N/A',
      valorContrato: '$ N/A',
      valorAdicion: '$ N/A',
      contratoNro: item.contrato_nro,
      objeto: 'Prestación de servicios profesionales y de apoyo a la gestión',
      cdpNro: 'N/A',
      crpNro: 'N/A',
      polizaNro: 'N/A',
      fechaPoliza: 'N/A',
      plazo: 'N/A',
      fechaInicio: formatDateSlash(item.periodo_desde) || '',
      fechaTerminacion: formatDateSlash(item.periodo_hasta) || '',
      modificaciones: 'N/A',
      observaciones: 'Informe en proceso de revisión y supervisión institucional.',
      obligaciones: [],
      anexos: [],
      valorPagar: '$ N/A',
      estado: item.estado,
      syncedToDb: true,
    });
  };

  const filteredInformes = informes.filter(inf => {
    if (inf.estado === 'Borrador') return false; // Borradores en edición no aparecen hasta ser radicados
    const matchesSearch = 
      inf.contratista_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.contrato_nro.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.informe_nro.toString().includes(searchTerm);
    
    const matchesStatus = statusFilter === 'todos' || inf.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAprobados = informes.filter(i => i.estado === 'Aprobado').length;
  const totalDevueltos = informes.filter(i => i.estado === 'Devuelto').length;
  const totalPendientes = informes.filter(i => i.estado === 'Enviado').length;

  // Paginación de Informes
  const totalPages = Math.ceil(filteredInformes.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredInformes.length);
  const paginatedInformes = filteredInformes.slice(startIndex, startIndex + pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Encabezado Seccional de la Secretaría */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 size={16} />
            <span>Panel de Supervisión y Aprobación • Dependencia Asignada</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900">
            {user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social'}
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            Supervisor(a): <strong className="text-gray-900">{user.nombreCompleto}</strong> (C.C. {user.documentoIdentidad}) • {user.cargo || 'Secretaria de Despacho'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-right">
            <p className="text-[10px] font-semibold text-emerald-800 uppercase">Código Dependencia</p>
            <p className="text-lg font-bold text-emerald-950 font-mono">{user.secretariaCodigo || '170'}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-right">
            <p className="text-[10px] font-semibold text-gray-600 uppercase">NIT Institucional</p>
            <p className="text-xs font-bold text-gray-800 font-mono">891680011-0</p>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas Principales */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 rounded-xl shadow-xs">
        <div className="flex space-x-1 sm:space-x-3 overflow-x-auto">
          
          <button
            onClick={() => setActiveTab('informes')}
            className={`py-3.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'informes'
                ? 'border-[#006b33] text-[#006b33] bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileCheck size={17} />
            <span>1. Informes y Supervisión</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
              {informes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('contratistas')}
            className={`py-3.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'contratistas'
                ? 'border-[#006b33] text-[#006b33] bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users size={17} />
            <span>2. Directorio de Contratistas</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
              {contractors.length}
            </span>
          </button>

        </div>

        {activeTab === 'contratistas' && (
          <button
            onClick={() => setShowAddContractorModal(true)}
            className="px-3.5 py-2 bg-[#006b33] hover:bg-[#005729] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <UserPlus size={15} />
            <span className="hidden sm:inline">Vincular Nuevo Contratista</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        )}
      </div>

      {/* PESTAÑA 1: INFORMES Y SUPERVISIÓN */}
      {activeTab === 'informes' && (
        <div className="space-y-6">
          {/* Tarjetas de Métricas de la Secretaría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase">Informes Radicados</span>
                <FileCheck size={18} className="text-emerald-700" />
              </div>
              <p className="text-2xl font-black text-gray-900">{informes.length}</p>
              <p className="text-xs text-gray-500 mt-1">Vigencia fiscal 2026</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase">Informes Aprobados</span>
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700">{totalAprobados}</p>
              <p className="text-xs text-emerald-600 mt-1">Listos para certificación de pago</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase">Devueltos (Con Observaciones)</span>
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-700">{totalDevueltos}</p>
              <p className="text-xs text-amber-600 mt-1">En corrección por contratistas</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-xs font-semibold uppercase">Pendientes de Revisión</span>
                <Clock size={18} className="text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-700">{totalPendientes}</p>
              <p className="text-xs text-blue-600 mt-1">Por verificar por supervisión</p>
            </div>

          </div>

          {/* Barra de Búsqueda y Filtros */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por contratista, cédula o contrato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={15} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-700">Filtrar Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="todos">Todos los radicados</option>
                <option value="Enviado">Enviados (Para revisión)</option>
                <option value="Devuelto">Devueltos (Con observaciones)</option>
                <option value="Aprobado">Aprobados</option>
                <option value="Rechazado">Rechazados</option>
              </select>
            </div>
          </div>

          {/* Tabla de Informes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Informes de Contratistas de la Secretaría</h3>
                <p className="text-xs text-gray-500">Supervisión, verificación de obligaciones y certificación de actividades</p>
              </div>
              <span className="text-xs font-medium text-gray-500">Total: {filteredInformes.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Informe</th>
                    <th className="px-4 py-3">Contratista</th>
                    <th className="px-4 py-3">Contrato</th>
                    <th className="px-4 py-3">Período Reportado</th>
                    <th className="px-4 py-3">Fecha Radicación</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones de Supervisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInformes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <FileText size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="font-semibold text-gray-700 text-sm">No se encontraron informes radicados</p>
                        <p className="text-xs text-gray-400 mt-1">Los informes enviados por los contratistas asignados aparecerán aquí en tiempo real.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedInformes.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-gray-900">
                          Nro. {item.informe_nro} ({item.tipo_informe})
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-900">{item.contratista_nombre}</p>
                          <p className="text-[10px] text-gray-500 font-mono">C.C. {item.contratista_documento}</p>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-800 font-mono">
                          #{item.contrato_nro}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          {item.periodo_desde} al {item.periodo_hasta}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          {item.fecha_presentacion}
                        </td>
                        <td className="px-4 py-3.5">
                          {(() => {
                            const comments = item.comentariosCampos || {};
                            const commList = Object.values(comments);
                            const pendingCount = commList.filter((c: any) => !c.corregido).length;
                            const isDevuelto = item.estado === 'Devuelto';
                            const allCorregidos = commList.length > 0 && pendingCount === 0;

                            if (item.estado === 'Aprobado') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 size={11} className="text-emerald-700" />
                                  Aprobado
                                </span>
                              );
                            }

                            if (isDevuelto) {
                              if (allCorregidos) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-400 font-extrabold shadow-xs">
                                    <CheckCircle2 size={11} className="text-emerald-700" />
                                    Correcciones Listas 🟢 (Re-verificar)
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 font-extrabold">
                                  <AlertTriangle size={11} className="text-amber-800 shrink-0" />
                                  Devuelto ({pendingCount > 0 ? `${pendingCount} pend.` : 'Con Obs.'})
                                </span>
                              );
                            }

                            if (item.estado === 'Enviado') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Clock size={11} className="text-blue-600" />
                                  Pendiente de Revisión
                                </span>
                              );
                            }

                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {item.estado || 'Borrador'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenInspectModal(item)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1"
                            title="Inspeccionar informe completo y dejar observaciones en casillas"
                          >
                            <Eye size={13} />
                            Revisar / Inspeccionar
                          </button>

                          <button
                            onClick={() => handleOpenWhatsAppModal(item)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-[#25D366] text-emerald-800 hover:text-white border border-emerald-300 hover:border-[#25D366] rounded font-semibold text-[11px] inline-flex items-center gap-1 transition-all"
                            title="Enviar notificación oficial por WhatsApp al contratista"
                          >
                            <MessageSquare size={13} />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>

                          {item.estado !== 'Aprobado' ? (
                            <button
                              onClick={() => {
                                handleUpdateStatus(item.id, 'Aprobado');
                                handleOpenWhatsAppModal(item, 'aprobado');
                              }}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold text-[11px] inline-flex items-center gap-1 shadow-xs"
                              title="Aprobar para pago y notificar por WhatsApp"
                            >
                              <CheckCircle2 size={13} />
                              Aprobar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Enviado')}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                              title="Revertir para correcciones"
                            >
                              Reabrir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {filteredInformes.length > 0 && (
              <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span>
                    Mostrando <strong className="text-gray-900">{startIndex + 1} - {endIndex}</strong> de <strong className="text-gray-900">{filteredInformes.length}</strong> informes
                  </span>
                  <span className="text-gray-300">|</span>
                  <label className="flex items-center gap-1.5 text-gray-500">
                    <span>Por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-gray-300 rounded px-2 py-0.5 bg-white text-gray-700 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={validCurrentPage === 1}
                      className="px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 font-medium transition-colors"
                      title="Página anterior"
                    >
                      <ChevronLeft size={14} />
                      <span>Anterior</span>
                    </button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        if (
                          totalPages <= 7 ||
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          Math.abs(pageNum - validCurrentPage) <= 1
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-7 h-7 rounded text-xs font-semibold flex items-center justify-center transition-colors ${
                                pageNum === validCurrentPage
                                  ? 'bg-emerald-800 text-white shadow-xs'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          (pageNum === validCurrentPage - 2 && pageNum > 1) ||
                          (pageNum === validCurrentPage + 2 && pageNum < totalPages)
                        ) {
                          return <span key={pageNum} className="px-1 text-gray-400">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={validCurrentPage === totalPages}
                      className="px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 font-medium transition-colors"
                      title="Página siguiente"
                    >
                      <span>Siguiente</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: GESTIÓN DE CONTRATISTAS */}
      {activeTab === 'contratistas' && (
        <div className="space-y-6">
          
          <div className="bg-emerald-900 text-white p-5 rounded-xl border border-emerald-700/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-emerald-300" />
                Directorio Oficial de Contratistas de la Secretaría
              </h3>
              <p className="text-xs text-emerald-200 mt-1 max-w-2xl">
                Crea perfiles con credenciales de acceso (*Nombre, Cédula, Correo Institucional y Contraseña*), vincula contratos de prestación de servicios y administra el acceso a la plataforma.
              </p>
            </div>

            <button
              onClick={() => setShowAddContractorModal(true)}
              className="bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
            >
              <UserPlus size={16} />
              <span>+ Crear Contratista</span>
            </button>
          </div>

          {/* Listado de Tarjetas de Contratistas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contractors.map((c) => (
              <div 
                key={c.id} 
                className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 hover:border-emerald-500 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h4 className="font-bold text-gray-900 text-sm">{c.nombreCompleto}</h4>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        C.C. {c.documentoIdentidad} • Tel. {c.telefono || 'Sin teléfono'}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                      {c.contratoNro ? `Contrato #${c.contratoNro}` : 'Contrato por registrar'}
                    </span>
                  </div>

                  {/* Bloque de Credenciales de Acceso */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200/80 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-gray-700">
                      <span className="flex items-center gap-1.5 font-sans font-semibold text-[11px] text-gray-500">
                        <Mail size={13} className="text-emerald-700" /> Correo:
                      </span>
                      <span className="text-gray-900 font-semibold">{c.email}</span>
                    </div>

                    <div className="flex items-center justify-between text-gray-700">
                      <span className="flex items-center gap-1.5 font-sans font-semibold text-[11px] text-gray-500">
                        <KeyRound size={13} className="text-amber-600" /> Contraseña:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {visiblePasswords[c.id] ? (c.password || 'Contratista2026*') : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(c.id)}
                          className="text-gray-400 hover:text-gray-700"
                          title="Mostrar/Ocultar contraseña"
                        >
                          {visiblePasswords[c.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Datos de Rol / Contrato */}
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-700">
                      <span className="font-semibold text-gray-900">Cargo / Función: </span>
                      {c.cargo || c.objetoContrato || 'Contratista de Prestación de Servicios'}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-2 text-[11px]">
                      {c.valorContrato && (
                        <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-900 font-semibold">
                          Valor: {c.valorContrato}
                        </span>
                      )}
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {c.contratoNro ? `Contrato Nro. ${c.contratoNro}` : 'Detalles contractuales gestionados por el contratista'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones para el Contratista */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCopyCredentials(c)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-50 text-gray-800 hover:text-emerald-900 border border-gray-200 hover:border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedId === c.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copiedId === c.id ? '¡Copiado!' : 'Copiar Credenciales'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenWhatsAppModal(c, 'recordatorio')}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-[#25D366] text-emerald-800 hover:text-white border border-emerald-300 hover:border-[#25D366] rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                      title="Enviar mensaje oficial por WhatsApp al contratista"
                    >
                      <MessageSquare size={13} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(c)}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border border-gray-200 hover:border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Editar datos del contratista"
                    >
                      <Edit size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => setSelectedContractorForReports(c)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                      title="Ver historial individual de informes y certificados de este contratista"
                    >
                      <FileBadge size={14} />
                      <span>Historial & Certificados</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('informes');
                        setSearchTerm(c.nombreCompleto);
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors"
                    >
                      Ver Informes
                    </button>
                    <button
                      onClick={() => handleDeleteContractor(c)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Desvincular contratista"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* MODAL PARA REGISTRAR NUEVO CONTRATISTA */}
      {showAddContractorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-emerald-800">
                <UserPlus size={22} />
                <div>
                  <h3 className="text-lg font-bold">Crear y Vincular Perfil de Contratista</h3>
                  <p className="text-xs text-gray-500">Asignar a {user.secretariaNombre}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddContractorModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Banner informativo sobre la gestión del contrato por parte del contratista */}
            <div className="mt-4 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2.5 leading-relaxed">
              <span className="text-base shrink-0">ℹ️</span>
              <div>
                <strong className="font-bold">Responsabilidad Contractual:</strong> El administrador crea la cuenta y credenciales de acceso del contratista. Los datos específicos del contrato (Nro. de contrato, objeto, valor, CDP, CRP, póliza y fechas) los diligencia directamente el propio contratista al redactar su informe mensual.
              </div>
            </div>

            <form onSubmit={handleCreateContractorSubmit} className="mt-4 space-y-4 text-xs">
              
              {/* Datos Personales & Credenciales de Acceso */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-emerald-950 uppercase tracking-wide">
                  <Shield size={16} className="text-emerald-700" />
                  <span>Datos Personales y Credenciales de Acceso</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">Nombre Completo del Contratista *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. JUAN CARLOS MURILLO CÓRDOBA"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Cédula de Ciudadanía / NIT *</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. 1077555444"
                      value={nuevaCedula}
                      onChange={(e) => setNuevaCedula(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Teléfono Móvil</label>
                    <input
                      type="text"
                      placeholder="ej. 3105557788"
                      value={nuevoTelefono}
                      onChange={(e) => setNuevoTelefono(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Correo Electrónico (Usuario de Acceso) *</label>
                    <input
                      type="email"
                      required
                      placeholder="ej. juan.murillo@quibdo-ejemplo.gov.co"
                      value={nuevoCorreo}
                      onChange={(e) => setNuevoCorreo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Contraseña Inicial de Acceso *</label>
                    <input
                      type="text"
                      required
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">Cargo / Función Principal</label>
                    <input
                      type="text"
                      placeholder="ej. Contratista de Prestación de Servicios de Apoyo a la Gestión"
                      value={nuevoCargo}
                      onChange={(e) => setNuevoCargo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">Secretaría Asignada</label>
                    <input
                      type="text"
                      disabled
                      value={`${user.secretariaNombre} (Cód. ${user.secretariaCodigo})`}
                      className="w-full border border-gray-200 rounded-lg p-2.5 bg-gray-100 text-gray-600 font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddContractorModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <UserPlus size={15} />
                  <span>Crear y Habilitar Acceso</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL DE INSPECCIÓN COMPLETA CON 5 PESTAÑAS Y MODO REVISIÓN */}
      {inspectingInforme && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full h-[94vh] flex flex-col overflow-hidden border border-gray-200">
            
            {/* Header del Visor */}
            <div className="p-4 bg-emerald-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <FileCheck size={20} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Inspección de Informe Nro. {inspectingInforme.informeNro} • {inspectingInforme.contratistaNombre}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inspectingInforme.estado === 'Aprobado' 
                        ? 'bg-emerald-700 text-white' 
                        : inspectingInforme.estado === 'Devuelto'
                        ? 'bg-amber-400 text-amber-950'
                        : 'bg-blue-600 text-white'
                    }`}>
                      {inspectingInforme.estado}
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Contrato #{inspectingInforme.contratoNro} • Período {inspectingInforme.periodoDesde} al {inspectingInforme.periodoHasta}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppModal(inspectingInforme)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer border border-emerald-400/30"
                  title="Enviar notificación oficial por WhatsApp al contratista (incluye observaciones de informes y certificados)"
                >
                  <MessageSquare size={14} />
                  <span className="hidden sm:inline">Notificar por WhatsApp</span>
                </button>

                <button 
                  onClick={() => setInspectingInforme(null)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 text-sm font-bold transition-colors"
                  title="Cerrar visor"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Barra de Pestañas de la Suite Contractual (5 Certificados / Documentos) */}
            {(() => {
              const allComms = inspectingInforme.comentariosCampos || {};
              const certKeys = ['certificado_supervision', 'soporte_fiduciaria', 'declaracion_juramento', 'autorizacion_desembolso'];
              
              const informeComms = Object.entries(allComms)
                .filter(([k]) => !certKeys.includes(k))
                .map(([_, v]) => v as FieldComment);
              const informePending = informeComms.filter(c => !c.corregido).length;
              const informeFixed = informeComms.filter(c => c.corregido).length;

              const supComm = allComms['certificado_supervision'] || 
                Object.values(allComms).find((c: any) => c.campoId === 'certificado_supervision' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('certificado de supervisión')));
              
              const fidComm = allComms['soporte_fiduciaria'] || 
                Object.values(allComms).find((c: any) => c.campoId === 'soporte_fiduciaria' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('soporte fiduciaria')));

              const jurComm = allComms['declaracion_juramento'] || 
                Object.values(allComms).find((c: any) => c.campoId === 'declaracion_juramento' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('declaración')));

              const desComm = allComms['autorizacion_desembolso'] || 
                Object.values(allComms).find((c: any) => c.campoId === 'autorizacion_desembolso' || (c.nombreCampo && c.nombreCampo.toLowerCase().includes('desembolso')));

              return (
                <>
                  <div className="bg-white px-4 py-2.5 border-b border-slate-200 shadow-xs shrink-0 overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-max">
                      
                      <button
                        onClick={() => setAdminModuleTab('informe')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          adminModuleTab === 'informe'
                            ? 'bg-[#006b33] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <FileText size={15} />
                        <span>1. Informe Mensual</span>
                        {informePending > 0 ? (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black text-[10px] rounded-full border border-amber-400">
                            ⚠️ {informePending}
                          </span>
                        ) : informeFixed > 0 ? (
                          <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-950 font-black text-[10px] rounded-full border border-emerald-400">
                            🟢 {informeFixed}
                          </span>
                        ) : null}
                      </button>

                      <button
                        onClick={() => setAdminModuleTab('supervision')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          adminModuleTab === 'supervision'
                            ? 'bg-[#006b33] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <ShieldCheck size={15} />
                        <span>2. Certificado de Supervisión</span>
                        {supComm && (!supComm.corregido ? (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black text-[10px] rounded-full border border-amber-400">
                            ⚠️ Obs
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-950 font-black text-[10px] rounded-full border border-emerald-400">
                            🟢 Subsanado
                          </span>
                        ))}
                      </button>

                      <button
                        onClick={() => setAdminModuleTab('fiduciaria')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          adminModuleTab === 'fiduciaria'
                            ? 'bg-[#006b33] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Landmark size={15} />
                        <span>3. Soporte Fiduciaria / Pagos</span>
                        {fidComm && (!fidComm.corregido ? (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black text-[10px] rounded-full border border-amber-400">
                            ⚠️ Obs
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-950 font-black text-[10px] rounded-full border border-emerald-400">
                            🟢 Subsanado
                          </span>
                        ))}
                      </button>

                      <button
                        onClick={() => setAdminModuleTab('juramento')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          adminModuleTab === 'juramento'
                            ? 'bg-[#006b33] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Scale size={15} />
                        <span>4. Declaración Bajo Juramento</span>
                        {jurComm && (!jurComm.corregido ? (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black text-[10px] rounded-full border border-amber-400">
                            ⚠️ Obs
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-950 font-black text-[10px] rounded-full border border-emerald-400">
                            🟢 Subsanado
                          </span>
                        ))}
                      </button>

                      <button
                        onClick={() => setAdminModuleTab('desembolso')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          adminModuleTab === 'desembolso'
                            ? 'bg-[#006b33] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <CreditCard size={15} />
                        <span>5. Autorización de Desembolso</span>
                        {desComm && (!desComm.corregido ? (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black text-[10px] rounded-full border border-amber-400">
                            ⚠️ Obs
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-950 font-black text-[10px] rounded-full border border-emerald-400">
                            🟢 Subsanado
                          </span>
                        ))}
                      </button>

                    </div>
                  </div>

                  {/* Banner Informativo de Revisión y Estado de Subsanación */}
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-950 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-black rounded text-[10.5px]">
                        📝 MODO REVISIÓN & COMENTARIOS
                      </span>
                      <span className="text-[11.5px]">
                        {adminModuleTab === 'informe' 
                          ? 'Haz clic sobre cualquier casilla para escribir o editar observaciones. Quedarán resaltadas en amarillo para que el contratista las corrija.'
                          : 'Revisa los datos del documento. Puedes añadir, editar o validar observaciones con los botones correspondientes.'
                        }
                      </span>
                    </div>

                    {/* Stats de observaciones según pestaña activa */}
                    {adminModuleTab === 'informe' ? (
                      (informePending > 0 || informeFixed > 0) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {informeFixed > 0 && (
                            <div className="bg-emerald-100 text-emerald-950 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shrink-0 border border-emerald-400 shadow-xs">
                              <CheckCircle2 size={13} className="text-emerald-700" />
                              <span>{informeFixed} corrección(es) lista(s) para validar</span>
                            </div>
                          )}
                          {informePending > 0 && (
                            <div className="bg-amber-200/90 text-amber-950 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shrink-0 border border-amber-400 shadow-xs">
                              <AlertTriangle size={13} className="text-amber-800" />
                              <span>{informePending} observación(es) pendiente(s) por el contratista</span>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      (() => {
                        const currentComm = adminModuleTab === 'supervision' ? supComm
                          : adminModuleTab === 'fiduciaria' ? fidComm
                          : adminModuleTab === 'juramento' ? jurComm
                          : desComm;
                        
                        if (!currentComm) {
                          return (
                            <span className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                              Sin observaciones en este certificado
                            </span>
                          );
                        }
                        
                        return currentComm.corregido ? (
                          <div className="bg-emerald-100 text-emerald-950 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shrink-0 border border-emerald-400 shadow-xs">
                            <CheckCircle2 size={13} className="text-emerald-700" />
                            <span>Corrección realizada por el contratista • Lista para validar</span>
                          </div>
                        ) : (
                          <div className="bg-amber-200/90 text-amber-950 font-bold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shrink-0 border border-amber-400 shadow-xs">
                            <AlertTriangle size={13} className="text-amber-800" />
                            <span>Observación activa • Pendiente de corrección por el contratista</span>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </>
              );
            })()}

            {/* Cuerpo del Visor con el Documento Activo */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6 md:p-8 flex justify-center">
              <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-4 sm:p-6">
                
                {adminModuleTab === 'informe' && (
                  <ReportPreview 
                    data={inspectingInforme}
                    isReviewMode={true}
                    onSaveComment={handleSaveComment}
                    onDeleteComment={handleDeleteComment}
                    authorName={user.nombreCompleto || 'Supervisora'}
                  />
                )}

                {adminModuleTab === 'supervision' && (
                  <CertificadoSupervisionDoc
                    reportData={inspectingInforme}
                    isEditable={false}
                    hideGuide={true}
                    isReviewMode={true}
                    onSaveComment={handleSaveComment}
                    onDeleteComment={handleDeleteComment}
                    authorName={user.nombreCompleto || 'Supervisora'}
                  />
                )}

                {adminModuleTab === 'fiduciaria' && (
                  <SoporteFiduciariaDoc
                    reportData={inspectingInforme}
                    isEditable={false}
                    hideGuide={true}
                    isReviewMode={true}
                    onSaveComment={handleSaveComment}
                    onDeleteComment={handleDeleteComment}
                    authorName={user.nombreCompleto || 'Supervisora'}
                  />
                )}

                {adminModuleTab === 'juramento' && (
                  <DeclaracionRentaDoc
                    reportData={inspectingInforme}
                    isEditable={false}
                    hideGuide={true}
                    isReviewMode={true}
                    onSaveComment={handleSaveComment}
                    onDeleteComment={handleDeleteComment}
                    authorName={user.nombreCompleto || 'Supervisora'}
                  />
                )}

                {adminModuleTab === 'desembolso' && (
                  <AutorizacionDesembolsoDoc
                    reportData={inspectingInforme}
                    isEditable={false}
                    hideGuide={true}
                    isReviewMode={true}
                    onSaveComment={handleSaveComment}
                    onDeleteComment={handleDeleteComment}
                    authorName={user.nombreCompleto || 'Supervisora'}
                  />
                )}

              </div>
            </div>

            {/* Footer con Cerrar Visor */}
            <div className="p-3 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-600 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Alcaldía de Quibdó</span>
                <span>• Visualización y comentarios de supervisión contractual</span>
              </div>

              <button
                onClick={() => setInspectingInforme(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs"
              >
                Cerrar Visor
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR DATOS DEL CONTRATISTA */}
      {editingContractor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            
            <div className="flex items-start justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-emerald-800">
                <Edit size={22} />
                <div>
                  <h3 className="text-lg font-bold">Editar Perfil del Contratista</h3>
                  <p className="text-xs text-gray-500">{editingContractor.nombreCompleto}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingContractor(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateContractorSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nombre Completo del Contratista <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="EJ: JHOAN STIVEN CORDOBA PALACIOS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 uppercase font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Cédula / Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCedula}
                    onChange={(e) => setEditCedula(e.target.value)}
                    placeholder="1077448899"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={editTelefono}
                    onChange={(e) => setEditTelefono(e.target.value)}
                    placeholder="3101234567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Correo Electrónico (Usuario de Acceso) <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editCorreo}
                  onChange={(e) => setEditCorreo(e.target.value)}
                  placeholder="contratista@quibdo-choco.gov.co"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Cargo / Objeto Principal
                </label>
                <input
                  type="text"
                  value={editCargo}
                  onChange={(e) => setEditCargo(e.target.value)}
                  placeholder="Contratista de Prestación de Servicios"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                  <KeyRound size={13} className="text-amber-700" />
                  Contraseña de Acceso (Opcional - Actualizar clave)
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Contratista2026*"
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 font-mono font-bold text-gray-800"
                />
                <p className="text-[11px] text-amber-800 mt-1">
                  Deja la contraseña actual o escribe una nueva para cambiar las credenciales de ingreso del contratista.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingContractor(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE DESVINCULACIÓN (SANDBOX-SAFE) */}
      {contractorToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Desvincular Contratista</h3>
                <p className="text-xs text-gray-500">Esta acción revoca el acceso a la plataforma</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 text-xs space-y-1.5 my-4">
              <p><span className="font-semibold text-gray-700">Contratista:</span> {contractorToDelete.nombreCompleto}</p>
              <p><span className="font-semibold text-gray-700">Documento:</span> {contractorToDelete.documentoIdentidad}</p>
              <p><span className="font-semibold text-gray-700">Correo:</span> {contractorToDelete.email}</p>
            </div>

            <p className="text-xs text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar este contratista? Se eliminará su registro de Supabase y no podrá iniciar sesión.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setContractorToDelete(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteContractor}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 size={14} />
                Sí, Desvincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Certificado de Supervisión Oficial */}
      {showCertModal && (
        <CertificadoSupervisionModal
          isOpen={showCertModal}
          onClose={() => setShowCertModal(false)}
          reportData={selectedCertReportData || undefined}
          initialCertData={selectedCertData || undefined}
          isEditable={true}
        />
      )}

      {/* Modal Notificación Oficial por WhatsApp */}
      {whatsappPayload && (
        <WhatsAppNotifyModal
          payload={whatsappPayload}
          onClose={() => setWhatsappPayload(null)}
          onUpdatePhone={handleUpdatePhoneFromWhatsApp}
        />
      )}

      {/* Modal Historial de Informes y Certificados por Contratista */}
      {selectedContractorForReports && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            
            {/* Header */}
            <div className="p-5 bg-emerald-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-900/80 border border-emerald-600 flex items-center justify-center text-emerald-300">
                  <FileBadge size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Historial de Informes y Certificados • {selectedContractorForReports.nombreCompleto}
                  </h3>
                  <p className="text-xs text-emerald-300 font-mono">
                    C.C. {selectedContractorForReports.documentoIdentidad} • Contrato #{selectedContractorForReports.contratoNro || 'Por registrar'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedContractorForReports(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Body / List */}
            <div className="p-6 overflow-y-auto space-y-4 bg-gray-50 flex-1">
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">Informes Radicados y Certificados Emitidos</h4>
                    <p className="text-[11px] text-gray-500">Visualice y gestione individualmente cada informe sin mezclar datos</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
                    {informes.filter(i => i.contratista_documento === selectedContractorForReports.documentoIdentidad || (i.contratista_nombre && selectedContractorForReports.nombreCompleto && i.contratista_nombre.trim().toLowerCase() === selectedContractorForReports.nombreCompleto.trim().toLowerCase())).length} Informes
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {informes.filter(i => i.contratista_documento === selectedContractorForReports.documentoIdentidad || (i.contratista_nombre && selectedContractorForReports.nombreCompleto && i.contratista_nombre.trim().toLowerCase() === selectedContractorForReports.nombreCompleto.trim().toLowerCase())).length === 0 ? (
                    <div className="py-12 text-center text-gray-500">
                      <FileText size={36} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-bold text-sm">Este contratista aún no ha radicado informes mensuales</p>
                      <p className="text-xs text-gray-400 mt-1">Los informes enviados por el contratista aparecerán aquí en tiempo real para su revisión.</p>
                    </div>
                  ) : (
                    informes
                      .filter(i => i.contratista_documento === selectedContractorForReports.documentoIdentidad || (i.contratista_nombre && selectedContractorForReports.nombreCompleto && i.contratista_nombre.trim().toLowerCase() === selectedContractorForReports.nombreCompleto.trim().toLowerCase()))
                      .map(inf => (
                        <div key={inf.id} className="p-4 hover:bg-emerald-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">Informe Nro. {inf.informe_nro} ({inf.tipo_informe})</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inf.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                inf.estado === 'Devuelto' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {inf.estado}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 font-mono">
                              Período: {inf.periodo_desde} al {inf.periodo_hasta} • Radicado: {inf.fecha_presentacion || 'N/A'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <button
                              onClick={() => {
                                handleOpenInspectModal(inf);
                                setSelectedContractorForReports(null);
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border border-emerald-300 transition-colors"
                              title="Revisar informe, agregar observaciones y resaltar casillas"
                            >
                              <Eye size={13} />
                              <span>Revisar / Inspeccionar</span>
                            </button>



                            <button
                              onClick={() => handleOpenWhatsAppModal(inf)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-[#25D366] text-emerald-800 hover:text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-emerald-300 transition-all"
                              title="Enviar notificación por WhatsApp"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </button>

                            {inf.estado !== 'Aprobado' ? (
                              <button
                                onClick={() => {
                                  handleUpdateStatus(inf.id, 'Aprobado');
                                  handleOpenWhatsAppModal(inf, 'aprobado');
                                }}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                                title="Aprobar para pago"
                              >
                                <CheckCircle2 size={13} />
                                <span>Aprobar</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(inf.id, 'Enviado')}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                                title="Reabrir para correcciones"
                              >
                                Reabrir
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedContractorForReports(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
