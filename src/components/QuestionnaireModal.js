'use client';

import { useState, useEffect } from 'react';
import { 
  QUESTIONNAIRE_STRUCTURE, 
  getTotalQuestionsCount, 
  getNextQuestion, 
  getPreviousQuestion,
  getProgressPercentage 
} from '@/lib/questionnaire';
import { updateProfileAnswer } from '@/lib/database';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import colors from '@/app/colors';

export default function QuestionnaireModal({ isOpen, onClose, onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [showIntro, setShowIntro] = useState(true);

  const handleClose = () => {
    // Do not refresh the page; simply close the modal
    onClose();
  };

  // Load existing profile data when modal opens
  useEffect(() => {
    if (isOpen && auth.currentUser) {
      loadProfileData();
    }
  }, [isOpen]);

  // Get total questions count
  useEffect(() => {
    const fetchTotalQuestions = async () => {
      try {
        const count = await getTotalQuestionsCount();
        setTotalQuestions(count);
      } catch (error) {
        console.error('Error getting total questions count:', error);
        setTotalQuestions(0);
      }
    };
    
    if (isOpen) {
      fetchTotalQuestions();
    }
  }, [isOpen]);

  // Initialize first question after profile data is loaded
  useEffect(() => {
    if (profileData && QUESTIONNAIRE_STRUCTURE.length > 0 && !showIntro) {
      // Find the first unanswered question
      let firstUnansweredQuestion = null;
      for (const category of QUESTIONNAIRE_STRUCTURE) {
        for (const question of category.questions) {
          const value = profileData[question.id];
          if (value === undefined || value === null || value === '') {
            // Check for arrays (multi_select)
            if (Array.isArray(value)) {
              if (value.length === 0) {
                firstUnansweredQuestion = question;
                break;
              }
            } else {
              firstUnansweredQuestion = question;
              break;
            }
          }
        }
        if (firstUnansweredQuestion) break;
      }
      
      // If all questions are answered, start with the first one
      if (!firstUnansweredQuestion) {
        firstUnansweredQuestion = QUESTIONNAIRE_STRUCTURE[0].questions[0];
      }
      
      setCurrentQuestion({
        ...firstUnansweredQuestion,
        category: firstUnansweredQuestion.category || QUESTIONNAIRE_STRUCTURE[0].id,
        categoryTitle: firstUnansweredQuestion.categoryTitle || QUESTIONNAIRE_STRUCTURE[0].title
      });
      
      // Initialize answer based on question type
      if (firstUnansweredQuestion.type === 'multi_select') {
        setCurrentAnswer([]);
      } else {
        setCurrentAnswer('');
      }
    }
  }, [profileData, showIntro]);

  const loadProfileData = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setProfileData(userData);
        
        // Get answered questions from user data
        const answered = [];
        QUESTIONNAIRE_STRUCTURE.forEach(category => {
          category.questions.forEach(question => {
            const value = userData[question.id];
            if (value !== undefined && value !== null && value !== '') {
              // Check for arrays (multi_select)
              if (Array.isArray(value)) {
                if (value.length > 0) {
                  answered.push(question.id);
                }
              } else {
                answered.push(question.id);
              }
            }
          });
        });
        // setAnsweredQuestions(answered); // This line is removed
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleAnswerChange = (value) => {
    setCurrentAnswer(value);
  };

  const handleNotRelevant = async () => {
    if (!currentQuestion) return;
    
    try {
      setLoading(true);
      
      // Save "Not Relevant" to the database
      await updateProfileAnswer(auth.currentUser.uid, currentQuestion.id, 'Not Relevant');
      
      // Merge answer locally so progress updates live
      const updatedProfile = { ...(profileData || {}), [currentQuestion.id]: 'Not Relevant' };
      setProfileData(updatedProfile);

      // Move to next question using updated profile
      const nextQuestion = getNextQuestion(currentQuestion.id, updatedProfile);
      
      if (nextQuestion) {
        // Move to next question
        setCurrentQuestion({
          ...nextQuestion,
          category: nextQuestion.category || QUESTIONNAIRE_STRUCTURE[0].id,
          categoryTitle: nextQuestion.categoryTitle || QUESTIONNAIRE_STRUCTURE[0].title
        });
        
        // Initialize answer based on question type
        if (nextQuestion.type === 'multi_select') {
          setCurrentAnswer([]);
        } else {
          setCurrentAnswer('');
        }
      } else {
        // Questionnaire completed - no refresh
        onComplete && onComplete();
        onClose();
      }
      
    } catch (error) {
      console.error('Error saving answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;
    
    try {
      setLoading(true);
      
      // Move to next question without saving
      const nextQuestion = getNextQuestion(currentQuestion.id, profileData);
      
      if (nextQuestion) {
        // Move to next question
        setCurrentQuestion({
          ...nextQuestion,
          category: nextQuestion.category || QUESTIONNAIRE_STRUCTURE[0].id,
          categoryTitle: nextQuestion.categoryTitle || QUESTIONNAIRE_STRUCTURE[0].title
        });
        
        // Initialize answer based on question type
        if (nextQuestion.type === 'multi_select') {
          setCurrentAnswer([]);
        } else {
          setCurrentAnswer('');
        }
      } else {
        // Questionnaire completed - no refresh
        onComplete && onComplete();
        onClose();
      }
      
    } catch (error) {
      console.error('Error skipping question:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!currentQuestion) return;
    
    try {
      setLoading(true);
      
      // Save answer to database
      await updateProfileAnswer(auth.currentUser.uid, currentQuestion.id, currentAnswer);
      
      // Merge answer locally so progress updates live
      const updatedProfile = { ...(profileData || {}), [currentQuestion.id]: currentAnswer };
      setProfileData(updatedProfile);

      // Move to next question using updated profile
      const nextQuestion = getNextQuestion(currentQuestion.id, updatedProfile);
      
      if (nextQuestion) {
        // Move to next question
        setCurrentQuestion({
          ...nextQuestion,
          category: nextQuestion.category || QUESTIONNAIRE_STRUCTURE[0].id,
          categoryTitle: nextQuestion.categoryTitle || QUESTIONNAIRE_STRUCTURE[0].title
        });
        
        // Initialize answer based on question type
        if (nextQuestion.type === 'multi_select') {
          setCurrentAnswer([]);
        } else {
          setCurrentAnswer('');
        }
      } else {
        // Questionnaire completed - no refresh
        onComplete && onComplete();
        onClose();
      }
      
    } catch (error) {
      console.error('Error saving answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const moveToNextQuestion = () => {
    const nextQuestion = getNextQuestion(currentQuestion.id, profileData);
    
    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      // Initialize answer based on question type
      if (nextQuestion.type === 'multi_select') {
        setCurrentAnswer([]);
      } else {
        setCurrentAnswer('');
      }
      // setQuestionIndex(prev => prev + 1); // This line is removed
    } else {
      // All questions completed
      // Check if this was the last question being answered
      const wasLastQuestionAnswered = currentQuestion && profileData?.[currentQuestion.id];
      onComplete(wasLastQuestionAnswered);
      onClose();
    }
  };

  const moveToPreviousQuestion = () => {
    const prevQuestion = getPreviousQuestion(currentQuestion.id, profileData);
    
    if (prevQuestion) {
      setCurrentQuestion(prevQuestion);
      const savedAnswer = profileData?.[prevQuestion.id];
      
      // Initialize answer based on question type
      if (prevQuestion.type === 'multi_select') {
        setCurrentAnswer(savedAnswer || []);
      } else {
        setCurrentAnswer(savedAnswer || '');
      }
      // setQuestionIndex(prev => Math.max(0, prev - 1)); // This line is removed
    }
  };

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const { type, options, required } = currentQuestion;

    switch (type) {
      case 'text':
        return (
          <input
            type="text"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type your answer..."
            required={required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            placeholder="Type your answer..."
            required={required}
          />
        );

      case 'select':
        return (
          <select
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={required}
          >
            <option value="">בחר אפשרות...</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={required}
          />
        );

      case 'phone':
        return (
          <input
            type="tel"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter phone number..."
            required={required}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter email address..."
            required={required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            min="1"
            max="10"
            value={currentAnswer || ''}
            onChange={(e) => handleAnswerChange(parseInt(e.target.value) || null)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Choose a number from 1 to 10..."
            required={required}
          />
        );

      case 'boolean':
        return (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleAnswerChange('Yes')}
              className={`px-6 py-3 rounded-lg border-2 transition-colors ${
                currentAnswer === 'Yes'
                  ? 'border-green-500 bg-green-100 text-green-700'
                  : 'border-gray-300 hover:border-green-400'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleAnswerChange('No')}
              className={`px-6 py-3 rounded-lg border-2 transition-colors ${
                currentAnswer === 'No'
                  ? 'border-red-500 bg-red-100 text-red-700'
                  : 'border-gray-300 hover:border-red-400'
              }`}
            >
              No
            </button>
          </div>
        );

      case 'multi_select':
        return (
          <div className="space-y-2">
            {options.map((option) => (
              <label key={option} className="flex items-center space-x-3 space-x-reverse">
                <input
                  type="checkbox"
                  checked={Array.isArray(currentAnswer) && currentAnswer.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleAnswerChange([...(Array.isArray(currentAnswer) ? currentAnswer : []), option]);
                    } else {
                      handleAnswerChange((Array.isArray(currentAnswer) ? currentAnswer : []).filter(item => item !== option));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type your answer..."
          />
        );
    }
  };

  if (!isOpen) return null;

  const progress = getProgressPercentage(profileData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6" style={{ background: colors.gold, color: colors.black }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-2xl font-bold">Personal Information Questionnaire</h2>
            <button
              onClick={handleClose}
              className="text-black hover:text-gray-700 text-2xl sm:text-3xl font-bold p-2"
            >
              ×
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-3 sm:mb-4">
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span>Progress: {progress}%</span>
              <span>Questions: {(() => {
                if (!profileData) return `0/${totalQuestions}`;
                let answered = 0;
                for (const category of QUESTIONNAIRE_STRUCTURE) {
                  for (const question of category.questions) {
                    const value = profileData[question.id];
                    if (value !== undefined && value !== null && value !== '') {
                      if (Array.isArray(value)) {
                        if (value.length > 0) {
                          answered++;
                        }
                      } else {
                        answered++;
                      }
                    }
                  }
                }
                return `${answered}/${totalQuestions}`;
              })()}</span>
            </div>
            <div className="w-full bg-white bg-opacity-20 rounded-full h-2 sm:h-3">
              <div 
                className="bg-white h-2 sm:h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {showIntro && (
            <div className="text-center py-8">
              <h3 className="text-xl font-bold mb-4">Welcome to the Personal Information Questionnaire</h3>
              <p className="text-lg text-gray-800 mb-6">
                Please take your time to fill out this questionnaire accurately. 
                Your information helps us provide better service.
              </p>
              <p className="text-lg text-gray-800 mb-6">
                You can always update your answers later in your profile settings.
              </p>
              <button
                onClick={() => setShowIntro(false)}
                className="mt-6 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Start Questionnaire
              </button>
            </div>
          )}
          {currentQuestion && !showIntro && (
            <div className="space-y-4 sm:space-y-6">
              {/* Category and Question */}
              <div>
                <div className="text-xs sm:text-sm mb-2" style={{ color: colors.primaryGreen, fontWeight: 600 }}>
                  {currentQuestion.categoryTitle}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                  {currentQuestion.text}
                </h3>
              </div>

              {/* Input */}
              <div className="min-h-[100px] sm:min-h-[120px] flex items-center">
                {renderQuestionInput()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showIntro && (
          <div className="border-t border-gray-200 p-4 sm:p-6" style={{ background: colors.surface }}>
            {/* Mobile: Stack buttons vertically, Desktop: Side by side */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={(() => {
                    if (loading) return true;
                    if (currentQuestion?.type === 'multi_select') {
                      return !Array.isArray(currentAnswer) || currentAnswer.length === 0;
                    }
                    return !currentAnswer || currentAnswer.toString().trim() === '';
                  })() || loading}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  style={{ 
                    background: 'transparent', 
                    color: colors.primaryGreen,
                    border: `2px solid ${colors.primaryGreen}`
                  }}
                >
                  {loading ? 'Saving...' : 'Continue'}
                </button>
                
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  style={{ 
                    background: 'transparent', 
                    color: colors.yellow,
                    border: `2px solid ${colors.yellow}`
                  }}
                >
                  Skip
                </button>
                
                <button
                  type="button"
                  onClick={handleNotRelevant}
                  disabled={loading}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  style={{ 
                    background: 'transparent', 
                    color: colors.red,
                    border: `2px solid ${colors.red}`
                  }}
                >
                  Not Relevant
                </button>
              </div>
              
              <button
                type="button"
                onClick={moveToPreviousQuestion}
                disabled={!getPreviousQuestion(currentQuestion?.id, profileData) || loading}
                className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                style={{ 
                  background: 'transparent', 
                  color: '#6B7280',
                  border: '2px solid #6B7280'
                }}
              >
                Previous
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
