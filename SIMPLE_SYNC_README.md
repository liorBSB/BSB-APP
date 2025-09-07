# Simple Two-Way Google Sheets Sync

## Overview

A simplified two-way sync system between your app and Google Sheets with minimal complexity and cost.

## How It Works

### 📤 **App → Sheets (Real-time)**
- When soldier data changes in the app, it immediately syncs to Google Sheets
- Only updates if the change is successful
- Runs in background, doesn't slow down the app

### 📥 **Sheets → App (Every 5 minutes)**
- Automatically checks Google Sheets for changes every 5 minutes
- Updates app database with any changes found
- **Simple rule: Google Sheets always wins in conflicts**

## Key Features

✅ **No admin UI** - Runs automatically in background  
✅ **Simple conflict resolution** - Sheets data always takes priority  
✅ **Cost-effective** - Minimal API calls, efficient operation  
✅ **Reliable** - Handles errors gracefully, continues working  

## Setup

### 1. Update Google Apps Script
Copy the updated code from `google-apps-script.js` to your Google Apps Script project and redeploy.

### 2. Environment Variables
Make sure these are set in your `.env.local`:
```env
NEXT_PUBLIC_SOLDIER_SHEETS_ID=your_spreadsheet_id
NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL=your_script_url
```

### 3. That's it!
The sync starts automatically when admins load the admin dashboard.

## Behavior

### When data changes in app:
1. App saves to database ✅
2. App immediately syncs to Google Sheets ✅
3. Sheets get updated with "Last Updated From App" timestamp ✅

### When data changes in sheets:
1. Every 5 minutes, app checks sheets for changes ✅
2. If changes found, app updates database ✅
3. **Sheets data overwrites app data** (no conflicts) ✅

### Cost Optimization:
- Only syncs when there are actual changes
- Uses efficient batch operations
- Minimal API calls (1 per soldier update + 1 every 5 minutes)
- No complex UI or management overhead

## Monitoring

Check browser console for sync messages:
- `✅ Synced to sheets: [Soldier Name]` - Successful app→sheets sync
- `📥 Updated from sheets: [Soldier Name]` - Successful sheets→app sync
- `🔄 Running scheduled sync from sheets...` - 5-minute sync starting
- `⚠️ Failed to sync...` - Any errors (non-critical)

## Files

- `src/lib/simpleSyncService.js` - Main sync logic
- `google-apps-script.js` - Google Apps Script (updated)
- Auto-starts from admin home page

---

**Simple, effective, cost-efficient! 🎯**
