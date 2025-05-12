// ===== ./src/pages/ProfilePage.tsx =====
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth'; // Ensure path is correct
import {
    updateProfile,
    uploadAvatar,
    getCurrentUser,
    getMyEnrollments,
    getMyCreatedCourses,
    EnrollmentWithCourse
} from '../api/userApi'; // Ensure path is correct
import type { User } from '../types/User'; // Ensure path is correct
import type { Course } from '../types/Course'; // Ensure path is correct
import ActiveCourseCard from '@/components/profile/ActiveCourseCard'; // Ensure path is correct
import CompletedCourseCard from '@/components/profile/CompletedCourseCard'; // Ensure path is correct
import CreatedCourseCard from '@/components/profile/CreatedCourseCard'; // Ensure path is correct
import '../styles/profile.css';

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

  // State Initialization - start as null, will be populated by effect
  const [userData, setUserData] = useState<User | null>(null);
  const [isFetchingInitialProfile, setIsFetchingInitialProfile] = useState<boolean>(false); // Explicitly track initial fetch
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  // Form/Edit state
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false); // Separate state for updates

  // Tab state
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.ActiveCourses);
  const [activeEnrollments, setActiveEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [completedEnrollments, setCompletedEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  console.log("ProfilePage: State Init:", { isAuthLoading, user: !!user, userData: !!userData, isFetchingInitialProfile });

  // --- Effect 1: Fetch initial profile data ONCE when auth is ready and user exists ---
  useEffect(() => {
    // Condition: Auth loaded, user logged in, AND initial fetch hasn't started/completed yet
    if (!isAuthLoading && user && !userData && !isFetchingInitialProfile && !initialLoadError) {
      console.log("ProfilePage: EFFECT 1 - Triggering initial user data fetch...");
      setIsFetchingInitialProfile(true); // Mark fetch as started
      setInitialLoadError(null);

      getCurrentUser()
        .then(latestUserData => {
          console.log("ProfilePage: EFFECT 1 - Initial user data fetched:", latestUserData);
          setUserData(latestUserData); // Set the data
        })
        .catch(error => {
          console.error('ProfilePage: EFFECT 1 - Failed to fetch initial user data:', error);
          setInitialLoadError('Не удалось загрузить данные профиля.');
          setUserData(null); // Ensure data is null on error
        })
        .finally(() => {
          setIsFetchingInitialProfile(false); // Mark fetch as finished
           console.log("ProfilePage: EFFECT 1 - Finished initial user data fetch attempt.");
        });
    } else if (!isAuthLoading && !user && userData !== null) {
        // Condition: Auth loaded, NO user logged in, but local state still has data (e.g., after logout)
        console.log("ProfilePage: EFFECT 1 - Auth loaded, no user. Clearing local userData.");
        setUserData(null); // Clear stale data
    }
    // Only depend on auth state and user object presence
  }, [isAuthLoading, user, userData, isFetchingInitialProfile, initialLoadError]);

  // --- Effect 2: Update form fields when userData is successfully loaded ---
  useEffect(() => {
    if (userData) {
      console.log("ProfilePage: EFFECT 2 - userData available, updating form fields.", userData);
      setFullName(userData.fullName || '');
      setAvatarPreview(userData.avatarUrl || '/images/default-avatar.png');
       // Reset edit mode if userData changes (e.g., refetch after update)
      setIsEditing(false);
      setProfileMessage(null); // Clear old messages
    } else {
      // Reset form if userData becomes null
      console.log("ProfilePage: EFFECT 2 - userData is null, resetting form fields.");
      setFullName('');
      setAvatarPreview('/images/default-avatar.png');
      setIsEditing(false);
    }
  }, [userData]); // Only depends on userData

  // --- Effect 3: Load data for the selected tab ---
   const loadTabData = useCallback(async () => {
    // Guard: Only run if we definitely have user data
    if (!userData) {
      console.log("ProfilePage: loadTabData - Skipping, no userData.");
      return;
    }

    console.log(`ProfilePage: loadTabData - Loading data for tab: ${activeTab}`);
    setIsLoadingCourses(true);
    setCoursesError(null);
    // Clear previous data for other tabs
    if (activeTab !== ProfileTab.ActiveCourses) setActiveEnrollments([]);
    if (activeTab !== ProfileTab.CompletedCourses) setCompletedEnrollments([]);
    if (activeTab !== ProfileTab.CreatedCourses) setCreatedCourses([]);

    try {
      switch (activeTab) {
        case ProfileTab.ActiveCourses:
          setActiveEnrollments(await getMyEnrollments('inProgress'));
          break;
        case ProfileTab.CompletedCourses:
          setCompletedEnrollments(await getMyEnrollments('completed'));
          break;
        case ProfileTab.CreatedCourses:
          if (userData.role === 'author') setCreatedCourses(await getMyCreatedCourses());
          else setCreatedCourses([]); // Should not happen if tab is hidden
          break;
      }
      console.log(`ProfilePage: loadTabData - Data loaded for ${activeTab}.`);
    } catch (error) {
      console.error(`ProfilePage: loadTabData - Error loading tab data (${activeTab}):`, error);
      setCoursesError(`Не удалось загрузить данные.`);
    } finally { setIsLoadingCourses(false); }
  }, [activeTab, userData]); // Depends only on tab and userData presence

  useEffect(() => {
    // Trigger tab load when userData becomes available OR activeTab changes
    console.log("ProfilePage: EFFECT 3 - Checking if tab data should load.", { hasUserData: !!userData, activeTab });
    if (userData) { // Only load if we have profile data
      loadTabData().catch(console.error);
    }
     // Cleanup function to potentially cancel fetch if component unmounts? (More advanced)
     // return () => { /* cleanup logic */ };
  }, [userData, activeTab, loadTabData]); // Add loadTabData to dependency array

  // --- Handlers ---
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Add basic validation
      if (!file.type.startsWith('image/')) {
          setProfileMessage({ text: 'Пожалуйста, выберите файл изображения.', type: 'error'});
          return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
           setProfileMessage({ text: 'Файл слишком большой (макс. 5MB).', type: 'error'});
           return;
      }
      setProfileMessage(null); // Clear previous errors
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setAvatarPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return; // Should not happen if button is disabled, but safety check
    console.log("ProfilePage: handleProfileSubmit - Submitting profile update...");
    setIsUpdatingProfile(true); // Use separate state for update operation
    setProfileMessage(null);
    try {
        let dataToUpdate: { fullName?: string; avatarUrl?: string } = {}; // Specify fields
        let userAfterUpdate: User = { ...userData };

        // Check if fullName changed
        if (fullName.trim() !== (userData.fullName || '').trim() && fullName.trim() !== '') {
            dataToUpdate.fullName = fullName.trim();
        }

        // 1. Update text fields first if necessary
        if (dataToUpdate.fullName) {
            console.log("ProfilePage: Updating text fields:", dataToUpdate);
            const updatedTextFields = await updateProfile({ fullName: dataToUpdate.fullName });
            userAfterUpdate = { ...userAfterUpdate, ...updatedTextFields };
            console.log("ProfilePage: Text fields updated.");
        }

        // 2. Upload and update avatar if a new file was selected
        if (avatarFile) {
            console.log("ProfilePage: Uploading new avatar...");
            const formData = new FormData();
            formData.append('avatar', avatarFile);
            const avatarResponse = await uploadAvatar(formData);
            console.log("ProfilePage: Avatar uploaded, URL:", avatarResponse.avatarUrl);

            // Always call updateProfile to save the new avatarUrl
            console.log("ProfilePage: Updating profile with new avatar URL...");
            const finalUpdatedUser = await updateProfile({ avatarUrl: avatarResponse.avatarUrl });
            // Merge the very latest user state (which includes the avatar)
            userAfterUpdate = { ...userAfterUpdate, ...finalUpdatedUser };
            console.log("ProfilePage: Profile updated with new avatar URL.");
        }

        // Update local and global state with the final user object
        setUserData(userAfterUpdate);
        updateUserState(userAfterUpdate); // Update global auth state

        setAvatarFile(null); // Reset file state
        setIsEditing(false); // Exit edit mode
        setProfileMessage({ text: 'Профиль успешно обновлен', type: 'success' });
        console.log("ProfilePage: Profile update successful.");

    } catch (error) {
        console.error('ProfilePage: handleProfileSubmit - Error updating profile:', error);
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        setProfileMessage({ text: `Ошибка обновления: ${errorMsg}`, type: 'error' });
    } finally {
        setIsUpdatingProfile(false); // Stop update loader
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

  // 3. Initial Profile Fetch In Progress
  // Check isFetchingInitialProfile *and* ensure userData is still null
  if (isFetchingInitialProfile && !userData) {
     console.log("ProfilePage: Render: Initial Profile Fetching");
     return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }

  // 4. Initial Profile Fetch Failed
  // Check error state *and* ensure userData is still null
  if (initialLoadError && !userData) {
      console.log("ProfilePage: Render: Initial Load Error");
      return <div className="text-center py-12 text-red-600">{initialLoadError}</div>;
  }

  // 5. CRITICAL CHECK: If all loading is done, user exists, no initial error,
  //    but userData is STILL null, then display a generic error. This prevents the TypeError.
  if (!userData) {
     console.error("ProfilePage: Render: Fallback Error - userData is null after loading!");
     return <div className="text-center py-12 text-red-600">Не удалось загрузить данные профиля. Обновите страницу.</div>;
  }

  // --- RENDER MAIN CONTENT (userData is guaranteed to be non-null here) ---
  console.log("ProfilePage: Render: Main Content for", userData.email);

   // --- Tab Rendering Function ---
   const renderCoursesTab = () => {
        if (isLoadingCourses) { return (<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>); }
        if (coursesError) { return (<div className="text-center py-8 text-red-500"><p>{coursesError}</p><button onClick={() => loadTabData().catch(console.error)} className="mt-2 px-3 py-1 border border-red-500 rounded text-red-500 hover:bg-red-50 text-sm">Попробовать снова</button></div>); }
        let content: React.ReactNode = null;
        let isEmpty = false;
        let emptyMessage = '';
        switch (activeTab) {
            case ProfileTab.ActiveCourses: isEmpty = activeEnrollments.length === 0; emptyMessage = 'У вас пока нет активных курсов.'; content = activeEnrollments.map(enr => <ActiveCourseCard key={enr.course.id} enrollment={enr} />); break;
            case ProfileTab.CompletedCourses: isEmpty = completedEnrollments.length === 0; emptyMessage = 'У вас пока нет завершенных курсов.'; content = completedEnrollments.map(enr => <CompletedCourseCard key={enr.course.id} enrollment={enr} />); break;
            case ProfileTab.CreatedCourses:
                if (userData?.role !== 'author') { isEmpty = true; emptyMessage = 'Эта вкладка доступна только авторам.'; content = null; }
                else { isEmpty = createdCourses.length === 0; emptyMessage = 'Вы пока не создали ни одного курса.'; content = createdCourses.map(course => <CreatedCourseCard key={course.id} course={course} />); }
                break;
        }
        if (isEmpty) { return (<div className="text-center py-8 text-gray-500"><p>{emptyMessage}</p>{activeTab === ProfileTab.CreatedCourses && userData?.role === 'author' && (<a href="/create-course" className="mt-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm font-medium">Создать курс</a>)}</div>); }
        return (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{content}</div>);
   };

   // --- Main Page Structure ---
   return (
       <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Profile Info Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 relative">
                {/* Loading overlay for profile UPDATES */}
                {isUpdatingProfile && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                )}
                {profileMessage && ( <div className={`p-3 mb-4 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{profileMessage.text}</div> )}

                {isEditing ? (
                    <form onSubmit={handleProfileSubmit}>
                         <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                             <div className="w-full md:w-1/4 flex flex-col items-center"> {/* Avatar */}
                                 <div className="relative avatar-upload w-32 h-32"> {/* Ensure size consistency */}
                                     <div className="avatar-preview w-full h-full border-2 border-gray-200 rounded-full overflow-hidden">
                                         <img src={avatarPreview || '/images/default-avatar.png'} alt="Avatar Preview" className="w-full h-full object-cover"/>
                                     </div>
                                     <div className="avatar-edit">
                                         <input type="file" id="avatarUpload" accept="image/*" onChange={handleAvatarChange}/>
                                         <label htmlFor="avatarUpload" className="flex items-center justify-center w-8 h-8 bg-orange-500 text-white rounded-full cursor-pointer shadow hover:bg-orange-600 absolute right-1 bottom-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                         </label>
                                     </div>
                                 </div>
                             </div>
                             <div className="w-full md:w-3/4"> {/* Fields */}
                                 <div className="mb-4"> {/* Full Name */}
                                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
                                    <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500" required/>
                                 </div>
                                 <div className="mb-4"> {/* Email */}
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input id="email" type="email" value={userData.email} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed" disabled/>
                                 </div>
                                 <div> {/* Role */}
                                     <span className="text-sm font-medium text-gray-700">Роль: </span>
                                     <span className="text-sm text-gray-600">{userData.role === 'author' ? 'Автор' : 'Пользователь'}</span>
                                 </div>
                             </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 border-t pt-4"> {/* Buttons */}
                            <button type="button" onClick={() => { setIsEditing(false); setAvatarFile(null); setAvatarPreview(userData.avatarUrl || '/images/default-avatar.png'); setFullName(userData.fullName || ''); setProfileMessage(null);}} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500" disabled={isUpdatingProfile}>Отмена</button>
                            <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50" disabled={isUpdatingProfile}>{isUpdatingProfile ? 'Сохранение...' : 'Сохранить'}</button>
                        </div>
                    </form>
                ) : (
                     <div className="flex flex-col md:flex-row items-center gap-6">
                         <div className="w-full md:w-1/4 flex justify-center">
                             <img src={userData.avatarUrl || '/images/default-avatar.png'} alt={userData.fullName || 'User'} className="w-32 h-32 object-cover rounded-full border-2 border-gray-200"/>
                         </div>
                         <div className="w-full md:w-3/4 text-center md:text-left">
                             <h1 className="text-2xl font-bold text-gray-900 mb-1">{userData.fullName || 'Имя не указано'}</h1>
                             <p className="text-gray-600 mb-4">{userData.email}</p>
                             <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                                 {/* Stats Display */}
                                <div className="text-center px-3 py-1 bg-gray-100 rounded"><span className="block text-xs text-gray-500">Активные</span><span className="text-lg font-semibold">{isValidNumber(userData.stats?.activeCourses) ? userData.stats.activeCourses : 0}</span></div>
                                <div className="text-center px-3 py-1 bg-gray-100 rounded"><span className="block text-xs text-gray-500">Завершенные</span><span className="text-lg font-semibold">{isValidNumber(userData.stats?.completedCourses) ? userData.stats.completedCourses : 0}</span></div>
                                <div className="text-center px-3 py-1 bg-gray-100 rounded">
                                    <span className="block text-xs text-gray-500">Средний балл</span>
                                    <span className="text-lg font-semibold">{isValidNumber(userData.stats?.avgScore) ? userData.stats.avgScore.toFixed(1) : 'N/A'}</span>
                                </div>
                             </div>
                             <button onClick={() => setIsEditing(true)} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">Редактировать профиль</button>
                         </div>
                    </div>
                )}
            </div>

            {/* Tabs Section */}
            <div>
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        <button onClick={() => setActiveTab(ProfileTab.ActiveCourses)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.ActiveCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Активные курсы</button>
                        <button onClick={() => setActiveTab(ProfileTab.CompletedCourses)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CompletedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Завершенные курсы</button>
                        {userData.role === 'author' && (<button onClick={() => setActiveTab(ProfileTab.CreatedCourses)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CreatedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Мои созданные курсы</button>)}
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