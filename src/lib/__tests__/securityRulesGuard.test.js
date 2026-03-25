import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const firestoreRulesPath = path.join(repoRoot, 'firestore.rules');
const storageRulesPath = path.join(repoRoot, 'storage.rules');

describe('security rules guardrails', () => {
  it('firestore rules keep admin gate for expenses and archives', () => {
    const content = fs.readFileSync(firestoreRulesPath, 'utf8');
    expect(content).toContain("match /expenses/{expenseId}");
    expect(content).toContain("allow create: if isSignedIn() && isAdmin(request.auth.uid);");
    expect(content).toContain("match /archivedSoldiers/{archivedId}");
    expect(content).toContain("allow read, write: if isSignedIn() && isAdmin(request.auth.uid);");
  });

  it('firestore rules protect profile ownership updates', () => {
    const content = fs.readFileSync(firestoreRulesPath, 'utf8');
    expect(content).toContain("match /users/{userId}");
    expect(content).toContain("ownerKeepsSafeUserType()");
    expect(content).toContain("ownerKeepsSafeRoleChoice()");
    expect(content).toContain("'approvedBy'");
  });

  it('storage rules enforce image-only and size limit', () => {
    const content = fs.readFileSync(storageRulesPath, 'utf8');
    expect(content).toContain("request.resource.size < 10 * 1024 * 1024");
    expect(content).toContain("request.resource.contentType.matches('image/.*')");
    expect(content).toContain("match /reports/{ownerUid}/{fileId}");
    expect(content).toContain("match /expenses/{userId}/{fileName}");
  });
});
