// ==== File: frontend/src/pages/CourseTakingPage.tsx ====
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCourseById, markLessonCompleteApi, submitAnswerApi } from '@/api/coursesApi';
import type { Course, LessonEditable, LessonPage, Question, UserAnswerSubmission } from '@/types/Course';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QuestionInput from '@/components/course_taking/QuestionInput';

// Icons
const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </svg>
);
const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const CourseTakingPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonEditable[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCompletingLesson, setIsCompletingLesson] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<Record<string, boolean>>({});

  const [pageAnswers, setPageAnswers] = useState<Record<string, UserAnswerSubmission>>({});

  // Helper to initialize/reset question states within lessons
  // This should be called carefully to not overwrite user's current input in `pageAnswers`
  const initializeQuestionStatesInLessons = (lessonArray: LessonEditable[]): LessonEditable[] => {
    return lessonArray.map(l => ({
      ...l,
      pages: (l.pages || []).map(p => ({
        ...p,
        questions: (p.questions || []).map(q => {
            // If question was answered correctly, attempt is not allowed.
            // Otherwise, allow attempt unless explicitly set to false elsewhere.
            const allowAttempt = q.isCorrect === true ? false : (q.isAttemptAllowed !== undefined ? q.isAttemptAllowed : true);
            return {
                ...q,
                isAttemptAllowed: allowAttempt,
                // DO NOT reset userAnswer here, it's managed by pageAnswers and handleAnswerChange
            };
        })
      }))
    }));
  };


  const fetchCourseData = useCallback(async (resetNavigation = true) => {
    if (!courseId) {
      setError("ID курса не указан."); setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);
    try {
      const courseData = await getCourseById(courseId); 
      if (!courseData || !courseData.lessons || !Array.isArray(courseData.lessons)) {
        throw new Error("Некорректные данные курса получены.");
      }
      setCourse(courseData);
      
      let sortedLessons = (courseData.lessons as LessonEditable[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(l => ({
            ...l,
            pages: (l.pages || []).sort((pa, pb) => pa.sort_order - pb.sort_order)
        }));

      sortedLessons = initializeQuestionStatesInLessons(sortedLessons);
      setLessons(sortedLessons);

      document.title = `Изучение: ${courseData.title || 'Курс'} - AI-Hunt`;

      if(resetNavigation) {
        let initialLessonIdx = sortedLessons.findIndex(l => !l.completedByUser);
        if (initialLessonIdx === -1 && sortedLessons.length > 0) initialLessonIdx = 0;
        else if (initialLessonIdx === -1) initialLessonIdx = 0; 

        setCurrentLessonIndex(initialLessonIdx);
        setCurrentPageIndex(0);
      }
      setPageAnswers({}); // Clear local pageAnswers cache on full data fetch/reload

    } catch (err: any) {
      console.error("Error fetching course for taking:", err);
      setError("Не удалось загрузить курс. " + (err.message || ""));
      setCourse(null);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]); // Removed dependencies that were causing issues

  useEffect(() => {
    if (!authLoading && user) {
        fetchCourseData(); // Call fetchCourseData when auth state is ready
    } else if (!authLoading && !user) {
        navigate('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, courseId, navigate]);
  
  // This effect runs when the current page/lesson changes
  useEffect(() => {
    setPageAnswers({}); // Clear answers for the new page
    setActionError(null); 
    // No need to call initializeQuestionStatesInLessons here again if fetchCourseData does it
    // and fetchCourseData is called appropriately when data needs refresh.
    // The key is that the `lessons` state itself should hold the correct `isAttemptAllowed`.
  }, [currentPageIndex, currentLessonIndex]);


  const currentLesson = useMemo(() => lessons[currentLessonIndex], [lessons, currentLessonIndex]);
  const currentPage = useMemo(() => currentLesson?.pages[currentPageIndex], [currentLesson, currentPageIndex]);

  const overallProgress = useMemo(() => {
    if (!lessons || lessons.length === 0) return 0;
    const completedCount = lessons.filter(l => l.completedByUser).length;
    return Math.round((completedCount / lessons.length) * 100);
  }, [lessons]);

  const handleAnswerChange = (questionId: string, answer: UserAnswerSubmission) => {
    setPageAnswers(prev => ({ ...prev, [questionId]: answer }));
    // No need to update `lessons` state here for `userAnswer`.
    // `QuestionInput` will use `pageAnswers[question.id]` for its `currentAnswer` prop.
  };

  const handleRetryQuestion = (questionId: string) => {
    // Clear the specific answer from local state
    setPageAnswers(prev => {
        const newAnswers = {...prev};
        delete newAnswers[questionId]; // Or set to empty: newAnswers[questionId] = {};
        return newAnswers;
    });
    // Update the question in the main `lessons` state to allow new attempt
    setLessons(prevLessons => prevLessons.map((l, lIdx) => {
        if (lIdx === currentLessonIndex) {
            return {
                ...l,
                pages: l.pages.map((p, pIdx) => {
                    if (pIdx === currentPageIndex) {
                        return {
                            ...p,
                            questions: p.questions.map(q => 
                                q.id === questionId ? { ...q, isCorrect: null, feedback: undefined, isAttemptAllowed: true, userAnswer: {} } : q
                            )
                        };
                    }
                    return p;
                })
            };
        }
        return l;
    }));
  };

  const handleSubmitAnswer = async (questionId: string) => {
    const answerToSubmit = pageAnswers[questionId];
    if (!answerToSubmit || ( (answerToSubmit.selectedOptionIds === undefined || answerToSubmit.selectedOptionIds.length === 0) && (answerToSubmit.answerText === undefined || answerToSubmit.answerText.trim() === ''))) {
        const errorMsg = "Ответ не выбран или не введен.";
        setActionError(errorMsg);
        // Update question's feedback in lessons state
        setLessons(prevLessons => prevLessons.map((l, lIdx) => lIdx === currentLessonIndex ? { ...l, pages: l.pages.map((p, pIdx) => pIdx === currentPageIndex ? { ...p, questions: p.questions.map(q => q.id === questionId ? { ...q, feedback: errorMsg, isCorrect: false, isAttemptAllowed: true } : q) } : p) } : l));
        return;
    }
    setIsSubmittingAnswer(prev => ({...prev, [questionId]: true}));
    setActionError(null);
    try {
        const response = await submitAnswerApi({
            questionId,
            selectedOptionIds: answerToSubmit.selectedOptionIds,
            answerText: answerToSubmit.answerText
        });
        setLessons(prevLessons => prevLessons.map((l, lIdx) => {
            if (lIdx === currentLessonIndex) {
                return {
                    ...l,
                    pages: l.pages.map((p, pIdx) => {
                        if (pIdx === currentPageIndex) {
                            return {
                                ...p,
                                questions: p.questions.map(q => 
                                    q.id === questionId ? { 
                                        ...q, 
                                        isCorrect: response.data.is_correct, 
                                        feedback: response.data.is_correct ? "Верно!" : (q.feedback || "Попробуйте еще раз."), // Preserve existing feedback if any, or set new
                                        isAttemptAllowed: !response.data.is_correct 
                                    } : q
                                )
                            };
                        }
                        return p;
                    })
                };
            }
            return l;
        }));
    } catch (err: any) {
        const apiErrorMsg = err.response?.data?.message || "Ошибка при отправке ответа.";
        setActionError(apiErrorMsg);
        setLessons(prevLessons => prevLessons.map((l, lIdx) => lIdx === currentLessonIndex ? { ...l, pages: l.pages.map((p, pIdx) => pIdx === currentPageIndex ? { ...p, questions: p.questions.map(q => q.id === questionId ? { ...q, feedback: apiErrorMsg, isCorrect: false, isAttemptAllowed: true } : q) } : p) } : l));
    } finally {
        setIsSubmittingAnswer(prev => ({...prev, [questionId]: false}));
    }
  };

  const handleNextPage = () => {
    if (!currentLesson) return;
    setActionError(null);
    if (currentPageIndex < currentLesson.pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
    } else if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(prev => prev + 1);
      setCurrentPageIndex(0);
    }
  };

  const handlePrevPage = () => {
    setActionError(null);
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    } else if (currentLessonIndex > 0) {
      const prevLesson = lessons[currentLessonIndex - 1];
      setCurrentLessonIndex(prev => prev - 1);
      setCurrentPageIndex(prevLesson.pages.length - 1);
    }
  };
  
  const allLessonAssignmentsCorrect = useMemo(() => {
    if (!currentLesson) return false;
    for (const page of currentLesson.pages) {
      if (page.page_type === 'ASSIGNMENT') {
        if (page.questions.length === 0) continue; 
        for (const question of page.questions) {
          if (question.isCorrect !== true) {
            return false; 
          }
        }
      }
    }
    return true; 
  }, [currentLesson]);

  const handleMarkLessonComplete = async () => {
    if (!currentLesson || currentLesson.completedByUser || !allLessonAssignmentsCorrect) {
        if(!allLessonAssignmentsCorrect) {
            setActionError("Не все задания в уроке выполнены правильно.");
        }
        return;
    }
    
    setIsCompletingLesson(true);
    setActionError(null);
    try {
        await markLessonCompleteApi(currentLesson.id);
        // Re-fetch all course data to ensure all statuses are correctly updated from the source of truth (backend)
        // Pass false to fetchCourseData to prevent resetting navigation to the first uncompleted lesson
        await fetchCourseData(false); 
    } catch (err: any) {
        setActionError(err.response?.data?.message || "Ошибка при завершении урока.");
    } finally {
        setIsCompletingLesson(false);
    }
  };

  const isLastPageOfCourse = currentLessonIndex === lessons.length - 1 && 
                             currentLesson && currentPageIndex === currentLesson.pages.length - 1;

  if (isLoading || authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3 text-gray-700">Загрузка обучения...</p></div>;
  }
  if (error) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-red-600 text-lg">{error}</p><Link to={`/courses/${courseId}`} className="mt-4 btn-primary">К странице курса</Link></div>;
  }
  if (!course || !currentLesson || !currentPage) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-gray-600 text-lg">Контент курса не найден или загружается.</p></div>;
  }

  const isOnLastPageOfLesson = currentPageIndex === currentLesson.pages.length - 1;
  const canEnableCompleteLessonButton = isOnLastPageOfLesson && !currentLesson.completedByUser && allLessonAssignmentsCorrect;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="bg-white shadow-sm p-4 border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to={`/courses/${courseId}`} className="text-sm text-orange-600 hover:underline truncate max-w-[calc(100%-200px)]">
            ← К курсу "{course.title}"
          </Link>
          <div className="text-sm text-gray-600 flex-shrink-0">Урок {currentLessonIndex + 1}/{lessons.length} - Стр. {currentPageIndex + 1}/{currentLesson.pages.length}</div>
        </div>
        <div className="max-w-7xl mx-auto mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${overallProgress}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 text-right mt-1">{overallProgress}% завершено</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 sticky top-0 bg-gray-50 py-2 z-10">Уроки</h3>
          {lessons.map((lesson, index) => (
            <button
              key={lesson.id}
              onClick={() => { setCurrentLessonIndex(index); setCurrentPageIndex(0); }}
              className={`w-full text-left p-2.5 rounded-md text-sm transition-colors
                ${index === currentLessonIndex ? 'bg-orange-100 text-orange-700 font-medium' : 'hover:bg-gray-100 text-gray-700'}
              `}
            >
              <div className="flex justify-between items-center">
                <span className={`truncate ${lesson.completedByUser ? 'line-through text-gray-500' : ''}`}>{index + 1}. {lesson.title}</span>
                {lesson.completedByUser && <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />}
              </div>
            </button>
          ))}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{currentLesson.title}</h1>
            <h2 className="text-xl font-semibold text-gray-700 mb-6">{currentPage.title}</h2>
            
            {actionError && <p className="text-sm text-red-500 mb-4 p-2 bg-red-50 border border-red-200 rounded">{actionError}</p>}

            {currentPage.page_type === 'METHODICAL' && (
              <div className="prose prose-sm sm:prose max-w-none text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentPage.content}</ReactMarkdown>
              </div>
            )}

            {currentPage.page_type === 'ASSIGNMENT' && (
              <div className="space-y-0">
                {currentPage.questions.map((q, qIndex) => (
                  <QuestionInput
                    key={q.id}
                    question={q} 
                    questionIndex={qIndex}
                    currentAnswer={pageAnswers[q.id]}
                    onAnswerChange={handleAnswerChange}
                    onSubmitAnswer={handleSubmitAnswer}
                    onRetryQuestion={handleRetryQuestion}
                    isSubmitting={isSubmittingAnswer[q.id] || false}
                  />
                ))}
              </div>
            )}
          </div>

          <footer className="bg-white border-t border-gray-200 p-4 mt-auto sticky bottom-0 z-20">
            <div className="flex justify-between items-center">
              <button 
                onClick={handlePrevPage} 
                disabled={currentLessonIndex === 0 && currentPageIndex === 0}
                className="btn-outline text-sm flex items-center"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Назад
              </button>
              
              {canEnableCompleteLessonButton && (
                <button 
                  onClick={handleMarkLessonComplete} 
                  disabled={isCompletingLesson} 
                  className="btn-success text-sm"
                >
                  {isCompletingLesson ? 'Завершение...' : 'Завершить урок'}
                </button>
              )}

              <button 
                onClick={handleNextPage} 
                disabled={isLastPageOfCourse || (isOnLastPageOfLesson && !currentLesson.completedByUser && !allLessonAssignmentsCorrect)}
                className="btn-primary text-sm flex items-center"
              >
                Далее <ChevronRightIcon className="w-4 h-4 ml-1" />
              </button>
            </div>
             {isLastPageOfCourse && currentLesson.completedByUser && (
                <div className="text-center mt-4">
                    <Link to={`/courses/${courseId}`} className="btn-primary bg-green-600 hover:bg-green-700">
                        Поздравляем! Курс завершен!
                    </Link>
                </div>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
};

export default CourseTakingPage;