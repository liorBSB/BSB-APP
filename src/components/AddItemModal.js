'use client';

import React, { useState, useEffect } from 'react';
import '@/i18n';
import { useTranslation } from 'react-i18next';
import colors from '../app/colors';
import { StyledDateTimeInput } from '@/components/StyledDateInput';

const emptyForm = { title: '', body: '', startTime: '', endTime: '', link: '' };

export default function AddItemModal({ open, onClose, onSave, type = 'event', loading = false }) {
  const { t } = useTranslation('components');
  const [form, setForm] = useState(emptyForm);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (open) { setForm(emptyForm); setDateError(''); }
  }, [open]);

  const validate = (f) => {
    if (type === 'survey') {
      if (f.endTime && new Date(f.endTime) <= new Date()) {
        return t('add_item_modal.err_end_future');
      }
    } else {
      if (f.startTime && f.endTime && new Date(f.endTime) <= new Date(f.startTime)) {
        return t('add_item_modal.err_end_after_start');
      }
    }
    return '';
  };

  const handleChange = (e) => {
    const name = e.target.name;
    const val = e.target.value;
    setForm(f => {
      const updated = { ...f, [name]: val };
      setDateError(validate(updated));
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate(form);
    if (err) { setDateError(err); return; }
    onSave(form);
  };

  const modalTitle = type === 'survey' ? t('add_item_modal.add_survey_title') : t('add_item_modal.add_event_title');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs mx-4">
        <h2 className="text-xl font-bold mb-4">{modalTitle}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">{t('add_item_modal.title')}</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">{t('add_item_modal.body')}</label>
            <textarea
              name="body"
              value={form.body}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              rows="3"
              required
            />
          </div>
          {type === 'survey' && (
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">{t('add_item_modal.link_label')} <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="link"
                value={form.link}
                onChange={handleChange}
                placeholder={t('add_item_modal.link_placeholder')}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                required
              />
            </div>
          )}
          {type !== 'survey' && (
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">{t('add_item_modal.start_time')}</label>
              <StyledDateTimeInput
                name="startTime"
                value={form.startTime}
                onChange={handleChange}
                required
              />
            </div>
          )}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              {type === 'survey' ? t('add_item_modal.due_date') : t('add_item_modal.end_time')}
            </label>
            <StyledDateTimeInput
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              required
            />
            {dateError && (
              <p className="text-sm font-medium mt-1.5" style={{ color: colors.red }}>{dateError}</p>
            )}
          </div>
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ background: colors.gold }}
              disabled={loading || !!dateError}
            >
              {loading ? t('add_item_modal.saving') : t('add_item_modal.add')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border-2 font-semibold"
              style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
              disabled={loading}
            >
              {t('add_item_modal.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
