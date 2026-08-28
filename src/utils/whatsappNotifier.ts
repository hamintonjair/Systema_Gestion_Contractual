import { FieldComment, ReportData } from '../types';

export interface WhatsAppNotificationPayload {
  tipo: 'aprobado' | 'devuelto' | 'recordatorio';
  contratistaNombre: string;
  contratistaTelefono?: string;
  contratistaDocumento?: string;
  informeNro: string;
  contratoNro: string;
  periodoDesde?: string;
  periodoHasta?: string;
  supervisorNombre: string;
  secretariaNombre: string;
  comentariosCampos?: Record<string, FieldComment>;
  appUrl?: string;
}

/**
 * Normaliza un número telefónico de Colombia para WhatsApp (+57)
 */
export const formatColombianPhoneForWhatsApp = (rawPhone?: string): string => {
  if (!rawPhone) return '';
  // Eliminar todo lo que no sea dígito
  const digits = rawPhone.replace(/\D/g, '');
  
  if (!digits) return '';

  // Si ya tiene el código de país 57 al inicio y tiene 12 dígitos
  if (digits.startsWith('57') && digits.length === 12) {
    return digits;
  }

  // Si es un celular de Colombia estándar de 10 dígitos (ej. 3101234567)
  if (digits.length === 10 && digits.startsWith('3')) {
    return `57${digits}`;
  }

  // Si tiene 11 dígitos y empieza por 573
  if (digits.length === 12 && digits.startsWith('573')) {
    return digits;
  }

  // Si tiene menos de 10 dígitos o formato desconocido, devolver lo que tenga
  return digits.length === 10 ? `57${digits}` : digits;
};

/**
 * Genera el texto formal oficial para el mensaje de WhatsApp
 */
export const generateWhatsAppMessage = (payload: WhatsAppNotificationPayload): string => {
  const {
    tipo,
    contratistaNombre,
    informeNro,
    contratoNro,
    periodoDesde,
    periodoHasta,
    supervisorNombre,
    secretariaNombre,
    comentariosCampos,
    appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-lcuenae36vdqnc5x4idqnr-736890033354.us-east1.run.app'
  } = payload;

  const header = `*ALCALDÍA DE QUIBDÓ - SUPERVISIÓN CONTRACTUAL*\n_${secretariaNombre}_\n`;
  const saludo = `Hola, estimado(a) *${contratistaNombre.trim()}*.\n`;

  if (tipo === 'aprobado') {
    return `${header}
${saludo}
*INFORME MENSUAL APROBADO*

Le informamos que su *Informe Mensual de Actividades #${informeNro}* correspondiente al Contrato de Prestación de Servicios *#${contratoNro}* (Período: ${periodoDesde || ''} al ${periodoHasta || ''}) ha sido *REVISADO Y APROBADO SATISFACTORIAMENTE* por la supervisora *${supervisorNombre}*.

* Su informe ya se encuentra aprobado y listo para su impresión y entrega a la Secretaría para su firma.

* Puede ingresar a la plataforma para descargar su copia oficial en PDF:
${appUrl}

_Mensaje oficial emitido desde el Panel de Supervisión Municipal._`;
  }

  if (tipo === 'devuelto') {
    const commentsList = comentariosCampos ? (Object.values(comentariosCampos) as FieldComment[]) : [];
    const pendingComments = commentsList.filter(c => !c.corregido);
    
    let commentsText = '';
    if (pendingComments.length > 0) {
      commentsText = `\n*Observaciones Registradas (${pendingComments.length}):*\n` + 
        pendingComments.map((c, i) => {
          const field = c.nombreCampo || c.campoId || `Campo ${i + 1}`;
          let prefix = '•';
          const fieldLower = field.toLowerCase();
          if (fieldLower.includes('certificado de supervisión')) prefix = '📋';
          else if (fieldLower.includes('fiduciaria') || fieldLower.includes('pagos')) prefix = '🏛️';
          else if (fieldLower.includes('declaración') || fieldLower.includes('juramento')) prefix = '⚖️';
          else if (fieldLower.includes('desembolso')) prefix = '💳';
          else prefix = '📄';
          
          return `${prefix} *${field}:* ${c.comentario}`;
        }).join('\n') + '\n';
    } else if (commentsList.length > 0) {
      commentsText = `\n*Observaciones Registradas:*\n` + 
        commentsList.map((c, i) => {
          const field = c.nombreCampo || c.campoId || `Campo ${i + 1}`;
          const isFixed = Boolean(c.corregido);
          return `${isFixed ? '🟢' : '⚠️'} *${field}:* ${c.comentario} ${isFixed ? '_(Subsanado)_' : ''}`;
        }).join('\n') + '\n';
    }

    return `${header}
${saludo}
*NOTIFICACIÓN DE OBSERVACIONES EN SU INFORME Y CERTIFICADOS*

Le informamos que su *Informe Mensual #${informeNro}* (Contrato *#${contratoNro}*) ha sido revisado por la supervisora *${supervisorNombre}* y presenta observaciones en los documentos correspondientes que deben ser corregidas para proceder con la aprobación de su pago.
${commentsText}
* Por favor ingrese a la plataforma, revise las pestañas resaltadas, realice las modificaciones y presione *"Marcar como Subsanado"* o *"Radicar / Reenviar Informe"*:
${appUrl}

_Quedamos atentos a su pronta radicación corregida._`;
  }

  // Recordatorio
  return `${header}
${saludo}
*RECORDATORIO DE SUPERVISIÓN*

Le recordamos verificar el estado de su *Informe Mensual #${informeNro}* correspondiente al Contrato *#${contratoNro}*.

* Ingrese a la plataforma institucional:
${appUrl}

_Supervisión: ${supervisorNombre}_`;
};

/**
 * Abre WhatsApp con notificación específica para un certificado/documento (1 al 5)
 */
export const openWhatsAppForCertificate = (params: {
  docName: string;
  informeNro: string;
  contratoNro: string;
  contratistaNombre: string;
  telefono?: string;
  comentario: string;
  isSubsanado?: boolean;
  supervisorNombre?: string;
  secretariaNombre?: string;
}) => {
  const {
    docName,
    informeNro,
    contratoNro,
    contratistaNombre,
    telefono,
    comentario,
    isSubsanado = false,
    supervisorNombre = 'Supervisora Municipal',
    secretariaNombre = 'Secretaría Institucional'
  } = params;

  const phone = formatColombianPhoneForWhatsApp(telefono);
  const header = `*ALCALDÍA DE QUIBDÓ - SUPERVISIÓN CONTRACTUAL*\n_${secretariaNombre}_\n`;
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-lcuenae36vdqnc5x4idqnr-736890033354.us-east1.run.app';

  let message = '';
  if (isSubsanado) {
    message = `${header}
Hola, apreciado(a) supervisora *${supervisorNombre}*.

*NOTIFICACIÓN DE SUBSANACIÓN REALIZADA*

Le informo que he corregido y marcado como *SUBSANADO* el documento *${docName}* correspondiente al *Informe Mensual #${informeNro}* (Contrato *#${contratoNro}*).

• *Observación Atendida:* "${comentario}"

Quedo atento(a) a su revisión y validación final en la plataforma institucional:
${appUrl}

_Atentamente: ${contratistaNombre}_`;
  } else {
    message = `${header}
Hola, estimado(a) *${contratistaNombre.trim()}*.

*NOTIFICACIÓN DE OBSERVACIÓN EN ${docName.toUpperCase()}*

Le informamos que en la revisión de su *Informe Mensual #${informeNro}* (Contrato *#${contratoNro}*), la supervisora *${supervisorNombre}* ha registrado la siguiente observación en el *${docName}*:

• *Observación:* "${comentario}"

Por favor ingrese a la plataforma, efectúe el ajuste correspondiente y presione *"Marcar como Subsanado"*:
${appUrl}

_Supervisión: ${supervisorNombre}_`;
  }

  const encodedText = encodeURIComponent(message);
  const url = phone ? `https://wa.me/${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
};

/**
 * Abre la API de WhatsApp Web / App con el mensaje y destinatario
 */
export const openWhatsAppNotification = (payload: WhatsAppNotificationPayload, customMessage?: string): boolean => {
  const phone = formatColombianPhoneForWhatsApp(payload.contratistaTelefono);
  const message = customMessage || generateWhatsAppMessage(payload);
  const encodedText = encodeURIComponent(message);

  let url = '';
  if (phone) {
    url = `https://wa.me/${phone}?text=${encodedText}`;
  } else {
    // Si no tiene teléfono, abrir con el texto precargado para seleccionar contacto
    url = `https://wa.me/?text=${encodedText}`;
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
};
