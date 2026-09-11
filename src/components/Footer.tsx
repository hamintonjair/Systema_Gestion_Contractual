import React from 'react';
import { Github, Linkedin, ShieldCheck, Heart, Code2, Globe } from 'lucide-react';
import QuibdoLogo from './QuibdoLogo';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 print:hidden text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-b border-slate-800 pb-6">
          {/* Identidad Institucional */}
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-xs border border-white/10">
              <QuibdoLogo className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">
                Alcaldía Municipal de Quibdó
              </h3>
              <p className="text-[11px] text-emerald-400 font-semibold">
                Secretaría de Inclusión y Cohesión Social
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Chocó, Colombia &bull; Transparencia y Eficiencia Operativa
              </p>
            </div>
          </div>

          {/* Estado del Sistema */}
          <div className="flex flex-col items-center md:items-center text-center space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Plataforma Oficial de Informes y Cuentas de Cobro</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Optimizando la gestión documental de los contratistas del municipio.
            </p>
          </div>

          {/* Desarrollador y Enlaces Sociales */}
          <div className="flex flex-col md:items-end justify-center space-y-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              Desarrollado con <Heart size={12} className="text-red-500 fill-red-500" /> por
              <strong className="text-white font-bold">Haminton Mena Mena</strong>
            </span>

            <div className="flex items-center gap-2">
              <a
                href="https://github.com/hamintonjair"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all group font-semibold text-[11px]"
                title="Perfil de GitHub de Haminton Mena"
              >
                <Github size={14} className="text-slate-400 group-hover:text-white transition-colors" />
                <span>GitHub</span>
              </a>

              <a
                href="https://www.linkedin.com/in/haminton-mena-mena-haminton/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-200 hover:text-white border border-blue-800/60 transition-all group font-semibold text-[11px]"
                title="Perfil de LinkedIn de Haminton Mena"
              >
                <Linkedin size={14} className="text-blue-400 group-hover:text-white transition-colors" />
                <span>LinkedIn</span>
              </a>
            </div>
          </div>
        </div>

        {/* Derechos de Autor */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>
            &copy; {currentYear} Alcaldía Municipal de Quibdó. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Protección de Datos Supabase SSL Encrypted</span>
            </span>
            <span>&bull;</span>
            <span className="text-slate-400">Versión 2.5 Pro</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
