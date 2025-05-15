// ==== File: frontend/src/pages/EditCourseContentPage.tsx ====
// ==== File: frontend/src/pages/EditCourseContentPage.tsx ====
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { getCourseById, updateCourseContent } from '@/api/coursesApi';
import type {
  Course, LessonEditable, LessonIdentifiable, LessonPage, Question,
  CourseContentUpdatePayload, LessonPayloadForBackend
} from '@/types/Course';
import { createNewLessonPage } from '@/types/Course';
import LessonItem, { AddLessonButtonPlaceholder } from '@/components/course_editor/LessonItem';
import ContextMenu from '@/components/course_editor/ContextMenu';
import PageTab, { AddPageButton } from '@/components/course_editor/PageTabs';
import PageEditor from '@/components/course_editor/PageEditor';
import ChoosePageTypeModal from '@/components/course_editor/modals/ChoosePageTypeModal';
import { v4 as uuidv4 } from 'uuid';

const PencilSquareIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

const EditCourseContentPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonEditable[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [lessonTitleInput, setLessonTitleInput] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lessonId: string } | null>(null);
  const [isDndLessonsReady, setIsDndLessonsReady] = useState(false);
  const [isPageTypeModalOpen, setIsPageTypeModalOpen] = useState(false);

  const [showSaveFeedback, setShowSaveFeedback] = useState(false);
  const saveFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- DEBUGGING ---
  console.log(`%cRENDER EditCourseContentPage | Selected Lesson: ${selectedLessonId} | Selected Page: ${selectedPageId}`, "color: dodgerblue");

  useEffect(() => {
    if (!courseId) {
      setPageError("ID курса не указан в URL."); setIsLoading(false); navigate('/'); return;
    }
    document.title = `Редактор: Загрузка... - AI-Hunt`;
    setIsLoading(true); setPageError(null); setIsDndLessonsReady(false);
    getCourseById(courseId)
      .then(data => {
        if (!data || !data.id) { throw new Error("Курс не найден или данные некорректны."); }
        setCourse(data);
        const courseLessons = (data.lessons as LessonEditable[] || [])
            .map(l => ({
                id: l.id, title: l.title, description: l.description,
                sort_order: l.sort_order ?? (l as any).sortOrder ?? 0,
                pages: (l.pages || []).map(p => ({
                    ...p,
                    content: p.content || '',
                    questions: (p.questions || []).map(q => ({
                        ...q,
                        options: q.options || []
                    })).sort((a,b) => a.sort_order - b.sort_order)
                })).sort((a,b) => a.sort_order - b.sort_order)
            }))
            .sort((a, b) => a.sort_order - b.sort_order);
        setLessons(courseLessons);
        document.title = `Редактор: ${data.title || 'Курс'} - AI-Hunt`;
        setIsDndLessonsReady(true);
      })
      .catch(err => {
        console.error("Error fetching course for editing:", err);
        setPageError(`Не удалось загрузить курс (ID: ${courseId}). ` + (err.message || ""));
        document.title = `Ошибка загрузки - AI-Hunt`;
      })
      .finally(() => setIsLoading(false));
  }, [courseId, navigate]);

  useEffect(() => {
    console.log('%cEFFECT: Initial Lesson/Page Selection | Lessons Populated:', "color: green", lessons.length > 0, '| Current Selected Lesson:', selectedLessonId);
    if (lessons.length > 0 && !selectedLessonId) {
        const firstLesson = lessons[0];
        console.log('%cEFFECT: Setting initial selected lesson:', "color: green", firstLesson.id);
        setSelectedLessonId(firstLesson.id);
        // Page selection will be handled by the next effect if this updates selectedLessonId
    }
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (selectedLessonId) {
      const selected = lessons.find(l => l.id === selectedLessonId);
      setLessonTitleInput(selected?.title || '');
    } else { setLessonTitleInput(''); }
  }, [selectedLessonId, lessons]);

  useEffect(() => {
    console.log(`%cEFFECT: Page Selection | Selected Lesson: ${selectedLessonId} | Current Selected Page: ${selectedPageId} | Lessons count: ${lessons.length}`, "color: purple");
    if (selectedLessonId) {
      const currentLesson = lessons.find(l => l.id === selectedLessonId);
      console.log('%cEFFECT: Page Selection | Found current lesson:', "color: purple", currentLesson);
      if (currentLesson) {
        if (currentLesson.pages.length > 0) {
          const isCurrentPageStillValid = currentLesson.pages.some(p => p.id === selectedPageId);
          if (!isCurrentPageStillValid) {
            console.log('%cEFFECT: Page Selection | Current page invalid or not set, selecting first page:', "color: purple", currentLesson.pages[0].id);
            setSelectedPageId(currentLesson.pages[0].id);
          } else {
            console.log('%cEFFECT: Page Selection | Current page is valid, keeping selection.', "color: purple");
          }
        } else {
          console.log('%cEFFECT: Page Selection | Current lesson has no pages, setting selectedPageId to null.', "color: purple");
          setSelectedPageId(null);
        }
      } else {
         console.log('%cEFFECT: Page Selection | SelectedLessonId is set, but lesson not found in lessons array (should not happen). Setting selectedPageId to null.', "color: red");
         setSelectedPageId(null);
      }
    } else {
      console.log('%cEFFECT: Page Selection | No lesson selected, setting selectedPageId to null.', "color: purple");
      setSelectedPageId(null);
    }
  }, [selectedLessonId, lessons]); // Removed selectedPageId to prevent potential loops if it's the only thing changing this effect

  const handleAddLesson = useCallback((afterLessonId?: string) => {
    const newLesson: LessonEditable = {
        id: `temp-${uuidv4()}`, title: 'Новый урок', description: '', sort_order: 0, pages: []
    };
    setLessons(prevLessons => {
      let newArr = [...prevLessons];
      let insertAtIndex = prevLessons.length;
      if (afterLessonId) {
        const index = prevLessons.findIndex(l => l.id === afterLessonId);
        if (index !== -1) insertAtIndex = index + 1;
      }
      newArr.splice(insertAtIndex, 0, newLesson);
      return newArr.map((lesson, idx) => ({ ...lesson, sort_order: idx }));
    });
    setSelectedLessonId(newLesson.id);
    setSuccessMessage(null); setPageError(null);
  }, []);

  const handleDeleteLesson = useCallback((lessonIdToDelete: string) => {
    setLessons(prevLessons => {
        const newArr = prevLessons.filter(l => l.id !== lessonIdToDelete).map((l, i) => ({...l, sort_order: i}));
        if (selectedLessonId === lessonIdToDelete) {
            const newSelectedLesson = newArr.length > 0 ? newArr[0] : null;
            setSelectedLessonId(newSelectedLesson ? newSelectedLesson.id : null);
        }
        return newArr;
    });
    setSuccessMessage(null); setPageError(null);
  }, [selectedLessonId]);

  const handleLessonTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => setLessonTitleInput(e.target.value);

  const applyCurrentLessonTitleChanges = useCallback(() => {
    if (selectedLessonId) {
      setLessons(prevLessons =>
        prevLessons.map(l =>
          l.id === selectedLessonId ? { ...l, title: lessonTitleInput.trim() || "Урок без названия" } : l
        )
      );
    }
  }, [selectedLessonId, lessonTitleInput]);

  const handleLessonTitleBlur = applyCurrentLessonTitleChanges;
  const handleLessonTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); applyCurrentLessonTitleChanges(); (e.target as HTMLInputElement).blur(); }
  };

  const handleAddPageOptimistic = (type: 'METHODICAL' | 'ASSIGNMENT') => {
    console.log(`%chandleAddPageOptimistic called with type: ${type}, selectedLessonId: ${selectedLessonId}`, "color: orange; font-weight: bold;");
    if (!selectedLessonId) {
        console.error("handleAddPageOptimistic: No lesson selected!");
        return;
    }
    const currentLessonForPageAdd = lessons.find(l => l.id === selectedLessonId);
    if (!currentLessonForPageAdd) {
        console.error(`handleAddPageOptimistic: Could not find lesson with ID ${selectedLessonId}`);
        return;
    }

    const newPage = createNewLessonPage(type, currentLessonForPageAdd.pages.length);
    console.log(`%chandleAddPageOptimistic: New page created:`, "color: orange;", newPage);

    setLessons(prevLessons => {
        console.log(`%chandleAddPageOptimistic: Updating lessons state. Prev lesson pages count for ${selectedLessonId}: ${prevLessons.find(l=>l.id===selectedLessonId)?.pages.length}`, "color: orange;");
        const newLessonsState = prevLessons.map(l => {
            if (l.id === selectedLessonId) {
                const updatedPages = [...l.pages, newPage].map((p, i) => ({...p, sort_order: i}));
                console.log(`%chandleAddPageOptimistic: Lesson ${l.id} updated. New pages array:`, "color: orange;", updatedPages);
                return { ...l, pages: updatedPages };
            }
            return l;
        });
        console.log(`%chandleAddPageOptimistic: Full new lessons state:`, "color: orange;", newLessonsState);
        return newLessonsState;
    });
    console.log(`%chandleAddPageOptimistic: Setting selectedPageId to: ${newPage.id}`, "color: orange; font-weight: bold;");
    setSelectedPageId(newPage.id);
  };

  const handleDeletePage = (pageIdToDelete: string) => {
    if (!selectedLessonId) return;
    setLessons(prevLessons => prevLessons.map(l => {
        if (l.id === selectedLessonId) {
            const remainingPages = l.pages.filter(p => p.id !== pageIdToDelete).map((p, i) => ({...p, sort_order: i}));
            if (selectedPageId === pageIdToDelete) {
                setSelectedPageId(remainingPages.length > 0 ? remainingPages[0].id : null);
            }
            return { ...l, pages: remainingPages };
        }
        return l;
    }));
  };
  
  const handlePageTitleChange = (pageId: string, newTitle: string) => {
    setLessons(prev => prev.map(l => {
        if (l.id === selectedLessonId) {
            return { ...l, pages: l.pages.map(p => p.id === pageId ? {...p, title: newTitle} : p) };
        }
        return l;
    }));
  };

  const handlePageContentChange = (pageId: string, newContent: string) => {
    setLessons(prev => prev.map(l => {
        if (l.id === selectedLessonId) {
            return { ...l, pages: l.pages.map(p => p.id === pageId ? {...p, content: newContent} : p) };
        }
        return l;
    }));
  };

  const handlePageQuestionsChange = (pageId: string, newQuestions: Question[]) => {
    setLessons(prev => prev.map(l => {
        if (l.id === selectedLessonId) {
            return { ...l, pages: l.pages.map(p => p.id === pageId ? {...p, questions: newQuestions} : p) };
        }
        return l;
    }));
  };

  const onLessonDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    setLessons(prevLessons => {
        const items = Array.from(prevLessons);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        return items.map((lesson, index) => ({ ...lesson, sort_order: index }));
    });
    setSuccessMessage(null); setPageError(null);
  };

  const onPageDragEnd = (result: DropResult) => {
    if (!selectedLessonId || !result.destination) return;
    const { source, destination } = result;
     if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    setLessons(prevLessons => prevLessons.map(l => {
        if (l.id === selectedLessonId) {
            const pagesArray = Array.from(l.pages);
            const [reorderedPage] = pagesArray.splice(source.index, 1);
            pagesArray.splice(destination.index, 0, reorderedPage);
            return { ...l, pages: pagesArray.map((page, index) => ({ ...page, sort_order: index })) };
        }
        return l;
    }));
  };

  const handleContextMenu = (event: React.MouseEvent, lessonId: string) => {
    event.preventDefault(); setSelectedLessonId(lessonId);
    setContextMenu({ x: event.clientX, y: event.clientY, lessonId });
  };
  const closeContextMenu = () => setContextMenu(null);

  const handleSaveChanges = useCallback(async () => {
    if (!courseId || !course) { setPageError("Курс не загружен."); return; }
    applyCurrentLessonTitleChanges(); 

    setIsSaving(true); setPageError(null); 

    const lessonsToSave: LessonPayloadForBackend[] = lessons.map((lesson, lessonIndex) => ({
      title: lesson.title,
      description: lesson.description,
      sort_order: lessonIndex,
      pages: lesson.pages.map((page, pageIndex) => ({
        title: page.title,
        page_type: page.page_type,
        sort_order: pageIndex,
        content: page.content || '', 
        questions: page.questions.map((q, questionIndex) => {
          // Ensure correct_answer is either a string or null in the payload
          let finalCorrectAnswer: string | null = null;
          if (typeof q.correct_answer === 'string' && q.correct_answer.trim() !== '') {
            finalCorrectAnswer = q.correct_answer;
          } else if (q.correct_answer === '') { // Allow sending empty string if explicitly set
            finalCorrectAnswer = '';
          }
          // Any other case (undefined, null but not empty string) will default to null

          // console.log(`[FRONTEND PAYLOAD] Question ${q.id} correct_answer being sent: '${finalCorrectAnswer}' (original was: '${q.correct_answer}')`);

          return {
            text: q.text,
            type: q.type,
            correct_answer: finalCorrectAnswer, 
            sort_order: questionIndex,
            options: q.options.map((opt, optionIndex) => ({
              label: opt.label,
              is_correct: opt.is_correct,
              sort_order: optionIndex,
            }))
          };
        })
      }))
    }));

    const payload: CourseContentUpdatePayload = { lessons: lessonsToSave };

    try {
        const updatedCourseFromApi = await updateCourseContent(courseId, payload);
        const backendLessons = (updatedCourseFromApi.lessons as LessonEditable[] || [])
            .map(l => ({
                id: l.id, title: l.title, description: l.description,
                sort_order: l.sort_order ?? (l as any).sortOrder ?? 0,
                pages: (l.pages || []).map(p => ({
                    ...p,
                    content: p.content || '',
                    questions: (p.questions || []).map(q => ({
                        ...q, 
                        correct_answer: q.correct_answer || '',
                        options: q.options || []
                    })).sort((a,b) => a.sort_order - b.sort_order)
                })).sort((a,b) => a.sort_order - b.sort_order)
            }))
            .sort((a, b) => a.sort_order - b.sort_order);

        // --- DEBUG BEFORE SETTING STATE ---
        console.log("%cSave Success: Received from API (updatedCourseFromApi.lessons):", "color: blue", updatedCourseFromApi.lessons);
        console.log("%cSave Success: Processed backendLessons:", "color: blue", backendLessons);
        console.log(`%cSave Success: Old selectedLessonId: ${selectedLessonId}, Old selectedPageId: ${selectedPageId}`, "color: blue");
        // ---

        const oldSelectedLessonId = selectedLessonId;
        const oldSelectedPageId = selectedPageId;
        let oldLessonIndex = -1;
        if (oldSelectedLessonId) {
             oldLessonIndex = lessons.findIndex(l => l.id === oldSelectedLessonId);
        }
        let oldPageIndex = -1;
        if (oldLessonIndex !== -1 && oldSelectedPageId) {
            oldPageIndex = lessons[oldLessonIndex].pages.findIndex(p => p.id === oldSelectedPageId);
        }

        setLessons(backendLessons);
        setCourse(updatedCourseFromApi); // Update the course itself if needed

        setShowSaveFeedback(true);
        if (saveFeedbackTimeoutRef.current) {
            clearTimeout(saveFeedbackTimeoutRef.current);
        }
        saveFeedbackTimeoutRef.current = setTimeout(() => {
            setShowSaveFeedback(false);
        }, 2000);

        let newSelectedLessonId: string | null = null;
        if (oldLessonIndex !== -1 && backendLessons[oldLessonIndex]) {
            newSelectedLessonId = backendLessons[oldLessonIndex].id;
        } else if (backendLessons.length > 0) {
            newSelectedLessonId = backendLessons[0].id;
        }
        setSelectedLessonId(newSelectedLessonId);
        console.log(`%cSave Success: New selectedLessonId: ${newSelectedLessonId}`, "color: blue");

        if (newSelectedLessonId) {
            const newSelectedLessonData = backendLessons.find(l => l.id === newSelectedLessonId);
            let newSelectedPageIdToSet: string | null = null;
            if (newSelectedLessonData) {
                if (oldPageIndex !== -1 && newSelectedLessonData.pages[oldPageIndex]) {
                    newSelectedPageIdToSet = newSelectedLessonData.pages[oldPageIndex].id;
                } else if (newSelectedLessonData.pages.length > 0) {
                    newSelectedPageIdToSet = newSelectedLessonData.pages[0].id;
                }
            }
            setSelectedPageId(newSelectedPageIdToSet);
            console.log(`%cSave Success: New selectedPageIdToSet: ${newSelectedPageIdToSet}`, "color: blue");
        } else {
            setSelectedPageId(null);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
        console.error("Error saving course content:", err);
        const apiErrorMessage = (err as any).response?.data?.message;
        setPageError("Ошибка при сохранении уроков: " + (apiErrorMessage || (err as Error).message || "Неизвестная ошибка"));
    } finally {
        setIsSaving(false);
    }
  }, [courseId, course, lessons, selectedLessonId, selectedPageId, lessonTitleInput, applyCurrentLessonTitleChanges]);

  const currentLesson = useMemo(() => {
    const lesson = lessons.find(l => l.id === selectedLessonId);
    console.log(`%cMEMO currentLesson | selectedLessonId: ${selectedLessonId} | found:`, "color: teal", lesson);
    return lesson;
  }, [lessons, selectedLessonId]);

  const currentPage = useMemo(() => {
    const page = currentLesson?.pages.find(p => p.id === selectedPageId);
    console.log(`%cMEMO currentPage | selectedPageId: ${selectedPageId} | found in currentLesson:`, "color: teal", page);
    return page;
  }, [currentLesson, selectedPageId]);

  if (isLoading) { return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка редактора...</p></div>; }
  if (pageError && !course) { return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"><h2 className="text-2xl font-semibold text-red-600 mb-4">Ошибка</h2><p className="text-gray-700 mb-6">{pageError}</p><Link to="/profile" className="btn-primary">В профиль</Link></div>;}
  if (!course) { return <div className="flex justify-center items-center min-h-screen"><p>Загрузка...</p></div>; }

  return (
    <div className={`flex h-[calc(100vh-4rem)] bg-gray-100 text-gray-800 transition-all duration-500 ease-in-out ${showSaveFeedback ? 'outline outline-4 outline-green-500 outline-offset-[-4px]' : 'outline-none'}`}>
      {/* Lessons Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center min-h-[65px]">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-2" title={course.title}>
            {course.title}
          </h2>
          <Link to={`/courses/${course.id}/edit-facade`} title="Редактировать информацию о курсе" className="p-1.5 text-gray-500 hover:text-orange-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500">
            <PencilSquareIcon className="w-5 h-5" />
          </Link>
        </div>
        <div className="flex-grow overflow-y-auto p-3 custom-scrollbar">
          {isDndLessonsReady ? (
            <DragDropContext onDragEnd={onLessonDragEnd}>
              <Droppable droppableId="lessonsList" type="LESSON">
                {(provided, snapshot) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className={`min-h-full pb-1 ${snapshot.isDraggingOver ? 'bg-orange-50' : ''}`}>
                    {lessons.map((lesson, index) => (
                      <Draggable key={lesson.id} draggableId={lesson.id} index={index}>
                        {(providedDraggable, snapshotDraggable) => (
                          <LessonItem lesson={lesson} index={index} provided={providedDraggable} snapshot={snapshotDraggable} onSelectLesson={setSelectedLessonId} onContextMenu={handleContextMenu} isSelected={selectedLessonId === lesson.id} />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <div className="mt-2"> <AddLessonButtonPlaceholder onClick={() => handleAddLesson()} /> </div>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (<p className="p-4 text-sm text-gray-500 text-center">Загрузка уроков...</p>)}
        </div>
        <div className="p-3 border-t border-gray-200 mt-auto">
          <button onClick={handleSaveChanges} disabled={isSaving || isLoading || !isDndLessonsReady} className="w-full btn-primary py-2.5 text-sm">
            {isSaving ? ( <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div> Сохранение...</> ) 
                      : showSaveFeedback ? "Сохранено!" 
                      : "Сохранить структуру"}
          </button>
        </div>
        {contextMenu && ( <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} onDelete={() => { handleDeleteLesson(contextMenu.lessonId); closeContextMenu(); }} onAddAfter={() => { handleAddLesson(contextMenu.lessonId); closeContextMenu(); }} /> )}
      </div>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col p-0 overflow-hidden">
        {pageError && !successMessage && <div className="m-4 p-3 bg-red-100 text-red-700 rounded-md text-sm shadow" role="alert">{pageError}</div>}

        {selectedLessonId && currentLesson ? (
            <>
                <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 shadow-sm">
                    <div className="mb-3">
                        <label htmlFor="lessonTitleInputMain" className="block text-xs font-medium text-gray-500 mb-0.5">Название урока (в списке слева)</label>
                        <input id="lessonTitleInputMain" type="text" value={lessonTitleInput} onChange={handleLessonTitleChange} onBlur={handleLessonTitleBlur} onKeyDown={handleLessonTitleKeyDown} placeholder="Название урока" className="form-input w-full sm:w-2/3 lg:w-1/2 text-lg py-1.5" />
                    </div>
                    <div className="flex items-center overflow-x-auto pb-1 custom-scrollbar-thin">
                        <DragDropContext onDragEnd={onPageDragEnd}>
                            <Droppable droppableId={`pages-${selectedLessonId}`} direction="horizontal" type="PAGE">
                                {(providedDroppable) => (
                                    <div ref={providedDroppable.innerRef} {...providedDroppable.droppableProps} className="flex items-center">
                                        {currentLesson.pages.map((page, index) => (
                                        <Draggable key={page.id} draggableId={page.id} index={index}>
                                            {(providedDraggable, snapshotDraggable) => (
                                                <PageTab page={page} index={index} provided={providedDraggable} snapshot={snapshotDraggable} isSelected={selectedPageId === page.id} onSelectPage={setSelectedPageId} onDeletePage={handleDeletePage}/>
                                            )}
                                        </Draggable>
                                        ))}
                                        {providedDroppable.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                        <AddPageButton onClick={() => setIsPageTypeModalOpen(true)} />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    {currentLesson.pages.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-300"> <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0a3.375 3.375 0 0 0-3.375 3.375M19.5 0v.75Q19.5 3.75 16.5 3.75h-2.25V1.5" transform="translate(0 6)"/> <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /> </svg>
                            <p className="text-base">В этом уроке пока нет страниц.</p>
                            <p className="text-sm mt-1">Нажмите "+" выше, чтобы добавить страницу.</p>
                        </div>
                    ) : selectedPageId && currentPage ? (
                        <PageEditor
                            page={currentPage}
                            onPageTitleChange={handlePageTitleChange}
                            onContentChange={handlePageContentChange}
                            onQuestionsChange={handlePageQuestionsChange}
                        />
                    ) : currentLesson.pages.length > 0 ? ( 
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <p className="text-base">Выберите страницу из списка выше для редактирования.</p>
                        </div>
                    ) : null } 
                </div>
            </>
        ) : lessons.length > 0 && isDndLessonsReady ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"> <p className="text-base">Выберите урок из списка слева для редактирования.</p> </div>
        ) : isDndLessonsReady && lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-300"> <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /> </svg>
                <p className="text-base">У этого курса пока нет уроков.</p> <p className="text-sm mt-1">Нажмите "+" в списке слева, чтобы добавить.</p>
            </div>
        ) : null }
      </main>
      <ChoosePageTypeModal
        isOpen={isPageTypeModalOpen}
        onClose={() => setIsPageTypeModalOpen(false)}
        onSelectType={(type) => {
            console.log(`%cModal onSelectType: ${type}`, "color: fuchsia;");
            handleAddPageOptimistic(type);
            setIsPageTypeModalOpen(false);
        }}
      />
    </div>
  );
};

export default EditCourseContentPage;