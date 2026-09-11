import fs from 'fs';
let content = fs.readFileSync('src/components/ContratistaDashboard.tsx', 'utf-8');

const oldLogic = `  // Cargar datos reales desde Supabase y almacenamiento local
  const loadContractorData = async () => {
    setLoadingDb(true);
    try {
      const dbReports = await supabaseService.getContractorReports(user.documentoIdentidad, user.id);
      if (dbReports && dbReports.length > 0) {
        const userDoc = user.documentoIdentidad || '';
        const userDocKey = userDoc ? \`_\${userDoc}\` : '';
        const merged = dbReports.map(dbRep => {
          let local = localStorage.getItem(\`informe_data\${userDocKey}_\${dbRep.informeNro}\`) || 
                        localStorage.getItem(\`informe_data_\${userDoc}_\${dbRep.informeNro}\`);
          
          if (!local) {
             const generic = localStorage.getItem(\`informe_data_\${dbRep.informeNro}\`);
             if (generic) {
               try {
                 const parsed = JSON.parse(generic);
                 if (parsed.contratistaDocumento === user.documentoIdentidad) {
                    local = generic;
                 }
               } catch(e) {}
             }
          }

          let localComments = localStorage.getItem(\`informe_comentarios_\${userDoc}_\${dbRep.informeNro}\`);
          
          if (!localComments && local) {
             const genComm = localStorage.getItem(\`informe_comentarios_\${dbRep.informeNro}\`);
             if (genComm) {
               try {
                  const p = JSON.parse(local);
                  if (p.contratistaDocumento === user.documentoIdentidad) {
                     localComments = genComm;
                  }
               } catch(e) {}
             }
          }

          let rep: ReportData = { ...dbRep };
          if (localComments) {
            try {
              const parsedComm = JSON.parse(localComments);
              if (parsedComm && Object.keys(parsedComm).length > 0) {
                rep.comentariosCampos = { ...(rep.comentariosCampos || {}), ...parsedComm };
              }
            } catch (e) {}
          }

          if (local) {
            try {
              const parsed = JSON.parse(local);
              if (parsed.anexos && parsed.anexos.length > (rep.anexos?.length || 0)) {
                rep.anexos = parsed.anexos;
              }
              if (parsed.comentariosCampos && Object.keys(parsed.comentariosCampos).length > 0) {
                rep.comentariosCampos = { ...parsed.comentariosCampos, ...(rep.comentariosCampos || {}) };
              }
              if (parsed.estado) {
                if (parsed.estado === 'Devuelto' && rep.estado !== 'Aprobado') {
                  rep.estado = 'Devuelto';
                }
              }
            } catch (e) {}
          }

          if (rep.estado === 'Borrador') {
            rep.comentariosCampos = {};
          } else if (rep.comentariosCampos && Object.keys(rep.comentariosCampos).length > 0 && rep.estado !== 'Aprobado') {
            rep.estado = 'Devuelto';
          }
          return rep;
        });

        // Aplicar depuración automática de informes y fotos con antigüedad mayor a 7 meses (210 días)
        const { validReports } = await supabaseService.cleanupExpiredReports(merged, user.documentoIdentidad);

        setReportsList(validReports);
        setNewInformeNro((Math.max(...validReports.map(r => parseInt(r.informeNro || '0')), 0) + 1).toString());

        // Detectar si hay informes aprobados para notificar
        const approved = validReports.filter(r => r.estado === 'Aprobado');
        if (approved.length > 0) {
          const unnotified = approved.filter(r => {
            const key = \`notified_approved_\${user.documentoIdentidad}_\${r.informeNro}\`;
            return sessionStorage.getItem(key) !== 'seen';
          });
          if (unnotified.length > 0) {
            setApprovedReportsToNotify(unnotified);
            setShowApprovalModal(true);
          }
        }

        setLoadingDb(false);
        return;
      }
    } catch (e) {
      console.warn('Error loading reports from Supabase:', e);
    }

    // Fallback a almacenamiento local si no hay en la BD o está offline
    const userDoc = user.documentoIdentidad || '';
    const userDocKey = userDoc ? \`_\${userDoc}\` : '';
    const wasExplicitlyDeleted = localStorage.getItem(\`deleted_report_\${userDoc}_1\`) === 'true';

    const localList: ReportData[] = [];
    for (let i = 1; i <= 12; i++) {
      let saved = localStorage.getItem(\`informe_data\${userDocKey}_\${i}\`) || 
                    localStorage.getItem(\`informe_data_\${userDoc}_\${i}\`);
      
      if (!saved) {
         const generic = localStorage.getItem(\`informe_data_\${i}\`);
         if (generic) {
           try {
             const parsed = JSON.parse(generic);
             if (parsed.contratistaDocumento === user.documentoIdentidad) {
                saved = generic;
             }
           } catch(e) {}
         }
      }

      let storedComm = localStorage.getItem(\`informe_comentarios_\${userDoc}_\${i}\`);
      if (!storedComm && saved) {
         const genComm = localStorage.getItem(\`informe_comentarios_\${i}\`);
         if (genComm) {
           try {
              const p = JSON.parse(saved);
              if (p.contratistaDocumento === user.documentoIdentidad) {
                 storedComm = genComm;
              }
           } catch(e) {}
         }
      }

      const isDeleted = localStorage.getItem(\`deleted_report_\${userDoc}_\${i}\`) === 'true' || localStorage.getItem(\`deleted_report_\${i}\`) === 'true';
      if (saved && !isDeleted) {
        try {
          const parsed = JSON.parse(saved);
          if (storedComm) {
            try {
              const parsedComm = JSON.parse(storedComm);
              parsed.comentariosCampos = { ...(parsed.comentariosCampos || {}), ...parsedComm };
            } catch (e) {}
          }
          if (parsed.comentariosCampos && Object.keys(parsed.comentariosCampos).length > 0 && parsed.estado !== 'Aprobado') {
            parsed.estado = 'Devuelto';
          }
          if (!localList.some(r => r.informeNro === parsed.informeNro)) {
            localList.push(parsed);
          }
        } catch (e) {}
      }
    }

    // Si aún no tiene informes guardados y no fue borrado expresamente, inicializar con la plantilla contractual editable
    if (localList.length === 0 && !wasExplicitlyDeleted) {
      const defaultInitial: ReportData = {
        ...initialMockData,
        id: \`draft-\${Date.now()}\`,
        informeNro: '1',
        tipoInforme: 'Mensual',
        fechaPresentacion: new Date().toLocaleDateString('es-CO'),
        periodoDesde: '01/07/2026',
        periodoHasta: '31/07/2026',
        fechaAplicacion: formatFechaAplicacion('31/07/2026', '01/07/2026'),
        estado: 'Borrador',
        contratistaNombre: user.nombreCompleto || 'CONTRATISTA REGISTRADO',
        contratistaDocumento: user.documentoIdentidad || '',
        contratistaCorreo: user.email || '',
        contratistaTelefono: user.telefono || '3104567890',
        secretariaNombre: user.secretariaNombre || 'Secretaría de Inclusión y Cohesión Social',
        secretariaCodigo: user.secretariaCodigo || '170',
        contratoNro: user.contratoNro || '015',
        valorContrato: user.valorContrato || '$ 20.029.800',
        supervisorNombre: user.supervisorNombre || 'DIANA ANDREA MOSQUERA GARCIA',
        syncedToDb: false,
      };
      localList.push(defaultInitial);
      // Opcional: auto-guardar este borrador inicial
      localStorage.setItem(\`informe_data_\${user.documentoIdentidad}_1\`, JSON.stringify(defaultInitial));
    }

    // Aplicar depuración a la lista local
    const { validReports } = await supabaseService.cleanupExpiredReports(localList, user.documentoIdentidad);

    setReportsList(validReports);
    setNewInformeNro((Math.max(...validReports.map(r => parseInt(r.informeNro || '0')), 0) + 1).toString());

    // Detectar si hay informes aprobados para notificar en la lista local
    const approved = validReports.filter(r => r.estado === 'Aprobado');
    if (approved.length > 0) {
      const unnotified = approved.filter(r => {
        const key = \`notified_approved_\${user.documentoIdentidad}_\${r.informeNro}\`;
        return sessionStorage.getItem(key) !== 'seen';
      });
      if (unnotified.length > 0) {
        setApprovedReportsToNotify(unnotified);
        setShowApprovalModal(true);
      }
    }

    setLoadingDb(false);
  };`;

// Check if oldLogic exists exactly. To be safer, I'll extract it using regex.
