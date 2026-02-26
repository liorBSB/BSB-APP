# CLAUDE.md — Standing Rules

## What This App Is

- This is a **residential home for lone soldiers** ("בית לחייל בודד") — welfare and housing, NOT a military base or military operations app. The tone, language, and logic should reflect a home environment.
- This is a **standard Next.js web app deployed on Vercel**. There are NO native wrappers, NO Capacitor, NO mobile builds. It is a web-only application.

## Roles

- **"Live Here" / user** — A soldier who lives in the house (resident).
- **"Work Here" / admin** — Staff who works at the house (house mothers, social workers, etc.). Requires approval from an existing admin.

## Key Data Source

- Soldier master data lives in **Google Sheets**. Soldiers must already be registered in the sheet by staff before they can sign up in the app. During profile-setup, the soldier selects their name from the sheet and their data is auto-filled.
