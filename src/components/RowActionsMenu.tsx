import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}

interface Props {
  actions: RowAction[];
  align?: 'left' | 'right';
  buttonClassName?: string;
}

export default function RowActionsMenu({ actions, align = 'right', buttonClassName }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Más acciones"
        className={
          buttonClassName ||
          'p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors'
        }
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 z-30`}
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              title={a.title}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors ${
                a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-800 hover:bg-gray-100'
              }`}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
