# One-time Firebase Launch Reset Runbook

This runbook resets launch data while preserving one admin account:
- Preserved admin email: `bsb.happ1@gmail.com`
- Firestore: delete documents only
- Storage: delete all files
- Auth: delete all users except preserved admin

## Script location

`scripts/one-time/wipe-firebase-preserve-admin.js`

## Required environment variables

The script uses these variables:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Safety gates

The script refuses to run unless all gates pass:
- `--admin-email` is exactly `bsb.happ1@gmail.com`
- `--expected-project-id` matches runtime project id
- `--confirm` equals `DELETE_PRODUCTION_NOW`
- marker file `.one-time-firebase-reset.done` does not already exist

## Recommended preflight backup

Before running, create a backup/export of Firestore and Storage in GCP.

## Run command

From project root:

```bash
node scripts/one-time/wipe-firebase-preserve-admin.js \
  --admin-email bsb.happ1@gmail.com \
  --expected-project-id "<YOUR_FIREBASE_PROJECT_ID>" \
  --confirm DELETE_PRODUCTION_NOW
```

## What the script does

1. Verifies all safety gates.
2. Resolves admin user by email and snapshots `users/{adminUid}`.
3. Deletes all Firestore documents recursively (collections are empty/recreated automatically by future writes).
4. Restores `users/{adminUid}` with enforced admin role and email.
5. Deletes all files from default Firebase Storage bucket.
6. Deletes all Firebase Auth users except admin UID.
7. Verifies final state and writes `.one-time-firebase-reset.done`.

## Post-run checks

- Confirm admin can still sign in.
- Confirm no other users can sign in.
- Confirm data collections are empty except `users/{adminUid}`.

## Final one-time step

Delete the script immediately after successful run:

```bash
rm scripts/one-time/wipe-firebase-preserve-admin.js
```
