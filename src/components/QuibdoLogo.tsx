import React, { useState } from 'react';

export const QUIBDO_LOGO_URLS = [
  'https://usdsynzkedjydlynkala.supabase.co/storage/v1/object/public/anexos/logo/logo%20alcaldia.png',
  'https://usdsynzkedjydlynkala.supabase.co/storage/v1/object/public/anexos/logo/logo.png',
  'https://usdsynzkedjydlynkala.supabase.co/storage/v1/object/public/anexos/logo_alcaldia.png',
  'https://usdsynzkedjydlynkala.supabase.co/storage/v1/object/public/anexos/logo.png',
];
export const QUIBDO_LOGO_URL = QUIBDO_LOGO_URLS[0];

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'shield-only' | 'text-only' | 'horizontal';
  showNit?: boolean;
}

export default function QuibdoLogo({ 
  className = '', 
  size = 'md', 
  variant = 'full',
  showNit = false 
}: LogoProps) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  const handleImgError = () => {
    if (urlIndex < QUIBDO_LOGO_URLS.length - 1) {
      setUrlIndex(prev => prev + 1);
    } else {
      setImgError(true);
    }
  };

  const currentUrl = QUIBDO_LOGO_URLS[urlIndex];

  const sizeDimensions = {
    sm: { height: 42, width: 42, textHeight: 28 },
    md: { height: 68, width: 68, textHeight: 40 },
    lg: { height: 96, width: 96, textHeight: 56 },
    xl: { height: 130, width: 130, textHeight: 76 },
  };

  const current = sizeDimensions[size];

  // Si se solicita la imagen oficial y está disponible
  if (!imgError) {
    if (variant === 'shield-only') {
      return (
        <div className={`inline-flex items-center justify-center shrink-0 bg-transparent ${className}`}>
          <img
            src={currentUrl}
            alt="Escudo de Quibdó"
            className="object-contain bg-transparent mix-blend-multiply"
            style={{ height: `${current.height}px`, width: 'auto', maxHeight: `${current.height}px` }}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={handleImgError}
          />
        </div>
      );
    }

    if (variant === 'horizontal') {
      return (
        <div className={`inline-flex items-center gap-2.5 shrink-0 bg-transparent ${className}`}>
          <img
            src={currentUrl}
            alt="Alcaldía de Quibdó"
            className="object-contain bg-transparent mix-blend-multiply"
            style={{ height: `${current.height}px`, width: 'auto', maxHeight: `${current.height}px` }}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={handleImgError}
          />
          {showNit && (
            <span className="text-slate-500 font-bold text-[10px] tracking-wide self-end mb-1">
              NIT: 891680011-0
            </span>
          )}
        </div>
      );
    }

    return (
      <div className={`flex flex-col items-center justify-center text-center bg-transparent ${className}`}>
        <img
          src={currentUrl}
          alt="Alcaldía de Quibdó"
          className="object-contain bg-transparent mix-blend-multiply"
          style={{ height: `${current.height}px`, width: 'auto', maxHeight: `${current.height}px` }}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
        {showNit && (
          <span className="text-slate-500 font-bold tracking-wide mt-1.5 text-[10px]">
            NIT: 891680011-0
          </span>
        )}
      </div>
    );
  }

  // Fallback Vectorial si no hay conexión o falla la imagen
  const renderVectorFallback = () => (
    <svg 
      width={current.width} 
      height={current.height} 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-xs select-none"
    >
      <circle cx="100" cy="100" r="92" stroke="#006b33" strokeWidth="12" strokeDasharray="300 300" strokeDashoffset="0" />
      <circle cx="100" cy="100" r="92" stroke="#c8102e" strokeWidth="12" strokeDasharray="140 450" strokeDashoffset="-320" />
      <circle cx="100" cy="100" r="92" stroke="#eab308" strokeWidth="3" strokeDasharray="80 500" strokeDashoffset="-280" />
      <circle cx="100" cy="100" r="85" fill="#ffffff" />
      <path id="curveText" d="M 30,100 A 70,70 0 0,1 170,100" fill="none" stroke="none" />
      <text fill="#006b33" fontSize="13.5" fontWeight="800" letterSpacing="2.5" textAnchor="middle">
        <textPath href="#curveText" startOffset="50%">
          MUNICIPIO DE QUIBDÓ
        </textPath>
      </text>
      <circle cx="100" cy="46" r="6" fill="#f59e0b" />
      <path d="M94 52 C94 48, 106 48, 106 52 L108 58 L92 58 Z" fill="#92400e" />
      <path d="M60 55 L90 75 L60 85 Z" fill="#006b33" />
      <path d="M140 55 L110 75 L140 85 Z" fill="#c8102e" />
      <ellipse cx="100" cy="104" rx="42" ry="46" fill="#f8fafc" stroke="#b45309" strokeWidth="2.5" />
      <path d="M60 90 Q100 80 140 90 L140 106 Q100 100 60 106 Z" fill="#e0f2fe" />
      <path d="M60 106 Q100 100 140 106 L140 126 Q100 122 60 126 Z" fill="#38bdf8" />
      <path d="M60 126 Q100 122 140 126 L140 138 C140 152, 100 154, 60 138 Z" fill="#dc2626" opacity="0.85" />
      <path d="M72 152 Q100 148 128 152 Q100 158 72 152 Z" fill="#006b33" stroke="#eab308" strokeWidth="0.8" />
      <text x="100" y="153.5" fill="#fef08a" fontSize="5.5" fontWeight="700" textAnchor="middle">
        Municipio de Quibdó
      </text>
    </svg>
  );

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {renderVectorFallback()}
      <div className="mt-1 flex flex-col items-center">
        <span className="font-extrabold uppercase tracking-widest text-[#006b33] text-[10px]">
          ALCALDÍA DE
        </span>
        <div className="flex items-baseline font-black tracking-tight text-sm">
          <span className="text-[#006b33]">QUIB</span>
          <span className="text-[#c8102e]">DÓ</span>
        </div>
        {showNit && (
          <span className="text-slate-500 font-bold tracking-wide mt-1 text-[9px]">
            NIT: 891680011-0
          </span>
        )}
      </div>
    </div>
  );
}
