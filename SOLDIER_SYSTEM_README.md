# מערכת ניהול חיילים - Soldier Management System

## סקירה כללית

מערכת ניהול חיילים היא מערכת מקיפה לניהול מידע על חיילים בבית החיילים. המערכת מפרידה בין מידע יומיומי למידע לטווח ארוך, ומאפשרת ייצוא אוטומטי ל-Google Sheets כאשר חייל עוזב.

## מבנה המערכת

### 1. קולקציות Firestore

#### `soldiers` - מידע יומיומי
```javascript
{
  uid: "string",                    // מזהה ייחודי
  basicInfo: {                      // מידע בסיסי
    fullName: "string",
    email: "string", 
    phone: "string"
  },
  currentStatus: {                  // סטטוס נוכחי
    roomNumber: "string",
    roomLetter: "string",
    bedNumber: "string",
    isPresent: "boolean",
    lastSeen: "timestamp"
  },
  dailyInfo: {                      // מידע יומי
    lastMeal: "timestamp",
    notes: "string"
  },
  profilePhoto: "string",           // תמונת פרופיל
  profileComplete: "boolean",       // האם הפרופיל הושלם
  answeredQuestions: "number",      // מספר שאלות שענה
  totalQuestions: "number",         // סה"כ שאלות
  status: "active|left|archived",  // סטטוס החייל
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

#### `soldierProfiles` - מידע לטווח ארוך
```javascript
{
  soldierId: "string",              // reference ל-soldiers.uid
  personalInfo: {                   // פרטים אישיים
    firstName: "string",
    lastName: "string",
    dateOfBirth: "timestamp",
    gender: "string",
    idNumber: "string",
    // ... עוד שדות
  },
  familyInfo: {                     // מידע משפחתי
    familyInIsrael: "boolean",
    fatherName: "string",
    // ... עוד שדות
  },
  emergencyContact: {               // איש קשר חירום
    name: "string",
    phone: "string",
    // ... עוד שדות
  },
  militaryInfo: {                   // מידע צבאי
    personalNumber: "string",
    unit: "string",
    // ... עוד שדות
  },
  medicalInfo: {                    // מידע רפואי
    healthFund: "string",
    allergies: "string",
    // ... עוד שדות
  },
  answers: {                        // תשובות השאלון
    questionId: {
      value: "string",
      answeredAt: "timestamp",
      skipped: "boolean"
    }
  }
}
```

### 2. מבנה השאלון

השאלון מחולק ל-6 קטגוריות:

1. **פרטים אישיים** - שם, תאריך לידה, מגדר, ת.ז
2. **מידע משפחתי** - פרטי הורים, כתובות, טלפונים
3. **איש קשר בארץ** - פרטי קשר למקרה חירום
4. **מידע צבאי** - יחידה, גדוד, משקית תש, קצין
5. **מידע רפואי** - קופת חולים, אלרגיות, תרופות
6. **מידע נוסף** - רמת ניקיון, תרומות, הערות

### 3. תהליך העבודה

#### חייל חדש נרשם:
1. נוצר רשומה ב-`soldiers` עם `profileComplete: false`
2. האפליקציה עובדת כרגיל עם מידע יומי
3. השאלון מופיע בעמוד הבית

#### חייל ממלא שאלון:
1. כל שאלה נשמרת ב-`soldierProfiles`
2. ההתקדמות מתעדכנת בזמן אמת
3. השאלון נעלם כשהפרופיל הושלם

#### חייל עוזב (אדמין):
1. אדמין לוחץ "עזב" על חייל
2. כל המידע מיוצא ל-Google Sheets
3. המידע נמחק מהדאטהבייס
4. נשאר רק סטטוס "עזב"

## שימוש במערכת

### לחיילים:

#### השאלון:
- השאלון מופיע בעמוד הבית עד השלמה
- כל שאלה נשמרת אוטומטית
- אפשר לדלג על שאלות לא רלוונטיות
- התקדמות מוצגת בזמן אמת

#### מידע יומי:
- עדכון סטטוס נוכחות
- רישום ארוחות
- הערות יומיות
- תמונת פרופיל

### לאדמינים:

#### ניהול חיילים:
- צפייה ברשימת כל החיילים
- חיפוש בשפה חופשית
- צפייה בפרטי חייל
- סימון חייל כעוזב

#### חיפוש:
- חיפוש לפי שם
- חיפוש לפי מספר חדר
- חיפוש לפי ת.ז
- חיפוש לפי משקית תש
- חיפוש לפי קצין

## ייצוא ל-Google Sheets

### תהליך הייצוא:
1. **איסוף נתונים** - כל המידע מ-`soldiers` ו-`soldierProfiles`
2. **עיבוד נתונים** - המרה לפורמט מתאים ל-Sheets
3. **שליחה ל-Sheets** - באמצעות Google Sheets API
4. **ארכוב** - שמירת גיבוי לפני מחיקה
5. **ניקוי** - מחיקת המידע מהדאטהבייס

### שדות מיוצאים:
- כל השדות מהשאלון המפורט
- מידע יומי (חדר, מיטה, סטטוס)
- תאריכי כניסה ועזיבה
- מטא-דאטה (מתי יוצא, על ידי מי)

## אבטחה

### Firestore Rules:
```javascript
// Soldiers - חיילים יכולים לקרוא ולעדכן את המידע שלהם
match /soldiers/{soldierId} {
  allow read, write: if isSignedIn() && isOwner(soldierId);
  allow read, write: if isSignedIn() && isAdmin(request.auth.uid);
}

// Soldier Profiles - חיילים יכולים לקרוא ולעדכן את הפרופיל שלהם
match /soldierProfiles/{profileId} {
  allow read, write: if isSignedIn() && isOwner(profileId);
  allow read, write: if isSignedIn() && isAdmin(request.auth.uid);
}

// Archived Soldiers - רק אדמינים
match /archivedSoldiers/{archivedId} {
  allow read, write: if isSignedIn() && isAdmin(request.auth.uid);
}
```

## התקנה והגדרה

### 1. תלויות נדרשות:
```bash
npm install lodash
```

### 2. משתני סביבה:
```env
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=your_api_key
NEXT_PUBLIC_GOOGLE_SHEETS_ID=your_spreadsheet_id
```

### 3. Firestore Rules:
עדכן את `firestore.rules` עם הכללים החדשים

### 4. Google Sheets API:
1. צור פרויקט ב-Google Cloud Console
2. הפעל Google Sheets API
3. צור Service Account
4. הורד את הקובץ JSON
5. שתף את ה-Spreadsheet עם ה-Service Account

## פיתוח עתידי

### תכונות מתוכננות:
1. **ניתוח נתונים** - דוחות וסטטיסטיקות
2. **התראות** - עדכונים על שינויים
3. **גיבוי אוטומטי** - גיבוי יומי לשרת חיצוני
4. **API חיצוני** - חיבור למערכות אחרות
5. **אפליקציה ניידת** - גרסה למובייל

### שיפורים טכניים:
1. **Caching** - שמירת נתונים מקומית
2. **Offline Support** - עבודה ללא אינטרנט
3. **Real-time Updates** - עדכונים בזמן אמת
4. **Performance Optimization** - שיפור ביצועים

## תמיכה ועזרה

### בעיות נפוצות:
1. **שאלון לא נטען** - בדוק חיבור לאינטרנט
2. **שמירה נכשלת** - בדוק הרשאות Firestore
3. **ייצוא נכשל** - בדוק הגדרות Google Sheets

### לוגים:
- בדוק את Console בדפדפן
- בדוק את Firebase Console
- בדוק את Google Sheets API logs

## רישיון

מערכת זו פותחה עבור בית החיילים ואינה מיועדת לשימוש מסחרי.
