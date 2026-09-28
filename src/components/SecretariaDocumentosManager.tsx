import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { AuthUser } from '../types';
import { supabaseService, SecretariaDocumento } from '../services/supabaseService';
import PdfCanvasViewer from './PdfCanvasViewer';
import { 
  FileText, FileCode, FileSpreadsheet, FileCheck, Upload, Trash2, 
  Eye, Download, Search, Plus, X, AlertCircle, CheckCircle2, 
  Building2, Info, Loader2, Sparkles, FolderOpen
} from 'lucide-react';

function enhanceWordTableHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return rawHtml;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
    const container = doc.body.firstElementChild;
    if (!container) return rawHtml;

    const tables = container.querySelectorAll('table');
    tables.forEach((table) => {
      table.className = 'w-full border-collapse border border-slate-400 my-4 text-xs font-sans shadow-xs';

      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 0) return;

      let itemColIndex = -1;
      let folioColIndex = -1;

      // Detectar índices de columnas según encabezado
      const firstRowCells = Array.from(rows[0].querySelectorAll('th, td'));
      firstRowCells.forEach((cell, idx) => {
        const text = (cell.textContent || '').trim().toUpperCase();
        if (text.includes('ITEM') || text.includes('ÍTEM') || text.includes('NO.') || text.includes('N°')) {
          itemColIndex = idx;
        }
        if (text.includes('FOLIO')) {
          folioColIndex = idx;
        }
      });

      // Si no se encontró por palabra clave, usar la primera columna si hay varias
      if (itemColIndex === -1 && firstRowCells.length >= 2) {
        itemColIndex = 0;
      }

      let dataRowCounter = 1;

      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const isHeaderRow = rowIndex === 0 || row.parentElement?.tagName === 'THEAD';

        cells.forEach((cell, colIndex) => {
          if (isHeaderRow) {
            cell.className = 'border border-slate-400 bg-slate-100 p-2 font-bold text-slate-900 uppercase text-[11px] tracking-wide';
          } else {
            cell.className = 'border border-slate-300 p-2 text-slate-800 text-xs';
          }

          // Formatear columna de ÍTEMS
          if (colIndex === itemColIndex) {
            cell.style.width = '48px';
            cell.style.minWidth = '45px';
            cell.style.maxWidth = '55px';
            cell.style.textAlign = 'center';
            cell.style.whiteSpace = 'nowrap';
            cell.className += ' text-center font-bold font-mono bg-slate-50/50';

            if (!isHeaderRow) {
              const currentTxt = (cell.textContent || '').trim();
              if (!currentTxt || /^[.\s\d]*$/.test(currentTxt) || currentTxt === '1') {
                cell.textContent = String(dataRowCounter);
              }
            }
          }

          // Formatear columna de FOLIOS / N° FOLIO
          if (colIndex === folioColIndex) {
            cell.style.width = '65px';
            cell.style.minWidth = '60px';
            cell.style.maxWidth = '75px';
            cell.style.textAlign = 'center';
            cell.style.whiteSpace = 'nowrap';
            cell.className += ' text-center font-mono';
          }
        });

        if (!isHeaderRow) {
          dataRowCounter++;
        }
      });
    });

    return container.innerHTML;
  } catch (e) {
    console.warn('Error mejorando tablas de Word:', e);
    return rawHtml;
  }
}

interface Props {
  user: AuthUser;
  isAdminView?: boolean;
}

export default function SecretariaDocumentosManager({ user, isAdminView = false }: Props) {
  const [documentos, setDocumentos] = useState<SecretariaDocumento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Formulario de Subida
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadNombre, setUploadNombre] = useState<string>('');
  const [uploadCategoria, setUploadCategoria] = useState<string>('Formatos de Cobro');
  const [uploadDescripcion, setUploadDescripcion] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  // Modal de Previsualización
  const [previewDoc, setPreviewDoc] = useState<SecretariaDocumento | null>(null);
  const [docHtmlContent, setDocHtmlContent] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!previewDoc) {
      setDocHtmlContent(null);
      setDocLoading(false);
      return;
    }

    const loadWordContent = async () => {
      const name = (previewDoc.fileName || previewDoc.nombre || '').toLowerCase();
      const isDocx = name.endsWith('.docx') || previewDoc.mimeType?.includes('officedocument');

      if (isDocx && previewDoc.fileUrl) {
        setDocLoading(true);
        setDocHtmlContent(null);
        try {
          const response = await fetch(previewDoc.fileUrl);
          const arrayBuffer = await response.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const enhancedHtml = enhanceWordTableHtml(result.value || '');

          setDocHtmlContent(enhancedHtml || '<p class="italic text-slate-500">Documento sin texto extraíble.</p>');
        } catch (err) {
          console.warn('Error al extraer HTML de Word:', err);
          setDocHtmlContent(null);
        } finally {
          setDocLoading(false);
        }
      } else {
        setDocHtmlContent(null);
        setDocLoading(false);
      }
    };

    loadWordContent();
  }, [previewDoc]);

  // Modal de Confirmación de Borrado
  const [deletingDoc, setDeletingDoc] = useState<SecretariaDocumento | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    loadDocumentos();
  }, []);

  const loadDocumentos = async () => {
    setLoading(true);
    try {
      const list = await supabaseService.getSecretariaDocumentos(user.secretariaId || '170');
      setDocumentos(list);
    } catch (e) {
      console.warn('Error cargando documentos de secretaría:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFileToUpload(selected);
      if (!uploadNombre) {
        // Quitar extensión para el nombre sugerido
        const baseName = selected.name.replace(/\.[^/.]+$/, '');
        setUploadNombre(baseName);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      setUploadError('Por favor seleccione un archivo (Word o PDF).');
      return;
    }
    if (!uploadNombre.trim()) {
      setUploadError('Ingrese un nombre o título para el documento.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      // Convertir archivo a Data URL como respaldo
      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        const dataUrl = readerEvent.target?.result as string;

        const isPdf = fileToUpload.type.includes('pdf') || fileToUpload.name.endsWith('.pdf');
        const isWord = fileToUpload.type.includes('word') || fileToUpload.name.endsWith('.doc') || fileToUpload.name.endsWith('.docx');
        const isExcel = fileToUpload.type.includes('sheet') || fileToUpload.type.includes('excel') || fileToUpload.name.endsWith('.xls') || fileToUpload.name.endsWith('.xlsx');

        let mimeType = fileToUpload.type || 'application/octet-stream';
        let tipo: 'pdf' | 'word' | 'excel' | 'otro' = 'otro';
        if (isPdf) tipo = 'pdf';
        else if (isWord) tipo = 'word';
        else if (isExcel) tipo = 'excel';

        const res = await supabaseService.saveSecretariaDocumento({
          secretariaId: user.secretariaId || '170',
          nombre: uploadNombre.trim(),
          categoria: uploadCategoria,
          descripcion: uploadDescripcion.trim(),
          fileName: fileToUpload.name,
          fileSize: fileToUpload.size,
          mimeType,
          fileUrl: dataUrl,
          subidoPorNombre: user.nombreCompleto,
          subidoPorDocumento: user.documentoIdentidad,
          file: fileToUpload,
        });

        if (res.success && res.doc) {
          setDocumentos(prev => [res.doc!, ...prev]);
          setUploadSuccess(true);
          setTimeout(() => {
            setShowUploadModal(false);
            setUploadSuccess(false);
            setFileToUpload(null);
            setUploadNombre('');
            setUploadDescripcion('');
          }, 1000);
        } else {
          setUploadError(res.error || 'No se pudo guardar el documento.');
        }
        setUploading(false);
      };

      reader.onerror = () => {
        setUploadError('Error leyendo el archivo local.');
        setUploading(false);
      };

      reader.readAsDataURL(fileToUpload);
    } catch (err: any) {
      setUploadError(err?.message || 'Error al procesar la subida.');
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      await supabaseService.deleteSecretariaDocumento(deletingDoc.id, deletingDoc.fileUrl, deletingDoc.storagePath);
      setDocumentos(prev => prev.filter(d => d.id !== deletingDoc.id));
      setDeletingDoc(null);
    } catch (e) {
      console.warn('Error eliminando documento:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileBadge = (doc: SecretariaDocumento) => {
    const name = (doc.fileName || doc.nombre || '').toLowerCase();
    const mime = (doc.mimeType || '').toLowerCase();

    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      return { label: 'PDF', bg: 'bg-red-100 text-red-800 border-red-200', icon: <FileText className="text-red-600" size={20} /> };
    }
    if (mime.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
      return { label: 'WORD', bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: <FileCode className="text-blue-600" size={20} /> };
    }
    if (mime.includes('excel') || mime.includes('sheet') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
      return { label: 'EXCEL', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <FileSpreadsheet className="text-emerald-600" size={20} /> };
    }
    return { label: 'DOC', bg: 'bg-slate-100 text-slate-800 border-slate-200', icon: <FileCheck className="text-slate-600" size={20} /> };
  };

  const filteredDocs = documentos.filter(doc => {
    const matchesSearch = doc.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'todos' || doc.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoriasUnicas = Array.from(new Set(documentos.map(d => d.categoria).filter(Boolean)));

  return (
    <div className="space-y-6">
      
      {/* BANNER ENCABEZADO */}
      <div className="bg-gradient-to-r from-emerald-900 via-[#006b33] to-emerald-950 text-white p-5 rounded-2xl shadow-md border border-emerald-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 size={16} />
            <span>Documentos e Instructivos de la Dependencia</span>
          </div>
          <h3 className="text-xl font-black text-white">
            {user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social'}
          </h3>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
            {isAdminView 
              ? 'Suba y gestione plantillas Word, formatos PDF, decretos y guías de supervisión oficial para que todos los contratistas puedan previsualizarlos y descargarlos.'
              : 'Consulte, previsualice y descargue las plantillas Word, formatos de cobro e instructivos oficiales cargados por la Supervisión.'}
          </p>
        </div>

        {isAdminView && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>Subir Nuevo Documento</span>
          </button>
        )}
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006b33]"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              selectedCategory === 'todos'
                ? 'bg-[#006b33] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({documentos.length})
          </button>
          {categoriasUnicas.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#006b33] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat} ({documentos.filter(d => d.categoria === cat).length})
            </button>
          ))}
        </div>
      </div>

      {/* LISTADO DE DOCUMENTOS */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#006b33] animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Cargando documentos institucionales...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FolderOpen size={24} />
          </div>
          <p className="text-sm font-bold text-slate-800">No hay documentos registrados</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isAdminView 
              ? 'Haga clic en "Subir Nuevo Documento" para publicar el primer formato Word o PDF para los contratistas.' 
              : 'Aún no se han publicado formatos o instructivos en esta secretaría.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map(doc => {
            const badge = getFileBadge(doc);
            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors shrink-0">
                      {badge.icon}
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-[#006b33] transition-colors">
                      {doc.nombre}
                    </h4>
                    {doc.descripcion && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {doc.descripcion}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-1 font-mono">
                    <span>{doc.fechaSubida}</span>
                    <span>{formatBytes(doc.fileSize)}</span>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#006b33] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye size={15} />
                    <span>Previsualizar</span>
                  </button>

                  <a
                    href={doc.fileUrl}
                    download={doc.fileName || `${doc.nombre}.${doc.mimeType?.includes('pdf') ? 'pdf' : 'docx'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center transition-colors"
                    title="Descargar archivo"
                  >
                    <Download size={15} />
                  </a>

                  {isAdminView && (
                    <button
                      onClick={() => setDeletingDoc(doc)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs flex items-center justify-center transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE SUBIDA DE DOCUMENTOS */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#006b33] font-bold text-sm uppercase">
                <Upload size={18} />
                <span>Subir Documento u Instructivo</span>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>¡Documento cargado correctamente!</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              
              {/* Dropzone / File Picker */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Archivo (PDF, Word o Excel) *</label>
                <div className="border-2 border-dashed border-slate-300 hover:border-[#006b33] rounded-2xl p-5 text-center bg-slate-50 hover:bg-emerald-50/50 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-2 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#006b33] flex items-center justify-center mx-auto">
                      <Upload size={20} />
                    </div>
                    {fileToUpload ? (
                      <div>
                        <p className="font-bold text-slate-900">{fileToUpload.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(fileToUpload.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-slate-800">Haga clic o arrastre su archivo aquí</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Soporta formatos Word (.docx/.doc), PDF y Excel</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Título / Nombre */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Título / Nombre del Documento *</label>
                <input
                  type="text"
                  placeholder="Ej. Formato de Cobro Mensual Word 2026"
                  value={uploadNombre}
                  onChange={(e) => setUploadNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006b33]"
                  required
                />
              </div>

              {/* Categoría */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Categoría</label>
                <select
                  value={uploadCategoria}
                  onChange={(e) => setUploadCategoria(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006b33]"
                >
                  <option value="Formatos de Cobro">Formatos de Cobro</option>
                  <option value="Guías de Supervisión">Guías de Supervisión</option>
                  <option value="Plantillas Word">Plantillas Word</option>
                  <option value="Decretos y Resoluciones">Decretos y Resoluciones</option>
                  <option value="Anexos Institucionales">Anexos Institucionales</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {/* Descripción */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Descripción o Instrucciones (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Diligencie los campos resaltados en amarillo antes de convertir a PDF..."
                  value={uploadDescripcion}
                  onChange={(e) => setUploadDescripcion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006b33]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-[#006b33] hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Publicar Documento</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PREVISUALIZACIÓN */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Header Modal */}
            <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 rounded-xl bg-white/10 text-amber-300 shrink-0">
                  {getFileBadge(previewDoc).icon}
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm sm:text-base text-white truncate">
                    {previewDoc.nombre}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono truncate">
                    {previewDoc.fileName} • {formatBytes(previewDoc.fileSize)} • Subido {previewDoc.fechaSubida}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.fileName || `${previewDoc.nombre}.${previewDoc.mimeType?.includes('pdf') ? 'pdf' : 'docx'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download size={14} />
                  <span>Descargar</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Viewer Content Body */}
            <div className="flex-1 bg-slate-100 p-2 sm:p-6 overflow-y-auto flex flex-col items-center justify-start min-h-[75vh]">
              {(() => {
                const badge = getFileBadge(previewDoc);
                const isPdf = badge.label === 'PDF' || previewDoc.mimeType?.includes('pdf') || previewDoc.fileUrl?.startsWith('data:application/pdf');

                if (isPdf) {
                  return (
                    <PdfCanvasViewer
                      fileUrl={previewDoc.fileUrl}
                      fileName={previewDoc.fileName || `${previewDoc.nombre}.pdf`}
                    />
                  );
                }

                if (docLoading) {
                  return (
                    <div className="my-auto text-center space-y-3 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-md">
                      <Loader2 className="w-10 h-10 text-[#006b33] animate-spin mx-auto" />
                      <p className="font-bold text-slate-800 text-sm">Cargando y extrayendo contenido del documento Word...</p>
                      <p className="text-xs text-slate-500">Transformando párrafos, tablas y textos a vista previa en pantalla.</p>
                    </div>
                  );
                }

                if (docHtmlContent) {
                  return (
                    <div className="w-full max-w-4xl bg-white p-6 sm:p-12 rounded-3xl shadow-xl border border-slate-200 text-slate-900 my-auto space-y-6 overflow-y-auto max-h-[78vh]">
                      <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2 font-sans text-xs text-slate-500 shrink-0">
                        <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-wider">
                          <FileCode size={18} />
                          <span>Contenido del Documento Word</span>
                        </div>
                        <span className="font-mono bg-slate-100 px-2 py-1 rounded text-[11px] font-bold text-slate-700">
                          {previewDoc.fileName}
                        </span>
                      </div>

                      <div
                        className="prose prose-slate max-w-none text-sm leading-relaxed font-sans text-slate-900 prose-headings:font-bold prose-headings:text-slate-900 prose-p:my-2 prose-[#006b33] overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: docHtmlContent }}
                      />
                    </div>
                  );
                }

                // Si es un archivo .doc antiguo o HTTP URL, intentar incrustar visor o mostrar tarjeta estructurada
                const isHttpUrl = previewDoc.fileUrl?.startsWith('http://') || previewDoc.fileUrl?.startsWith('https://');

                if (isHttpUrl) {
                  return (
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewDoc.fileUrl)}&embedded=true`}
                      title={previewDoc.nombre}
                      className="w-full h-full min-h-[75vh] rounded-2xl border border-slate-300 bg-white shadow-inner"
                    />
                  );
                }

                // Para otros casos: Mostrar resumen de metadatos + botón de descarga
                return (
                  <div className="max-w-2xl w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-md text-center space-y-6 my-auto">
                    <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                      {badge.icon}
                    </div>

                    <div className="space-y-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${badge.bg}`}>
                        Documento {badge.label}
                      </span>
                      <h4 className="text-xl font-black text-slate-900 leading-snug">
                        {previewDoc.nombre}
                      </h4>
                      {previewDoc.descripcion && (
                        <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {previewDoc.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-mono text-slate-700">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-sans font-bold">Nombre de archivo</p>
                        <p className="font-bold truncate mt-0.5">{previewDoc.fileName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-sans font-bold">Tamaño</p>
                        <p className="font-bold mt-0.5">{formatBytes(previewDoc.fileSize)}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-[10px] text-slate-400 uppercase font-sans font-bold">Fecha de publicación</p>
                        <p className="font-bold mt-0.5">{previewDoc.fechaSubida}</p>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <a
                        href={previewDoc.fileUrl}
                        download={previewDoc.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 py-3 bg-[#006b33] hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                      >
                        <Download size={16} />
                        <span>Descargar Archivo {badge.label}</span>
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-base">¿Eliminar este documento?</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                El documento <strong className="text-slate-900">"{deletingDoc.nombre}"</strong> dejará de estar disponible para todos los contratistas.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-center gap-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingDoc(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
