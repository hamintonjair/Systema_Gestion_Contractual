import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerInputProps {
  value?: string; // Formato DD/MM/AAAA o AAAA-MM-DD
  onChange: (valueDDMMYYYY: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  allowNA?: boolean;
}

/**
 * Convierte DD/MM/AAAA a AAAA-MM-DD para el input type="date"
 */
function toIsoDate(val?: string): string {
  if (!val || val === 'N/A') return '';
  const str = val.trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return str;
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return '';
}

/**
 * Convierte AAAA-MM-DD a DD/MM/AAAA
 */
function toDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value = '',
  onChange,
  placeholder = 'DD/MM/AAAA',
  className = '',
  disabled = false,
  required = false,
  id,
  allowNA = false,
}) => {
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = () => {
    if (disabled) return;
    if (hiddenDateRef.current) {
      if (typeof hiddenDateRef.current.showPicker === 'function') {
        try {
          hiddenDateRef.current.showPicker();
        } catch {
          hiddenDateRef.current.focus();
        }
      } else {
        hiddenDateRef.current.focus();
      }
    }
  };

  const handleHiddenDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIso = e.target.value;
    if (selectedIso) {
      onChange(toDDMMYYYY(selectedIso));
    }
  };

  return (
    <div className="relative flex items-center w-full group">
      <input
        type="text"
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pr-6 ${className}`}
      />
      
      {/* Botón con el ícono de calendario que despliega el date picker nativo */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpenPicker}
        title="Abrir selector de fecha (calendario)"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors focus:outline-none disabled:opacity-40"
      >
        <Calendar size={15} className="cursor-pointer" />
      </button>

      {/* Input de fecha oculto nativo que provee el calendario desplegable */}
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={toIsoDate(value)}
        onChange={handleHiddenDateChange}
        className="sr-only absolute opacity-0 pointer-events-none"
      />
    </div>
  );
};

export default DatePickerInput;
