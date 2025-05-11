import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, uploadAvatar } from '../api/userApi';
import { getCourses } from '../api/coursesApi';
import { Course } from '../types/Course';
import '../styles/profile.css';

enum ProfileTab {
  ActiveCourses = 'active',
  CompletedCourses = 'completed',
  CreatedCourses = 'created'
}

const ProfilePage: React.FC = () => {
  const { user, login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.ActiveCourses);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  console.log('ProfilePage component rendering');
  console.log('Current user state:', user);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
    }
  }, [user]);

  useEffect(() => {
    console.log('useEffect for loading courses, user:', user);
    if (user) {
      console.log('Attempting to load courses for tab:', activeTab);
      loadCourses();
    }
  }, [user, activeTab]);

  const loadCourses = async () => {
    console.log('loadCourses called');
    if (!user) {
      console.log('No user, skipping course loading');
      return;
    }

    setIsLoadingCourses(true);
    try {
      console.log('Making API call to get courses');
      // В реальном приложении нужно будет добавить API для получения 
      // курсов пользователя с фильтрацией по статусу
      const allCourses = await getCourses();
      
      // Фильтруем курсы в зависимости от активного таба
      // Это временное решение, в реальном приложении фильтрация должна быть на стороне бэкенда
      let filteredCourses: Course[] = [];
      
      if (activeTab === ProfileTab.ActiveCourses) {
        // Имитация фильтрации активных курсов (в реальности нужен API с фильтрами)
        filteredCourses = allCourses.slice(0, 3);
      } else if (activeTab === ProfileTab.CompletedCourses) {
        // Имитация фильтрации завершенных курсов
        filteredCourses = allCourses.slice(3, 4);
      } else if (activeTab === ProfileTab.CreatedCourses && user.role === 'author') {
        // Имитация фильтрации созданных курсов (для авторов)
        filteredCourses = allCourses.filter(course => course.authorId === user.id);
      }
      
      setCourses(filteredCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      
      // Показываем предпросмотр
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
  
    try {
      // Обновляем базовые данные профиля
      const updatedUser = await updateProfile({
        fullName
      });
  
      // Если есть новый аватар, загружаем его
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarResponse = await uploadAvatar(formData);
        
        // Обновляем локальные данные пользователя с новым URL аватара
        updatedUser.avatarUrl = avatarResponse.avatarUrl;
      }
  
      // Обновляем локальное состояние пользователя
      // Используем обновленную функцию login, которая теперь может принимать объект пользователя
      login(updatedUser);
      
      setMessage({ text: 'Профиль успешно обновлен', type: 'success' });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ text: 'Ошибка при обновлении профиля', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <div className="text-center">
          <p className="text-lg">Для просмотра профиля необходимо войти в систему</p>
        </div>
      </div>
    );
  }

  const renderCoursesTab = () => {
    if (isLoadingCourses) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      );
    }

    if (courses.length === 0) {
      let emptyMessage = 'У вас пока нет активных курсов';
      
      if (activeTab === ProfileTab.CompletedCourses) {
        emptyMessage = 'У вас пока нет завершенных курсов';
      } else if (activeTab === ProfileTab.CreatedCourses) {
        emptyMessage = 'Вы пока не создали ни одного курса';
      }
      
      return (
        <div className="text-center py-8 text-gray-500">
          <p>{emptyMessage}</p>
          {activeTab === ProfileTab.CreatedCourses && (
            <a href="/create-course" className="mt-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600">
              Создать курс
            </a>
          )}
        </div>
      );
    }

    return (
      <div className="course-grid">
        {courses.map(course => (
          <div key={course.id} className="course-card">
            <div className="h-40 bg-gray-200 relative">
              <img 
                src={course.coverUrl} 
                alt={course.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-30"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-medium truncate">{course.title}</h3>
                <p className="text-white text-sm opacity-80">{course.authorName}</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{course.estimatedDuration} ч</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-yellow-500 mr-1">★</span>
                  <span>{course.stats.avgScore.toFixed(1)}</span>
                </div>
              </div>
              
              {activeTab !== ProfileTab.CreatedCourses && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Прогресс</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{ width: `${activeTab === ProfileTab.CompletedCourses ? 100 : Math.floor(Math.random() * 80) + 10}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div>
                <a 
                  href={`/courses/${course.id}`} 
                  className="w-full inline-block text-center py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm font-medium"
                >
                  {activeTab === ProfileTab.CreatedCourses ? 'Редактировать' : 'Продолжить'}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Профиль пользователя</h1>

          {message && (
            <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}

          {isEditing ? (
            // Форма редактирования профиля
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="w-full sm:w-1/3">
                  <div className="avatar-upload mx-auto">
                    <div className="avatar-preview">
                      <img 
                        src={avatarPreview || user.avatarUrl || '/images/default-avatar.png'} 
                        alt={user.fullName || 'User'} 
                      />
                    </div>
                    <div className="avatar-edit">
                      <input 
                        type="file" 
                        id="avatarUpload" 
                        accept="image/*" 
                        onChange={handleAvatarChange} 
                      />
                      <label htmlFor="avatarUpload">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="w-full sm:w-2/3">
                  <div className="mb-4">
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      ФИО
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={user.email}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                      disabled
                    />
                    <p className="mt-1 text-xs text-gray-500">Email нельзя изменить</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Роль
                    </label>
                    <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100">
                      {user.role === 'author' ? 'Автор' : 'Пользователь'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-orange-300"
                  disabled={isLoading}
                >
                  {isLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          ) : (
            // Просмотр профиля
            <div>
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="w-full sm:w-1/3">
                  <div className="w-32 h-32 rounded-full overflow-hidden mx-auto bg-gray-200">
                    <img 
                      src={user.avatarUrl || '/images/default-avatar.png'} 
                      alt={user.fullName || 'User'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                
                <div className="w-full sm:w-2/3">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">{user.fullName}</h2>
                    <p className="text-gray-600">{user.email}</p>
                    <p className="text-gray-500 mt-1">
                      {user.role === 'author' ? 'Автор курсов' : 'Пользователь'}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Статистика</h3>
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-gray-100 p-4 rounded-md">
                        <p className="text-sm text-gray-600">Активные курсы</p>
                        <p className="text-xl font-bold text-gray-900">{user.stats?.activeCourses || 0}</p>
                      </div>
                      <div className="bg-gray-100 p-4 rounded-md">
                        <p className="text-sm text-gray-600">Завершенные курсы</p>
                        <p className="text-xl font-bold text-gray-900">{user.stats?.completedCourses || 0}</p>
                      </div>
                      <div className="bg-gray-100 p-4 rounded-md">
                        <p className="text-sm text-gray-600">Средний балл</p>
                        <p className="text-xl font-bold text-gray-900">{user.stats?.avgScore?.toFixed(1) || '0.0'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  Редактировать профиль
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Табы с курсами */}
        <div className="profile-tabs">
          <div 
            className={`profile-tab ${activeTab === ProfileTab.ActiveCourses ? 'active' : ''}`}
            onClick={() => setActiveTab(ProfileTab.ActiveCourses)}
          >
            Активные курсы
          </div>
          <div 
            className={`profile-tab ${activeTab === ProfileTab.CompletedCourses ? 'active' : ''}`}
            onClick={() => setActiveTab(ProfileTab.CompletedCourses)}
          >
            Завершенные курсы
          </div>
          {user.role === 'author' && (
            <div 
              className={`profile-tab ${activeTab === ProfileTab.CreatedCourses ? 'active' : ''}`}
              onClick={() => setActiveTab(ProfileTab.CreatedCourses)}
            >
              Мои созданные курсы
            </div>
          )}
        </div>
        
        {/* Содержимое активного таба */}
        {renderCoursesTab()}
      </div>
    </div>
  );
};

export default ProfilePage;