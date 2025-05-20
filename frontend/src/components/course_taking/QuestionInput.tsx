// ==== File: frontend/src/components/course_taking/QuestionInput.tsx ====
import React from 'react';
import type { Question, UserAnswerSubmission } from '@/types/Course';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface QuestionInputProps {
  question: Question;
  questionIndex: number;
  currentAnswer: UserAnswerSubmission | undefined;
  onAnswerChange: (questionId: string, answer: UserAnswerSubmission) => void;
  onSubmitAnswer: (questionId: string) => void;
  onRetryQuestion: (questionId: string) => void;
  isSubmitting: boolean;
}

const QuestionInput: React.FC<QuestionInputProps> = ({
  question,
  questionIndex,
  currentAnswer,
  onAnswerChange,
  onSubmitAnswer,
  onRetryQuestion,
  isSubmitting,
}) => {
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onAnswerChange(question.id, { answerText: e.target.value });
  };

  const handleSingleChoiceChange = (optionId: string) => {
    onAnswerChange(question.id, { selectedOptionIds: [optionId] });
  };

  const handleMultiChoiceChange = (optionId: string, checked: boolean) => {
    const currentSelected = currentAnswer?.selectedOptionIds || [];
    let newSelected: string[];
    if (checked) {
      newSelected = [...currentSelected, optionId];
    } else {
      newSelected = currentSelected.filter(id => id !== optionId);
    }
    onAnswerChange(question.id, { selectedOptionIds: newSelected });
  };
  
  const feedbackClass = question.isCorrect === true ? 'border-green-500 bg-green-50' 
                     : question.isCorrect === false ? 'border-red-500 bg-red-50' 
                     : 'border-gray-200 bg-white';
  
  // Главное условие блокировки: если вопрос уже правильно отвечен ИЛИ если IsAttemptAllowed явно false.
  // Если isCorrect === null (еще не отвечали), то isAttemptAllowed должно быть true.
  // Если isCorrect === false, то isAttemptAllowed решает, можно ли еще пытаться.
  const disableInputs = isSubmitting || question.isCorrect === true || (question.isAttemptAllowed === false && question.isCorrect !== null);


  return (
    <div className={`p-4 border rounded-lg shadow-sm mb-6 ${feedbackClass}`}>
      <div className="font-medium text-gray-800 mb-2">
        Вопрос {questionIndex + 1}:
      </div>
      <div className="prose prose-sm max-w-none mb-4 text-gray-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.text}</ReactMarkdown>
      </div>

      {question.type === 'SINGLE_CHOICE' && (
        <div className="space-y-2">
          {question.options.map(opt => (
            <label key={opt.id} className={`flex items-center p-2 rounded-md hover:bg-gray-100 border border-gray-200 has-[:checked]:bg-orange-50 has-[:checked]:border-orange-400 ${disableInputs ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt.id}
                checked={currentAnswer?.selectedOptionIds?.includes(opt.id) || false}
                onChange={() => handleSingleChoiceChange(opt.id)}
                disabled={disableInputs}
                className="form-radio h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
              />
              <span className="ml-3 text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="space-y-2">
          {question.options.map(opt => (
            <label key={opt.id} className={`flex items-center p-2 rounded-md hover:bg-gray-100 border border-gray-200 has-[:checked]:bg-orange-50 has-[:checked]:border-orange-400 ${disableInputs ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                value={opt.id}
                checked={currentAnswer?.selectedOptionIds?.includes(opt.id) || false}
                onChange={(e) => handleMultiChoiceChange(opt.id, e.target.checked)}
                disabled={disableInputs}
                className="form-checkbox h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {(question.type === 'TEXT_INPUT' || question.type === 'CODE_INPUT') && (
        <textarea
          value={currentAnswer?.answerText || ''}
          onChange={handleTextChange}
          rows={question.type === 'CODE_INPUT' ? 6 : 3}
          className={`form-textarea w-full text-sm ${disableInputs ? 'bg-gray-100 opacity-70' : ''}`}
          placeholder={question.type === 'CODE_INPUT' ? "Введите ваш код..." : "Введите ваш ответ..."}
          disabled={disableInputs}
        />
      )}
      
      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        {/* Показываем кнопку "Ответить" только если:
            1. Попытка разрешена (isAttemptAllowed === true)
            2. Вопрос еще не был правильно отвечен (isCorrect !== true)
            3. Вопрос не находится в процессе отправки (isSubmitting === false)
        */}
        {question.isAttemptAllowed && question.isCorrect !== true && !isSubmitting && (
            <button
                onClick={() => onSubmitAnswer(question.id)}
                className="btn-primary text-sm py-1.5 px-3"
            >
                Ответить
            </button>
        )}
         {isSubmitting && (
             <span className="text-sm text-gray-500 italic">Отправка...</span>
         )}


        {question.isCorrect === true && <span className="text-sm font-medium text-green-600">Верно! {question.feedback || ''}</span>}
        
        {question.isCorrect === false && (
            <div className="flex items-center gap-2">
                 <span className="text-sm font-medium text-red-600">Неверно. {question.feedback || ''}</span>
                {/* Показываем "Попробовать снова" только если попытка разрешена (т.е. isAttemptAllowed === true) */}
                {question.isAttemptAllowed && ( 
                    <button
                        onClick={() => onRetryQuestion(question.id)}
                        className="btn-outline text-xs py-1 px-2 border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                        Попробовать снова
                    </button>
                )}
            </div>
        )}
        {/* Если isCorrect === false И isAttemptAllowed === false, значит попытки закончились */}
         {question.isCorrect === false && !question.isAttemptAllowed && (
             <span className="text-sm font-medium text-gray-500 italic">Попытки закончились.</span>
         )}
      </div>
    </div>
  );
};

export default QuestionInput;