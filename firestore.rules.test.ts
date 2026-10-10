/**
 * Firestore Security Rules Specification Test Suite (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads defined in security_spec.md return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Project Create',
    collection: 'projects',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      id: 'proj_1',
      ownerId: 'uid_1',
      title: 'Valid Title',
      description: 'Valid Description',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      managerId: 'mgr_1',
      managerName: 'Alex Rivera',
      isSuperProject: true, // Ghost field
    },
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing Attack',
    collection: 'projects',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      authEmail: 'singhsivam0001@gmail.com',
      emailVerified: false,
    },
  },
  {
    id: 3,
    name: 'Cross-Tenant PII Scraping on /users/{otherUid}',
    collection: 'users',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unscoped List Query on /tasks without ownerId filter',
    collection: 'tasks',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned Task Creation with non-existent projectId',
    collection: 'tasks',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      id: 'task_99',
      projectId: 'missing_project_999',
    },
  },
  {
    id: 6,
    name: 'Identity Spoofing on Project Create (ownerId != request.auth.uid)',
    collection: 'projects',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      ownerId: 'spoofed_uid_999',
    },
  },
  {
    id: 7,
    name: 'Immutable Field Mutation (changing createdAt or ownerId)',
    collection: 'projects',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      ownerId: 'new_owner_uid',
    },
  },
  {
    id: 8,
    name: 'Terminal State Bypass (updating an ARCHIVED task as non-admin)',
    collection: 'tasks',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      existingStatus: 'ARCHIVED',
      status: 'IN_PROGRESS',
    },
  },
  {
    id: 9,
    name: 'Path ID Poisoning with invalid characters',
    collection: 'projects',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      id: 'bad$id/../../etc',
    },
  },
  {
    id: 10,
    name: 'Denial-of-Wallet Oversized Description String',
    collection: 'tasks',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      descriptionLength: 50000,
    },
  },
  {
    id: 11,
    name: 'Out-of-Bounds Task Progress Percentage (progress: 250)',
    collection: 'tasks',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      progress: 250,
    },
  },
  {
    id: 12,
    name: 'Client Timestamp Forgery (createdAt != request.time)',
    collection: 'activities',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
];
