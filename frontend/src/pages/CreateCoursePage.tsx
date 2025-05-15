import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createNewCourse, uploadCourseCover, getAvailableTags } from '../api/coursesApi';
import type { CourseFacadeData, CourseCreatePayload, Course } from '../types/Course';

const DIFFICULTY_TAGS: Readonly<string[]> = ['Beginner', 'Middle', 'Senior'];
const COMMON_LANGUAGE_TAGS: Readonly<string[]> = [
  'Python', 'Java', 'SQL', 'Go', 'C++', 'C#'
];
// Теги, которые будут в приоритете при пустом поиске
const PRIORITY_TAG_VALUES: Readonly<string[]> = [...DIFFICULTY_TAGS, ...COMMON_LANGUAGE_TAGS.slice(0, 7)];


const CreateCoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState<CourseFacadeData>({
    title: '',
    description: '',
    selectedTags: [], // Храним "чистые" теги (без #)
    coverFile: null,
  });
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]); // Храним "чистые" теги
  const [isLoadingTags, setIsLoadingTags] = useState<boolean>(true);
  const [tagSearchTerm, setTagSearchTerm] = useState<string>('');

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Создание нового курса - AI-Hunt';
    const fetchTags = async () => {
      setIsLoadingTags(true);
      try {
        const tagsFromServer = await getAvailableTags();
        const uniqueTags = new Set([
            ...DIFFICULTY_TAGS,
            ...COMMON_LANGUAGE_TAGS,
            ...tagsFromServer.map(t => t.trim()).filter(Boolean)
        ]);
        setAllAvailableTags(Array.from(uniqueTags).sort());
      } catch (err) {
        console.error("Failed to fetch available tags:", err);
        setError("Не удалось загрузить список тегов. Отображаются стандартные теги.");
        setAllAvailableTags([...DIFFICULTY_TAGS, ...COMMON_LANGUAGE_TAGS].sort());
      } finally {
        setIsLoadingTags(false);
      }
    };
    fetchTags();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagToToggle: string) => { // tagToToggle - "чистый" тег
    setFormData(prev => {
      const isDifficultyTag = DIFFICULTY_TAGS.includes(tagToToggle);
      let newSelectedTags = [...prev.selectedTags];

      if (newSelectedTags.includes(tagToToggle)) {
        newSelectedTags = newSelectedTags.filter(t => t !== tagToToggle);
      } else {
        if (isDifficultyTag) {
          newSelectedTags = newSelectedTags.filter(t => !DIFFICULTY_TAGS.includes(t));
        }
        newSelectedTags.push(tagToToggle);
      }
      return { ...prev, selectedTags: newSelectedTags };
    });
  };
  
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите файл изображения для обложки.');
        setCoverPreview(null);
        setFormData(prev => ({ ...prev, coverFile: null }));
        if (coverInputRef.current) coverInputRef.current.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        setError('Файл обложки слишком большой (макс. 5MB).');
        setCoverPreview(null);
        setFormData(prev => ({ ...prev, coverFile: null }));
        if (coverInputRef.current) coverInputRef.current.value = "";
        return;
      }
      setError(null);
      setFormData(prev => ({ ...prev, coverFile: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setFormData(prev => ({ ...prev, coverFile: null }));
        setCoverPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Необходимо авторизоваться для создания курса.');
      return;
    }
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Название и описание курса обязательны.');
      return;
    }

    const selectedDifficulty = formData.selectedTags.find(tag => DIFFICULTY_TAGS.includes(tag));
    if (!selectedDifficulty) {
        setError('Пожалуйста, выберите один тег сложности (Beginner, Middle или Senior). Это обязательное поле.');
        return;
    }

    const selectedLanguage = formData.selectedTags.find(tag => COMMON_LANGUAGE_TAGS.includes(tag)) || null;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let coverUrl: string | null = null;
      if (formData.coverFile) {
        const coverUploadData = new FormData();
        coverUploadData.append('image', formData.coverFile);
        const uploadedCover = await uploadCourseCover(coverUploadData);
        coverUrl = uploadedCover.coverUrl;
      }

      const otherTags = formData.selectedTags.filter(
        tag => tag !== selectedDifficulty && tag !== selectedLanguage
      );

      const payload: CourseCreatePayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: selectedDifficulty as 'Beginner' | 'Middle' | 'Senior',
        language: selectedLanguage,
        tags: otherTags, // "Чистые" теги
        coverUrl: coverUrl,
      };

      const newCourse: Course = await createNewCourse(payload);
      setSuccessMessage(`Курс "${newCourse.title}" успешно создан! Перенаправление...`);
      
      setTimeout(() => {
        navigate(`/courses/${newCourse.id}`);
      }, 2000);

    } catch (err) {
      console.error("Course creation error:", err);
      const errorMsg = (err instanceof Error) ? err.message : 'Произошла неизвестная ошибка при создании курса.';
      if ((err as any).response?.data?.message) {
        setError((err as any).response.data.message);
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const tagsToDisplay = useMemo(() => {
    const lowerSearchTerm = tagSearchTerm.toLowerCase().trim();

    if (!lowerSearchTerm) { // Поиск неактивен
        const priority = PRIORITY_TAG_VALUES.filter(pt => allAvailableTags.includes(pt));
        const remainingAvailable = allAvailableTags.filter(t => !priority.includes(t));
        // Добавляем, например, еще 15 тегов или все оставшиеся, если их меньше
        const additionalTagsCount = Math.min(remainingAvailable.length, 15); 
        const additionalTags = remainingAvailable.slice(0, additionalTagsCount);
        
        // Сначала приоритетные (в их исходном порядке из PRIORITY_TAG_VALUES), потом дополнительные (отсортированные)
        const result = [
            ...priority, 
            ...additionalTags.sort()
        ];
        return Array.from(new Set(result)); // Убираем дубликаты, если PRIORITY_TAG_VALUES пересекаются с additionalTags (не должны)
    } else { // Поиск активен - показываем только результаты поиска
        return allAvailableTags.filter(tag =>
            tag.toLowerCase().includes(lowerSearchTerm)
        ).sort();
    }
  }, [tagSearchTerm, allAvailableTags]);
  
  const isSubmitDisabled = isSubmitting || 
                           !formData.title.trim() || 
                           !formData.description.trim() ||
                           !formData.selectedTags.some(tag => DIFFICULTY_TAGS.includes(tag));


  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
        Создание курса
      </h1>

      {error && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-lg text-sm text-center">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-gray-200 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Введите название <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            id="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Например, Основы Go для начинающих"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Опишите о чем этот курс, для кого он и какие навыки даст <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            id="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Подробное описание курса..."
          />
        </div>

        <div>
          <label htmlFor="coverFile" className="block text-sm font-medium text-gray-700 mb-1">
            Обложка курса (рекомендуется 16:9)
          </label>
          <input
            type="file"
            name="coverFile"
            id="coverFile"
            accept="image/*"
            onChange={handleCoverChange}
            ref={coverInputRef}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          />
          {coverPreview && (
            <div className="mt-3">
              <img src={coverPreview} alt="Предпросмотр обложки" className="max-h-48 rounded-md shadow-sm border" />
            </div>
          )}
        </div>
        
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Теги курса
            </label>
            <p className="text-xs text-gray-500 mb-2">
                Выберите теги, которые лучше всего описывают ваш курс (включая уровень сложности).
                Теги помогут пользователям легче найти ваш курс.
            </p>
            <input
                type="text"
                placeholder="Поиск по тегам..."
                value={tagSearchTerm}
                onChange={(e) => setTagSearchTerm(e.target.value)}
                className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
            {isLoadingTags ? (
                <p className="text-sm text-gray-500">Загрузка тегов...</p>
            ) : tagsToDisplay.length > 0 ? (
                // Контейнер для тегов с flex-wrap и gap для равномерных отступов
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50 flex flex-wrap gap-2">
                    {tagsToDisplay.map(tagValue => ( // tagValue - "чистый" тег
                        <button
                            type="button"
                            key={tagValue}
                            onClick={() => handleTagToggle(tagValue)}
                            // Стилизация кнопок тегов
                            className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors duration-150 border
                                ${formData.selectedTags.includes(tagValue)
                                    ? 'bg-orange-600 text-white border-orange-700 hover:bg-orange-700' // Выбранный тег
                                    : 'bg-gray-900 bg-opacity-70 hover:bg-opacity-80 text-white border-transparent' // Невыбранный тег (стиль с главной страницы)
                                }
                            `}
                        >
                            #{tagValue} {/* Отображаем с # */}
                        </button>
                    ))}
                </div>
            ) : (
              <p className="text-sm text-gray-500">Теги не найдены{tagSearchTerm && ` по запросу "${tagSearchTerm}"`}.</p>
            )}
        </div>

        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={isSubmitting}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 mr-3"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Создание...' : 'Далее (к урокам)'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateCoursePage;