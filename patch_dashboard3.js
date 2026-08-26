import fs from 'fs';

let content = fs.readFileSync('src/components/ContratistaDashboard.tsx', 'utf-8');

const regex = /const loadContractorData = async \(\) => \{[\s\S]*?setLoadingDb\(false\);\n  \};/m;
const match = content.match(regex);
if (match) {
  const newLogic = `const loadContractorData = async () => {
    setLoadingDb(true);
    let dbReports: ReportData[] | null = null;
    
    try {
      dbReports = await supabaseService.getContractorReports(user.documentoIdentidad, user.id);
    } catch (e) {
      console.warn('Error loading reports from Supabase:', e);
    }

    const userDoc = user.documentoIdentidad || '';
    const userDocKey = userDoc ? \`_\${userDoc}\` : '';
    let finalReports: ReportData[] = [];

    // Si dbReports no es null, usamos la base de datos como fuente de verdad
    if (dbReports !== null) {
      const merged = dbReports.map(dbRep => {
        let local = localStorage.getItem(\`informe_data\${userDocKey}_\${dbRep.informeNro}\`) || 
                      localStorage.getItem(\`informe_data_\${userDoc}_\${dbRep.informeNro}\`);
        
        let localComments = localStorage.getItem(\`informe_comentarios_\${userDoc}_\${dbRep.informeNro}\`);
        
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

      finalReports = [...merged];

      // Añadir borradores locales que NUNCA han sido sincronizados a DB
      for (let i = 1; i <= 12; i++) {
        const saved = localStorage.getItem(\`informe_data\${userDocKey}_\${i}\`) || localStorage.getItem(\`informe_data_\${userDoc}_\${i}\`);
        const isDeleted = localStorage.getItem(\`deleted_report_\${userDoc}_\${i}\`) === 'true';
        if (saved && !isDeleted) {
          try {
            const parsed = JSON.parse(saved);
            // Si el borrador local NO existe en DB, y tiene syncedToDb = false o un ID de borrador, lo mantenemos
            if (!merged.some(r => r.informeNro === parsed.informeNro) && (!parsed.syncedToDb || parsed.id.startsWith('draft-'))) {
               finalReports.push(parsed);
            }
          } catch(e) {}
        }
      }
    } else {
      // FALLBACK 100% OFFLINE (dbReports es null por error de red)
      const wasExplicitlyDeleted = localStorage.getItem(\`deleted_report_\${userDoc}_1\`) === 'true';
      for (let i = 1; i <= 12; i++) {
        let saved = localStorage.getItem(\`informe_data\${userDocKey}_\${i}\`) || 
                      localStorage.getItem(\`informe_data_\${userDoc}_\${i}\`);
        
        let storedComm = localStorage.getItem(\`informe_comentarios_\${userDoc}_\${i}\`);
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
            if (!finalReports.some(r => r.informeNro === parsed.informeNro)) {
              finalReports.push(parsed);
            }
          } catch (e) {}
        }
      }

      // Generar plantilla inicial si está vacio
      if (finalReports.length === 0 && !wasExplicitlyDeleted) {
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
        finalReports.push(defaultInitial);
        localStorage.setItem(\`informe_data_\${user.documentoIdentidad}_1\`, JSON.stringify(defaultInitial));
      }
    }

    // Sort valid reports and cleanup
    finalReports.sort((a, b) => parseInt(b.informeNro || '0') - parseInt(a.informeNro || '0'));
    const { validReports } = await supabaseService.cleanupExpiredReports(finalReports, user.documentoIdentidad);

    setReportsList(validReports);
    setNewInformeNro((Math.max(...validReports.map(r => parseInt(r.informeNro || '0')), 0) + 1).toString());

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
  content = content.replace(regex, newLogic);
  fs.writeFileSync('src/components/ContratistaDashboard.tsx', content);
  console.log("Patched successfully");
} else {
  console.log("Regex did not match");
}
