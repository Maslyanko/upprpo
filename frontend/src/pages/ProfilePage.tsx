// ==== File: frontend/src/pages/ProfilePage.tsx ====
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { useAuth } from '../hooks/useAuth';
import {
    getCurrentUser,
    getMyEnrollments,
    getMyCreatedCourses,
    EnrollmentWithCourse
} from '../api/userApi';
import type { User } from '../types/User';
import type { Course } from '../types/Course';
import ActiveCourseCard from '@/components/profile/ActiveCourseCard';
import CompletedCourseCard from '@/components/profile/CompletedCourseCard';
import CreatedCourseCard from '@/components/profile/CreatedCourseCard';

enum ProfileTab {
  ActiveCourses = 'active',
  CompletedCourses = 'completed',
  CreatedCourses = 'created'
}

const ProfilePage: React.FC = () => {
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [isFetchingInitialProfile, setIsFetchingInitialProfile] = useState<boolean>(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.ActiveCourses);
  const [activeEnrollments, setActiveEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [completedEnrollments, setCompletedEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  useEffect(() => {
    document.title = authUser ? `${authUser.fullName || 'Профиль'} - AI-Hunt` : 'Профиль - AI-Hunt';
  }, [authUser]);

  // --- Effect 1: Fetch initial profile data ---
  useEffect(() => {
    if (!isAuthLoading && authUser && !userData && !isFetchingInitialProfile && !initialLoadError) {
      setIsFetchingInitialProfile(true);
      setInitialLoadError(null);
      getCurrentUser()
        .then(latestUserData => { setUserData(latestUserData); })
        .catch(error => {
          setInitialLoadError('Не удалось загрузить данные профиля.');
          setUserData(null);
        })
        .finally(() => { setIsFetchingInitialProfile(false); });
    } else if (!isAuthLoading && !authUser && userData !== null) {
      setUserData(null); // Clear local data if user logs out
    }
  }, [isAuthLoading, authUser, userData, isFetchingInitialProfile, initialLoadError]);

  // --- Effect 2: Load data for the selected tab ---
   const loadTabData = useCallback(async () => {
    if (!userData) return;
    setIsLoadingCourses(true); setCoursesError(null);
    if (activeTab !== ProfileTab.ActiveCourses) setActiveEnrollments([]);
    if (activeTab !== ProfileTab.CompletedCourses) setCompletedEnrollments([]);
    if (activeTab !== ProfileTab.CreatedCourses) setCreatedCourses([]);
    try {
      switch (activeTab) {
        case ProfileTab.ActiveCourses: setActiveEnrollments(await getMyEnrollments('inProgress')); break;
        case ProfileTab.CompletedCourses: setCompletedEnrollments(await getMyEnrollments('completed')); break;
        case ProfileTab.CreatedCourses: setCreatedCourses(await getMyCreatedCourses()); break;
      }
    } catch (error) { setCoursesError(`Не удалось загрузить данные.`); }
    finally { setIsLoadingCourses(false); }
  }, [activeTab, userData]);

  useEffect(() => {
    if (userData) { loadTabData().catch(console.error); }
  }, [userData, activeTab, loadTabData]);


  if (isAuthLoading || (authUser && isFetchingInitialProfile && !userData)) {
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  if (!authUser) { // Should be caught by ProtectedRoute, but as a fallback
    return <div className="text-center py-12 text-lg">Пожалуйста, войдите, чтобы увидеть профиль.</div>;
  }
  if (initialLoadError && !userData) {
      return <div className="text-center py-12 text-red-600">{initialLoadError}</div>;
  }
  if (!userData) { // Should only show briefly if at all
     return <div className="text-center py-12 text-red-600">Загрузка данных профиля...</div>;
  }

  const renderCoursesTab = () => {
      if (isLoadingCourses) { return (<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>); }
      if (coursesError) { return (<div className="text-center py-16 text-red-500"><p>{coursesError}</p><button onClick={() => loadTabData().catch(console.error)} className="mt-2 px-3 py-1 border border-red-500 rounded text-red-500 hover:bg-red-50 text-sm">Попробовать снова</button></div>); }
      let content: React.ReactNode = null; let isEmpty = false; let emptyMessage = '';
      switch (activeTab) {
          case ProfileTab.ActiveCourses: isEmpty = activeEnrollments.length === 0; emptyMessage = 'У вас пока нет активных курсов.'; content = activeEnrollments.map(enr => <ActiveCourseCard key={enr.course.id} enrollment={enr} />); break;
          case ProfileTab.CompletedCourses: isEmpty = completedEnrollments.length === 0; emptyMessage = 'У вас пока нет завершенных курсов.'; content = completedEnrollments.map(enr => <CompletedCourseCard key={enr.course.id} enrollment={enr} />); break;
          case ProfileTab.CreatedCourses: isEmpty = createdCourses.length === 0; emptyMessage = 'Вы пока не создали ни одного курса.'; content = createdCourses.map(course => <CreatedCourseCard key={course.id} course={course} />); break;
      }
      if (isEmpty) { return (<div className="text-center py-16 text-gray-500"><p>{emptyMessage}</p>{activeTab === ProfileTab.CreatedCourses && (<Link to="/create-course" className="mt-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm font-medium">Создать курс</Link>)}</div>); }
      return (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{content}</div>);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header Section (View Mode) */}
        <div className="mb-10 p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-5">
                    <img
                        src={userData.avatarUrl || '/images/default-avatar.png'}
                        alt={userData.fullName || 'Аватар'}
                        className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-full border-2 border-gray-100 shadow-sm"
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{userData.fullName || 'Имя не указано'}</h1>
                        <p className="text-gray-500">{userData.email}</p>
                    </div>
                </div>
                <Link
                    to="/profile/edit" // Link to the new edit page
                    className="text-sm text-white bg-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 mt-4 sm:mt-0 px-4 py-2 rounded-md shadow-sm font-medium whitespace-nowrap"
                >
                    Редактировать профиль
                </Link>
            </div>
        </div>

        {/* Tabs Section */}
        <div>
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <button onClick={() => setActiveTab(ProfileTab.ActiveCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.ActiveCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Активные курсы</button>
                    <button onClick={() => setActiveTab(ProfileTab.CompletedCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CompletedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Завершенные курсы</button>
                    <button onClick={() => setActiveTab(ProfileTab.CreatedCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CreatedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Мои созданные курсы</button>
                </nav>
            </div>
            <div className="min-h-[200px]">
                {renderCoursesTab()}
            </div>
        </div>
    </div>
   );
};

export default ProfilePage;