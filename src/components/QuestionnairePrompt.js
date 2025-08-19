'use client';

import { useState } from 'react';
import { getTotalQuestionsCount } from '@/lib/questionnaire';
import QuestionnaireModal from './QuestionnaireModal';

export default function QuestionnairePrompt({ answeredQuestions = [], onComplete }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const totalQuestions = getTotalQuestionsCount();
  const progress = Math.round((answeredQuestions.length / totalQuestions) * 100);
  
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };
  
  return (
    <>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-xl">📋</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  למילוי שאלון פרטים אישיים
                </h3>
                <p className="text-sm text-gray-600">
                  אנא מלא את השאלון כדי להשלים את הפרופיל שלך
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>התקדמות: {progress}%</span>
                <span>שאלות: {answeredQuestions.length}/{totalQuestions}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
            
            {/* Category Progress */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="font-medium text-gray-700 mb-1">פרטים אישיים</div>
                <div className="text-blue-600">
                  {Math.round((answeredQuestions.filter(q => q.startsWith('personal')).length / 11) * 100)}%
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="font-medium text-gray-700 mb-1">מידע משפחתי</div>
                <div className="text-blue-600">
                  {Math.round((answeredQuestions.filter(q => q.startsWith('family')).length / 9) * 100)}%
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="font-medium text-gray-700 mb-1">איש קשר</div>
                <div className="text-blue-600">
                  {Math.round((answeredQuestions.filter(q => q.startsWith('emergency')).length / 4) * 100)}%
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="font-medium text-gray-700 mb-1">מידע צבאי</div>
                <div className="text-blue-600">
                  {Math.round((answeredQuestions.filter(q => q.startsWith('military')).length / 10) * 100)}%
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleOpenModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
          >
            {answeredQuestions.length === 0 ? 'התחל מילוי' : 'המשך מילוי'}
          </button>
        </div>
      </div>
      
      <QuestionnaireModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onComplete={handleComplete}
      />
    </>
  );
}
