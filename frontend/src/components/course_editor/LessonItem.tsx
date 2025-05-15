// ==== File: frontend/src/components/course_editor/LessonItem.tsx ====
import React from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import type { LessonIdentifiable } from '@/types/Course';

interface LessonItemProps {
  lesson: LessonIdentifiable;
  index: number;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onSelectLesson: (lessonId: string) => void;
  onContextMenu: (event: React.MouseEvent, lessonId: string) => void;
  isSelected: boolean;
}

// Компонент для "фиктивного" урока-кнопки "+"
export const AddLessonButtonPlaceholder: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 mb-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 
                 hover:text-orange-600 hover:border-orange-500 transition-colors 
                 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
      title="Добавить новый урок"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};


const LessonItem: React.FC<LessonItemProps> = ({
  lesson,
  index,
  provided,
  snapshot,
  onSelectLesson,
  onContextMenu,
  isSelected,
}) => {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onSelectLesson(lesson.id)}
      onContextMenu={(e) => onContextMenu(e, lesson.id)}
      className={`
        p-3 mb-2 rounded-lg border cursor-grab transition-all duration-150 ease-in-out
        flex items-center space-x-3
        ${snapshot.isDragging ? 'bg-orange-100 border-orange-300 shadow-lg' : 'bg-white border-gray-200 hover:bg-gray-50'}
        ${isSelected ? 'border-orange-500 ring-2 ring-orange-500 ring-offset-0 bg-orange-50' : ''}
      `}
      style={{
        ...provided.draggableProps.style,
      }}
    >
      <span className="text-sm font-medium text-gray-500 w-6 text-center flex-shrink-0">{index + 1}.</span>
      <span className="text-sm text-gray-800 truncate flex-grow min-w-0">{lesson.title || 'Новый урок'}</span>
    </div>
  );
};

export default LessonItem;