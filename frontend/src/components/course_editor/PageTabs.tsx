import React from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import type { LessonPage } from '@/types/Course';

interface PageTabProps {
  page: LessonPage;
  index: number;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  isSelected: boolean;
  onSelectPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}

const PageTab: React.FC<PageTabProps> = ({ page, index, provided, snapshot, isSelected, onSelectPage, onDeletePage }) => {
  const pageDisplayName = page.title || `Страница ${index + 1}`; // Calculate display name first

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onSelectPage(page.id)}
      className={`
        flex items-center px-3 py-2 mr-2 rounded-md cursor-grab border
        transition-all duration-150 ease-in-out whitespace-nowrap
        ${snapshot.isDragging ? 'bg-orange-100 border-orange-300 shadow-md' : 'bg-white hover:bg-gray-50'}
        ${isSelected ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50 text-orange-700 font-medium' : 'border-gray-300 text-gray-700'}
      `}
      style={{ ...provided.draggableProps.style }}
      title={page.title}
    >
      <span className="text-xs truncate max-w-[120px]">{page.title || `Страница ${index + 1}`}</span>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent onSelectPage
          // Use the pre-calculated pageDisplayName
          if (window.confirm(`Удалить страницу "${pageDisplayName}"?`)) {
            onDeletePage(page.id);
          }
        }}
        className="ml-2 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 focus:outline-none"
        title="Удалить страницу"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export const AddPageButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-2 rounded-md border-2 border-dashed border-gray-300 text-gray-500
                 hover:text-orange-600 hover:border-orange-500 transition-colors
                 focus:outline-none focus:ring-1 focus:ring-orange-500"
      title="Добавить новую страницу"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};

export default PageTab;