# Implementation Plan: StandVault

## Overview

Implement StandVault as a layered web application: a TypeScript REST API server backed by PostgreSQL, with two SPAs (Admin Panel and Buyer Portal). The implementation follows the append-only ledger model, role-based access control, and the correctness properties defined in the design document.

## Tasks

- [x] 1. Project scaffolding and database schema 
  - Initialise monorepo with `api/`, `admin/`, and `portal/` packages
  - Create all PostgreSQL migration files for every table in the data model (users, projects, project_configs, project_admin_assignments, stands, buyers, instalment_schedules, instalment_periods, ledger_entries, pop_submissions, additional_charge_batches, penalty_calculations, reconciliation_periods, documents, document_versions, audit_log, milestones, notifications, migration_imports)
  - Add DB-level triggers to enforce append-only on `ledger_entries` and `audit_log` (no UPDATE, no DELETE)
  - Add row-level security policies for buyer isolation and project admin isolation
  - Set up TypeScript API project with Express (or Fastify), Prisma (or Drizzle), and `fast-check` for property tests
  - _Requirements: 2.1, 2.2, 9.1, 9.4_

- [x] 2. Authentication service
  - [x] 2.1 Implement login endpoint `POST /auth/login` with bcrypt verification (min cost 12), session token issuance, and generic error response
    - _Requirements: 1.1, 1.2_
  - [x]* 2.2 Write property test for login correctness
    - **Property 1: Valid credentials authenticate; invalid credentials are rejected**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 2.3 Implement `POST /auth/logout`, `GET /auth/me`, and session middleware
    - _Requirements: 1.1_
  - [x] 2.4 Implement password reset flow: `POST /auth/forgot-password` and `POST /auth/reset-password` with single-use, hashed, 24-hour-expiry tokens
    - _Requirements: 1.3, 1.4, 1.5_
  - [x]* 2.5 Write property test for password reset token single-use
    - **Property 2: Password reset link is single-use**
    - **Validates: Requirements 1.4, 1.5**
  - [x] 2.6 Implement invitation flow: `POST /auth/set-password` for both admin and buyer invitations with single-use token enforcement
    - _Requirements: 1.6, 1.7_
  - [x]* 2.7 Write property test for invitation token single-use
    - **Property 3: Invitation token is single-use**
    - **Validates: Requirements 1.6, 1.7**

- [x] 3. Role-based access control middleware
  - [x] 3.1 Implement RBAC middleware that enforces buyer data isolation, project admin project isolation, and system admin full access on every protected route
    - _Requirements: 2.1, 2.2, 2.3_
  - [x]* 3.2 Write property test for buyer data isolation
    - **Property 4: Buyer data isolation**
    - **Validates: Requirements 2.1**
  - [x]* 3.3 Write property test for project administrator project isolation
    - **Property 5: Project administrator project isolation**
    - **Validates: Requirements 2.2**
  - [x]* 3.4 Write property test for buyer cannot mutate financial records
    - **Property 6: Buyer cannot mutate financial records**
    - **Validates: Requirements 2.4**
  - [x] 3.5 Implement audit log write on every 403 response
    - _Requirements: 2.6_
  - [x]* 3.6 Write property test for unauthorised access is logged
    - **Property 8: Unauthorised access is logged**
    - **Validates: Requirements 2.6**

- [x] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 5. Project and stand management
  - [x] 5.1 Implement project CRUD endpoints (`POST /projects`, `GET /projects/:id`, `PATCH /projects/:id/config`) with project config snapshot logic
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x]* 5.2 Write property test for project config snapshot isolation
    - **Property 9: Project config snapshot isolation**
    - **Validates: Requirements 3.3, 3.4**
  - [x] 5.3 Implement `POST /projects/:id/admins` for assigning project administrators
    - _Requirements: 3.5_
  - [x] 5.4 Implement stand endpoints (`GET /projects/:id/stands`, `POST /projects/:id/stands`, `PATCH /projects/:id/stands/:stand_id`) with status enum enforcement
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x]* 5.5 Write property test for stand status is always a valid enum value
    - **Property 10: Stand status is always a valid enum value**
    - **Validates: Requirements 4.2**

- [x] 6. Buyer profile management
  - [x] 6.1 Implement `POST /projects/:id/buyers` — create buyer, snapshot project config, allocate stand (set status to `allocated`), and trigger invitation email
    - _Requirements: 5.1, 4.8, 1.7_
  - [x]* 6.2 Write property test for stand allocation sets status to Allocated
    - **Property 11: Stand allocation sets status to Allocated**
    - **Validates: Requirements 4.8**
  - [x] 6.3 Implement `GET /projects/:id/buyers` with name, stand number, payment status, and arrears status filters
    - _Requirements: 5.3_
  - [x]* 6.4 Write property test for buyer list filter correctness
    - **Property 13: Buyer list filter correctness**
    - **Validates: Requirements 5.3**
  - [x] 6.5 Implement `GET /buyers/:buyer_id` and `PATCH /buyers/:buyer_id/details` (personal details only, no ledger mutation)
    - _Requirements: 5.4_
  - [x]* 6.6 Write property test for personal detail update does not alter ledger
    - **Property 14: Personal detail update does not alter ledger**
    - **Validates: Requirements 5.4**

- [x] 7. Instalment schedule generation
  - [x] 7.1 Implement schedule generation service: given buyer contract terms and project config, produce `instalment_schedules` + `instalment_periods` rows; call this from buyer creation
    - _Requirements: 5.2, 6.1_
  - [x]* 7.2 Write property test for buyer creation generates an instalment schedule
    - **Property 12: Buyer creation generates an instalment schedule**
    - **Validates: Requirements 5.2, 6.1**
  - [x] 7.3 Implement `GET /buyers/:buyer_id/schedule` and `GET /buyers/:buyer_id/balance` endpoints; balance status computed from ledger sum vs schedule
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  - [x]* 7.4 Write property test for balance status reflects ledger state
    - **Property 15: Balance status reflects ledger state**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

- [x] 8. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 9. Ledger service and payment recording
  - [x] 9.1 Implement `POST /buyers/:buyer_id/ledger/payments` — append-only ledger entry with full metadata (creator, timestamp, type, amount)
    - _Requirements: 7.2, 7.3, 9.1, 9.3_
  - [x]* 9.2 Write property test for payment recording creates a ledger entry with full metadata
    - **Property 17: Payment recording creates a ledger entry with full metadata**
    - **Validates: Requirements 7.2, 7.3, 9.3**
  - [x] 9.3 Implement `GET /buyers/:buyer_id/ledger` and `GET /buyers/:buyer_id/ledger/balance`; balance always computed from ledger sum, never from stored field
    - _Requirements: 7.4, 9.2_
  - [x]* 9.4 Write property test for balance calculation invariant
    - **Property 18: Balance calculation invariant**
    - **Validates: Requirements 7.4, 9.2**
  - [x] 9.5 Implement `POST /buyers/:buyer_id/ledger/reversals` — require non-empty reason, create negating entry, log administrator identity
    - _Requirements: 7.6_
  - [x]* 9.6 Write property test for reversal creates a negating ledger entry
    - **Property 19: Reversal creates a negating ledger entry**
    - **Validates: Requirements 7.6**
  - [x] 9.7 Enforce verified payment deletion rejection at API layer (return 409) and verify DB trigger blocks it
    - _Requirements: 7.5, 2.5_
  - [x]* 9.8 Write property test for verified payment deletion is rejected for all roles
    - **Property 7: Verified payment deletion is rejected for all roles**
    - **Validates: Requirements 2.5, 9.1**
  - [x]* 9.9 Write property test for ledger entries are immutable (attempt direct DB mutation)
    - **Property 23: Ledger entries are immutable**
    - **Validates: Requirements 9.1**

- [x] 10. Proof of Payment (PoP) service
  - [x] 10.1 Implement `POST /buyers/:buyer_id/pop` — store file in object store, create `pop_submissions` record with `status = pending`, add to admin queue
    - _Requirements: 8.1, 8.2_
  - [x]* 10.2 Write property test for PoP submission enters queue as Pending
    - **Property 20: PoP submission enters queue as Pending**
    - **Validates: Requirements 8.2**
  - [x] 10.3 Implement `GET /projects/:id/pop/queue`, `POST /pop/:submission_id/approve` (creates verified ledger entry, updates submission status), and `POST /pop/:submission_id/reject` (stores reason, enqueues buyer notification)
    - _Requirements: 8.3, 8.4, 8.5_
  - [x]* 10.4 Write property test for PoP approval creates a verified ledger entry
    - **Property 21: PoP approval creates a verified ledger entry**
    - **Validates: Requirements 8.3, 8.4**
  - [x]* 10.5 Write property test for PoP rejection notifies buyer with reason
    - **Property 22: PoP rejection notifies buyer with reason**
    - **Validates: Requirements 8.5**

- [x] 11. Audit log service
  - [x] 11.1 Implement audit log write helper called by every service on every state-changing action; enforce no-UPDATE/no-DELETE via DB trigger
    - _Requirements: 2.6_
  - [x]* 11.2 Write property test for audit log captures all state changes
    - **Property 24: Audit log captures all state changes**
    - **Validates: Requirements 2.6**
  - [x]* 11.3 Write property test for audit log entries are immutable
    - **Property 25: Audit log entries are immutable**
    - **Validates: Requirements 2.6**
  - [x] 11.4 Implement `GET /projects/:id/audit-logs` endpoint with filters

- [x] 12. Checkpoint — Ensure all tests pass, ask the user if they are ready to proceed with Admin SPA.

- [x] 13. Additional charges service
  - [x] 13.1 Implement `POST /buyers/:buyer_id/ledger/charges` for single-buyer additional charge; create ledger entry with `entry_type = charge`, enqueue buyer notification
    - _Requirements: 10.1, 10.3, 10.4, 10.5_
  - [x] 13.2 Implement bulk additional charge endpoint that applies the same charge to all buyers in a project in a single batch
    - _Requirements: 10.2_
  - [x]* 13.3 Write property test for bulk additional charge applies to all buyers in project
    - **Property 26: Bulk additional charge applies to all buyers in project**
    - **Validates: Requirements 10.2, 10.3**
  - [x]* 13.4 Write property test for additional charge notifies all affected buyers
    - **Property 27: Additional charge notifies all affected buyers**
    - **Validates: Requirements 10.5**
  - [x] 13.5 Implement balance breakdown endpoint returning `original_contract_value`, `total_additional_charges`, `total_paid`, `remaining_balance`
    - _Requirements: 10.6_
  - [x]* 13.6 Write property test for balance breakdown contains all four components
    - **Property 28: Balance breakdown contains all four components**
    - **Validates: Requirements 10.6**
  - [x] 13.7 Enforce that viewed additional charges can only be removed via reversal (reject direct deletion with 409)
    - _Requirements: 9.6_
  - [x]* 13.8 Write property test for viewed additional charge requires reversal for removal
    - **Property 29: Viewed additional charge requires reversal for removal**
    - **Validates: Requirements 9.6**
  - [x] 13.9 Trigger instalment schedule recalculation on additional charge; new version has `status = pending_approval` until admin approves
    - _Requirements: 6.6, 6.7_
  - [x]* 13.10 Write property test for additional charge triggers schedule recalculation with admin gate
    - **Property 16: Additional charge triggers schedule recalculation with admin gate**
    - **Validates: Requirements 6.6, 6.7**

- [x] 14. Penalty calculation service
  - [x] 14.1 Implement penalty calculation logic respecting grace period; create `penalty_calculations` record with `status = pending_review`
    - _Requirements: 11.1, 11.2, 11.3_
  - [x]* 14.2 Write property test for penalty calculation respects grace period
    - **Property 29: Penalty calculation respects grace period**
    - **Validates: Requirements 11.1**
  - [x] 14.3 Implement penalty approval endpoint (creates ledger entry) and rejection/waiver endpoint (logs identity, timestamp, reason)
    - _Requirements: 11.4, 11.5_
  - [x]* 14.4 Write property test for penalty rejection is fully logged
    - **Property 31: Penalty rejection is fully logged**
    - **Validates: Requirements 11.5**

- [x] 15. Reconciliation period service
  - [x] 15.1 Implement reconciliation period CRUD; enforce that close is rejected when pending PoP submissions exist
    - _Requirements: 12.1, 12.5_
  - [x]* 15.2 Write property test for reconciliation period close requires no pending PoP
    - **Property 32: Reconciliation period close requires no pending PoP**
    - **Validates: Requirements 12.5**
  - [x] 15.3 Implement backdated payment detection: if `effective_date` falls in a closed period, set `requires_approval = true` and include warning in response
    - _Requirements: 12.4_
  - [x]* 15.4 Write property test for backdated payment requires approval
    - **Property 33: Backdated payment requires approval**
    - **Validates: Requirements 12.4**

- [ ] 16. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 17. Document management service
  - [x] 17.1 Implement document upload (`POST /buyers/:buyer_id/documents`), list (`GET /buyers/:buyer_id/documents`), and version history (`GET /documents/:doc_id/versions`) endpoints; preserve all previous versions
    - _Requirements: 13.3, 13.4_
  - [x]* 17.2 Write property test for document versioning preserves all versions
    - **Property 34: Document versioning preserves all versions**
    - **Validates: Requirements 13.4**
  - [x] 17.3 Implement milestone tracking (`POST /buyers/:buyer_id/milestones`); trigger automatically if specific document typed `transfer_deed` is uploaded
    - _Requirements: 13.5_
  - [x]* 17.4 Write property test for transfer deed upload triggers milestone
    - **Property 35: Transfer deed upload triggers milestone**
    - **Validates: Requirements 13.5**
  - [x] 17.5 Implement Balance Confirmation Letter generation endpoint (`GET /buyers/:buyer_id/documents/balance-confirmation`)
    - _Requirements: 13.5_
  - [x] 17.6 Enqueue buyer notification on every document upload
    - _Requirements: 14.2_
  - [x]* 17.7 Write property test for document upload notifies buyer
    - **Property 36: Document upload notifies buyer**
    - **Validates: Requirements 14.2**

- [x] 18. Document request service
  - [x] 18.1 Implement `POST /documents/:doc_id/request` to create a document request; expose it as a pending task in the buyer portal
    - _Requirements: 14.3_
  - [x]* 18.2 Write property test for document request appears as pending task in buyer portal
    - **Property 37: Document request appears as pending task in buyer portal**
    - **Validates: Requirements 14.3**
  - [x] 18.3 Implement outstanding document requests list visible to project administrator
    - _Requirements: 14.4_
  - [x]* 18.4 Write property test for outstanding document requests are visible to administrator
    - **Property 38: Outstanding document requests are visible to administrator**
    - **Validates: Requirements 14.4**

- [x] 19. Notification service
  - [x] 19.1 Implement notification enqueue helper and `GET /notifications/mine` + `PATCH /notifications/:id/read` endpoints; every notification creates both an in-app record and an email delivery task
    - _Requirements: 17.4_
  - [x]* 19.2 Write property test for all notifications are delivered in-app and by email
    - **Property 49: All notifications are delivered in-app and by email**
    - **Validates: Requirements 17.4**
  - [x] 19.3 Wire all system events to notification enqueue: payment verified/rejected, additional charge added, document uploaded/requested, payment reminder, milestone reached, announcement posted (buyer events); PoP submitted, document uploaded by buyer, support query raised, 100% milestone (admin events)
    - _Requirements: 17.1, 17.2_
  - [x]* 19.4 Write property test for system events trigger buyer notifications
    - **Property 47: System events trigger buyer notifications**
    - **Validates: Requirements 17.1**
  - [x]* 19.5 Write property test for system events trigger admin notifications
    - **Property 48: System events trigger admin notifications**
    - **Validates: Requirements 17.2**
  - [x] 19.6 Implement announcement broadcast endpoint (`POST /projects/:id/announcements`) targeting all or a subset of buyers
    - _Requirements: 17.3_

- [x] 20. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 21. Payment milestones service
  - [x] 21.1 Implement milestone detection: after every verified payment, check if total paid crosses any threshold (deposit cleared, 25%, 50%, 75%, 100%); create `milestones` record and enqueue notification; notify admin on 100%
    - _Requirements: 18.1, 18.2, 18.4_
  - [x]* 21.2 Write property test for milestone triggered at correct thresholds
    - **Property 50: Milestone triggered at correct thresholds**
    - **Validates: Requirements 18.1**
  - [x] 21.3 Expose milestone badges on buyer profile response
    - _Requirements: 18.3_
  - [x]* 21.4 Write property test for milestone badges reflect triggered milestones
    - **Property 51: Milestone badges reflect triggered milestones**
    - **Validates: Requirements 18.3**

- [x] 22. Report service
  - [x] 22.1 Implement all seven report endpoints (Aged Debt, Collection Summary, Defaulters List, Project Summary, Projected Cashflow, Month-End, Additional Charges) with `?format=pdf|csv|xlsx` export support
    - _Requirements: 16.1, 16.2_
  - [x]* 22.2 Write property test for report export produces a downloadable file
    - **Property 45: Report export produces a downloadable file**
    - **Validates: Requirements 16.2**
  - [x] 22.3 Inject provisional data notice into all reports when a reconciliation period is open
    - _Requirements: 16.3, 12.2_
  - [x]* 22.4 Write property test for open reconciliation period adds provisional notice to reports
    - **Property 46: Open reconciliation period adds provisional notice to reports**
    - **Validates: Requirements 16.3**

- [x] 23. Migration import service
  - [x] 23.1 Implement migration wizard endpoints: template download, file upload (accept `.xlsx`, `.xls`, `.csv` only), column mapping, validation, preview (first 10 rows), and commit
    - _Requirements: 15.1, 15.2, 15.4_
  - [x]* 23.2 Write property test for migration import accepts only valid file formats
    - **Property 39: Migration import accepts only valid file formats**
    - **Validates: Requirements 15.2**
  - [x] 23.3 Implement validation step that collects all errors (row, column, description) into a downloadable error report — no silent skips
    - _Requirements: 15.3_
  - [x]* 23.4 Write property test for migration import validation reports all errors
    - **Property 40: Migration import validation reports all errors**
    - **Validates: Requirements 15.3**
  - [x] 23.5 Implement dry-run mode: validate and preview without writing any data; assert DB state unchanged
    - _Requirements: 15.9_
  - [x]* 23.6 Write property test for migration dry-run commits no data
    - **Property 41: Migration dry-run commits no data**
    - **Validates: Requirements 15.9**
  - [x] 23.7 Implement conflict detection: skip rows matching existing verified ledger entries and report them; tag all migrated records with `is_migrated = true`; log every import operation
    - _Requirements: 15.6, 15.7, 15.8_
  - [x]* 23.8 Write property test for migration does not overwrite verified payments
    - **Property 42: Migration does not overwrite verified payments**
    - **Validates: Requirements 15.7**
  - [x]* 23.9 Write property test for migrated records are tagged
    - **Property 43: Migrated records are tagged**
    - **Validates: Requirements 15.6**
  - [x]* 23.10 Write property test for migration import is logged
    - **Property 44: Migration import is logged**
    - **Validates: Requirements 15.8**
  - [x] 23.11 Generate migration reconciliation report on commit (Excel balance vs StandVault balance per buyer)
    - _Requirements: 15.10_

- [x] 24. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Admin Panel SPA
  - [x] 25.1 Implement dashboard screen: total buyers, total collected, total outstanding, pending PoP count, recent activity feed
    - _Requirements: 19.1_
  - [x] 25.2 Implement Buyer List screen with searchable/filterable table (name, stand number, payment status, arrears status)
    - _Requirements: 19.2, 5.3_
  - [x] 25.3 Implement Buyer Profile screen: full details, complete ledger, document vault, audit trail
    - _Requirements: 19.3_
  - [x] 25.4 Implement Additional Charges screen (single buyer and bulk project-wide)
    - _Requirements: 19.4_
  - [x] 25.5 Implement PoP Queue screen with approve and reject actions
    - _Requirements: 19.5_
  - [x] 25.6 Implement stand management screens (list, site map colour-coded by status, bulk import entry point)
    - _Requirements: 4.5, 4.6, 4.7_

- [ ] 26. Buyer Portal SPA
  - [x] 26.1 Implement portal dashboard: balance breakdown, payment progress bar, balance status badge
    - _Requirements: 20.1_
  - [x] 26.2 Implement Payment History screen (chronological ledger)
    - _Requirements: 20.2_
  - [x] 26.3 Implement Instalment Schedule screen (due dates, amounts due, amounts paid, running balance)
    - _Requirements: 20.3_
  - [x] 26.4 Implement Documents screen (view, download, upload)
    - _Requirements: 20.4_
  - [x] 26.5 Implement Additional Charges screen (view charges with descriptions and amounts)
    - _Requirements: 20.5_
  - [x] 26.6 Implement Announcements screen and Support/Disputes screen
    - _Requirements: 20.6, 20.7_
  - [x] 26.7 Implement PoP upload flow in buyer portal
    - _Requirements: 8.1_

- [x] 27. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per property
- Each property test must include a comment: `// Feature: stand-vault, Property N: <title>`
- Use an injectable `now()` clock abstraction throughout to keep time-dependent tests deterministic
- Ledger immutability is enforced at both the DB trigger level and the API layer
