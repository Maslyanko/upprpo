// ==== File: frontend/src/pages/EditProfilePage.tsx ====
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, uploadAvatar } from '../api/userApi'; // getCurrentUser removed if relying on useAuth
import type { User } from '../types/User';

const EditProfilePage: React.FC = () => {
  const { user: authUser, updateUserState, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  // Initialize form state directly from authUser if available
  const [fullName, setFullName] = useState<string>(authUser?.fullName || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(authUser?.avatarUrl || '/images/default-avatar.png');

  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Редактирование профиля - AI-Hunt';
    if (!isAuthLoading && !authUser) { // If auth check done and no user, redirect
        navigate('/profile'); // Or login
    }
    // Pre-fill form if authUser changes (e.g., after initial load)
    if (authUser) {
        setFullName(authUser.fullName || '');
        setAvatarPreview(authUser.avatarUrl || '/images/default-avatar.png');
    }
  }, [authUser, isAuthLoading, navigate]);


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setProfileMessage({ text: 'Пожалуйста, выберите файл изображения.', type: 'error' }); return; }
      if (file.size > 5 * 1024 * 1024) { setProfileMessage({ text: 'Файл слишком большой (макс. 5MB).', type: 'error' }); return; }
      setProfileMessage(null);
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file)); // Show preview immediately
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setIsUpdatingProfile(true);
    setProfileMessage(null);
    let newAvatarUrl = authUser.avatarUrl; // Keep existing if no new file

    try {
      // 1. Upload avatar if a new one is selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        // uploadAvatar now returns the full updated user object with the new avatar URL
        const uploadResponse = await uploadAvatar(formData);
        newAvatarUrl = uploadResponse.avatarUrl; // Get the new URL
        updateUserState(uploadResponse.user); // Update auth state with user from avatar upload response
        setAvatarFile(null); // Clear the file input state
        // No need to call updateProfile again if avatar was the only change and backend handles it
        if (fullName.trim() === (uploadResponse.user.fullName || '').trim()) {
             setProfileMessage({ text: 'Аватар успешно обновлен!', type: 'success' });
             setTimeout(() => navigate('/profile'), 1500);
             setIsUpdatingProfile(false);
             return; // Exit if only avatar changed and it's handled
        }
      }

      // 2. Update full name if it changed
      const currentFullName = authUser.fullName || '';
      if (fullName.trim() !== currentFullName.trim() && fullName.trim() !== '') {
        const updatedUserFromProfile = await updateProfile({ fullName: fullName.trim() });
        updateUserState(updatedUserFromProfile); // Update global auth state
        setProfileMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
      } else if (!avatarFile) { // No avatar change, no name change
        setProfileMessage({ text: 'Нет изменений для сохранения.', type: 'success' });
      } else if (avatarFile && fullName.trim() === (authUser.fullName || '').trim()){ // Avatar changed, name didn't
         // This case is handled above if avatarFile was processed
      } else { // Avatar changed AND name changed
         setProfileMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
      }


      setTimeout(() => navigate('/profile'), 1500);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      const apiErrorMsg = (error as any).response?.data?.message;
      setProfileMessage({ text: `Ошибка обновления: ${apiErrorMsg || errorMsg}`, type: 'error' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCancel = () => navigate('/profile');

  if (isAuthLoading && !authUser) {
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  if (!authUser) { // Should be caught by ProtectedRoute or initial useEffect
    return <div className="text-center py-12 text-lg">Пожалуйста, войдите для редактирования профиля.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">Редактирование профиля</h1>
      {profileMessage && (
        <div className={`p-3 mb-6 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {profileMessage.text}
        </div>
      )}
      <form onSubmit={handleProfileSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 sm:w-36 sm:h-36">
            <img src={avatarPreview || '/images/default-avatar.png'} alt="Аватар" className="w-full h-full object-cover rounded-full border-2 border-gray-300 shadow-sm"/>
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={isUpdatingProfile}
                    className="absolute -bottom-1 -right-1 bg-orange-600 text-white rounded-full p-2 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow" title="Изменить аватар">
              <input type="file" ref={avatarInputRef} accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={isUpdatingProfile}/>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
            </button>
          </div>
        </div>
        <div className="space-y-6 mb-8">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
            <input id="editFullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isUpdatingProfile} className="form-input"/>
          </div>
          <div>
            <label htmlFor="editEmail" className="block text-sm font-medium text-gray-700 mb-1">Электронная почта</label>
            <input id="editEmail" type="email" value={authUser.email} readOnly className="form-input bg-gray-100 text-gray-500 cursor-not-allowed"/>
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button type="button" onClick={handleCancel} disabled={isUpdatingProfile} className="btn-outline">Отмена</button>
          <button type="submit" disabled={isUpdatingProfile || (!avatarFile && fullName === (authUser.fullName || ''))} className="btn-primary">
            {isUpdatingProfile ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfilePage;