import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function EditFieldModal({ open, onClose, onSave, label, value }) {
  const { t } = useTranslation('components');
  const [input, setInput] = useState(value || '');

  useEffect(() => {
    setInput(value || '');
  }, [value, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-xl shadow-lg p-6 w-11/12 max-w-xs text-center relative">
        <button
          className="absolute top-2 right-3 text-gray-400 text-2xl font-bold"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-4 text-[#076332]">{t('edit_field_modal.edit')} {label}</h2>
        <input
          className="w-full border border-muted px-3 py-2 rounded-md text-text bg-background mb-4"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 rounded-lg font-semibold text-white bg-[#EDC381]"
            onClick={() => onSave(input)}
          >
{t('edit_field_modal.save')}
          </button>
          <button
            className="flex-1 py-2 rounded-lg font-semibold text-gray-700 bg-gray-200"
            onClick={onClose}
          >
{t('edit_field_modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
} 