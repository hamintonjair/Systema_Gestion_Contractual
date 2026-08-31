import React, { useState } from 'react';
import { 
  ListOrdered, 
  ExternalLink, 
  Building, 
  Landmark, 
  CheckCircle2, 
  Info, 
  FileText, 
  ShieldCheck, 
  CreditCard, 
  FileCheck, 
  Scale, 
  Copy, 
  Check, 
  AlertTriangle,
  BookOpen
} from 'lucide-react';

export interface DocumentoRequisito {
  id: number;
  documento: string;
  alcaldia: string;
  fiducia: string;
  observaciones: string;
  categoria?: string;
  enlaces?: {
    nombre: string;
    url: string;
    descripcion?: string;
    tag?: string;
  }[];
}

export const LISTA_ORDEN_DOCUMENTOS: DocumentoRequisito[] = [
  {
    id: 1,
    documento: "1. Informe Mensual de Actividades",
    alcaldia: "Aplica",
    fiducia: "Aplica",
    observaciones: "Requisito general obligatorio."
  },
  {
    id: 2,
    documento: "2. Salud, Pensión y ARL / Planilla SS",
    alcaldia: "Aplica",
    fiducia: "Aplica",
    observaciones: "Certificado para el primer cobro; planilla de pago para el segundo cobro en adelante.",
    enlaces: [
      {
        nombre: "Positiva ARL (Portal de Operaciones)",
        url: "https://operacionesarl.positiva.gov.co/login",
        descripcion: "Generación de certificados de afiliación y estado ARL Positiva",
        tag: "ARL"
      },
      {
        nombre: "Aportes en Línea (Salud y Pensión)",
        url: "https://independientes.aportesenlinea.com/Portal/Paginas/Home.aspx?ReturnUrl=%2fPortal%2f",
        descripcion: "Pago y descarga de planillas PILA para independientes",
        tag: "Planilla PILA"
      },
      {
        nombre: "Enlace Operativo (SuAporte)",
        url: "https://www.suaporte.com.co/sso/#/",
        descripcion: "Plataforma alternativa para liquidación y pago de Seguridad Social",
        tag: "Planilla PILA"
      }
    ]
  },
  {
    id: 3,
    documento: "3. Certificado de Supervisión",
    alcaldia: "Aplica",
    fiducia: "Aplica",
    observaciones: "Debe estar debidamente firmado por el supervisor asignado y la Secretaría de Inclusión y Cohesión Social."
  },
  {
    id: 4,
    documento: "4. Factura equivalente / Cuenta de Cobro",
    alcaldia: "Aplica",
    fiducia: "Aplica",
    observaciones: "Incluye los datos completos de la cuenta bancaria activa del contratista."
  },
  {
    id: 5,
    documento: "5. RUT (Registro Único Tributario)",
    alcaldia: "No aplica",
    fiducia: "Aplica",
    observaciones: "Exclusivo para trámites de pago ante la Fiducia.",
    enlaces: [
      {
        nombre: "Portal DIAN MUISCA (Obtención y actualización de RUT)",
        url: "https://muisca.dian.gov.co/WebIdentidadLogin/?ideRequest=eyJjbGllbnRJZCI6IldvMGFLQWxCN3ZSUF8xNmZyUEkxeDlacGhCRWEiLCJyZWRpcmVjdF91cmkiOiJodHRwOi8vbXVpc2NhLmRpYW4uZ292LmNvL0lkZW50aWRhZFJlc3RfTG9naW5GaWx0cm8vYXBpL3N0cy92MS9hdXRoL2NhbGxiYWNrP3JlZGlyZWN0X3VyaT1odHRwJTNBJTJGJTJGbXVpc2NhLmRpYW4uZ292LmNvJTJGV2ViQXJxdWl0ZWN0dXJhJTJGRGVmTG9naW4uZmFjZXMiLCJyZXNwb25zZVR5cGUiOiIiLCJzY29wZSI6IiIsInN0YXRlIjoiIiwibm9uY2UiOiIiLCJwYXJhbXMiOnsidGlwb1VzdWFyaW8iOiJtdWlzY2EifX0%3D",
        descripcion: "Descarga oficial del RUT actualizado desde el sistema MUISCA de la DIAN",
        tag: "DIAN RUT"
      }
    ]
  },
  {
    id: 6,
    documento: "6. Certificación bajo juramento (Declaración)",
    alcaldia: "2 copias",
    fiducia: "2 copias",
    observaciones: "Alcaldía: Ambas copias dirigidas a la Alcaldía municipal. Fiducia: 1 copia a Alcaldía y 1 copia a Fiducia."
  },
  {
    id: 7,
    documento: "7. Soporte de Fiducia / Transferencias",
    alcaldia: "No aplica",
    fiducia: "Aplica (2 copias)",
    observaciones: "Exclusivo si la orden de pago aplica para trámite ante Fiducia."
  },
  {
    id: 8,
    documento: "8. Cédula de Ciudadanía",
    alcaldia: "Opcional / No aplica",
    fiducia: "Aplica",
    observaciones: "Solo requerida para el primer cobro (opcional anexar copia legible en el primer cobro)."
  },
  {
    id: 9,
    documento: "9. Certificación bancaria",
    alcaldia: "Opcional / No aplica",
    fiducia: "Aplica",
    observaciones: "Solo requerida para el primer cobro (opcional anexar certificación bancaria reciente en el primero)."
  }
];

export const OrdenDocumentosGuia: React.FC = () => {
  const [filter, setFilter] = useState<'todos' | 'primer_cobro' | 'alcaldia' | 'fiducia'>('todos');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleCheck = (id: number) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const renderBadge = (value: string, type: 'alcaldia' | 'fiducia') => {
    const valLower = value.toLowerCase();

    if (valLower.includes('no aplica')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {value}
        </span>
      );
    }

    if (valLower.includes('opcional')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {value}
        </span>
      );
    }

    if (valLower.includes('2 copias')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          {value}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 size={13} className="text-emerald-600" />
        {value}
      </span>
    );
  };

  const filteredDocs = LISTA_ORDEN_DOCUMENTOS.filter(doc => {
    if (filter === 'alcaldia') return !doc.alcaldia.toLowerCase().includes('no aplica');
    if (filter === 'fiducia') return !doc.fiducia.toLowerCase().includes('no aplica');
    if (filter === 'primer_cobro') return doc.id === 2 || doc.id === 8 || doc.id === 9 || doc.observaciones.toLowerCase().includes('primer');
    return true;
  });

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((checkedCount / LISTA_ORDEN_DOCUMENTOS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004d25] via-[#006b33] to-emerald-800 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-emerald-200 text-xs font-semibold border border-white/10">
              <BookOpen size={14} />
              <span>Guía de Organización y Foliamiento</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <ListOrdered size={26} className="text-amber-400" />
              Orden de Documentos para la Cuenta de Cobro
            </h2>
            <p className="text-xs md:text-sm text-emerald-100 max-w-3xl leading-relaxed">
              Consulte y organice sus documentos en el orden exacto exigido por la Secretaría de Inclusión y Cohesión Social de Quibdó para la radicación exitosa de su pago.
            </p>
          </div>

          {/* Checklist Counter */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shrink-0 flex flex-col items-center justify-center min-w-[170px]">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Verificación Física</span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-black text-white">{checkedCount}</span>
              <span className="text-sm font-semibold text-emerald-200">/ {LISTA_ORDEN_DOCUMENTOS.length}</span>
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-amber-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-emerald-100 mt-1">{progressPercent}% completado</span>
          </div>
        </div>
      </div>

      {/* Acceso Rápido a Portales Externos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-[#006b33] rounded-lg font-bold">
              <ExternalLink size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Portales Oficiales para Descarga de Certificados y Planillas</h3>
              <p className="text-xs text-slate-500">Enlaces directos a ARL Positiva, Aportes en Línea, Enlace Operativo y DIAN MUISCA</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Positiva */}
          <a
            href="https://operacionesarl.positiva.gov.co/login"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left bg-slate-50/60"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  ARL Positiva
                </span>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-[#006b33] transition-colors">
                Positiva Operaciones ARL
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                Descarga de certificado de afiliación y estado ARL Positiva.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 mt-3 flex items-center gap-1 group-hover:underline">
              Ir al portal Positiva &rarr;
            </span>
          </a>

          {/* Aportes en Linea */}
          <a
            href="https://independientes.aportesenlinea.com/Portal/Paginas/Home.aspx?ReturnUrl=%2fPortal%2f"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left bg-slate-50/60"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Salud y Pensión
                </span>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-[#006b33] transition-colors">
                Aportes en Línea (PILA)
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                Pago y generación de planillas de Seguridad Social para independientes.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 mt-3 flex items-center gap-1 group-hover:underline">
              Ir a Aportes en Línea &rarr;
            </span>
          </a>

          {/* Enlace Operativo */}
          <a
            href="https://www.suaporte.com.co/sso/#/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left bg-slate-50/60"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Planilla SS
                </span>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-[#006b33] transition-colors">
                Enlace Operativo (SuAporte)
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                Plataforma de liquidación y comprobante de pago de Aportes Sociales.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 mt-3 flex items-center gap-1 group-hover:underline">
              Ir a SuAporte &rarr;
            </span>
          </a>

          {/* RUT DIAN */}
          <a
            href="https://muisca.dian.gov.co/WebIdentidadLogin/?ideRequest=eyJjbGllbnRJZCI6IldvMGFLQWxCN3ZSUF8xNmZyUEkxeDlacGhCRWEiLCJyZWRpcmVjdF91cmkiOiJodHRwOi8vbXVpc2NhLmRpYW4uZ292LmNvL0lkZW50aWRhZFJlc3RfTG9naW5GaWx0cm8vYXBpL3N0cy92MS9hdXRoL2NhbGxiYWNrP3JlZGlyZWN0X3VyaT1odHRwJTNBJTJGJTJGbXVpc2NhLmRpYW4uZ292LmNvJTJGV2ViQXJxdWl0ZWN0dXJhJTJGRGVmTG9naW4uZmFjZXMiLCJyZXNwb25zZVR5cGUiOiIiLCJzY29wZSI6IiIsInN0YXRlIjoiIiwibm9uY2UiOiIiLCJwYXJhbXMiOnsidGlwb1VzdWFyaW8iOiJtdWlzY2EifX0%3D"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left bg-slate-50/60"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  DIAN RUT
                </span>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <h4 className="text-xs font-black text-slate-800 group-hover:text-[#006b33] transition-colors">
                DIAN MUISCA (RUT)
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                Consulta y descarga del Registro Único Tributario (RUT) actualizado.
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 mt-3 flex items-center gap-1 group-hover:underline">
              Ir a DIAN MUISCA &rarr;
            </span>
          </a>
        </div>
      </div>

      {/* Tabla de Documentos y Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra superior con filtros */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Filtrar vista:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === 'todos'
                    ? 'bg-[#006b33] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Todos (9)
              </button>
              <button
                onClick={() => setFilter('primer_cobro')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === 'primer_cobro'
                    ? 'bg-[#006b33] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Primer Cobro
              </button>
              <button
                onClick={() => setFilter('alcaldia')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === 'alcaldia'
                    ? 'bg-[#006b33] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Alcaldía
              </button>
              <button
                onClick={() => setFilter('fiducia')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === 'fiducia'
                    ? 'bg-[#006b33] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Fiducia
              </button>
            </div>
          </div>

          <span className="text-xs text-slate-500 italic">
            Marque las casillas a medida que verifica los documentos físicos.
          </span>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 w-12 text-center">✓</th>
                <th className="py-3.5 px-4">Documento</th>
                <th className="py-3.5 px-4 min-w-[130px]">
                  <div className="flex items-center gap-1.5">
                    <Building size={14} className="text-[#006b33]" />
                    <span>Alcaldía</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[140px]">
                  <div className="flex items-center gap-1.5">
                    <Landmark size={14} className="text-blue-700" />
                    <span>Fiducia</span>
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[280px]">Observaciones y Requisitos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {filteredDocs.map((doc) => {
                const isChecked = !!checkedItems[doc.id];
                return (
                  <tr 
                    key={doc.id}
                    onClick={() => toggleCheck(doc.id)}
                    className={`cursor-pointer transition-colors ${
                      isChecked 
                        ? 'bg-emerald-50/60 hover:bg-emerald-100/60' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-4 px-4 text-center select-none" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(doc.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Nombre Documento */}
                    <td className="py-4 px-4 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span className={`text-sm ${isChecked ? 'line-through text-slate-400 font-semibold' : 'text-slate-800'}`}>
                          {doc.documento}
                        </span>
                        {doc.enlaces && doc.enlaces.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            {doc.enlaces.map((link, idx) => (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#006b33] hover:bg-emerald-700 hover:text-white transition-all border border-emerald-300"
                              >
                                <ExternalLink size={11} />
                                <span>{link.tag || link.nombre}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Alcaldia */}
                    <td className="py-4 px-4">
                      {renderBadge(doc.alcaldia, 'alcaldia')}
                    </td>

                    {/* Fiducia */}
                    <td className="py-4 px-4">
                      {renderBadge(doc.fiducia, 'fiducia')}
                    </td>

                    {/* Observaciones */}
                    <td className="py-4 px-4 text-slate-600 leading-relaxed">
                      <p>{doc.observaciones}</p>

                      {/* Enlaces descriptivos dentro de la fila */}
                      {doc.enlaces && doc.enlaces.length > 0 && (
                        <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                          {doc.enlaces.map((link, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <span className="font-bold text-slate-700">{link.nombre}:</span>
                              <span className="text-slate-500 truncate flex-1">{link.descripcion}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => copyToClipboard(link.url, `link-${doc.id}-${idx}`)}
                                  className="p-1 hover:bg-slate-200 text-slate-500 rounded transition-colors"
                                  title="Copiar enlace"
                                >
                                  {copiedLink === `link-${doc.id}-${idx}` ? (
                                    <Check size={12} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:bg-emerald-100 text-[#006b33] rounded transition-colors"
                                  title="Abrir enlace"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota Informativa */}
      <div className="bg-amber-50 border border-amber-200/90 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
        <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-950">
            Importante para la radicación ante la Alcaldía de Quibdó:
          </p>
          <p className="text-amber-800 leading-relaxed">
            Asegúrese de foliarse y organizarse cada paquete respetando el orden numerado (1 al 9). En caso de trámite mixto (Alcaldía + Fiducia), conserve 2 juegos físicos completos conforme a las especificaciones indicadas en la columna de observaciones.
          </p>
        </div>
      </div>
    </div>
  );
};
