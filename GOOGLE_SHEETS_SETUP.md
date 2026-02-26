# Google Sheets Setup

## Architecture

```
Master Sheet (foundation, read-only)
       │
       │  syncFromMaster() — every 2 hours
       ▼
┌─────────────────────────────────────┐
│  YOUR COPY SPREADSHEET              │
│                                     │
│  Tab 1: master_mirror               │
│    Raw dump of master data.          │
│    Overwritten each sync.            │
│    NOT touched by the app.           │
│                                     │
│  Tab 2: soldiers                    │
│    Only the columns we care about.   │
│    Merged from master_mirror.        │
│    The app reads and writes here.    │
└─────────────────────────────────────┘
       ▲               │
       │               │  getAllSoldiers / searchSoldiers
       │               ▼
   updateSoldierData   Next.js App ←→ Firestore
   (POST, JSON)
```

**Why two tabs?**
- `master_mirror` is a raw backup of whatever the master has — all columns, all data.
- `soldiers` is the curated working sheet with only the columns the app uses (defined in `KNOWN_COLUMNS` in the script and `FIELD_MAP` in the app).
- If the foundation adds or removes columns in the master, the mirror absorbs the change but the soldiers tab is unaffected. No app breakage.

---

## Step-by-step Setup

### Step 1: Create the copy spreadsheet

1. Go to Google Sheets and create a **new spreadsheet**.
2. You do NOT need to create tabs or headers — the script does that on first run.
3. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/THIS_PART/edit`

### Step 2: Get the master sheet info

You need two things from the master/foundation sheet:
- **Spreadsheet ID** — from the URL, same as above.
- **Tab name** — the name of the specific tab that has the soldier data (look at the tab names at the bottom of the sheet).

### Step 3: Deploy the Apps Script

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Delete the default `Code.gs` content.
3. Paste the **entire** contents of `google-apps-script.js` from this repo.
4. Go to **Project Settings** (gear icon) > **Script Properties** and add:

| Property | Value |
|----------|-------|
| `COPY_SPREADSHEET_ID` | The ID of your copy spreadsheet (from Step 1) |
| `MASTER_SPREADSHEET_ID` | The ID of the master/foundation spreadsheet (from Step 2) |
| `MASTER_SHEET_NAME` | The tab name in the master spreadsheet (from Step 2) |

5. Click **Deploy** > **New deployment**.
6. Set type to **Web app**.
7. Execute as: **Me**.
8. Who has access: **Anyone**.
9. Click **Deploy** and copy the URL.

### Step 4: Set up time triggers

In the Apps Script editor, click the **clock icon** (Triggers) on the left and create two triggers:

| Function | Event source | Type | Interval |
|----------|-------------|------|----------|
| `syncFromMaster` | Time-driven | Hours timer | Every 2 hours |
| `cleanupStale` | Time-driven | Day timer | Every 3 days |

### Step 5: Run the first sync

In the Apps Script editor:
1. Select `syncFromMaster` from the function dropdown at the top.
2. Click **Run**.
3. Grant permissions when prompted (it needs access to read the master sheet and write to your copy sheet).
4. Check the **Execution log** — you should see something like:
   ```
   Mirror updated: 45 rows from master
   Soldiers tab initialized with 57 columns
   syncFromMaster complete: added=45, updated=0
   ```
5. Open your copy spreadsheet — you should now see two tabs: `master_mirror` and `soldiers`.

### Step 6: Update your .env.local

```env
# The script URL from Step 3 (the deployed web app URL)
NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

# Archive sheet for departed soldiers (keep your existing one)
NEXT_PUBLIC_GOOGLE_SHEETS_ID=your_archive_sheet_id
```

Note: `NEXT_PUBLIC_SOLDIER_SHEETS_ID` is no longer needed — the script knows which spreadsheet to use from its own properties.

### Step 7: Test

1. Run `npm run dev`
2. Go to the profile-setup page and search for a soldier by name.
3. If results appear, the connection is working.

---

## How the sync works

### Master → Mirror → Soldiers (every 2 hours)

1. Script reads all rows from master sheet.
2. Overwrites the `master_mirror` tab completely (raw dump).
3. For each soldier in the mirror (matched by `מספר זהות`):
   - **New in master?** → Append to `soldiers` tab.
   - **Already in soldiers?** → Update only non-empty values from master (don't overwrite with blanks). Stamp `_lastSeenInMaster`.
4. Columns that exist in master but not in `KNOWN_COLUMNS` stay in the mirror only — the `soldiers` tab is unaffected.

### App → Soldiers tab (real-time)

When the app writes data (admin edits, status changes, etc.):
1. App sends a POST request with the updated fields (Hebrew column names).
2. Script finds the matching row by `מספר זהות`.
3. Updates the changed cells. Stamps `_lastAppUpdate`.

### Soldiers tab → App (every 5 minutes)

The app's client-side scheduler:
1. Fetches all rows from the `soldiers` tab.
2. Matches each row to a Firestore user by `מספר זהות`.
3. Updates Firestore with any changed non-empty values.

### Cleanup (every 3 days)

Rows where `_lastSeenInMaster` is older than 7 days get deleted from the `soldiers` tab. This means: if the foundation removes a soldier from the master, they'll be cleaned up within about a week.

---

## Adding or changing fields

If you need to add a new field:

1. Add the Hebrew column name + English field name to `KNOWN_COLUMNS` in `google-apps-script.js`.
2. Add a matching entry to `FIELD_MAP` in `src/lib/sheetFieldMap.js`.
3. Redeploy the Apps Script.
4. The next `syncFromMaster` will pick up the new column.

If the foundation adds columns to the master that you don't need: do nothing. They'll appear in the mirror but never reach the soldiers tab or the app.

---

## Files

| File | What it does |
|------|-------------|
| `google-apps-script.js` | Apps Script source — paste into Google Apps Script |
| `src/lib/sheetFieldMap.js` | Single field mapping (Hebrew ↔ English) + converters |
| `src/lib/soldierDataService.js` | App reads from sheet (search, list) |
| `src/lib/simpleSyncService.js` | Two-way sync (app ↔ sheet ↔ Firestore) |
| `src/lib/googleSheets.js` | Archive export for departed soldiers |
