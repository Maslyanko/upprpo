// ==== File: frontend/src/pages/EditCourseContentPage.tsx ====
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { getCourseById, updateCourseContent } from '@/api/coursesApi';
import type { Course, LessonEditable, LessonIdentifiable, CourseContentUpdatePayload, LessonPayloadForBackend } from '@/types/Course';
import LessonItem, { AddLessonButtonPlaceholder } from '@/components/course_editor/LessonItem';
import ContextMenu from '@/components/course_editor/ContextMenu';
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
  const [lessons, setLessons] = useState<LessonIdentifiable[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonTitleInput, setLessonTitleInput] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lessonId: string } | null>(null);
  const [isDndReady, setIsDndReady] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setPageError("ID курса не указан в URL."); setIsLoading(false); navigate('/'); return;
    }
    document.title = `Редактор: Загрузка... - AI-Hunt`;
    setIsLoading(true); setPageError(null); setIsDndReady(false);
    getCourseById(courseId)
      .then(data => {
        if (!data || !data.id) { throw new Error("Курс не найден или данные некорректны."); }
        setCourse(data);
        const courseLessons = (data.lessons as LessonEditable[] || [])
            .map(l => ({
                id: l.id, title: l.title,
                sort_order: l.sort_order !== undefined ? l.sort_order : (l as any).sortOrder ?? 0,
            }))
            .sort((a, b) => a.sort_order - b.sort_order);
        setLessons(courseLessons);
        if (courseLessons.length > 0) { setSelectedLessonId(courseLessons[0].id); }
        else { setSelectedLessonId(null); }
        document.title = `Редактор: ${data.title || 'Курс'} - AI-Hunt`;
        setIsDndReady(true);
      })
      .catch(err => {
        console.error("Error fetching course for editing:", err);
        setPageError(`Не удалось загрузить курс (ID: ${courseId}). ` + (err.message || ""));
        document.title = `Ошибка загрузки - AI-Hunt`;
      })
      .finally(() => setIsLoading(false));
  }, [courseId, navigate]);

  useEffect(() => {
    if (selectedLessonId) {
      const selected = lessons.find(l => l.id === selectedLessonId);
      setLessonTitleInput(selected?.title || '');
    } else { setLessonTitleInput(''); }
  }, [selectedLessonId, lessons]);

  const handleAddLesson = useCallback((afterLessonId?: string) => {
    const newLesson: LessonIdentifiable = { id: `new-${uuidv4()}`, title: 'Новый урок', sort_order: 0 };
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
        if (selectedLessonId === lessonIdToDelete) { setSelectedLessonId(newArr.length > 0 ? newArr[0].id : null); }
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

  const onDragEnd = (result: DropResult) => {
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

  const handleContextMenu = (event: React.MouseEvent, lessonId: string) => {
    event.preventDefault(); setSelectedLessonId(lessonId);
    setContextMenu({ x: event.clientX, y: event.clientY, lessonId });
  };
  const closeContextMenu = () => setContextMenu(null);

  const handleSaveChanges = useCallback(async () => {
    if (!courseId || !course) { setPageError("Курс не загружен."); return; }

    // Применяем несохраненные изменения из инпута перед отправкой
    // Эта операция синхронная, setLessons запланирует ререндер, но lessonsPayload ниже
    // должен быть сформирован на основе данных ПОСЛЕ этого вызова.
    // Чтобы избежать гонки состояний, можно создать временную переменную для lessons.
    let lessonsWithAppliedChanges = lessons;
    if (selectedLessonId) {
        lessonsWithAppliedChanges = lessons.map(l =>
            l.id === selectedLessonId ? { ...l, title: lessonTitleInput.trim() || "Урок без названия" } : l
        );
    }

    setIsSaving(true); setPageError(null); setSuccessMessage(null);

    const lessonsToSave: LessonPayloadForBackend[] = lessonsWithAppliedChanges.map((lesson, index) => ({
        id: lesson.id.startsWith('new-') ? undefined : lesson.id, // Для новых уроков ID не отправляем
        title: lesson.title,
        sort_order: index, // Бэкенд будет использовать этот порядок
        // description: lesson.description, // Если бы мы редактировали описание
        // pages: [] // Если бы мы редактировали страницы, здесь была бы их структура
    }));

    const payload: CourseContentUpdatePayload = { lessons: lessonsToSave };

    try {
        const updatedCourseFromApi = await updateCourseContent(courseId, payload);

        // Обновляем состояние уроков данными с сервера (с новыми ID и подтвержденным порядком)
        const backendLessons = (updatedCourseFromApi.lessons as LessonEditable[] || [])
            .map(l => ({
                id: l.id,
                title: l.title,
                sort_order: l.sort_order !== undefined ? l.sort_order : (l as any).sortOrder ?? 0,
            }))
            .sort((a, b) => a.sort_order - b.sort_order);

        setLessons(backendLessons);
        setCourse(updatedCourseFromApi); // Обновляем весь объект курса, если он изменился
        setSuccessMessage("Уроки успешно сохранены!");

        // Обновляем selectedLessonId, если он был новым и его ID изменился
        if (selectedLessonId?.startsWith('new-')) {
            const lastEditedTitle = lessonTitleInput.trim() || "Урок без названия";
            const newlySavedLesson = backendLessons.find(l => l.title === lastEditedTitle);
            // Если такой урок нашелся (имя не изменилось при сохранении), выбираем его.
            // Иначе, если есть уроки, выбираем первый, или null если уроков нет.
            setSelectedLessonId(newlySavedLesson ? newlySavedLesson.id : (backendLessons[0]?.id || null));
        }
        // Если selectedLessonId был существующим, он остается тем же, так как его ID не должен меняться
        // при подходе delete-recreate (если бэк возвращает новые ID для всех, то этот блок надо доработать).
        // При delete-recreate ВСЕ уроки получают новые ID. Поэтому selectedLessonId нужно обновлять всегда.
        // Найдем урок с тем же названием и новым sort_order (если название уникально)
        // или просто выберем урок с тем же индексом, что и был.
        else if (selectedLessonId) {
            const currentSelectedIndex = lessonsWithAppliedChanges.findIndex(l => l.id === selectedLessonId);
            if (currentSelectedIndex !== -1 && backendLessons[currentSelectedIndex]) {
                setSelectedLessonId(backendLessons[currentSelectedIndex].id);
            } else if (backendLessons.length > 0) {
                setSelectedLessonId(backendLessons[0].id);
            } else {
                setSelectedLessonId(null);
            }
        }


        setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
        console.error("Error saving course content:", err);
        const apiErrorMessage = (err as any).response?.data?.message;
        setPageError("Ошибка при сохранении уроков: " + (apiErrorMessage || (err as Error).message || "Неизвестная ошибка"));
    } finally {
        setIsSaving(false);
    }
  }, [courseId, course, lessons, selectedLessonId, lessonTitleInput]);

  if (isLoading) { return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка редактора...</p></div>; }
  if (pageError && !course) { return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"><h2 className="text-2xl font-semibold text-red-600 mb-4">Ошибка</h2><p className="text-gray-700 mb-6">{pageError}</p><Link to="/profile" className="btn-primary">В профиль</Link></div>;}
  if (!course) { return <div className="flex justify-center items-center min-h-screen"><p>Загрузка...</p></div>; }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100 text-gray-800">
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
          {isDndReady ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="lessonsList">
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
          <button onClick={handleSaveChanges} disabled={isSaving || isLoading || !isDndReady || lessons.length === 0} className="w-full btn-primary py-2.5 text-sm">
            {isSaving ? ( <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div> Сохранение...</> ) : "Сохранить уроки"}
          </button>
        </div>
        {contextMenu && ( <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} onDelete={() => { handleDeleteLesson(contextMenu.lessonId); closeContextMenu(); }} onAddAfter={() => { handleAddLesson(contextMenu.lessonId); closeContextMenu(); }} /> )}
      </div>
      <main className="flex-grow p-6 sm:p-8 overflow-y-auto custom-scrollbar">
        {pageError && !successMessage && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm shadow" role="alert">{pageError}</div>}
        {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm shadow" role="alert">{successMessage}</div>}
        {selectedLessonId && lessons.find(l => l.id === selectedLessonId) ? (
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-1">Редактирование урока</h3>
            <p className="text-xs text-gray-500 mb-5">Урок #{lessons.findIndex(l => l.id === selectedLessonId) + 1}</p>
            <div>
              <label htmlFor="lessonTitleInput" className="block text-sm font-medium text-gray-700 mb-1">Название урока</label>
              <input id="lessonTitleInput" type="text" value={lessonTitleInput} onChange={handleLessonTitleChange} onBlur={handleLessonTitleBlur} onKeyDown={handleLessonTitleKeyDown} placeholder="Введите название урока" className="form-input w-full" />
            </div>
            <div className="mt-10 pt-6 border-t border-gray-200">
              <p className="text-gray-500 text-sm italic"> Детальное редактирование страниц и содержимого урока будет доступно здесь в будущем. </p>
            </div>
          </div>
        ) : lessons.length > 0 && isDndReady ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"> <p className="text-base">Выберите урок из списка слева для редактирования.</p> </div>
        ) : isDndReady && lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-300"> <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /> </svg>
                <p className="text-base">У этого курса пока нет уроков.</p> <p className="text-sm mt-1">Нажмите "+" в списке слева, чтобы добавить.</p>
            </div>
        ) : null }
      </main>
    </div>
  );
};

export default EditCourseContentPage;