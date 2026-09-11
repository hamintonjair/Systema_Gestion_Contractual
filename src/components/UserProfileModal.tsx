import React, { useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { supabaseService } from '../services/supabaseService';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  IdCard, 
  KeyRound, 
  Building2, 
  FileText, 
  ShieldCheck, 
  X, 
  Save, 
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface Props {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: AuthUser) => void;
}

export default function UserProfileModal({ user, isOpen, onClose, onUserUpdated }: Props) {
  const [nombreCompleto, setNombreCompleto] = useState(user.nombreCompleto || '');
  const [documentoIdentidad, setDocumentoIdentidad] = useState(user.documentoIdentidad || '');
  const [email, setEmail] = useState(user.email || '');
  const [telefono, setTelefono] = useState(user.telefono || '');
  const [direccion, setDireccion] = useState(user.direccion || user.barrio || '');
  const [cargo, setCargo] = useState(user.cargo || 'Contratista de Prestación de Servicios');
  const [password, setPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNombreCompleto(user.nombreCompleto || '');
      setDocumentoIdentidad(user.documentoIdentidad || '');
      setEmail(user.email || '');
      setTelefono(user.telefono || '');
      setDireccion(user.direccion || user.barrio || '');
      setCargo(user.cargo || 'Contratista de Prestación de Servicios');
      setPassword('');

      // Cargar datos frescos de la BD (o informes guardados) para asegurar que se muestre la dirección
      const identifier = user.id || user.documentoIdentidad || user.email;
      if (identifier) {
        supabaseService.getUserProfile(identifier).then(freshProf => {
          if (freshProf) {
            if (freshProf.nombreCompleto) setNombreCompleto(freshProf.nombreCompleto);
            if (freshProf.documentoIdentidad) setDocumentoIdentidad(freshProf.documentoIdentidad);
            if (freshProf.email) setEmail(freshProf.email);
            if (freshProf.telefono) setTelefono(freshProf.telefono);
            if (freshProf.direccion || freshProf.barrio) setDireccion(freshProf.direccion || freshProf.barrio || '');
            if (freshProf.cargo) setCargo(freshProf.cargo);
          }
        }).catch(() => {});
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim() || !documentoIdentidad.trim() || !email.trim()) {
      setErrorMsg('Por favor completa los campos obligatorios (*)');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updatePayload: Partial<AuthUser> = {
        nombreCompleto: nombreCompleto.trim().toUpperCase(),
        documentoIdentidad: documentoIdentidad.trim().replace(/\./g, ''),
        email: email.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        barrio: direccion.trim(),
        cargo: cargo.trim(),
        ...(password.trim() ? { password: password.trim() } : {})
      };

      const result = await supabaseService.updateContractor(user.id, updatePayload);

      const updatedUser: AuthUser = {
        ...user,
        ...updatePayload,
        ...(result.data || {})
      };

      // Guardar en localStorage de sesión activa
      localStorage.setItem('alcaldia_quibdo_user', JSON.stringify(updatedUser));
      
      onUserUpdated(updatedUser);
      setSuccessMsg('¡Datos de perfil actualizados correctamente!');
      
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error al actualizar perfil:', err);
      setErrorMsg('Ocurrió un error al guardar los cambios en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        
        {/* Cabecera del Modal */}
        <div className="bg-[#042813] text-white px-6 py-4 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center text-white font-bold text-lg shadow-inner shrink-0">
              {user.nombreCompleto?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-white leading-tight">
                  Mi Perfil de usuario
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 border border-emerald-700">
                  {user.role === 'contratista' ? 'Contratista' : user.role === 'secretaria_admin' ? 'Secretaría Titular' : user.role === 'secretaria_supervisor' ? 'Supervisor' : 'Administrador'}
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Actualiza tus datos personales y credenciales de acceso a la plataforma
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 hover:text-white flex items-center justify-center transition-colors"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario con scroll interno */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            
            {/* Mensajes de Alerta */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
                <X size={16} className="text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Sección 1: Datos Personales y de Contacto */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[#006b33] uppercase tracking-wider flex items-center gap-2 border-b border-emerald-100 pb-2">
                <User size={15} className="text-[#006b33]" />
                Información Personal y de Contacto
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Nombre Completo */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-bold uppercase text-gray-900 focus:ring-2 focus:ring-[#006b33] focus:border-[#006b33] bg-white"
                      placeholder="Ej. JUAN CARLOS MURILLO CÓRDOBA"
                    />
                  </div>
                </div>

                {/* Documento de Identidad */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Cédula / Documento de Identidad *
                  </label>
                  <div className="relative">
                    <IdCard size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={documentoIdentidad}
                      onChange={(e) => setDocumentoIdentidad(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#006b33] focus:border-[#006b33] bg-white"
                      placeholder="Ej. 1077555444"
                    />
                  </div>
                </div>

                {/* Teléfono Móvil */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Teléfono Móvil
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:ring-2 focus:ring-[#006b33] focus:border-[#006b33] bg-white"
                      placeholder="Ej. 3105557788"
                    />
                  </div>
                </div>

                {/* Correo Electrónico */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Correo Electrónico (Usuario de Acceso) *
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:ring-2 focus:ring-[#006b33] focus:border-[#006b33] bg-white"
                      placeholder="Ej. usuario@quibdo-ejemplo.gov.co"
                    />
                  </div>
                </div>

                {/* Barrio / Dirección de Residencia */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Barrio / Dirección de Residencia
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium uppercase text-gray-900 focus:ring-2 focus:ring-[#006b33] focus:border-[#006b33] bg-white"
                      placeholder="Ej. BARRIO TOMAS PEREZ O BARRIO BUENOS AIRES"
                    />
                  </div>
                </div>

                {/* Cargo / Función */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Cargo / Función Principal
                  </label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-[#006b33] focus:border-[#006b33] bg-white"
                      placeholder="Ej. Contratista de Prestación de Servicios"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Sección 2: Seguridad y Credenciales */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <KeyRound size={15} className="text-amber-700" />
                Cambiar Contraseña de Acceso
              </h4>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 text-gray-900"
                  placeholder="Dejar en blanco si deseas mantener tu clave actual"
                />
                <p className="text-[11px] text-amber-800 mt-1">
                  Ingresa una nueva clave únicamente si deseas reemplazar tu contraseña de ingreso actual.
                </p>
              </div>
            </div>

            {/* Sección 3: Datos de Adscripción Institucional (Solo Lectura) */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={15} className="text-gray-500" />
                Vinculación Institucional (Solo Lectura)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-gray-500 block text-[11px]">Secretaría Asignada:</span>
                  <span className="font-bold text-gray-900">{user.secretariaNombre || 'Alcaldía Municipal de Quibdó'}</span>
                </div>
                {user.contratoNro && (
                  <div>
                    <span className="text-gray-500 block text-[11px]">Número de Contrato:</span>
                    <span className="font-mono font-bold text-[#006b33]">{user.contratoNro}</span>
                  </div>
                )}
                {user.supervisorNombre && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 block text-[11px]">Supervisor Asignado:</span>
                    <span className="font-semibold text-gray-800">{user.supervisorNombre}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Botones de Acción Fijos en la Parte Inferior */}
          <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200/70 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#006b33] hover:bg-[#005428] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
