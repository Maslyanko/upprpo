// ==== File: frontend/src/pages/CreateCoursePage.tsx ====
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createCourseFacade, uploadCourseCover, getAvailableTags } from '../api/coursesApi';
import type { CourseFacadePayload, Course } from '../types/Course';

const DIFFICULTY_TAG_OPTIONS: ReadonlyArray<'Beginner' | 'Middle' | 'Senior'> = ['Beginner', 'Middle', 'Senior'];
const COMMON_LANGUAGE_TAG_OPTIONS: Readonly<string[]> = [
  'Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript'
];

interface FormDataState {
  title: string;
  description: string;
  selectedTags: string[];
  coverFile: File | null;
  estimatedDuration: string;
}

const CreateCoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState<FormDataState>({
    title: '',
    description: '',
    selectedTags: [],
    coverFile: null,
    estimatedDuration: '',
  });

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
    document.title = 'Создание нового курса - AI-Hunt';
    const fetchSystemTags = async () => {
      setIsLoadingSystemTags(true);
      try {
        const tagsFromServer = await getAvailableTags();
        const uniqueTags = new Set([
          ...DIFFICULTY_TAG_OPTIONS,
          ...COMMON_LANGUAGE_TAG_OPTIONS,
          ...tagsFromServer.map(t => t.trim()).filter(Boolean)
        ]);
        setAllAvailableSystemTags(Array.from(uniqueTags).sort());
      } catch (err) {
        console.error("Failed to fetch available tags:", err);
        setError("Не удалось загрузить список системных тегов. Используются стандартные.");
        setAllAvailableSystemTags([...DIFFICULTY_TAG_OPTIONS, ...COMMON_LANGUAGE_TAG_OPTIONS].sort());
      } finally {
        setIsLoadingSystemTags(false);
      }
    };
    fetchSystemTags();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagToToggle: string) => {
    setFormData(prev => {
      let newSelectedTags = [...prev.selectedTags];
      const isDifficultyTag = DIFFICULTY_TAG_OPTIONS.includes(tagToToggle as any);

      if (newSelectedTags.includes(tagToToggle)) {
        newSelectedTags = newSelectedTags.filter(t => t !== tagToToggle);
      } else {
        if (isDifficultyTag) {
          newSelectedTags = newSelectedTags.filter(t => !DIFFICULTY_TAG_OPTIONS.includes(t as any));
        }
        newSelectedTags.push(tagToToggle);
      }
      return { ...prev, selectedTags: newSelectedTags };
    });
  };

  const handleAddCustomTag = () => {
    const newTag = customTagInput.trim();
    if (newTag && !formData.selectedTags.includes(newTag) && !allAvailableSystemTags.includes(newTag)) {
        setFormData(prev => ({...prev, selectedTags: [...prev.selectedTags, newTag]}));
    }
    setCustomTagInput('');
  };


  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setError('Файл должен быть изображением.'); setCoverPreview(null); setFormData(p => ({...p, coverFile: null})); if (coverInputRef.current) coverInputRef.current.value = ""; return; }
      if (file.size > 5 * 1024 * 1024) { setError('Файл слишком большой (макс. 5MB).'); setCoverPreview(null); setFormData(p => ({...p, coverFile: null})); if (coverInputRef.current) coverInputRef.current.value = ""; return; }
      setError(null);
      setFormData(prev => ({ ...prev, coverFile: file }));
      if (coverPreview) URL.revokeObjectURL(coverPreview); // Clean up previous object URL
      setCoverPreview(URL.createObjectURL(file));
    } else {
      setFormData(prev => ({ ...prev, coverFile: null }));
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }
  };
  // Cleanup for coverPreview URL when component unmounts or coverFile changes
  useEffect(() => {
    return () => {
        if (coverPreview && coverPreview.startsWith('blob:')) {
            URL.revokeObjectURL(coverPreview);
        }
    };
  }, [coverPreview]);


  const handleSubmitFacade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Необходима авторизация.'); return; }
    if (!formData.title.trim() || !formData.description.trim()) { setError('Название и описание обязательны.'); return; }

    const selectedDifficulty = formData.selectedTags.find(tag => DIFFICULTY_TAG_OPTIONS.includes(tag as any));
    if (!selectedDifficulty) { setError('Выберите один тег сложности (Beginner, Middle, Senior).'); return; }

    setIsSubmitting(true); setError(null); setSuccessMessage(null);

    try {
      let uploadedCoverUrl: string | undefined = undefined;
      if (formData.coverFile) {
        const coverFormData = new FormData();
        coverFormData.append('avatar', formData.coverFile);
        const uploadResponse = await uploadCourseCover(coverFormData);
        uploadedCoverUrl = uploadResponse.coverUrl;
      }

      const duration = formData.estimatedDuration ? parseInt(formData.estimatedDuration, 10) : undefined;
      if (formData.estimatedDuration && (isNaN(duration) || duration <=0)) {
        setError("Длительность должна быть положительным числом.");
        setIsSubmitting(false);
        return;
      }

      const payload: CourseFacadePayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        tags: formData.selectedTags,
        coverUrl: uploadedCoverUrl,
        estimatedDuration: duration,
      };

      const newCourse: Course = await createCourseFacade(payload);
      setSuccessMessage(`Базовая информация о курсе "${newCourse.title}" сохранена! Перенаправление для добавления уроков...`);
      setTimeout(() => {
        navigate(`/courses/${newCourse.id}/edit-content`);
      }, 2500);

    } catch (err) {
      const errorMsg = (err instanceof Error) ? err.message : 'Ошибка при создании курса.';
      setError((err as any).response?.data?.message || errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSystemTags = useMemo(() => {
    const lowerSearch = tagSearchTerm.toLowerCase().trim();
    if (!lowerSearch) return allAvailableSystemTags.filter(tag => !formData.selectedTags.includes(tag)).slice(0, 20);
    return allAvailableSystemTags.filter(tag =>
      !formData.selectedTags.includes(tag) && tag.toLowerCase().includes(lowerSearch)
    );
  }, [tagSearchTerm, allAvailableSystemTags, formData.selectedTags]);

  const isSubmitDisabled = isSubmitting || !formData.title.trim() || !formData.description.trim() || !formData.selectedTags.find(tag => DIFFICULTY_TAG_OPTIONS.includes(tag as any));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* ИЗМЕНЕННЫЙ ЗАГОЛОВОК */}
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Создание курса</h1>
      {error && <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>}
      {successMessage && <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-lg text-sm text-center">{successMessage}</div>}

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
          {coverPreview && <img src={coverPreview} alt="Предпросмотр" className="mt-3 max-h-48 rounded-md shadow-sm border"/>}
        </div>
        <div>
          <label htmlFor="estimatedDuration" className="block text-sm font-medium text-gray-700 mb-1">Примерная длительность (часов)</label>
          <input type="number" name="estimatedDuration" id="estimatedDuration" value={formData.estimatedDuration} onChange={handleChange} className="form-input w-32" placeholder="20" min="1"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Теги курса <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-2">Выберите уровень сложности (обязательно), язык (если применимо) и другие релевантные теги.</p>
          {formData.selectedTags.length > 0 && (
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
          <input type="text" placeholder="Поиск по системным тегам..." value={tagSearchTerm} onChange={(e) => setTagSearchTerm(e.target.value)} className="form-input mb-2"/>
          {isLoadingSystemTags ? <p className="text-xs text-gray-500">Загрузка тегов...</p> : (
            filteredSystemTags.length > 0 && (
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2 flex flex-wrap gap-1.5 mb-2">
                {filteredSystemTags.map(tag => (
                  <button type="button" key={`suggest-${tag}`} onClick={() => handleTagToggle(tag)}
                          className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300">
                    #{tag}
                  </button>
                ))}
              </div>
            )
          )}
          <div className="flex gap-2 items-center">
            <input type="text" placeholder="Добавить свой тег" value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); }}}
                   className="form-input flex-grow"/>
            <button type="button" onClick={handleAddCustomTag} className="btn-secondary text-sm px-3 py-2 whitespace-nowrap">Добавить тег</button>
          </div>
        </div>
        <div className="pt-5 flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} disabled={isSubmitting} className="btn-outline">Отмена</button>
          <button type="submit" disabled={isSubmitDisabled} className="btn-primary">
            {isSubmitting ? 'Сохранение...' : 'Сохранить и к урокам'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCoursePage;