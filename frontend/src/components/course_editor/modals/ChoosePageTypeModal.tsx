import React from 'react';

interface ChoosePageTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'METHODICAL' | 'ASSIGNMENT') => void;
}

const ChoosePageTypeModal: React.FC<ChoosePageTypeModalProps> = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Выберите тип страницы</h3>
        <div className="space-y-3">
          <button
            onClick={() => { onSelectType('METHODICAL'); onClose(); }}
            className="w-full btn-primary py-2.5"
          >
            Методическая страница (Markdown)
          </button>
          <button
            onClick={() => { onSelectType('ASSIGNMENT'); onClose(); }}
            className="w-full btn-primary py-2.5"
          >
            Страница с заданиями
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full btn-outline mt-4 py-2.5"
        >
          Отмена
        </button>
      </div>
    </div>
  );
};

export default ChoosePageTypeModal;