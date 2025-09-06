import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import colors from '../app/colors';

export default function DeleteAccountModal({ open, onClose, onDelete }) {
  const { t } = useTranslation('settings');
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const user = auth.currentUser;
      if (user) {
        console.log('Starting account deletion for user:', user.uid);
        
        // Delete user document from Firestore first
        const userRef = doc(db, 'users', user.uid);
        console.log('Deleting user document from Firestore...');
        await deleteDoc(userRef);
        console.log('User document deleted from Firestore successfully');
        
        // Delete the user account from Firebase Auth
        console.log('Deleting user from Firebase Auth...');
        await deleteUser(user);
        console.log('User deleted from Firebase Auth successfully');
        
        // Redirect to root (login) page since user account is now deleted
        router.push('/');
      } else {
        throw new Error('No authenticated user found');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(`Error deleting account: ${error.message}. Please try again.`);
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-xl shadow-lg p-6 w-11/12 max-w-sm text-center relative">
        <button
          className="absolute top-2 right-3 text-gray-400 text-2xl font-bold hover:text-gray-600 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        
        {/* Warning Icon */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef2f2' }}>
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-3 text-red-600">{t('delete_account_warning')}</h2>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{t('delete_account_description')}</p>
        
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-lg font-semibold text-white transition-colors"
            style={{ backgroundColor: '#dc2626' }}
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : t('confirm_delete')}
          </button>
          <button
            className="flex-1 py-3 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('cancel_delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
