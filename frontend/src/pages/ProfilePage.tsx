// ===== ./src/pages/ProfilePage.tsx =====
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth'; // Ensure path: ../hooks/useAuth or @/hooks/useAuth
import {
    updateProfile,
    uploadAvatar,
    getCurrentUser,
    getMyEnrollments,
    getMyCreatedCourses,
    EnrollmentWithCourse
} from '../api/userApi'; // Ensure path: ../api/userApi or @/api/userApi
import type { User } from '../types/User'; // Ensure path: ../types/User or @/types/User
import type { Course } from '../types/Course'; // Ensure path: ../types/Course or @/types/Course
import ActiveCourseCard from '@/components/profile/ActiveCourseCard'; // Ensure path: @/components/profile/...
import CompletedCourseCard from '@/components/profile/CompletedCourseCard'; // Ensure path: @/components/profile/...
import CreatedCourseCard from '@/components/profile/CreatedCourseCard'; // Ensure path: @/components/profile/...
import '../styles/profile.css'; // For avatar edit button styles if needed

enum ProfileTab {
  ActiveCourses = 'active',
  CompletedCourses = 'completed',
  CreatedCourses = 'created'
}

// Helper to check for valid number
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

const ProfilePage: React.FC = () => {
  console.log("ProfilePage: Render Start");

  const { user, updateUserState, isLoading: isAuthLoading } = useAuth();

  // --- State ---
  // Profile Data
  const [userData, setUserData] = useState<User | null>(null);
  const [isFetchingInitialProfile, setIsFetchingInitialProfile] = useState<boolean>(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Tab & Course Data State
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.ActiveCourses);
  const [activeEnrollments, setActiveEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [completedEnrollments, setCompletedEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  console.log("ProfilePage: State Init:", { isAuthLoading, user: !!user, userData: !!userData, isFetchingInitialProfile });

  // --- Effect 1: Fetch initial profile data ---
  useEffect(() => {
    if (!isAuthLoading && user && !userData && !isFetchingInitialProfile && !initialLoadError) {
      console.log("ProfilePage: EFFECT 1 - Triggering initial user data fetch...");
      setIsFetchingInitialProfile(true);
      setInitialLoadError(null);
      getCurrentUser()
        .then(latestUserData => {
          console.log("ProfilePage: EFFECT 1 - Initial user data fetched:", latestUserData);
          setUserData(latestUserData);
        })
        .catch(error => {
          console.error('ProfilePage: EFFECT 1 - Failed to fetch initial user data:', error);
          setInitialLoadError('Не удалось загрузить данные профиля.');
          setUserData(null);
        })
        .finally(() => {
          setIsFetchingInitialProfile(false);
          console.log("ProfilePage: EFFECT 1 - Finished initial user data fetch attempt.");
        });
    } else if (!isAuthLoading && !user && userData !== null) {
        console.log("ProfilePage: EFFECT 1 - Auth loaded, no user. Clearing local userData.");
        setUserData(null);
    }
  }, [isAuthLoading, user, userData, isFetchingInitialProfile, initialLoadError]);

  // --- Effect 2: Update form fields when userData loads/changes ---
  useEffect(() => {
    if (userData) {
      console.log("ProfilePage: EFFECT 2 - userData available, updating form fields.", userData);
      setFullName(userData.fullName || '');
      // Use default avatar if userData.avatarUrl is null or empty
      setAvatarPreview(userData.avatarUrl || '/images/default-avatar.png');
      // Reset editing state if user data is externally updated (e.g., after save)
      if (!isUpdatingProfile) { // Avoid resetting immediately after save starts
          setIsEditing(false);
      }
      setProfileMessage(null); // Clear messages when data reloads
    } else {
      console.log("ProfilePage: EFFECT 2 - userData is null, resetting form fields.");
      setFullName('');
      setAvatarPreview('/images/default-avatar.png'); // Default image path
      setIsEditing(false);
    }
  }, [userData, isUpdatingProfile]); // Rerun when userData changes or update finishes

  // --- Effect 3: Load data for the selected tab ---
   const loadTabData = useCallback(async () => {
    if (!userData) {
      console.log("ProfilePage: loadTabData - Skipping, no userData.");
      setActiveEnrollments([]); setCompletedEnrollments([]); setCreatedCourses([]); // Clear data
      return;
    }
    console.log(`ProfilePage: loadTabData - Loading data for tab: ${activeTab}`);
    setIsLoadingCourses(true); setCoursesError(null);
    // Clear previous data for other tabs to avoid flicker
    if (activeTab !== ProfileTab.ActiveCourses) setActiveEnrollments([]);
    if (activeTab !== ProfileTab.CompletedCourses) setCompletedEnrollments([]);
    if (activeTab !== ProfileTab.CreatedCourses) setCreatedCourses([]);
    try {
      switch (activeTab) {
        case ProfileTab.ActiveCourses: setActiveEnrollments(await getMyEnrollments('inProgress')); break;
        case ProfileTab.CompletedCourses: setCompletedEnrollments(await getMyEnrollments('completed')); break;
        case ProfileTab.CreatedCourses:
          setCreatedCourses(await getMyCreatedCourses());
          break;
      }
      console.log(`ProfilePage: loadTabData - Data loaded for ${activeTab}.`);
    } catch (error) {
      console.error(`ProfilePage: loadTabData - Error loading tab data (${activeTab}):`, error);
      setCoursesError(`Не удалось загрузить данные.`);
    } finally { setIsLoadingCourses(false); }
  }, [activeTab, userData]); // Depend on tab and userData presence

  useEffect(() => {
    console.log("ProfilePage: EFFECT 3 - Checking if tab data should load.", { hasUserData: !!userData, activeTab });
    if (userData) { // Only load if profile data is available
      loadTabData().catch(console.error);
    }
  }, [userData, activeTab, loadTabData]); // Rerun if userData, tab, or the function itself changes


  // --- Handlers ---
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) { setProfileMessage({ text: 'Пожалуйста, выберите файл изображения.', type: 'error'}); return; }
        if (file.size > 5 * 1024 * 1024) { setProfileMessage({ text: 'Файл слишком большой (макс. 5MB).', type: 'error'}); return; }
        setProfileMessage(null);
        setAvatarFile(file);
        const reader = new FileReader();
        reader.onload = (event) => setAvatarPreview(event.target?.result as string);
        reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    console.log("ProfilePage: handleProfileSubmit - Submitting profile update...");
    setIsUpdatingProfile(true); setProfileMessage(null);
    try {
        let dataToUpdate: { fullName?: string; avatarUrl?: string } = {};
        let userAfterUpdate: User = { ...userData };
        if (fullName.trim() !== (userData.fullName || '').trim() && fullName.trim() !== '') {
            dataToUpdate.fullName = fullName.trim();
        }
        if (dataToUpdate.fullName) {
            console.log("ProfilePage: Updating text fields:", dataToUpdate);
            const updatedTextFields = await updateProfile({ fullName: dataToUpdate.fullName });
            userAfterUpdate = { ...userAfterUpdate, ...updatedTextFields };
            console.log("ProfilePage: Text fields updated.");
        }
        if (avatarFile) {
            console.log("ProfilePage: Uploading new avatar...");
            const formData = new FormData();
            formData.append('avatar', avatarFile);
            const avatarResponse = await uploadAvatar(formData);
            console.log("ProfilePage: Avatar uploaded, URL:", avatarResponse.avatarUrl);
            console.log("ProfilePage: Updating profile with new avatar URL...");
            const finalUpdatedUser = await updateProfile({ avatarUrl: avatarResponse.avatarUrl });
            userAfterUpdate = { ...userAfterUpdate, ...finalUpdatedUser };
            console.log("ProfilePage: Profile updated with new avatar URL.");
        }
        setUserData(userAfterUpdate); // Update local state first for immediate feedback
        updateUserState(userAfterUpdate); // Then update global state
        setAvatarFile(null);
        // setIsEditing(false); // Let Effect 2 handle exiting edit mode based on userData change
        setProfileMessage({ text: 'Профиль успешно обновлен', type: 'success' });
        console.log("ProfilePage: Profile update successful.");
    } catch (error) {
        console.error('ProfilePage: handleProfileSubmit - Error updating profile:', error);
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        setProfileMessage({ text: `Ошибка обновления: ${errorMsg}`, type: 'error' });
    } finally {
        setIsUpdatingProfile(false);
    }
  };

  // --- RENDER LOGIC ---
  console.log("ProfilePage: Evaluating render conditions...", { isAuthLoading, user:!!user, isFetchingInitialProfile, userData:!!userData, initialLoadError });

  // 1. Auth Loading
  if (isAuthLoading) {
    console.log("ProfilePage: Render: Auth Loading");
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  // 2. Not Logged In
  if (!user) {
    console.log("ProfilePage: Render: Not Logged In");
    return <div className="text-center py-12 text-lg">Пожалуйста, войдите, чтобы увидеть профиль.</div>;
  }
  // 3. Initial Profile Fetch In Progress (only show if userData is still null)
  if (isFetchingInitialProfile && !userData) {
     console.log("ProfilePage: Render: Initial Profile Fetching");
     return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  // 4. Initial Profile Fetch Failed (only show if userData is still null)
  if (initialLoadError && !userData) {
      console.log("ProfilePage: Render: Initial Load Error");
      return <div className="text-center py-12 text-red-600">{initialLoadError}</div>;
  }
  // 5. Fallback if userData is unexpectedly null after checks
  if (!userData) {
     console.error("ProfilePage: Render: Fallback Error - userData is null!");
     return <div className="text-center py-12 text-red-600">Не удалось загрузить данные профиля. Обновите страницу.</div>;
  }

  // --- RENDER MAIN CONTENT (userData is guaranteed non-null here) ---
  console.log("ProfilePage: Render: Main Content for", userData.email);

  // --- Tab Rendering Function ---
  const renderCoursesTab = () => {
      if (isLoadingCourses) { return (<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>); }
      if (coursesError) { return (<div className="text-center py-16 text-red-500"><p>{coursesError}</p><button onClick={() => loadTabData().catch(console.error)} className="mt-2 px-3 py-1 border border-red-500 rounded text-red-500 hover:bg-red-50 text-sm">Попробовать снова</button></div>); }
      let content: React.ReactNode = null; let isEmpty = false; let emptyMessage = '';
      switch (activeTab) {
          case ProfileTab.ActiveCourses: isEmpty = activeEnrollments.length === 0; emptyMessage = 'У вас пока нет активных курсов.'; content = activeEnrollments.map(enr => <ActiveCourseCard key={enr.course.id} enrollment={enr} />); break;
          case ProfileTab.CompletedCourses: isEmpty = completedEnrollments.length === 0; emptyMessage = 'У вас пока нет завершенных курсов.'; content = completedEnrollments.map(enr => <CompletedCourseCard key={enr.course.id} enrollment={enr} />); break;
          case ProfileTab.CreatedCourses:
              isEmpty = createdCourses.length === 0; emptyMessage = 'Вы пока не создали ни одного курса.'; content = createdCourses.map(course => <CreatedCourseCard key={course.id} course={course} />);
              break;
      }
      if (isEmpty) { return (<div className="text-center py-16 text-gray-500"><p>{emptyMessage}</p>{activeTab === ProfileTab.CreatedCourses && (<a href="/create-course" className="mt-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm font-medium">Создать курс</a>)}</div>); }
      // Grid layout for course cards
      return (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{content}</div>);
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Profile Header Section */}
        <div className="mb-10">
            {profileMessage && (
                <div className={`p-3 mb-4 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {profileMessage.text}
                </div>
            )}

            {isEditing ? (
                // Edit Form Container
                <form onSubmit={handleProfileSubmit} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 relative">
                    {isUpdatingProfile && ( <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div> )}
                    <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                        {/* Avatar Edit Column */}
                        <div className="w-full md:w-auto flex flex-col items-center">
                            <div className="relative avatar-upload w-28 h-28">
                                <div className="avatar-preview w-full h-full border-2 border-gray-200 rounded-full overflow-hidden">
                                    <img src={avatarPreview || '/images/default-avatar.png'} alt="Предпросмотр аватара" className="w-full h-full object-cover"/>
                                </div>
                                <div className="avatar-edit">
                                    <input type="file" id="avatarUpload" accept="image/*" onChange={handleAvatarChange} className="sr-only"/> {/* Hide default input */}
                                    <label htmlFor="avatarUpload" className="flex items-center justify-center w-8 h-8 bg-orange-500 text-white rounded-full cursor-pointer shadow hover:bg-orange-600 absolute right-0 bottom-0 ring-2 ring-white">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </label>
                                </div>
                            </div>
                        </div>
                        {/* Fields Edit Column */}
                        <div className="flex-grow">
                            <div className="mb-4">
                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
                                <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500" required/>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input id="email" type="email" value={userData.email} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed" disabled/>
                            </div>
                        </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
                        <button type="button" onClick={() => { setIsEditing(false); setAvatarFile(null); setAvatarPreview(userData.avatarUrl || '/images/default-avatar.png'); setFullName(userData.fullName || ''); setProfileMessage(null);}} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={isUpdatingProfile}>Отмена</button>
                        <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50" disabled={isUpdatingProfile}>{isUpdatingProfile ? 'Сохранение...' : 'Сохранить'}</button>
                    </div>
                </form>
            ) : (
                // View Mode Header Container
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-5"> {/* Avatar + Name/Email */}
                        <img
                            src={userData.avatarUrl || '/images/default-avatar.png'}
                            alt={userData.fullName || 'Аватар'}
                            className="w-28 h-28 object-cover rounded-full border-2 border-gray-100 shadow-sm"
                        />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{userData.fullName || 'Имя не указано'}</h1>
                            <p className="text-gray-500">{userData.email}</p>
                        </div>
                    </div>
                    <button // Edit Button
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-gray-600 hover:text-orange-600 focus:outline-none mt-4 sm:mt-0 whitespace-nowrap px-3 py-1 rounded border border-gray-300 hover:border-gray-400" // Button-like appearance
                    >
                        Редактировать профиль
                    </button>
                </div>
            )}
        </div>

        {/* Tabs Section */}
        <div>
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <button onClick={() => setActiveTab(ProfileTab.ActiveCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.ActiveCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Активные курсы</button>
                    <button onClick={() => setActiveTab(ProfileTab.CompletedCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CompletedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Завершенные курсы</button>
                    {<button onClick={() => setActiveTab(ProfileTab.CreatedCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CreatedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Мои созданные курсы</button>}
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