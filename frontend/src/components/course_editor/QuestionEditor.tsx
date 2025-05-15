// ==== File: frontend/src/components/course_editor/QuestionEditor.tsx ====
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
// import { v4 as uuidv4 } from 'uuid'; // Not used directly here if options are created by parent
import type { Question, QuestionOption } from '@/types/Course';
import { createNewQuestionOption } from '@/types/Course';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onQuestionChange: (updatedQuestion: Question) => void;
  onDeleteQuestion: (questionId: string) => void;
  provided?: any;
  isDragDisabled?: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  onQuestionChange,
  onDeleteQuestion,
  provided,
  isDragDisabled = false
}) => {
  const [text, setText] = useState(question.text);
  const [type, setType] = useState<Question['type']>(question.type);
  const [options, setOptions] = useState<QuestionOption[]>(question.options || []);
  const [correctAnswer, setCorrectAnswer] = useState<string>(question.correct_answer || '');

  useEffect(() => {
    setText(question.text);
    setType(question.type);
    setOptions(question.options || []);
    setCorrectAnswer(question.correct_answer || '');
  }, [question]);

  // Memoized function to prevent unnecessary re-creation if props don't change
  const triggerQuestionUpdate = useCallback(() => {
      onQuestionChange({ 
        id: question.id, // always pass id
        page_id: question.page_id, // pass existing page_id
        text, 
        type, 
        options, 
        correct_answer: correctAnswer, 
        sort_order: question.sort_order // maintain sort_order
    });
  }, [text, type, options, correctAnswer, onQuestionChange, question.id, question.page_id, question.sort_order]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value);
  const handleTextBlur = () => {
    if (text !== question.text) {
        triggerQuestionUpdate();
    }
  };

  const handleCorrectAnswerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCorrectAnswer(e.target.value);
  };
  const handleCorrectAnswerBlur = () => {
    if (correctAnswer !== (question.correct_answer || '')) {
        triggerQuestionUpdate();
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as Question['type'];
    setType(newType); // Update local state first
    
    let newOptionsState = type === newType ? options : []; // Keep options if type is same, else clear
    let newCorrectAnswerState = type === newType ? correctAnswer : '';

    if (!['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(newType)) {
        newOptionsState = [];
    } else if (newOptionsState.length === 0 && ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(newType)) {
        newOptionsState = [createNewQuestionOption(0)];
    }
    if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(newType)) {
        newCorrectAnswerState = '';
    }
    
    setOptions(newOptionsState);
    setCorrectAnswer(newCorrectAnswerState);

    // Call onQuestionChange with all updated state values
    onQuestionChange({
        id: question.id,
        page_id: question.page_id,
        text: text, // use current text state
        type: newType,
        options: newOptionsState,
        correct_answer: newCorrectAnswerState,
        sort_order: question.sort_order
    });
  };
  
  const handleOptionChange = (optIndex: number, field: keyof QuestionOption, value: string | boolean) => {
    const newOptions = options.map((opt, i) =>
      i === optIndex ? { ...opt, [field]: value } : opt
    );
    if (type === 'SINGLE_CHOICE' && field === 'is_correct' && value === true) {
        newOptions.forEach((opt, i) => { if (i !== optIndex) opt.is_correct = false; });
    }
    setOptions(newOptions);
    // Update immediately with new options
    onQuestionChange({ ...question, text, type, options: newOptions, correct_answer: correctAnswer });
  };

  const addOption = () => {
    const newOpt = createNewQuestionOption(options.length);
    const newOptions = [...options, newOpt];
    setOptions(newOptions);
    onQuestionChange({ ...question, text, type, options: newOptions, correct_answer: correctAnswer });
  };

  const deleteOption = (optIndex: number) => {
    const newOptions = options.filter((_, i) => i !== optIndex).map((opt, i) => ({...opt, sort_order: i}));
    setOptions(newOptions);
    onQuestionChange({ ...question, text, type, options: newOptions, correct_answer: correctAnswer });
  };

  const onOptionDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(options);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const finalOptions = items.map((opt, idx) => ({ ...opt, sort_order: idx }));
    setOptions(finalOptions);
    onQuestionChange({ ...question, text, type, options: finalOptions, correct_answer: correctAnswer });
  };

  const questionTypeLabels: Record<Question['type'], string> = {
    SINGLE_CHOICE: "Один вариант",
    MULTIPLE_CHOICE: "Несколько вариантов",
    TEXT_INPUT: "Текстовый ответ",
    CODE_INPUT: "Код",
  };

  return (
    <div 
        ref={provided?.innerRef} 
        {...provided?.draggableProps} 
        className="p-4 border border-gray-300 rounded-lg mb-4 bg-white shadow"
        style={provided?.draggableProps.style}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-grow">
            <div className="flex items-center">
                {!isDragDisabled && provided?.dragHandleProps && (
                    <button type="button" {...provided.dragHandleProps} className="p-1 text-gray-400 hover:text-gray-600 mr-2 cursor-grab focus:outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                        </svg>
                    </button>
                )}
                <label htmlFor={`qtext-${question.id}`} className="text-sm font-medium text-gray-700">
                Вопрос {index + 1}
                </label>
            </div>
        </div>
        <button
          onClick={() => onDeleteQuestion(question.id)}
          className="text-red-500 hover:text-red-700 text-xs p-1 rounded hover:bg-red-50"
          title="Удалить вопрос"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <textarea
        id={`qtext-${question.id}`}
        value={text}
        onChange={handleTextChange}
        onBlur={handleTextBlur} // Uses triggerQuestionUpdate via handleTextBlur
        placeholder="Текст вопроса (Markdown)..."
        rows={3}
        className="form-textarea w-full text-sm mb-3"
      />
      <div className="mb-4">
        <label htmlFor={`qtype-${question.id}`} className="text-xs font-medium text-gray-600 mr-2">Тип:</label>
        <select
          id={`qtype-${question.id}`}
          value={type}
          onChange={handleTypeChange} // This now calls onQuestionChange directly
          className="form-select text-xs py-1 px-2 rounded-md"
        >
          {(Object.keys(questionTypeLabels) as Array<Question['type']>).map(key => (
            <option key={key} value={key}>{questionTypeLabels[key]}</option>
          ))}
        </select>
      </div>

      {(type === 'TEXT_INPUT' || type === 'CODE_INPUT') && (
        <div className="mb-4">
          <label htmlFor={`qcorrect-${question.id}`} className="block text-xs font-medium text-gray-600 mb-1">
            Правильный ответ ({type === 'CODE_INPUT' ? 'точная строка или шаблон' : 'точная строка'})
          </label>
          <textarea
            id={`qcorrect-${question.id}`}
            value={correctAnswer}
            onChange={handleCorrectAnswerChange}
            onBlur={handleCorrectAnswerBlur} // Uses triggerQuestionUpdate via handleCorrectAnswerBlur
            placeholder="Введите единственно верный ответ..."
            rows={type === 'CODE_INPUT' ? 4 : 2}
            className="form-textarea w-full text-sm"
          />
           <p className="text-xs text-gray-500 mt-1">Для текстовых ответов сравнение обычно регистрозависимое и чувствительно к пробелам. Для кода, если нужна проверка сложнее, это потребует отдельной логики на бэкенде.</p>
        </div>
      )}

      {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
        <div className="space-y-2 pl-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Варианты ответов:</label>
            <DragDropContext onDragEnd={onOptionDragEnd}>
                <Droppable droppableId={`options-${question.id}`} type={`options-${question.id}`}>
                    {(providedList) => (
                    <div {...providedList.droppableProps} ref={providedList.innerRef}>
                        {options.map((opt, optIndex) => (
                        <Draggable key={opt.id} draggableId={opt.id.toString()} index={optIndex}>
                            {(providedItem) => (
                            <div
                                ref={providedItem.innerRef}
                                {...providedItem.draggableProps}
                                className="flex items-center space-x-2 mb-1.5 p-1.5 bg-gray-50 rounded"
                            >
                                <button type="button" {...providedItem.dragHandleProps} className="p-0.5 text-gray-400 hover:text-gray-600 cursor-grab focus:outline-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>
                                </button>
                                <input
                                    type={type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                                    name={`qopt-correct-${question.id}-${index}`} // Make name more unique for radios if multiple questions on page
                                    checked={opt.is_correct}
                                    onChange={(e) => handleOptionChange(optIndex, 'is_correct', e.target.checked)}
                                    className={`form-${type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} h-3.5 w-3.5 text-orange-600 focus:ring-orange-500 border-gray-300`}
                                />
                                <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => handleOptionChange(optIndex, 'label', e.target.value)}
                                onBlur={triggerQuestionUpdate} 
                                placeholder={`Вариант ${optIndex + 1}`}
                                className="form-input flex-grow text-xs px-2 py-1"
                                />
                                <button
                                onClick={() => deleteOption(optIndex)}
                                className="text-red-400 hover:text-red-600 text-xs p-0.5 rounded hover:bg-red-50"
                                title="Удалить вариант"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            )}
                        </Draggable>
                        ))}
                        {providedList.placeholder}
                    </div>
                    )}
                </Droppable>
            </DragDropContext>
          <button
            onClick={addOption}
            className="text-xs text-orange-600 hover:text-orange-700 border border-orange-500 rounded px-2 py-1 hover:bg-orange-50"
          >
            + Добавить вариант
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionEditor;