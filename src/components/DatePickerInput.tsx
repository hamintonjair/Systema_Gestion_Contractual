import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

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

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_HEADER = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/**
 * Convierte cualquier formato válido (DD/MM/AAAA o AAAA-MM-DD) a objeto Date seguro
 */
function parseDateString(val?: string): { day: number; month: number; year: number } | null {
  if (!val || val === 'N/A' || val.trim() === '') return null;
  const str = val.trim();
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return { day: d, month: m, year: y };
      }
    }
  }
  
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return { day: d, month: m, year: y };
        }
      } else if (parts[2].length === 4) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return { day: d, month: m, year: y };
        }
      }
    }
  }
  return null;
}

function formatToDDMMYYYY(day: number, month: number, year: number): string {
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  return `${d}/${m}/${year}`;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value = '',
  onChange,
  placeholder = 'DD/MM/AAAA',
  className = '',
  disabled = false,
  required = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = parseDateString(value);
  const today = new Date();
  
  const [currentYear, setCurrentYear] = useState<number>(parsed ? parsed.year : today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(parsed ? parsed.month - 1 : today.getMonth()); // 0-indexed

  // Sincronizar año y mes cuando cambia el valor externo
  useEffect(() => {
    if (parsed) {
      setCurrentYear(parsed.year);
      setCurrentMonth(parsed.month - 1);
    }
  }, [value]);

  // Cerrar el popover al hacer clic afuera o presionar Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = formatToDDMMYYYY(day, currentMonth + 1, currentYear);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const d = today.getDate();
    const m = today.getMonth() + 1;
    const y = today.getFullYear();
    onChange(formatToDDMMYYYY(d, m, y));
    setCurrentMonth(today.getMonth());
    setCurrentYear(y);
    setIsOpen(false);
  };

  const handleSelectMonthStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(formatToDDMMYYYY(1, currentMonth + 1, currentYear));
    setIsOpen(false);
  };

  const handleSelectMonthEnd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    onChange(formatToDDMMYYYY(lastDay, currentMonth + 1, currentYear));
    setIsOpen(false);
  };

  // Cálculo de los días del mes para la grilla
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  // Ajuste para que la semana empiece en Lunes (0 = Domingo -> 6, 1 = Lunes -> 0)
  const startingCol = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDaysArray = Array.from({ length: startingCol }, (_, i) => i);

  // Años disponibles para selección rápida
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full">
        <input
          type="text"
          id={id}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pr-8 cursor-pointer ${className}`}
        />
        
        {/* Botón con el ícono de calendario que despliega el calendario interactivo */}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(prev => !prev);
          }}
          title="Abrir selector de fecha (calendario)"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors focus:outline-none disabled:opacity-40 z-10 ${
            isOpen ? 'bg-emerald-100 text-emerald-900' : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
          }`}
        >
          <CalendarIcon size={16} className="cursor-pointer" />
        </button>
      </div>

      {/* Popover Calendario Interactivo */}
      {isOpen && !disabled && (
        <div 
          className="absolute z-50 mt-1.5 left-0 w-72 bg-white rounded-xl shadow-xl border border-emerald-200 p-3 animate-in fade-in zoom-in-95 duration-100 text-gray-800"
          style={{ minWidth: '280px' }}
        >
          {/* Cabecera del Mes y Año */}
          <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-gray-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-md px-1.5 py-1 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={idx} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-1 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_HEADER.map((dName, idx) => (
              <span key={idx} className="text-[10px] font-bold text-gray-600 uppercase">
                {dName}
              </span>
            ))}
          </div>

          {/* Grilla de Días del Mes */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {emptyDaysArray.map((_, idx) => (
              <div key={`empty-${idx}`} className="h-7 w-7" />
            ))}

            {daysArray.map((dayNum) => {
              const isSelected = parsed && parsed.day === dayNum && parsed.month === (currentMonth + 1) && parsed.year === currentYear;
              const isToday = today.getDate() === dayNum && (today.getMonth() === currentMonth) && (today.getFullYear() === currentYear);

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-7 w-7 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-xs scale-105'
                      : isToday
                      ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-400 hover:bg-emerald-200'
                      : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Accesos Rápidos para Fechas Contractuales */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-1 text-[10px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              Hoy
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSelectMonthStart}
                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition-colors"
                title="Seleccionar el 01 del mes"
              >
                01 (Inicio)
              </button>
              <button
                type="button"
                onClick={handleSelectMonthEnd}
                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition-colors"
                title="Seleccionar último día del mes (30 o 31)"
              >
                Fin de Mes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePickerInput;
