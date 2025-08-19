// src/lib/questionnaire.js

// ============================================================================
// QUESTIONNAIRE STRUCTURE & FLOW
// ============================================================================

export const QUESTION_CATEGORIES = {
  PERSONAL_BASIC: 'personal_basic',
  FAMILY_INFO: 'family_info',
  EMERGENCY_CONTACT: 'emergency_contact', 
  MILITARY_INFO: 'military_info',
  MEDICAL_INFO: 'medical_info',
  ADDITIONAL_INFO: 'additional_info'
};

export const QUESTION_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  DATE: 'date',
  PHONE: 'phone',
  EMAIL: 'email',
  BOOLEAN: 'boolean',
  MULTI_SELECT: 'multi_select',
  NUMBER: 'number'
};

// Main questionnaire structure
export const QUESTIONNAIRE_STRUCTURE = [
  {
    id: QUESTION_CATEGORIES.PERSONAL_BASIC,
    title: 'Personal Information',
    description: 'Basic information about the soldier',
    questions: [
      {
        id: 'entryDateToHouse',
        text: 'What date did you enter the house?',
        type: QUESTION_TYPES.DATE,
        field: 'entryDateToHouse'
      },
      {
        id: 'gender',
        text: 'What is your gender?',
        type: QUESTION_TYPES.SELECT,
        options: ['Male', 'Female', 'Other'],
        field: 'gender'
      },
      {
        id: 'dateOfBirth',
        text: 'What is your date of birth?',
        type: QUESTION_TYPES.DATE,
        field: 'dateOfBirth'
      },
      {
        id: 'idType',
        text: 'What type of ID do you have?',
        type: QUESTION_TYPES.SELECT,
        options: ['ID Card', 'Passport', 'Blue Card', 'Other'],
        field: 'idType'
      },
      {
        id: 'countryOfOrigin',
        text: 'What is your country of origin (in which country were you born)?',
        type: QUESTION_TYPES.TEXT,
        field: 'countryOfOrigin'
      },
      {
        id: 'phoneNumber',
        text: 'What is your phone number?',
        type: QUESTION_TYPES.PHONE,
        field: 'phoneNumber'
      },
      {
        id: 'email',
        text: 'What is your email address?',
        type: QUESTION_TYPES.EMAIL,
        field: 'email'
      },
      {
        id: 'arrivalDate',
        text: 'What date did you arrive in the country?',
        type: QUESTION_TYPES.DATE,
        field: 'arrivalDate'
      },
      {
        id: 'previousAddress',
        text: 'Where did you live before the house? (type of residence and address)',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'previousAddress'
      },
      {
        id: 'education',
        text: 'What education do you have?',
        type: QUESTION_TYPES.SELECT,
        options: ['None', '12 years of study (High School)', 'Full Matriculation', 'Bachelor\'s Degree', 'Master\'s Degree'],
        field: 'education'
      },
      {
        id: 'license',
        text: 'What driving license do you have?',
        type: QUESTION_TYPES.SELECT,
        options: ['No license', 'Car license', 'Motorcycle license', 'Car and motorcycle license'],
        field: 'license'
      },
      {
        id: 'familyInIsrael',
        text: 'Do you have family in the country?',
        type: QUESTION_TYPES.BOOLEAN,
        field: 'familyInIsrael'
      },
      {
        id: 'familyInIsraelDetails',
        text: 'If yes, what family do you have in the country?',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'familyInIsraelDetails'
      },
      {
        id: 'cleanlinessLevel',
        text: 'What is your cleanliness level from 1-10?',
        type: QUESTION_TYPES.NUMBER,
        field: 'cleanlinessLevel'
      }
    ]
  },
  {
    id: QUESTION_CATEGORIES.FAMILY_INFO,
    title: 'Family Information',
    description: 'Details about family and parents',
    questions: [
      {
        id: 'fatherName',
        text: 'What is your father\'s name?',
        type: QUESTION_TYPES.TEXT,
        field: 'fatherName'
      },
      {
        id: 'fatherPhone',
        text: 'What is your father\'s phone number?',
        type: QUESTION_TYPES.PHONE,
        field: 'fatherPhone'
      },
      {
        id: 'motherName',
        text: 'What is your mother\'s name?',
        type: QUESTION_TYPES.TEXT,
        field: 'motherName'
      },
      {
        id: 'motherPhone',
        text: 'What is your mother\'s phone number?',
        type: QUESTION_TYPES.PHONE,
        field: 'motherPhone'
      },
      {
        id: 'parentsStatus',
        text: 'What is your parents\' status?',
        type: QUESTION_TYPES.SELECT,
        options: ['Married', 'Divorced', 'Orphan from one', 'Orphan from both', 'Other'],
        field: 'parentsStatus'
      },
      {
        id: 'parentsAddress',
        text: 'Address of one of the parents',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'parentsAddress'
      },
      {
        id: 'parentsEmail',
        text: 'Email address of one of the parents',
        type: QUESTION_TYPES.EMAIL,
        field: 'parentsEmail'
      },
      {
        id: 'contactWithParents',
        text: 'How is your relationship with your parents?',
        type: QUESTION_TYPES.SELECT,
        options: ['Excellent', 'Good', 'Fair', 'Not great', 'No contact'],
        field: 'contactWithParents'
      }
    ]
  },
  {
    id: QUESTION_CATEGORIES.EMERGENCY_CONTACT,
    title: 'Emergency Contact in Country',
    description: 'Contact details for emergency situations',
    questions: [
      {
        id: 'emergencyContactName',
        text: 'Name of emergency contact in the country',
        type: QUESTION_TYPES.TEXT,
        field: 'emergencyContactName'
      },
      {
        id: 'emergencyContactPhone',
        text: 'Phone number of emergency contact in the country',
        type: QUESTION_TYPES.PHONE,
        field: 'emergencyContactPhone'
      },
      {
        id: 'emergencyContactAddress',
        text: 'Address of emergency contact in the country',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'emergencyContactAddress'
      },
      {
        id: 'emergencyContactEmail',
        text: 'Email address of emergency contact in the country',
        type: QUESTION_TYPES.EMAIL,
        field: 'emergencyContactEmail'
      }
    ]
  },
  {
    id: QUESTION_CATEGORIES.MILITARY_INFO,
    title: 'Military Information',
    description: 'Details about military service',
    questions: [
      {
        id: 'personalNumber',
        text: 'What is your personal number?',
        type: QUESTION_TYPES.TEXT,
        field: 'personalNumber'
      },
      {
        id: 'enlistmentDate',
        text: 'What date did you enlist?',
        type: QUESTION_TYPES.DATE,
        field: 'enlistmentDate'
      },
      {
        id: 'releaseDate',
        text: 'What date are you expected to be released?',
        type: QUESTION_TYPES.DATE,
        field: 'releaseDate'
      },
      {
        id: 'unit',
        text: 'In which unit do you serve?',
        type: QUESTION_TYPES.TEXT,
        field: 'unit'
      },
      {
        id: 'battalion',
        text: 'In which battalion do you serve?',
        type: QUESTION_TYPES.TEXT,
        field: 'battalion'
      },
      {
        id: 'mashakitTash',
        text: 'What is your Mashakit Tash\'s name?',
        type: QUESTION_TYPES.TEXT,
        field: 'mashakitTash'
      },
      {
        id: 'mashakitPhone',
        text: 'What is your Mashakit Tash\'s phone number?',
        type: QUESTION_TYPES.PHONE,
        field: 'mashakitPhone'
      },
      {
        id: 'officerName',
        text: 'What is your officer\'s name?',
        type: QUESTION_TYPES.TEXT,
        field: 'officerName'
      },
      {
        id: 'officerPhone',
        text: 'What is your officer\'s phone number?',
        type: QUESTION_TYPES.PHONE,
        field: 'officerPhone'
      },
      {
        id: 'disciplinaryRecord',
        text: 'Have you committed any disciplinary violations in the past?',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'disciplinaryRecord'
      }
    ]
  },
  {
    id: QUESTION_CATEGORIES.MEDICAL_INFO,
    title: 'Medical Information',
    description: 'Important medical details',
    questions: [
      {
        id: 'healthFund',
        text: 'Which health fund were you in before the army?',
        type: QUESTION_TYPES.TEXT,
        field: 'healthFund'
      },
      {
        id: 'medicalProblems',
        text: 'Do you have any medical problems? If yes, please specify',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'medicalProblems'
      },
      {
        id: 'allergies',
        text: 'Do you have any allergies or sensitivities to food/medications? If yes, please specify',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'allergies'
      },
      {
        id: 'hospitalizations',
        text: 'Have you been hospitalized in the past for any reason? If yes, please specify',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'hospitalizations'
      },
      {
        id: 'psychiatricTreatment',
        text: 'Have you received psychiatric treatment in the past or present? If yes, please specify',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'psychiatricTreatment'
      },
      {
        id: 'regularMedication',
        text: 'Do you take any medications regularly? If yes, please specify',
        type: QUESTION_TYPES.TEXTAREA,
        field: 'regularMedication'
      }
    ]
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get total questions count
 */
export const getTotalQuestionsCount = () => {
  return QUESTIONNAIRE_STRUCTURE.reduce((total, category) => {
    return total + category.questions.length;
  }, 0);
};

/**
 * Get question by ID
 */
export const getQuestionById = (questionId) => {
  for (const category of QUESTIONNAIRE_STRUCTURE) {
    const question = category.questions.find(q => q.id === questionId);
    if (question) {
      return { ...question, category: category.id, categoryTitle: category.title };
    }
  }
  return null;
};

/**
 * Get next question in sequence
 */
export const getNextQuestion = (currentQuestionId, profileData) => {
  let foundCurrent = false;
  
  for (const category of QUESTIONNAIRE_STRUCTURE) {
    for (const question of category.questions) {
      if (foundCurrent) {
        // Check if this question field is filled in the database
        const value = profileData?.[question.id];
        if (value === undefined || value === null || value === '') {
          // Check for arrays (multi_select)
          if (Array.isArray(value)) {
            if (value.length === 0) {
              // Field is empty, return this question
              return { ...question, category: category.id, categoryTitle: category.title };
            }
          } else {
            // Field is empty, return this question
            return { ...question, category: category.id, categoryTitle: category.title };
          }
        }
        // Field is filled, continue to next question
      }
      if (question.id === currentQuestionId) {
        foundCurrent = true;
      }
    }
  }
  
  return null; // No more questions
};

/**
 * Get previous question in sequence
 */
export const getPreviousQuestion = (currentQuestionId, profileData) => {
  let previousQuestion = null;
  
  for (const category of QUESTIONNAIRE_STRUCTURE) {
    for (const question of category.questions) {
      if (question.id === currentQuestionId) {
        return previousQuestion;
      }
      // Check if this question field is filled in the database
      const value = profileData?.[question.id];
      if (value === undefined || value === null || value === '') {
        // Check for arrays (multi_select)
        if (Array.isArray(value)) {
          if (value.length === 0) {
            // Field is empty, this could be the previous question
            previousQuestion = { ...question, category: category.id, categoryTitle: category.title };
          }
        } else {
          // Field is empty, this could be the previous question
          previousQuestion = { ...question, category: category.id, categoryTitle: category.title };
        }
      }
    }
  }
  
  return previousQuestion;
};

/**
 * Get progress percentage
 */
export const getProgressPercentage = (profileData) => {
  if (!profileData) return 0;
  
  let answered = 0;
  const total = getTotalQuestionsCount();
  
  for (const category of QUESTIONNAIRE_STRUCTURE) {
    for (const question of category.questions) {
      const value = profileData[question.id];
      if (value !== undefined && value !== null && value !== '') {
        // Check for arrays (multi_select)
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
  
  return Math.round((answered / total) * 100);
};

/**
 * Get category progress
 */
export const getCategoryProgress = (categoryId, answeredQuestions) => {
  const category = QUESTIONNAIRE_STRUCTURE.find(cat => cat.id === categoryId);
  if (!category) return { answered: 0, total: 0, percentage: 0 };
  
  const total = category.questions.length;
  const answered = category.questions.filter(q => answeredQuestions.includes(q.id)).length;
  const percentage = Math.round((answered / total) * 100);
  
  return { answered, total, percentage };
};

export default {
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
  QUESTIONNAIRE_STRUCTURE,
  getTotalQuestionsCount,
  getQuestionById,
  getNextQuestion,
  getPreviousQuestion,
  getProgressPercentage,
  getCategoryProgress
};
