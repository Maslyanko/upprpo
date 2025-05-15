// ==== File: frontend/src/pages/CreateCoursePage.tsx ====
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  createCourseFacade,
  uploadCourseCover,
  getAvailableTags,
  getCourseById,
  updateCourseFacade
} from '../api/coursesApi';
import type { CourseFacadePayload, Course } from '../types/Course';

const DIFFICULTY_TAG_OPTIONS: ReadonlyArray<'Beginner' | 'Middle' | 'Senior'> = ['Beginner', 'Middle', 'Senior'];
const COMMON_LANGUAGE_TAG_OPTIONS: Readonly<string[]> = [
  'Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'
];

interface FormDataState {
  title: string;
  description: string;
  selectedTags: string[];
  coverFile: File | null;
  estimatedDuration: string;
}

const initialFormData: FormDataState = {
  title: '',
  description: '',
  selectedTags: [],
  coverFile: null,
  estimatedDuration: '',
};

const CreateCoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  const isEditMode = !!courseId;

  const [initialLoading, setInitialLoading] = useState<boolean>(isEditMode);
  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [allAvailableSystemTags, setAllAvailableSystemTags] = useState<string[]>([]);
  const [isLoadingSystemTags, setIsLoadingSystemTags] = useState<boolean>(true);
  const [tagSearchTerm, setTagSearchTerm] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pageTitle = isEditMode ? 'Редактирование курса - AI-Hunt' : 'Создание нового курса - AI-Hunt';
    document.title = pageTitle;

    if (isEditMode && courseId) {
      setInitialLoading(true); setError(null);
      getCourseById(courseId)
        .then(courseData => {
          if (!courseData || !courseData.id) { throw new Error("Данные курса не получены или некорректны."); }
          setFormData({
            title: courseData.title || '', description: courseData.description || '',
            selectedTags: Array.isArray(courseData.tags) ? courseData.tags : [],
            coverFile: null, estimatedDuration: courseData.estimatedDuration?.toString() || '',
          });
          setCoverPreview(courseData.coverUrl || null);
        })
        .catch(err => { setError(`Не удалось загрузить курс (ID: ${courseId}). ` + (err.message || "")); navigate('/profile'); })
        .finally(() => setInitialLoading(false));
    } else {
      setFormData(initialFormData); setCoverPreview(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
      setError(null); setSuccessMessage(null); setInitialLoading(false);
    }
  }, [isEditMode, courseId, navigate]);

  useEffect(() => {
    setIsLoadingSystemTags(true);
    getAvailableTags()
      .then(tagsFromServer => {
        const uniqueTags = new Set([...DIFFICULTY_TAG_OPTIONS, ...COMMON_LANGUAGE_TAG_OPTIONS, ...tagsFromServer.map(t => t.trim()).filter(Boolean)]);
        setAllAvailableSystemTags(Array.from(uniqueTags).sort());
      })
      .catch(err => { setError("Не удалось загрузить системные теги."); setAllAvailableSystemTags([...DIFFICULTY_TAG_OPTIONS, ...COMMON_LANGUAGE_TAG_OPTIONS].sort()); })
      .finally(() => setIsLoadingSystemTags(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null); setSuccessMessage(null);
  };

  const handleTagToggle = (tagToToggle: string) => {
    setFormData(prev => {
      let newSelectedTags = prev.selectedTags ? [...prev.selectedTags] : [];
      const isDifficultyTag = DIFFICULTY_TAG_OPTIONS.includes(tagToToggle as any);
      if (newSelectedTags.includes(tagToToggle)) {
        newSelectedTags = newSelectedTags.filter(t => t !== tagToToggle);
      } else {
        if (isDifficultyTag) { newSelectedTags = newSelectedTags.filter(t => !DIFFICULTY_TAG_OPTIONS.includes(t as any)); }
        newSelectedTags.push(tagToToggle);
      }
      return { ...prev, selectedTags: newSelectedTags };
    });
    setError(null); setSuccessMessage(null);
  };

  const handleAddCustomTag = () => {
    const newTag = customTagInput.trim();
    if (newTag && !formData.selectedTags.includes(newTag) && !allAvailableSystemTags.includes(newTag)) {
        setFormData(prev => ({...prev, selectedTags: [...(prev.selectedTags || []), newTag]}));
    }
    setCustomTagInput(''); setError(null); setSuccessMessage(null);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setError('Файл должен быть изображением.'); setCoverPreview(null); setFormData(p => ({...p, coverFile: null})); if (coverInputRef.current) coverInputRef.current.value = ""; return; }
      if (file.size > 5 * 1024 * 1024) { setError('Файл слишком большой (макс. 5MB).'); setCoverPreview(null); setFormData(p => ({...p, coverFile: null})); if (coverInputRef.current) coverInputRef.current.value = ""; return; }
      setError(null); setFormData(prev => ({ ...prev, coverFile: file }));
      if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
      setCoverPreview(URL.createObjectURL(file));
    } else {
      setFormData(prev => ({ ...prev, coverFile: null }));
      if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }
    setError(null); setSuccessMessage(null);
  };
  useEffect(() => { return () => { if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview); }; }, [coverPreview]);

  const handleSubmitFacade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Необходима авторизация.'); return; }
    if (!formData.title.trim() || !formData.description.trim()) { setError('Название и описание обязательны.'); return; }
    const selectedDifficulty = formData.selectedTags.find(tag => DIFFICULTY_TAG_OPTIONS.includes(tag as any));
    if (!selectedDifficulty) { setError('Выберите один тег сложности (Beginner, Middle, Senior).'); return; }
    setIsSubmitting(true); setError(null); setSuccessMessage(null);
    try {
      let finalCoverUrl: string | null | undefined = coverPreview;
      if (formData.coverFile) {
        const coverFormData = new FormData(); coverFormData.append('avatar', formData.coverFile);
        const uploadResponse = await uploadCourseCover(coverFormData); finalCoverUrl = uploadResponse.coverUrl;
      } else if (coverPreview === null && isEditMode) { finalCoverUrl = null; }
      const durationStr = formData.estimatedDuration.trim();
      const duration = durationStr ? parseInt(durationStr, 10) : undefined;
      if (durationStr && (isNaN(duration!) || duration! < 0)) {
        setError("Длительность должна быть положительным числом или пустой."); setIsSubmitting(false); return;
      }
      const payload: CourseFacadePayload = {
        title: formData.title.trim(), description: formData.description.trim(),
        tags: formData.selectedTags, coverUrl: finalCoverUrl, estimatedDuration: duration,
      };
      let resultingCourse: Course;
      if (isEditMode && courseId) {
        resultingCourse = await updateCourseFacade(courseId, payload);
        setSuccessMessage(`Курс "${resultingCourse.title}" успешно обновлен!`);
        setFormData(prev => ({
            ...prev, title: resultingCourse.title || '', description: resultingCourse.description || '',
            selectedTags: Array.isArray(resultingCourse.tags) ? resultingCourse.tags : [],
            coverFile: null, estimatedDuration: resultingCourse.estimatedDuration?.toString() || '',
        }));
        setCoverPreview(resultingCourse.coverUrl || null);
        setTimeout(() => { setSuccessMessage(null); }, 3000);
      } else {
        resultingCourse = await createCourseFacade(payload);
        setSuccessMessage(`Курс "${resultingCourse.title}" создан! Перенаправление к урокам...`);
        if (resultingCourse && resultingCourse.id) {
          setTimeout(() => { navigate(`/courses/${resultingCourse.id}/edit-content`); }, 2000);
        } else {
            setError("Не удалось получить ID созданного курса. Попробуйте сохранить еще раз.");
            console.error("CreateCoursePage: resultingCourse or ID is missing", resultingCourse);
        }
      }
    } catch (err) {
      const errorMsg = (err instanceof Error) ? err.message : 'Ошибка при сохранении курса.';
      setError((err as any).response?.data?.message || errorMsg);
    } finally { setIsSubmitting(false); }
  };

  const filteredSystemTags = useMemo(() => {
    const lowerSearch = tagSearchTerm.toLowerCase().trim();
    const currentSelectedTags = Array.isArray(formData.selectedTags) ? formData.selectedTags : [];
    const availableToShow = allAvailableSystemTags.filter(tag => !currentSelectedTags.includes(tag));
    if (!lowerSearch) { return availableToShow.slice(0, 20); } // Показываем до 20 тегов, если поиск пуст
    return availableToShow.filter(tag => tag.toLowerCase().includes(lowerSearch));
  }, [tagSearchTerm, allAvailableSystemTags, formData.selectedTags]);

  const isSubmitDisabled = isSubmitting || !formData.title.trim() || !formData.description.trim() || !(Array.isArray(formData.selectedTags) && formData.selectedTags.find(tag => DIFFICULTY_TAG_OPTIONS.includes(tag as any)));

  if (initialLoading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Редактирование курса' : 'Создание курса'}
        </h1>
        {isEditMode && (
          <Link to="/create-course" className="btn-outline text-sm">
            Создать новый курс
          </Link>
        )}
      </div>

      {error && <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center" role="alert">{error}</div>}
      {successMessage && <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-lg text-sm text-center" role="alert">{successMessage}</div>}

      <form onSubmit={handleSubmitFacade} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl border border-gray-200 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Название курса <span className="text-red-500">*</span></label>
          <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required className="form-input" placeholder="Основы Go для начинающих"/>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Описание <span className="text-red-500">*</span></label>
          <textarea name="description" id="description" rows={4} value={formData.description} onChange={handleChange} required className="form-textarea" placeholder="Подробное описание..."/>
        </div>
        <div>
          <label htmlFor="coverFile" className="block text-sm font-medium text-gray-700 mb-1">Обложка (16:9, до 5MB)</label>
          <input type="file" name="coverFile" id="coverFile" accept="image/*" onChange={handleCoverChange} ref={coverInputRef} className="form-file-input"/>
          {coverPreview && (
            <div className="mt-3 relative group w-fit max-w-xs">
                <img src={coverPreview} alt="Предпросмотр" className="max-h-48 w-full object-contain rounded-md shadow-sm border"/>
                {isEditMode && coverPreview && (
                    <button type="button" onClick={() => { setCoverPreview(null); setFormData(prev => ({...prev, coverFile: null})); if(coverInputRef.current) coverInputRef.current.value = ""; }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            title="Удалить обложку">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="estimatedDuration" className="block text-sm font-medium text-gray-700 mb-1">Примерная длительность (часов)</label>
          <input type="number" name="estimatedDuration" id="estimatedDuration" value={formData.estimatedDuration} onChange={handleChange} className="form-input w-32" placeholder="20" min="0"/>
        </div>

        {/* ВОССТАНОВЛЕННАЯ СЕКЦИЯ ТЕГОВ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Теги курса <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-2">Выберите уровень сложности (обязательно), язык (если применимо) и другие релевантные теги.</p>
          {Array.isArray(formData.selectedTags) && formData.selectedTags.length > 0 && (
            <div className="mb-3 p-3 border border-gray-200 rounded-md bg-gray-50 flex flex-wrap gap-2">
              {formData.selectedTags.map(tag => (
                <button type="button" key={`selected-${tag}`} onClick={() => handleTagToggle(tag)}
                        className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-600 text-white border border-orange-700 hover:bg-orange-700 flex items-center">
                  {tag}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <input type="text" placeholder="Поиск по системным тегам..." value={tagSearchTerm} onChange={(e) => setTagSearchTerm(e.target.value)} className="form-input mb-2" />
          {isLoadingSystemTags ? ( <p className="text-xs text-gray-500">Загрузка тегов...</p> ) : (
            filteredSystemTags.length > 0 ? (
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2 flex flex-wrap gap-1.5 mb-2">
                {filteredSystemTags.map(tag => (
                  <button type="button" key={`suggest-${tag}`} onClick={() => handleTagToggle(tag)}
                          className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300">
                    #{tag}
                  </button>
                ))}
              </div>
            ) : ( tagSearchTerm && <p className="text-xs text-gray-500 mb-2">Теги по запросу "{tagSearchTerm}" не найдены.</p> )
          )}
          <div className="flex gap-2 items-center">
            <input type="text" placeholder="Добавить свой тег (например, React)" value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); }}}
                   className="form-input flex-grow"/>
            <button type="button" onClick={handleAddCustomTag} className="btn-secondary text-sm px-3 py-2 whitespace-nowrap">Добавить тег</button>
          </div>
        </div>
        {/* КОНЕЦ СЕКЦИИ ТЕГОВ */}

        <div className="pt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(isEditMode && courseId ? `/courses/${courseId}/edit-content` : '/profile')}
            disabled={isSubmitting}
            className="btn-outline"
          >
            {isEditMode ? 'К урокам' : 'Отмена'}
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="btn-primary"
          >
            {isSubmitting ? 'Сохранение...' : (isEditMode ? 'Сохранить изменения' : 'Далее (к урокам)')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCoursePage;