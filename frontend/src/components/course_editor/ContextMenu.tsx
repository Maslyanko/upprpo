// ==== File: frontend/src/components/course_editor/ContextMenu.tsx ====
import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onAddAfter: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onDelete, onAddAfter }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-48"
      style={{ top: y, left: x }}
    >
      <button
        onClick={() => { onAddAfter(); onClose(); }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
      >
        Добавить урок после
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        Удалить урок
      </button>
    </div>
  );
};

export default ContextMenu;