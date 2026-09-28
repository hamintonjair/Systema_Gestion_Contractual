import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Download, Loader2, FileText, ExternalLink, RefreshCw } from 'lucide-react';

// Configurar Worker de PDF.js desde CDN para compatibilidad universal en Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

interface Props {
  fileUrl: string;
  fileName?: string;
}

export default function PdfCanvasViewer({ fileUrl, fileName = 'documento.pdf' }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Convertir Data URL base64 a Uint8Array
  const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1] || dataUrl;
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);
    setPdfDoc(null);

    const loadPdfData = async () => {
      try {
        let bytes: Uint8Array;

        if (fileUrl.startsWith('data:')) {
          bytes = dataUrlToUint8Array(fileUrl);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          if (isMounted) setBlobUrl(URL.createObjectURL(blob));
        } else {
          const response = await fetch(fileUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const arrayBuf = await response.arrayBuffer();
          bytes = new Uint8Array(arrayBuf);
          const blob = new Blob([arrayBuf], { type: 'application/pdf' });
          if (isMounted) setBlobUrl(URL.createObjectURL(blob));
        }

        // Cargar documento en PDF.js pasando el array binario en memoria
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        if (!isMounted) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.warn('Advertencia en carga PDF.js, activando visor alternativo nativo/embed:', err);
        if (!isMounted) return;
        setError(true);
        setLoading(false);
      }
    };

    loadPdfData();

    return () => {
      isMounted = false;
    };
  }, [fileUrl]);

  // Renderizar páginas en canvas cuando pdfDoc esté listo
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;

    let isSubscribed = true;

    const renderPages = async () => {
      for (let i = 1; i <= numPages; i++) {
        if (!isSubscribed) break;
        const canvas = canvasRefs.current[i - 1];
        if (!canvas) continue;

        try {
          const page = await pdfDoc.getPage(i);
          if (!isSubscribed) break;

          const viewport = page.getViewport({ scale });
          const context = canvas.getContext('2d');

          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };

            await page.render(renderContext).promise;
          }
        } catch (e) {
          console.warn(`Error renderizando página ${i}:`, e);
        }
      }
    };

    renderPages();

    return () => {
      isSubscribed = false;
    };
  }, [pdfDoc, numPages, scale]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.6));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] w-full p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
        <Loader2 className="w-10 h-10 text-[#006b33] animate-spin" />
        <p className="font-bold text-slate-800 text-sm">Cargando páginas del documento PDF...</p>
        <p className="text-xs text-slate-500">Procesando vista previa interactiva en pantalla.</p>
      </div>
    );
  }

  // Si falló el renderizado Canvas por alguna razón, usar el visor nativo de objetos/embed de navegador o Google Docs Viewer
  if (error || !pdfDoc) {
    const targetUrl = blobUrl || fileUrl;
    const isHttp = fileUrl.startsWith('http://') || fileUrl.startsWith('https://');

    return (
      <div className="flex flex-col w-full h-full min-h-[75vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="bg-slate-950 text-white px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
            <FileText size={16} className="text-red-400" />
            <span>Vista de Documento PDF</span>
          </div>
        </div>

        <div className="flex-1 w-full h-full bg-slate-100 flex items-center justify-center p-2">
          {targetUrl ? (
            <object
              data={targetUrl}
              type="application/pdf"
              className="w-full h-full min-h-[72vh] rounded-xl border border-slate-300 bg-white shadow-sm"
            >
              {isHttp ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                  title={fileName}
                  className="w-full h-full min-h-[72vh] rounded-xl border border-slate-300 bg-white"
                />
              ) : (
                <embed src={targetUrl} type="application/pdf" className="w-full h-full min-h-[72vh]" />
              )}
            </object>
          ) : (
            <div className="text-center p-8 space-y-4">
              <p className="text-slate-700 font-bold">Documento disponible para visualización y descarga.</p>
              <a
                href={fileUrl}
                download={fileName}
                className="px-6 py-2.5 bg-[#006b33] text-white font-bold rounded-xl text-xs inline-flex items-center gap-2"
              >
                <Download size={16} />
                <span>Abrir / Descargar PDF</span>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[75vh] bg-slate-900/95 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      
      {/* Toolbar */}
      <div className="bg-slate-950 text-white px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
          <FileText size={16} className="text-red-400" />
          <span>{numPages} {numPages === 1 ? 'Página' : 'Páginas'} en total</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.6}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-30"
            title="Reducir zoom"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono font-bold text-slate-300 px-2">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-30"
            title="Aumentar zoom"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Rendered pages container */}
      <div
        ref={containerRef}
        className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col items-center space-y-6 bg-slate-800/80 custom-scrollbar max-h-[75vh]"
      >
        {Array.from({ length: numPages }, (_, index) => (
          <div key={index + 1} className="flex flex-col items-center space-y-2 max-w-full">
            <div className="bg-white p-2 rounded-xl shadow-2xl border border-slate-700/50 max-w-full overflow-x-auto">
              <canvas
                ref={(el) => (canvasRefs.current[index] = el)}
                className="max-w-full h-auto block rounded-lg bg-white"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-900/90 px-2.5 py-0.5 rounded-full border border-slate-700">
              Página {index + 1} de {numPages}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
