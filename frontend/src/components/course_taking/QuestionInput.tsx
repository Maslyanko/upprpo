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
  onRetryQuestion: (questionId: string) => void; // NEW: For retrying
  isSubmitting: boolean;
}

const QuestionInput: React.FC<QuestionInputProps> = ({
  question,
  questionIndex,
  currentAnswer,
  onAnswerChange,
  onSubmitAnswer,
  onRetryQuestion, // NEW
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
  
  // Disable inputs if the question is answered correctly OR if an attempt is not allowed (though isAttemptAllowed is primary)
  const disableInputs = isSubmitting || question.isCorrect === true || !question.isAttemptAllowed;

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
          className={`form-textarea w-full text-sm ${disableInputs ? 'bg-gray-100' : ''}`}
          placeholder={question.type === 'CODE_INPUT' ? "Введите ваш код..." : "Введите ваш ответ..."}
          disabled={disableInputs}
        />
      )}
      
      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        {question.isAttemptAllowed && question.isCorrect === null && ( // Show "Ответить" only if attempt allowed and not yet answered
            <button
                onClick={() => onSubmitAnswer(question.id)}
                disabled={isSubmitting}
                className="btn-primary text-sm py-1.5 px-3"
            >
                {isSubmitting ? 'Отправка...' : 'Ответить'}
            </button>
        )}

        {question.isCorrect === true && <span className="text-sm font-medium text-green-600">Верно! {question.feedback || ''}</span>}
        
        {question.isCorrect === false && (
            <div className="flex items-center gap-2">
                 <span className="text-sm font-medium text-red-600">Неверно. {question.feedback || ''}</span>
                {question.isAttemptAllowed && ( // Show retry only if attempts are still allowed
                    <button
                        onClick={() => onRetryQuestion(question.id)}
                        className="btn-outline text-xs py-1 px-2 border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                        Попробовать снова
                    </button>
                )}
            </div>
        )}
         {question.isCorrect !== null && !question.isAttemptAllowed && question.isCorrect === false && (
             <span className="text-sm font-medium text-gray-500 italic">Попытки закончились.</span>
         )}
      </div>
    </div>
  );
};

export default QuestionInput;