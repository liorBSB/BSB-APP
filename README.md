# House Efficiency Pro (BSB App)

A Next.js application for managing a soldier house -- handling resident profiles, expenses, reports, events, and two-way data sync with Google Sheets.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Styling**: Tailwind CSS v3 + custom color palette (`src/app/colors.js`)
- **Database & Auth**: Firebase (Firestore, Authentication, Storage)
- **i18n**: react-i18next (English + Hebrew with RTL support)
- **Google Sheets**: Two-way sync via Google Apps Script
- **PDF Generation**: jspdf + jspdf-autotable
- **Mobile**: Capacitor (static export)

## Project Structure

```
src/
  app/                          # Next.js App Router pages
    page.js                     # Login (Google Auth)
    redirect/                   # Post-login routing logic
    home/                       # Soldier home dashboard
    settings/                   # User settings & profile
    report/                     # Problem & refund reporting
    profile-setup/              # New user onboarding
    register/                   # Registration flow (selection, consent, pending)
    account-deletion/           # Account deletion flow
    admin/
      home/                     # Admin dashboard
      soldiers/                 # Soldier management
      soldiers-home/            # Soldier overview
      expenses/                 # Expense tracking & PDF reports
      report/                   # Problem reports management
      edit/                     # Content editing (events, surveys, messages)
      settings/                 # Admin settings
      profile-setup/            # Admin profile setup
    api/
      proxy-image/              # Image proxy for CORS in PDF generation
    colors.js                   # Central color palette
  components/                   # Reusable UI components
    BottomNavBar.js             # Navigation bar (user)
    AdminBottomNavBar.js        # Navigation bar (admin)
    SoldierManagement.js        # Soldier CRUD management
    SoldierSearch.js            # Search soldiers in Firestore
    SoldierNameSearch.js        # Autocomplete search via Google Sheets
    PhotoUpload.js              # Camera capture & file upload
    SignatureModal.js           # Signature capture
    EditFieldModal.js           # Inline field editing
    DeleteAccountModal.js       # Account deletion confirmation
    DatePickerModal.js          # Date picker
    AddItemModal.js             # Add event/survey/message
    LanguageSwitcher.js         # EN/HE language toggle
    PencilIcon.js               # Edit icon
    home/                       # Home page sub-components
  hooks/
    useAuthRedirect.js          # Auth guard & redirect hook
  lib/
    firebase.js                 # Firebase initialization & exports
    database.js                 # Firestore CRUD operations
    googleSheets.js             # Export soldier data to Google Sheets
    simpleSyncService.js        # Two-way sync (app <-> Google Sheets)
    soldierDataService.js       # Read soldier data from Google Sheets
    questionnaire.js            # Questionnaire structure & helpers
    questionnaire-i18n.js       # Hebrew translations for questionnaire
  i18n.js                       # i18next configuration
public/
  locales/{en,he}/              # Translation JSON files
  House_Logo.jpg                # App logo
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project (Firestore, Auth, Storage enabled)
- Google Sheets with Apps Script (for soldier data sync)

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your values:

```bash
cp .env.local.example .env.local
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_GOOGLE_SHEETS_ID` | Google Sheets ID (export sheet) |
| `NEXT_PUBLIC_SOLDIER_SHEETS_ID` | Google Sheets ID (soldier data) |
| `NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL` | Google Apps Script URL |

3. Start the development server:

```bash
npm run dev
```

The app will be available at http://localhost:3000.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Firebase

- **Project ID**: `bsb-app-e37dc`
- **Console**: https://console.firebase.google.com/project/bsb-app-e37dc
- **Security rules**: See `firestore.rules` and `storage.rules`

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | All user/soldier profiles and data |
| `expenses` | Admin-managed expense records |
| `events` | House events with RSVP tracking |
| `surveys` | Active surveys |
| `messages` | Announcements |
| `refundRequests` | Soldier refund requests |
| `problemReports` | Problem reports from soldiers |
| `fixedProblems` | Archived resolved problems |
| `approvalRequests` | Admin access requests |
| `archivedUsers` | Data for soldiers who have left |

## Google Sheets Integration

The app syncs soldier data bidirectionally with Google Sheets:

- **App to Sheets**: Profile updates push to sheets automatically
- **Sheets to App**: Background sync every 5 minutes pulls sheet changes
- **Export on Leave**: When a soldier leaves, their full data is exported to sheets

The sync is powered by a Google Apps Script deployed as a web app. See `google-apps-script.js` for the script source.

## Mobile (Capacitor)

To build the mobile app:

```bash
npm run build
npx cap sync
npx cap open ios     # or: npx cap open android
```

Configuration is in `capacitor.config.ts`.
