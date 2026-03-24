import React, { useState, useEffect } from 'react';
import colors from '../app/colors';
import { StyledDateTimeInput } from '@/components/StyledDateInput';

const emptyForm = { title: '', body: '', startTime: '', endTime: '', link: '' };

export default function AddItemModal({ open, onClose, onSave, type = 'event', loading = false }) {
  const [form, setForm] = useState(emptyForm);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (open) { setForm(emptyForm); setDateError(''); }
  }, [open]);

  const validate = (f) => {
    if (type === 'survey') {
      if (f.endTime && new Date(f.endTime) <= new Date()) {
        return 'End time must be in the future';
      }
    } else {
      if (f.startTime && f.endTime && new Date(f.endTime) <= new Date(f.startTime)) {
        return 'End time must be after start time';
      }
    }
    return '';
  };

  const handleChange = (e) => {
    setForm(f => {
      const updated = { ...f, [e.target.name]: e.target.value };
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs mx-4">
        <h2 className="text-xl font-bold mb-4">Add New {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Title</label>
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
            <label className="block text-gray-700 font-semibold mb-2">Body</label>
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
              <label className="block text-gray-700 font-semibold mb-2">Link <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="link"
                value={form.link}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
                required
              />
            </div>
          )}
          {type !== 'survey' && (
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Start Time</label>
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
              {type === 'survey' ? 'Due Date' : 'End Time'}
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
              {loading ? 'Saving...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border-2 font-semibold"
              style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen }}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 