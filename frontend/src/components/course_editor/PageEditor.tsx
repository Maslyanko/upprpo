import React from 'react';
import type { LessonPage } from '@/types/Course';
import MethodicalPageEditor from './MethodicalPageEditor';
import AssignmentPageEditor from './AssignmentPageEditor';

interface PageEditorProps {
  page: LessonPage | null; // Can be null if no page is selected
  onContentChange: (pageId: string, newContent: string) => void; // For methodical
  onQuestionsChange: (pageId: string, newQuestions: any[]) => void; // For assignment
  onPageTitleChange: (pageId: string, newTitle: string) => void; // For both
}

const PageEditor: React.FC<PageEditorProps> = ({
  page,
  onContentChange,
  onQuestionsChange,
  onPageTitleChange,
}) => {
  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-300 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-gray-500">Выберите страницу для редактирования или добавьте новую.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 max-w-full"> {/* Changed max-w-2xl to full */}
      {page.page_type === 'METHODICAL' && (
        <MethodicalPageEditor
          page={page}
          onContentChange={onContentChange}
          onTitleChange={onPageTitleChange}
        />
      )}
      {page.page_type === 'ASSIGNMENT' && (
        <AssignmentPageEditor
          page={page}
          onQuestionsChange={onQuestionsChange}
          onTitleChange={onPageTitleChange}
        />
      )}
    </div>
  );
};

export default PageEditor;