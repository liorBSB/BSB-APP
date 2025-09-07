import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

export default function DeleteAccountModal({ open, onClose, onDelete }) {
  const { t } = useTranslation('settings');
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [canDelete, setCanDelete] = useState(false);

  // Countdown effect
  useEffect(() => {
    if (open && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanDelete(true);
    }
  }, [open, countdown]);

  // Reset countdown when modal opens
  useEffect(() => {
    if (open) {
      setCountdown(5);
      setCanDelete(false);
    }
  }, [open]);

  const handleDeleteAccount = () => {
    if (canDelete) {
      // Redirect to deletion status page
      router.push('/account-deletion');
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
        <p className="text-gray-600 mb-4 text-sm leading-relaxed">{t('delete_account_description')}</p>
        
        {/* Countdown Display */}
        <div className="mb-6">
          {!canDelete ? (
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">{countdown}</div>
              <p className="text-gray-600 text-sm">Please wait before confirming deletion...</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-green-600 font-semibold text-sm">You can now confirm deletion</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-lg font-semibold text-white transition-colors"
            style={{ 
              backgroundColor: canDelete ? '#dc2626' : '#9ca3af',
              cursor: canDelete ? 'pointer' : 'not-allowed'
            }}
            onClick={handleDeleteAccount}
            disabled={!canDelete}
          >
            {t('confirm_delete')}
          </button>
          <button
            className="flex-1 py-3 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
            onClick={onClose}
          >
            {t('cancel_delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
