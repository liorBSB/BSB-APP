import React, { useState } from 'react';
import colors from '../app/colors';

export default function AddItemModal({ open, onClose, onSave, type = 'event', loading = false }) {
  const [form, setForm] = useState({
    title: '',
    body: '',
    startTime: '',
    endTime: '',
  });

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
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
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Start Time</label>
            <input
              type="datetime-local"
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">End Time</label>
            <input
              type="datetime-local"
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-primaryGreen"
              required
            />
          </div>
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg text-white font-semibold"
              style={{ background: colors.gold }}
              disabled={loading}
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