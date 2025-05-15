import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import type { LessonPage, Question } from '@/types/Course';
import QuestionEditor from './QuestionEditor';
import { createNewQuestion } from '@/types/Course';

interface AssignmentPageEditorProps {
  page: LessonPage;
  onQuestionsChange: (pageId: string, newQuestions: Question[]) => void;
  onTitleChange: (pageId: string, newTitle: string) => void;
}

const AssignmentPageEditor: React.FC<AssignmentPageEditorProps> = ({ page, onQuestionsChange, onTitleChange }) => {
  const [title, setTitle] = useState(page.title);
  const [questions, setQuestions] = useState<Question[]>(page.questions || []);

  useEffect(() => {
    setTitle(page.title);
    setQuestions(page.questions || []);
  }, [page]);

  const handleTitleBlur = () => {
    if (title.trim() !== page.title) {
      onTitleChange(page.id, title.trim() || "Без названия");
    }
  };
  
  const handleAddQuestion = () => {
    const newQ = createNewQuestion(questions.length);
    const newQuestions = [...questions, newQ];
    setQuestions(newQuestions);
    onQuestionsChange(page.id, newQuestions);
  };

  const handleQuestionChange = (updatedQuestion: Question) => {
    const newQuestions = questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q);
    setQuestions(newQuestions);
    onQuestionsChange(page.id, newQuestions);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const newQuestions = questions.filter(q => q.id !== questionId).map((q, i) => ({...q, sort_order: i}));
    setQuestions(newQuestions);
    onQuestionsChange(page.id, newQuestions);
  };

  const onQuestionDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const finalQuestions = items.map((q, idx) => ({ ...q, sort_order: idx }));
    setQuestions(finalQuestions);
    onQuestionsChange(page.id, finalQuestions);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor={`pageTitle-assignment-${page.id}`} className="block text-sm font-medium text-gray-700 mb-1">
          Название страницы (задания)
        </label>
        <input
          id={`pageTitle-assignment-${page.id}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Название задания"
          className="form-input w-full"
        />
      </div>

      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">Вопросы:</h4>
        {questions.length === 0 && (
            <p className="text-sm text-gray-500 italic">На этой странице пока нет вопросов.</p>
        )}
        <DragDropContext onDragEnd={onQuestionDragEnd}>
            <Droppable droppableId={`questionsList-${page.id}`} type={`questions-${page.id}`}>
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                        {questions.map((q, index) => (
                            <Draggable key={q.id} draggableId={q.id} index={index}>
                                {(providedDraggable) => (
                                    <QuestionEditor
                                        question={q}
                                        index={index}
                                        onQuestionChange={handleQuestionChange}
                                        onDeleteQuestion={handleDeleteQuestion}
                                        provided={providedDraggable}
                                    />
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>

        <button
          onClick={handleAddQuestion}
          className="mt-4 btn-outline text-sm py-2 px-3"
        >
          + Добавить вопрос
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-4">Изменения сохраняются автоматически при общем сохранении уроков.</p>
    </div>
  );
};

export default AssignmentPageEditor;