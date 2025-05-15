import React, { useState, useEffect } from 'react';
import type { LessonPage } from '@/types/Course';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface MethodicalPageEditorProps {
  page: LessonPage;
  onContentChange: (pageId: string, newContent: string) => void;
  onTitleChange: (pageId: string, newTitle: string) => void;
}

const MethodicalPageEditor: React.FC<MethodicalPageEditorProps> = ({ page, onContentChange, onTitleChange }) => {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setTitle(page.title);
    setContent(page.content);
    setShowPreview(false); // Reset to edit mode when page changes
  }, [page]);

  const handleTitleBlur = () => {
    if (title.trim() !== page.title) {
      onTitleChange(page.id, title.trim() || "Без названия");
    }
  };
  
  const handleContentBlur = () => {
    if (content !== page.content) {
      onContentChange(page.id, content);
    }
  };


  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`pageTitle-${page.id}`} className="block text-sm font-medium text-gray-700 mb-1">
          Название страницы
        </label>
        <input
          id={`pageTitle-${page.id}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Название методической страницы"
          className="form-input w-full"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
            <label htmlFor={`pageContent-${page.id}`} className="block text-sm font-medium text-gray-700">
            Содержимое (Markdown)
            </label>
            <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
            >
            {showPreview ? 'Редактировать' : 'Предпросмотр'}
            </button>
        </div>
        {showPreview ? (
            // Apply prose classes for Tailwind Typography styling
            <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none p-3 border border-gray-300 rounded-md min-h-[200px] bg-gray-50">
                {content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown> : <p className="italic text-gray-400">Нет содержимого для предпросмотра.</p>}
            </div>
        ) : (
            <textarea
            id={`pageContent-${page.id}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleContentBlur}
            placeholder="Введите содержимое страницы в формате Markdown..."
            rows={15}
            className="form-textarea w-full text-sm font-mono" // font-mono helps with markdown editing
            />
        )}
      </div>
       <p className="text-xs text-gray-500">Изменения сохраняются автоматически при потере фокуса полей или при общем сохранении структуры курса.</p>
    </div>
  );
};

export default MethodicalPageEditor;