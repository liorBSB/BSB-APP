# Two-Way Google Sheets Sync System

## Overview

This system provides seamless two-way synchronization between your app's Firestore database and Google Sheets. When soldier data is updated in either the app or the Google Sheet, the changes are automatically synchronized to keep both systems in sync.

## Features

### ✅ **Bidirectional Sync**
- **App → Sheets**: Real-time updates when data changes in the app
- **Sheets → App**: Periodic sync from Google Sheets to app database
- **Conflict Resolution**: Intelligent handling of simultaneous changes

### ✅ **Smart Conflict Detection**
- Timestamp-based conflict detection
- Field-level comparison for precise conflict identification
- Manual resolution interface for complex conflicts

### ✅ **Admin Management Interface**
- Real-time sync status monitoring
- Manual sync triggers
- Configurable sync intervals
- Individual soldier sync status tracking

### ✅ **Robust Error Handling**
- Retry logic for failed syncs
- Comprehensive error logging
- Graceful degradation when Google Sheets is unavailable

## Architecture

```
┌─────────────────┐    Real-time     ┌──────────────────┐
│   App Database  │ ────────────────→ │  Google Sheets   │
│   (Firestore)   │                   │                  │
│                 │ ←──── Periodic ── │                  │
└─────────────────┘    (5 minutes)    └──────────────────┘
        │                                       │
        │                                       │
        ▼                                       ▼
┌─────────────────┐                   ┌──────────────────┐
│  Sync Service   │                   │ Google Apps      │
│  - syncToSheets │                   │ Script           │
│  - syncFromSheets│                   │ - updateSoldier  │
│  - conflicts    │                   │ - getSoldiers    │
└─────────────────┘                   └──────────────────┘
```

## Components

### 1. **Google Apps Script** (`google-apps-script.js`)
Enhanced with new functions:
- `updateSoldierData`: Updates soldier data in sheets
- `getSoldiersWithTimestamp`: Returns soldiers with timestamp info
- Field mapping between app and sheet columns
- Automatic timestamp tracking

### 2. **Sync Service** (`src/lib/syncService.js`)
Core synchronization logic:
- `syncToSheets()`: Push app changes to sheets
- `syncFromSheets()`: Pull sheet changes to app
- `getSyncStatus()`: Get sync status for all soldiers
- `manualSync()`: Trigger manual sync operations

### 3. **Sync Scheduler** (`src/lib/syncScheduler.js`)
Background sync management:
- Configurable sync intervals (1-60 minutes)
- Automatic startup and shutdown
- Sync statistics tracking
- Event-driven UI updates

### 4. **Database Triggers** (`src/lib/database.js`)
Automatic sync triggers:
- `updateUserStatus()`: Enhanced with sheet sync
- `updateProfileAnswer()`: Enhanced with sheet sync
- `updateUserData()`: New function with built-in sync

### 5. **Admin UI Components**
- `SyncManagement.js`: Main sync management interface
- `ConflictResolution.js`: Conflict resolution modal
- `SyncInitializer.js`: Background sync startup

## Setup Instructions

### Step 1: Update Google Apps Script

1. **Open your Google Apps Script project**
2. **Replace the existing code** with the enhanced version from `google-apps-script.js`
3. **Update configuration**:
   ```javascript
   const spreadsheetId = 'YOUR_SPREADSHEET_ID';
   const sheetName = 'YOUR_SHEET_NAME';
   ```
4. **Deploy as Web App** with "Anyone" access permissions
5. **Copy the deployment URL**

### Step 2: Environment Variables

Update your `.env.local` file:
```env
# Existing variables
NEXT_PUBLIC_SOLDIER_SHEETS_ID=your_spreadsheet_id
NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL=your_script_deployment_url

# Optional: Sync configuration
NEXT_PUBLIC_SYNC_INTERVAL=300000  # 5 minutes in milliseconds
```

### Step 3: Sheet Structure

Ensure your Google Sheet has these columns with a "Last Updated From App" column for tracking:

| Column Name (Hebrew) | App Field | Type |
|---------------------|-----------|------|
| שם מלא | fullName | Text |
| שם פרטי | firstName | Text |
| שם משפחה | lastName | Text |
| חדר | roomNumber | Text |
| מספר זהות | idNumber | Text |
| מספר סלולרי | phone | Text |
| כתובת מייל חייל | email | Email |
| ... (all other fields) | ... | ... |
| Last Updated From App | (system) | Timestamp |

### Step 4: Verification

1. **Check Admin Dashboard**: Go to Admin Home → Google Sheets Sync
2. **Verify Sync Status**: Should show "Running" with configured interval
3. **Test Manual Sync**: Click "Sync FROM Sheets" to test
4. **Monitor Logs**: Check browser console for sync activity

## Usage

### For Admins

#### **Sync Management Dashboard**
Access through: Admin Home → Google Sheets Sync section

**Features:**
- **Real-time Status**: Shows if sync is running, last sync time, success/failure stats
- **Manual Controls**: Force sync in either direction
- **Interval Configuration**: Adjust automatic sync frequency (1-60 minutes)
- **Individual Status**: See sync status for each soldier

#### **Manual Sync Operations**
- **Sync FROM Sheets**: Pull latest changes from Google Sheets
- **Full Sync (Both Ways)**: Complete bidirectional synchronization
- **Start/Stop Scheduler**: Control automatic background sync

#### **Conflict Resolution**
When conflicts are detected:
1. **Automatic Detection**: System identifies when both app and sheet have changes
2. **Resolution Interface**: Modal appears with conflict details
3. **Resolution Options**:
   - Use App Data (recommended for recent changes)
   - Use Sheet Data
   - Field-by-field selection for complex conflicts

### For Regular Users

**Transparent Operation**: Users don't need to do anything special. Their data changes are automatically synchronized to Google Sheets in real-time.

## Sync Behavior

### **App → Sheets (Real-time)**
- Triggers on any soldier data update
- Immediate sync attempt (non-blocking)
- Updates timestamp in "Last Updated From App" column
- Logs success/failure for admin monitoring

### **Sheets → App (Periodic)**
- Runs every 5 minutes by default (configurable)
- Compares timestamps to detect changes
- Only updates changed fields
- Handles conflicts intelligently

### **Conflict Resolution**
1. **Detection**: Compares last update timestamps
2. **Types**:
   - **No Conflict**: Sheet updated after app → Apply sheet changes
   - **Simple Conflict**: App updated after sheet → Keep app data (default)
   - **Complex Conflict**: Simultaneous changes → Manual resolution required

## Monitoring and Troubleshooting

### **Sync Status Indicators**

| Status | Meaning | Action |
|--------|---------|---------|
| 🟢 Running | Sync active, working normally | None needed |
| 🟡 Stopped | Sync paused | Click "Start Auto Sync" |
| 🔴 Error | Last sync failed | Check logs, retry |

### **Common Issues**

#### **"Sync scheduler not started: Missing Google Sheets configuration"**
- **Cause**: Environment variables not set
- **Solution**: Check `.env.local` file has correct values

#### **"Failed to sync to sheets: HTTP 403"**
- **Cause**: Google Apps Script permissions issue
- **Solution**: Redeploy script with "Anyone" access

#### **"Soldier not found for update"**
- **Cause**: Soldier name/ID mismatch between app and sheet
- **Solution**: Verify soldier exists in both systems with matching identifiers

#### **Conflicts not resolving**
- **Cause**: Field mapping issues or data format differences
- **Solution**: Check field mappings in Google Apps Script

### **Debug Mode**
Enable detailed logging by opening browser console:
```javascript
// Enable detailed sync logging
localStorage.setItem('syncDebug', 'true');

// View sync scheduler stats
console.log(syncScheduler.getStats());

// Force sync with logging
syncScheduler.forceSync().then(console.log);
```

## Performance Considerations

### **Sync Frequency**
- **Default**: 5 minutes (good balance of freshness vs. performance)
- **High-activity environments**: Consider 2-3 minutes
- **Low-activity environments**: Can increase to 10-15 minutes

### **Large Datasets**
- System handles hundreds of soldiers efficiently
- Google Sheets API has rate limits (100 requests/100 seconds/user)
- Batch operations are used to minimize API calls

### **Network Resilience**
- Failed syncs are retried automatically
- Offline changes sync when connection restored
- Graceful degradation when Google Sheets unavailable

## Security

### **Data Protection**
- All syncs use HTTPS
- No sensitive data stored in logs
- Timestamps track all changes for audit

### **Access Control**
- Only authenticated admins can manage sync
- Google Apps Script runs with sheet owner permissions
- Individual users can only sync their own data

## Future Enhancements

### **Planned Features**
- **Real-time Webhooks**: Instant sheet-to-app sync
- **Selective Sync**: Choose which fields to sync
- **Batch Operations**: Bulk soldier imports/exports
- **Sync History**: Detailed change logs
- **Mobile Notifications**: Sync status alerts

### **Integration Possibilities**
- **Multiple Sheets**: Support for different sheet types
- **Excel Integration**: Microsoft Excel support
- **CSV Export**: Automated report generation
- **API Endpoints**: External system integration

## Support

### **Getting Help**
1. Check this documentation first
2. Review browser console for error messages
3. Test with manual sync to isolate issues
4. Check Google Apps Script execution logs

### **Reporting Issues**
When reporting sync issues, include:
- Sync status from admin dashboard
- Browser console logs
- Specific soldier data that's not syncing
- Timestamp of when issue occurred

---

## Quick Reference

### **Key Files**
- `google-apps-script.js` - Google Apps Script code
- `src/lib/syncService.js` - Core sync logic
- `src/lib/syncScheduler.js` - Background scheduler
- `src/components/SyncManagement.js` - Admin UI
- `src/components/ConflictResolution.js` - Conflict handling

### **Environment Variables**
```env
NEXT_PUBLIC_SOLDIER_SHEETS_ID=spreadsheet_id
NEXT_PUBLIC_SOLDIER_SHEETS_SCRIPT_URL=script_url
```

### **Admin Access**
Admin Home → Google Sheets Sync section

### **Default Settings**
- Sync interval: 5 minutes
- Conflict resolution: Last-write-wins
- Auto-start: Enabled
- Retry attempts: 3

---

*Two-way sync system successfully implemented! 🎉*
