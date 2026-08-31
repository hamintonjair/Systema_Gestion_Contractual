import html2pdf from 'html2pdf.js';

export interface PDFExportOptions {
  informeNro: string;
  contratistaNombre: string;
  contratoNro?: string;
}

/**
 * Genera y descarga el archivo PDF oficial del Informe de Actividades
 */
export const exportInformeToPDF = async (options: PDFExportOptions): Promise<boolean> => {
  const element = document.getElementById('informe-printable-document');
  
  if (!element) {
    console.warn('Elemento #informe-printable-document no está visible o montado. Usando impresión nativa.');
    const oldTitle = document.title;
    document.title = "Formato Informe De Cumplimiento";
    window.print();
    document.title = oldTitle;
    return false;
  }

  const filename = `Formato Informe De Cumplimiento.pdf`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const oldTitle = document.title;
    document.title = "Formato Informe De Cumplimiento";
    window.print();
    document.title = oldTitle;
    return true;
  }

  const opt = {
    margin: [8, 8, 8, 8] as [number, number, number, number],
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 1.5, 
      useCORS: true,
      allowTaint: true,
      logging: false,
      letterRendering: true,
      windowWidth: 1024
    },
    jsPDF: { unit: 'mm' as const, format: 'letter' as const, orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    await html2pdf().set(opt).from(element).save();
    setTimeout(() => {
      window.focus();
      if (document.activeElement && 'blur' in document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
    }, 300);
    return true;
  } catch (error) {
    console.error('Error al generar PDF con html2pdf:', error);
    // Fallback suave a impresión nativa del navegador
    try {
      window.print();
    } catch (e) {
      console.warn('Error en fallback de impresión:', e);
    }
    setTimeout(() => {
      window.focus();
    }, 300);
    return false;
  }
};

/**
 * Abre el diálogo nativo de impresión del navegador con restauración de foco
 */
export const printInformeNative = () => {
  try {
    window.print();
  } catch (e) {
    console.warn('Error en printInformeNative:', e);
  } finally {
    setTimeout(() => {
      window.focus();
    }, 300);
  }
};
