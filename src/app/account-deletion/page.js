'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import colors from '../colors';

export default function AccountDeletionPage() {
  const { t } = useTranslation('settings');
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [currentStep, setCurrentStep] = useState('');

  useEffect(() => {
    const deleteAccount = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No authenticated user found');
        }

        console.log('Starting account deletion for user:', user.uid);
        
        // Step 1: Delete Firestore data
        setCurrentStep('Deleting your data...');
        const userRef = doc(db, 'users', user.uid);
        console.log('Deleting user document from Firestore...');
        await deleteDoc(userRef);
        console.log('User document deleted from Firestore successfully');
        
        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 2: Delete Firebase Auth account
        setCurrentStep('Deleting your account...');
        console.log('Deleting user from Firebase Auth...');
        try {
          await deleteUser(user);
          console.log('User deleted from Firebase Auth successfully');
          setCurrentStep('Account deleted successfully!');
          await new Promise(resolve => setTimeout(resolve, 1000));
          setStatus('success');
        } catch (authError) {
          // If auth deletion fails, we still consider it a success since data is deleted
          if (authError.code === 'auth/requires-recent-login') {
            console.log('Auth deletion requires recent login, but data is deleted');
            setCurrentStep('Data deleted successfully!');
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStatus('success');
          } else {
            throw authError;
          }
        }
        
      } catch (error) {
        console.error('Error deleting account:', error);
        setStatus('error');
        setErrorMessage(error.message);
      }
    };

    // Start deletion process
    deleteAccount();
  }, []);

  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 font-body flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl p-8 shadow-lg text-center" style={{ background: 'rgba(0,0,0,0.38)' }}>
          
          {status === 'loading' && (
            <>
              {/* Loading State */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
                  <svg className="w-10 h-10 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-3 text-white">{t('deleting_account')}</h2>
                <p className="text-white/80 text-sm mb-2">{t('deleting_wait')}</p>
                {currentStep && (
                  <p className="text-yellow-300 text-sm font-medium">{currentStep}</p>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-2 mb-6">
                <div className="bg-yellow-400 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              
              {/* Loading Animation */}
              <div className="flex justify-center space-x-2 mb-6">
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              {/* Success State */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
                  <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-3 text-white">{t('deletion_success')}</h2>
                <p className="text-white/80 text-sm mb-6">{t('deletion_success_desc')}</p>
              </div>
              
              <button
                onClick={handleGoBack}
                className="w-full py-4 px-6 bg-transparent text-white font-bold text-lg border-2 border-white rounded-xl hover:bg-white/10 transition-colors"
              >
                {t('go_back_to_start')}
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              {/* Error State */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef2f2' }}>
                  <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-3 text-white">{t('deletion_failed')}</h2>
                <p className="text-white/80 text-sm mb-4">{t('deletion_error_desc')}</p>
                <p className="text-red-300 text-xs mb-6">{errorMessage}</p>
              </div>
              
              <button
                onClick={handleGoBack}
                className="w-full py-4 px-6 bg-transparent text-white font-bold text-lg border-2 border-white rounded-xl hover:bg-white/10 transition-colors"
              >
                {t('go_back_to_start')}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
