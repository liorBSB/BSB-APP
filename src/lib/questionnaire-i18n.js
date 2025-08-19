// src/lib/questionnaire-i18n.js
// Hebrew translations for the questionnaire

export const QUESTIONNAIRE_HEBREW = {
  // Categories
  personal_basic: 'פרטים אישיים',
  family_info: 'מידע משפחתי',
  emergency_contact: 'איש קשר בארץ',
  military_info: 'מידע צבאי',
  medical_info: 'מידע רפואי',

  // Questions
  entryDateToHouse: 'באיזה תאריך נכנסת לבית?',
  gender: 'מה המגדר שלך?',
  dateOfBirth: 'באיזה תאריך נולדת?',
  idType: 'איזה סוג תעודה יש ברשותך?',
  countryOfOrigin: 'מה הארץ מוצא שלך (באיזה מדינה נולדת?)',
  phoneNumber: 'מה המספר טלפון שלך?',
  email: 'מה כתובת מייל שלך?',
  arrivalDate: 'באיזה תאריך הגעת לארץ?',
  previousAddress: 'איפה גרת לפני הבית? (סוג מגורים וכתובת)',
  education: 'איזה השכלה יש ברשותך?',
  license: 'איזה רישיון נהיגה יש לך?',
  familyInIsrael: 'האם יש לך משפחה בארץ?',
  familyInIsraelDetails: 'במידה ויש לך, איזה משפחה יש לך בארץ?',
  cleanlinessLevel: 'מה רמת הניקיון שלך מ1-10?',
  fatherName: 'מה השם של אבא שלך?',
  fatherPhone: 'מה המספר טלפון של אבא שלך?',
  motherName: 'מה השם של אמא שלך?',
  motherPhone: 'מה המספר טלפון של אמא שלך?',
  parentsStatus: 'מה מצב ההורים שלך?',
  parentsAddress: 'כתובת המגורים של אחד ההורים',
  parentsEmail: 'כתובת מייל של אחד ההורים',
  contactWithParents: 'איך הקשר שלך עם ההורים?',
  emergencyContactName: 'שם של איש קשר בארץ',
  emergencyContactPhone: 'מספר טלפון של איש קשר בארץ',
  emergencyContactAddress: 'כתובת מגורים של איש קשר בארץ',
  emergencyContactEmail: 'כתובת מייל של איש קשר בארץ',
  personalNumber: 'מה המספר האישי שלך?',
  enlistmentDate: 'באיזה תאריך התגייסת?',
  releaseDate: 'באיזה תאריך את/ה עתיד להתשחרר?',
  unit: 'באיזה יחידה את/ה משרת?',
  battalion: 'באיזה גדוד את/ה משרת?',
  mashakitTash: 'מה השם של המשקית תש שלך?',
  mashakitPhone: 'מה הטלפון של המשקית תש שלך?',
  officerName: 'מה השם של הקצין שלך?',
  officerPhone: 'מה המספר טלפון של הקצין שלך?',
  disciplinaryRecord: 'האם ביצעת עברות משמעת בעבר?',
  healthFund: 'באיזה קופת חולים היית לפני הצבא?',
  medicalProblems: 'האם יש לך בעיות רפואיות כלשהן, אם כן פרט/י',
  allergies: 'האם יש לך אלרגיה או רגישות למזון/לתרופות כלשהם, אם כן פרט/י?',
  hospitalizations: 'האם אושפזת/ה בעבר מכל סיבה שהיא, אם כן פרט/י?',
  psychiatricTreatment: 'האם קיבלת טיפול פסיכיאטרי בעבר או בהווה, אם כן פרט/י?',
  regularMedication: 'האם את/ה נוטל/ת כדורים כלשהם בקביעות, אם כן פרט/י?',

  // Options
  genderOptions: {
    Male: 'זכר',
    Female: 'נקבה',
    Other: 'אחר'
  },
  idTypeOptions: {
    'ID Card': 'תעודת זהות',
    'Passport': 'דרכון',
    'Blue Card': 'כחולה',
    'Other': 'אחר'
  },
  educationOptions: {
    'None': 'אין',
    '12 years of study (High School)': '12 שנות לימוד (תיכון)',
    'Full Matriculation': 'בגרות מלאה',
    'Bachelor\'s Degree': 'תואר ראשון',
    'Master\'s Degree': 'תואר שני'
  },
  licenseOptions: {
    'No license': 'אין לי רישיון',
    'Car license': 'רישיון לאוטו',
    'Motorcycle license': 'רישיון לאופנוע',
    'Car and motorcycle license': 'רישיון לאוטו ואופנוע'
  },
  parentsStatusOptions: {
    'Married': 'נשואים',
    'Divorced': 'גרושים',
    'Orphan from one': 'יתום מאחד',
    'Orphan from both': 'יתום משניהם',
    'Other': 'אחר'
  },
  contactWithParentsOptions: {
    'Excellent': 'מצוין',
    'Good': 'טוב',
    'Fair': 'סביר',
    'Not great': 'לא משהו',
    'No contact': 'אין קשר'
  },
  booleanOptions: {
    'Yes': 'כן',
    'No': 'לא'
  },

  // UI Text
  title: 'שאלון פרטים אישיים',
  progress: 'התקדמות',
  questions: 'שאלות',
  requiredField: 'שדה חובה',
  continue: 'המשך',
  skip: 'דלג',
  notRelevant: 'לא רלוונטי',
  previous: 'קודם',
  saving: 'שומר...',

  // Placeholders
  typeAnswer: 'הקלד את תשובתך...',
  enterPhone: 'הקלד מספר טלפון...',
  enterEmail: 'הקלד כתובת מייל...',
  chooseNumber: 'בחר מספר מ-1 עד 10...'
};

export default QUESTIONNAIRE_HEBREW;
