# Google Sheets Integration - הוראות התקנה

## סקירה כללית
מערכת אינטגרציה עם Google Sheets לניהול נתוני חיילים. המערכת מאפשרת:
- חיפוש חיילים לפי שם מלא
- טעינת כל הנתונים מהגיליון לאפליקציה
- סינכרון דו-כיווני (עדכונים מהאפליקציה לגיליון)

## קבצים שנוצרו

### 1. `src/lib/soldierDataService.js`
שירות לניהול נתוני חיילים מ-Google Sheets
- קריאת נתונים מהגיליון
- חיפוש חיילים לפי שם
- מפתוח נתונים לעברית לאנגלית
- ניהול cache

### 2. `src/components/SoldierNameSearch.js`
רכיב חיפוש אוטומטי לחיילים
- חיפוש בזמן אמת
- הצגת הצעות
- בחירת חייל
- עיצוב מותאם למובייל

### 3. `src/app/profile-setup/page.js` (עודכן)
דף הגדרת פרופיל עם אינטגרציה ל-Google Sheets
- חיפוש חייל לפי שם
- טעינת כל הנתונים מהגיליון
- שמירה ב-Firestore

### 4. `google-apps-script.js`
Google Apps Script לניהול הגיליון
- קריאת נתונים
- חיפוש חיילים
- עדכון נתונים

## הוראות התקנה

### שלב 1: הגדרת Google Apps Script

1. **פתח Google Apps Script**
   - לך ל-https://script.google.com
   - צור פרויקט חדש

2. **העתק את הקוד**
   - העתק את התוכן מ-`google-apps-script.js`
   - הדבק ב-Google Apps Script

3. **הגדר את הגיליון**
   - שנה את `spreadsheetId` בקוד
   - שנה את `sheetName` לשם הגיליון שלך

4. **פרוס את הסקריפט**
   - לחץ על "Deploy" > "New deployment"
   - בחר "Web app"
   - הגדר הרשאות: "Anyone"
   - לחץ "Deploy"

5. **קבל את ה-URL**
   - העתק את ה-URL שנוצר
   - עדכן את `scriptUrl` ב-`soldierDataService.js`

### שלב 2: הגדרת משתני סביבה

צור קובץ `.env.local` עם המשתנים הבאים:

```env
# Google Sheets Configuration
NEXT_PUBLIC_SOLDIER_SHEETS_ID=your_spreadsheet_id_here
NEXT_PUBLIC_SOLDIER_SHEETS_API_KEY=your_api_key_here
```

### שלב 3: עדכון הקוד

1. **עדכן את `soldierDataService.js`**
   ```javascript
   const SOLDIER_SHEETS_CONFIG = {
     spreadsheetId: process.env.NEXT_PUBLIC_SOLDIER_SHEETS_ID,
     sheetName: 'Soldiers', // שם הגיליון שלך
     scriptUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
   };
   ```

2. **עדכן את ה-Google Apps Script**
   - שנה את `spreadsheetId` ל-ID של הגיליון שלך
   - שנה את `sheetName` לשם הגיליון שלך

### שלב 4: בדיקת המערכת

1. **הפעל את האפליקציה**
   ```bash
   npm run dev
   ```

2. **בדוק את החיבור**
   - לך לדף profile-setup
   - נסה לחפש חייל
   - ודא שהנתונים נטענים

## מבנה הגיליון הנדרש

הגיליון צריך לכלול את העמודות הבאות:

| עמודה | תיאור |
|--------|--------|
| שם מלא | שם מלא של החייל |
| שם פרטי | שם פרטי |
| שם משפחה | שם משפחה |
| חדר | מספר חדר |
| בניין | בניין |
| קומה | קומה |
| אגף-כיוון חדר | כיוון החדר |
| אפיון חדר | סוג החדר |
| מגדר | מגדר |
| תאריך לידה | תאריך לידה |
| מספר זהות | מספר זהות |
| סוג תעודה | סוג תעודה |
| ארץ מוצא | ארץ מוצא |
| מספר סלולרי | מספר טלפון |
| כתובת מייל חייל | כתובת מייל |

ועוד עמודות נוספות לפי הצורך.

## פתרון בעיות

### שגיאה: "Sheet not found"
- ודא שהשם של הגיליון נכון
- ודא שהגיליון קיים

### שגיאה: "Spreadsheet not found"
- ודא שה-ID של הגיליון נכון
- ודא שיש לך הרשאות לגיליון

### שגיאה: "Script not found"
- ודא שה-URL של הסקריפט נכון
- ודא שהסקריפט פרוס כ-Web app

### שגיאה: "CORS error"
- ודא שהסקריפט פרוס עם הרשאות "Anyone"
- ודא שה-URL נכון

## תמיכה

אם יש בעיות, בדוק:
1. את Console בדפדפן
2. את Google Apps Script logs
3. את הגדרות הגיליון
4. את משתני הסביבה

## הערות חשובות

- המערכת עובדת עם cache של 5 דקות
- עדכונים בגיליון יופיעו רק אחרי 5 דקות
- המערכת תומכת בחיפוש חלקי
- כל הנתונים נשמרים ב-Firestore אחרי הבחירה
