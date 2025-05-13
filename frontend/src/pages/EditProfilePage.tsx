// ===== ./src/pages/EditProfilePage.tsx =====
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, uploadAvatar, getCurrentUser } from '../api/userApi';
import type { User } from '../types/User';

const EditProfilePage: React.FC = () => {
  const { user: authUser, updateUserState, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [isFetching, setIsFetching] = useState(true); // For fetching current user data

  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Редактирование профиля - AI-Hunt';
  }, []);

  // Fetch current user data on mount to prefill the form
  useEffect(() => {
    if (authUser && !currentUserData) { // Only fetch if authUser exists and we haven't fetched yet
      setIsFetching(true);
      getCurrentUser()
        .then(data => {
          setCurrentUserData(data);
          setFullName(data.fullName || '');
          setAvatarPreview(data.avatarUrl || '/images/default-avatar.png');
        })
        .catch(err => {
          setProfileMessage({ text: 'Не удалось загрузить данные профиля.', type: 'error' });
        })
        .finally(() => setIsFetching(false));
    } else if (!authUser && !isAuthLoading) { // If user is not authenticated (e.g. direct navigation)
        setIsFetching(false); // Stop fetching
        navigate('/profile'); // Or to login page
    }
  }, [authUser, currentUserData, isAuthLoading, navigate]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setProfileMessage({ text: 'Пожалуйста, выберите файл изображения.', type: 'error' }); return; }
      if (file.size > 5 * 1024 * 1024) { setProfileMessage({ text: 'Файл слишком большой (макс. 5MB).', type: 'error' }); return; }
      setProfileMessage(null);
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setAvatarPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserData) return; // Should not happen if fetching is done

    setIsUpdatingProfile(true);
    setProfileMessage(null);

    try {
      let dataToUpdate: { fullName?: string; avatarUrl?: string } = {};

      if (fullName.trim() !== (currentUserData.fullName || '').trim() && fullName.trim() !== '') {
        dataToUpdate.fullName = fullName.trim();
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarResponse = await uploadAvatar(formData);
        dataToUpdate.avatarUrl = avatarResponse.avatarUrl;
        setAvatarFile(null);
      }

      if (Object.keys(dataToUpdate).length > 0) {
        const updatedUserFromApi = await updateProfile(dataToUpdate);
        updateUserState(updatedUserFromApi); // Update global auth state
        setCurrentUserData(updatedUserFromApi); // Update local state for this page
        setProfileMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
        // Optionally navigate back after a short delay
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        setProfileMessage({ text: 'Нет изменений для сохранения.', type: 'success' }); // Or 'info' type
         setTimeout(() => navigate('/profile'), 1500);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setProfileMessage({ text: `Ошибка обновления: ${errorMsg}`, type: 'error' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCancel = () => {
    navigate('/profile'); // Navigate back to the main profile view
  };

  if (isAuthLoading || isFetching) {
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }

  if (!authUser || !currentUserData) { // Should be caught by ProtectedRoute, but check again
    // This case should ideally not be reached if ProtectedRoute works correctly.
    // Or if initial fetch failed and currentUserData is still null.
    return <div className="text-center py-12 text-lg">Не удалось загрузить профиль для редактирования. <Link to="/profile" className="text-orange-500">Вернуться в профиль</Link>.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
        Редактирование профиля
      </h1>

      {profileMessage && (
        <div className={`p-3 mb-6 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {profileMessage.text}
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-lg border border-gray-200">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 sm:w-36 sm:h-36">
            <img
              src={avatarPreview || '/images/default-avatar.png'}
              alt="Аватар"
              className="w-full h-full object-cover rounded-full border-2 border-gray-300 shadow-sm"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-orange-600 text-white rounded-full p-2 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow"
              title="Изменить аватар"
              disabled={isUpdatingProfile}
            >
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={isUpdatingProfile}
              />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Profile Fields Section */}
        <div className="space-y-6 mb-8">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700 mb-1">
              ФИО
            </label>
            <input
              id="editFullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isUpdatingProfile}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white text-sm sm:text-base"
            />
          </div>
          <div>
            <label htmlFor="editEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Электронная почта
            </label>
            <input
              id="editEmail"
              type="email"
              value={currentUserData.email} // Display from currentUserData
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUpdatingProfile}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isUpdatingProfile}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 disabled:opacity-60"
          >
            {isUpdatingProfile ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfilePage;