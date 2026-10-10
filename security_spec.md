# Firestore Zero-Trust Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth

1. **Global Default Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity & Ownership**: All standard read and write operations require `request.auth != null` and `request.auth.token.email_verified == true`. Every document across `managedUsers`, `projects`, `tasks`, `activities`, and `systemSettings` is strictly bound to `ownerId == request.auth.uid` (or `isAdmin()`), preventing cross-tenant access and PII leaks.
3. **PII Isolation (`/users/{userId}`)**: User account documents containing email and credential audit hashes are strictly isolated: `get` and `list` are only permitted when `request.auth.uid == userId` or `isAdmin()`.
4. **Relational Integrity (`/tasks/{taskId}`)**: A task cannot be created unless its parent `/projects/$(incoming().projectId)` exists (`exists(...)`) and belongs to the authenticated owner (`get(...).data.ownerId == request.auth.uid`).
5. **Temporal Integrity**: `createdAt` and `updatedAt` must match `request.time` on creation. On update, `createdAt` and `ownerId` are immutable, and `updatedAt` must match `request.time`.
6. **Terminal State Locking**: Once a `managedUser`, `project`, or `task` reaches terminal status `'ARCHIVED'`, no further standard user updates are permitted (only `isAdmin()` can override).
7. **Strict Key & Volumetric Boundaries**: Every write validates `hasAll` and `hasOnly` keys and enforces exact `minLength`/`maxLength` and `^[a-zA-Z0-9_\-]+$` regex constraints from `firebase-blueprint.json`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Shadow Field Injection (`projects`)**:
   `{ "id": "proj_1", "ownerId": "uid_1", ..., "isSuperProject": true }` -> Rejected by `data.keys().hasOnly(...)`.
2. **Payload 2 — Unverified Email Spoofing (`admins` / `projects`)**:
   Auth token `{ email: "singhsivam0001@gmail.com", email_verified: false }` -> Rejected by `isVerifiedUser()`.
3. **Payload 3 — Cross-Tenant PII Scraping (`users/{otherUid}`)**:
   Authenticated user `uid_attacker` calls `get(/users/uid_victim)` -> Rejected by `request.auth.uid == userId || isAdmin()`.
4. **Payload 4 — Unscoped List Query (`tasks`)**:
   Authenticated user runs `getDocs(collection(db, 'tasks'))` without `where('ownerId', '==', uid)` -> Rejected by `resource.data.ownerId == request.auth.uid || isAdmin()`.
5. **Payload 5 — Orphaned Task Creation (`tasks`)**:
   `{ "id": "task_99", "projectId": "non_existent_project", ... }` -> Rejected by `exists(/databases/$(database)/documents/projects/$(incoming().projectId))`.
6. **Payload 6 — Identity Spoofing on Create (`projects`)**:
   Authenticated `uid_1` sends `{ "ownerId": "uid_2", ... }` -> Rejected by `data.ownerId == request.auth.uid`.
7. **Payload 7 — Immutable Field Mutation (`projects` update)**:
   Updating `ownerId` or `createdAt` on an existing project -> Rejected by `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`.
8. **Payload 8 — Terminal State Bypass (`tasks` update)**:
   Updating a task whose `existing().status == 'ARCHIVED'` as a non-admin -> Rejected by `existing().status != 'ARCHIVED' || isAdmin()`.
9. **Payload 9 — Path ID Poisoning (`projects/{maliciousId}`)**:
   Creating `/projects/../../bad$id` -> Rejected by `isValidId(projectId)` (`^[a-zA-Z0-9_\-]+$`).
10. **Payload 10 — Denial-of-Wallet Oversized String (`tasks`)**:
    Sending a 50,000-character `description` -> Rejected by `data.description.size() <= 1000`.
11. **Payload 11 — Out-of-Bounds Progress Value (`tasks`)**:
    Sending `progress: 250` or `progress: -10` -> Rejected by `data.progress >= 0 && data.progress <= 100`.
12. **Payload 12 — Client Timestamp Forgery (`activities`)**:
    Sending a backdated `createdAt` timestamp instead of `serverTimestamp()` (`request.time`) -> Rejected by `incoming().createdAt == request.time`.

---

## 3. Red Team Conflict Report

- **Users (`/users/{userId}`)**:
  - Identity Spoofing: Blocked (`data.uid == request.auth.uid && userId == request.auth.uid`).
  - PII Blanket Test: Passed (`get` & `list` restricted to `request.auth.uid == userId || isAdmin()`).
  - Value Poisoning: Blocked (`isValidUserProfile(incoming())` wraps `allow update`).
- **ManagedUsers (`/managedUsers/{memberId}`)**:
  - Shadow Update Test: Blocked (`affectedKeys().hasOnly(...)` + `isValidManagedUser(incoming())`).
  - Terminal State Locking: Enforced (`existing().status != 'ARCHIVED' || isAdmin()`).
- **Projects (`/projects/{projectId}`)**:
  - Identity Spoofing: Blocked (`data.ownerId == request.auth.uid`).
  - Resource Poisoning: Blocked (`isValidId(projectId)` and `.size()` limits on all strings).
- **Tasks (`/tasks/{taskId}`)**:
  - Relational Sync (Master Gate): Enforced (`get(/databases/$(database)/documents/projects/$(incoming().projectId)).data.ownerId == request.auth.uid`).
  - Tiered Action Updates: Split into status/progress update vs full task edit actions.
- **Activities (`/activities/{activityId}`) & SystemSettings (`/systemSettings/{settingId}`)**:
  - Query Trust Test: Passed (`resource.data.ownerId == request.auth.uid || isAdmin()`).
