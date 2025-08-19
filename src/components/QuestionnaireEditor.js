import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { QUESTIONNAIRE_STRUCTURE, QUESTION_TYPES } from '@/lib/questionnaire';
import colors from '@/app/colors';

export default function QuestionnaireEditor({ isOpen, onClose, userData, onUpdate, isAdmin, soldierId, onMarkAsLeft }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // If admin editing soldier, use soldier data; otherwise use current user data
      if (isAdmin && userData) {
        const initialAnswers = {};
        QUESTIONNAIRE_STRUCTURE.forEach(category => {
          category.questions.forEach(question => {
            initialAnswers[question.id] = userData[question.id] || '';
          });
        });
        setAnswers(initialAnswers);
      } else if (auth.currentUser) {
        // Fetch full user data from database
        const fetchUserData = async () => {
          try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const data = userSnap.data();
              const initialAnswers = {};
              QUESTIONNAIRE_STRUCTURE.forEach(category => {
                category.questions.forEach(question => {
                  initialAnswers[question.id] = data[question.id] || '';
                });
              });
              setAnswers(initialAnswers);
            }
          } catch (err) {
            console.error('Error fetching user data:', err);
          }
        };
        
        fetchUserData();
      }
    }
  }, [isOpen, isAdmin, userData]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    
    try {
      // If admin editing soldier, use soldier ID; otherwise use current user ID
      const userId = isAdmin ? soldierId : auth.currentUser?.uid;
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, answers);
        setSuccess('Profile updated successfully!');
        onUpdate(answers);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const renderQuestionInput = (question) => {
    const value = answers[question.id] || '';
    
    switch (question.type) {
      case QUESTION_TYPES.TEXT:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your answer..."
          />
        );
        
      case QUESTION_TYPES.TEXTAREA:
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your answer..."
          />
        );
        
      case QUESTION_TYPES.SELECT:
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an option...</option>
            {question.options.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
        
      case QUESTION_TYPES.DATE:
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
        
      case QUESTION_TYPES.PHONE:
        return (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter phone number..."
          />
        );
        
      case QUESTION_TYPES.EMAIL:
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter email address..."
          />
        );
        
      case QUESTION_TYPES.BOOLEAN:
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        );
        
      case QUESTION_TYPES.NUMBER:
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter number..."
          />
        );
        
      case QUESTION_TYPES.MULTI_SELECT:
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleInputChange(question.id, [...selectedValues, option]);
                    } else {
                      handleInputChange(question.id, selectedValues.filter(v => v !== option));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
        
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your answer..."
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden mx-2">
        {/* Header */}
        <div className="bg-gray-100 px-4 sm:px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Edit Profile Questionnaire</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Admin Actions - Soldier Left Button */}
        {isAdmin && onMarkAsLeft && (
          <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-3">
            <div className="flex justify-between items-center">
              <span className="text-red-800 font-medium text-sm">Admin Action:</span>
              <button
                onClick={onMarkAsLeft}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Mark Soldier as Left
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-4 sm:p-6">
          {QUESTIONNAIRE_STRUCTURE.map((category) => (
            <div key={category.id} className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4 pb-2 border-b border-gray-200">
                {category.title}
              </h3>
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm">{category.description}</p>
              
              <div className="space-y-6">
                {category.questions.map((question) => (
                  <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {question.text}
                    </label>
                    {renderQuestionInput(question)}
                    <div className="mt-2 text-xs text-gray-500">
                      {answers[question.id] ? '✓ Answered' : '○ Not answered yet'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 border-t flex justify-between items-center">
          <div className="flex-1">
            {success && <div className="text-green-600 text-sm">{success}</div>}
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
