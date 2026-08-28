/**
 * Utilidades para clasificar observaciones/comentarios
 * según pertenezcan al Informe Mensual Principal (1) o a los Certificados Adicionales (2 al 5)
 */

export function isCertificateComment(c: any): boolean {
  if (!c) return false;
  const fid = String(c.campoId || c.fieldId || '').toLowerCase();
  const fn = String(c.nombreCampo || c.fieldName || '').toLowerCase();
  
  return (
    fid === 'certificado_supervision' || 
    fid.startsWith('cert_') || 
    fn.includes('certificado de supervisión') ||
    fid === 'soporte_fiduciaria' || 
    fid.startsWith('fid_') || 
    fn.includes('fiduciaria') || 
    fn.includes('soporte fiduciario') ||
    fid === 'declaracion_juramento' || 
    fid.startsWith('dec_') || 
    fn.includes('declaración') || 
    fn.includes('juramento') ||
    fid === 'autorizacion_desembolso' || 
    fid.startsWith('desemb_') || 
    fn.includes('desembolso')
  );
}

export function isMainReportComment(c: any): boolean {
  return !isCertificateComment(c);
}
