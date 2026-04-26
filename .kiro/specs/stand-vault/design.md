# Design Document: StandVault

## Overview

StandVault is a web application for managing stand (plot) purchases and instalment payments in land development projects. It replaces Excel-based record-keeping with a structured, auditable system.

The system has two primary interfaces:
- **Admin Panel** — used by Project_Administrators and System_Administrators to manage buyers, record payments, configure projects, and generate reports.
- **Buyer Portal** — used by Buyers to view their account, track payments, access documents, and upload requested documents.

The core financial model is an **append-only ledger**: every payment, charge, and reversal is a new entry; nothing is ever edited or deleted. Balances are always computed from the ledger sum, never stored. This guarantees auditability and integrity.

Authentication is email/password with bcrypt-hashed passwords and session tokens (or JWT). Role-based access control enforces strict data isolation between buyers, project administrators, and system administrators.

---

## Architecture

The system follows a layered web architecture:

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
│   Admin Panel SPA          Buyer Portal SPA              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / REST + WebSocket (notifications)
┌────────────────────▼────────────────────────────────────┐
│                    API Server (REST)                      │
│  Auth  │  Projects  │  Buyers  │  Ledger  │  Documents   │
│  Roles │  Stands    │  Payments│  Reports │  Notifications│
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   PostgreSQL    File Store    Email Service
  (primary DB)  (documents,   (invites, password
                  PoP files)   resets, notifications)
```

### Key Architectural Decisions

**Append-only ledger**: No UPDATE or DELETE on ledger entries. Corrections are made via Reversal entries. This is enforced at the database level with row-level security and at the application level.

**Balance computed on read**: The buyer's outstanding balance is always `SUM(ledger entries)` — never a cached field. For performance, a materialized view or read-model can be maintained but must always be derivable from the raw ledger.

**Role isolation**: Row-level security (RLS) in PostgreSQL enforces that project administrators only see data for their assigned projects, and buyers only see their own records.

**Document storage**: Files (PoP images, PDFs, signed agreements) are stored in an object store (e.g., S3-compatible). The database stores metadata and a reference URL.

**Notifications**: Delivered in-app (via WebSocket push or polling) and by email. A notification queue handles delivery with retry logic.

---

## Components and Interfaces

### Authentication Service

Handles login, password management, invitation flows, and session management.

```
POST /auth/login                 { email, password } → { session_token }
POST /auth/logout
GET  /auth/me                    → { user_id, role, assigned_projects }
POST /auth/forgot-password       { email }
POST /auth/reset-password        { token, new_password }
POST /auth/set-password          { token, password }   (invitation flow)
```

Password storage:
- Passwords are hashed with bcrypt (minimum cost factor 12) before storage
- Plain-text passwords are never stored or logged
- Invitation and reset tokens are single-use, expire after 24 hours, and are stored hashed

### Project Service

Manages project configuration and stand inventory.

```
POST   /projects                          (System_Admin only)
GET    /projects/:id
PATCH  /projects/:id/config               (System_Admin only)
POST   /projects/:id/admins               assign Project_Admin
GET    /projects/:id/stands
POST   /projects/:id/stands
PATCH  /projects/:id/stands/:stand_id
POST   /projects/:id/stands/import        bulk import
```

### Buyer Service

Manages buyer profiles, instalment schedules, and balance status.

```
POST   /projects/:id/buyers               create buyer
GET    /projects/:id/buyers               list with filters
GET    /buyers/:buyer_id                  full profile
PATCH  /buyers/:buyer_id/details          personal details only
GET    /buyers/:buyer_id/schedule         instalment schedule
GET    /buyers/:buyer_id/balance          computed balance + status
```

### Ledger Service

The core financial engine. All writes are append-only.

```
POST   /buyers/:buyer_id/ledger/payments          record payment
POST   /buyers/:buyer_id/ledger/charges           add additional charge
POST   /buyers/:buyer_id/ledger/reversals         record reversal
GET    /buyers/:buyer_id/ledger                   full ledger
GET    /buyers/:buyer_id/ledger/balance           computed balance
```

### Proof of Payment Service

Manages buyer-submitted PoP submissions and the admin verification queue.

```
POST   /buyers/:buyer_id/pop              buyer submits PoP
GET    /projects/:id/pop/queue            admin queue (Pending)
POST   /pop/:submission_id/approve        admin approves → creates ledger entry
POST   /pop/:submission_id/reject         admin rejects → notifies buyer
```

### Document Service

Manages document storage, versioning, and document requests.

```
POST   /buyers/:buyer_id/documents        upload document
GET    /buyers/:buyer_id/documents        list documents
GET    /documents/:doc_id/versions        version history
POST   /documents/:doc_id/request         request document from buyer
GET    /buyers/:buyer_id/documents/balance-confirmation   generate BCL
```

### Notification Service

Internal service that other services call to enqueue notifications.

```
POST   /notifications/enqueue   { recipient_id, type, payload }
GET    /notifications/mine      buyer/admin fetches their notifications
PATCH  /notifications/:id/read
```

### Report Service

Generates reports on demand.

```
GET  /projects/:id/reports/aged-debt
GET  /projects/:id/reports/collection-summary
GET  /projects/:id/reports/defaulters
GET  /projects/:id/reports/project-summary
GET  /projects/:id/reports/cashflow
GET  /projects/:id/reports/month-end
GET  /projects/:id/reports/additional-charges
```

All report endpoints accept `?format=pdf|csv|xlsx` for export.

### Migration Import Service

Handles the Excel migration wizard.

```
GET    /projects/:id/migration/template   download template
POST   /projects/:id/migration/upload     upload file
POST   /projects/:id/migration/map        column mapping
POST   /projects/:id/migration/validate   validate → error report
GET    /projects/:id/migration/preview    preview first 10 rows
POST   /projects/:id/migration/commit     commit (or dry-run)
GET    /projects/:id/migration/report     reconciliation report
```

---

## Data Models

### User

```
users
  id              UUID PK
  email           TEXT UNIQUE NOT NULL
  full_name       TEXT
  role            ENUM(system_admin, project_admin, buyer)
  password_hash   TEXT NULL              -- bcrypt hash; NULL until password is set
  is_active       BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ
  invited_at      TIMESTAMPTZ
  activated_at    TIMESTAMPTZ
```

### Project

```
projects
  id              UUID PK
  name            TEXT NOT NULL
  location        TEXT
  created_at      TIMESTAMPTZ
  created_by      UUID FK → users.id

project_configs
  id              UUID PK
  project_id      UUID FK → projects.id
  effective_from  DATE NOT NULL
  min_deposit_pct NUMERIC(5,2)
  min_deposit_amt NUMERIC(15,2)
  instalment_months INT
  monthly_amount  NUMERIC(15,2)
  penalty_type    ENUM(flat, percentage)
  penalty_value   NUMERIC(10,4)
  grace_period_days INT
  created_at      TIMESTAMPTZ
  -- Only the config with the latest effective_from <= contract_start_date applies to a buyer
```

### Project Admin Assignment

```
project_admin_assignments
  project_id      UUID FK → projects.id
  user_id         UUID FK → users.id
  assigned_at     TIMESTAMPTZ
  assigned_by     UUID FK → users.id
  PRIMARY KEY (project_id, user_id)
```

### Stand

```
stands
  id              UUID PK
  project_id      UUID FK → projects.id
  stand_number    TEXT NOT NULL
  size_sqm        NUMERIC(10,2)
  price           NUMERIC(15,2)
  status          ENUM(available, reserved, allocated, transferred, on_hold)
  gps_lat         NUMERIC(10,7)
  gps_lng         NUMERIC(10,7)
  water           BOOLEAN
  sewer           BOOLEAN
  electricity     BOOLEAN
  is_migrated     BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ
  UNIQUE (project_id, stand_number)
```

### Buyer

```
buyers
  id              UUID PK
  user_id         UUID FK → users.id   -- links to login
  project_id      UUID FK → projects.id
  stand_id        UUID FK → stands.id
  full_name       TEXT NOT NULL
  national_id     TEXT
  phone           TEXT
  email           TEXT NOT NULL
  address         TEXT
  next_of_kin_name TEXT
  next_of_kin_relationship TEXT
  next_of_kin_phone TEXT
  contract_start_date DATE
  purchase_price  NUMERIC(15,2)
  deposit_amount  NUMERIC(15,2)
  project_config_id UUID FK → project_configs.id  -- snapshot at contract creation
  is_migrated     BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ
  created_by      UUID FK → users.id
```

### Instalment Schedule

```
instalment_schedules
  id              UUID PK
  buyer_id        UUID FK → buyers.id
  version         INT NOT NULL DEFAULT 1
  generated_at    TIMESTAMPTZ
  approved_at     TIMESTAMPTZ          -- NULL until admin approves recalculation
  approved_by     UUID FK → users.id

instalment_periods
  id              UUID PK
  schedule_id     UUID FK → instalment_schedules.id
  period_number   INT NOT NULL
  due_date        DATE NOT NULL
  amount_due      NUMERIC(15,2) NOT NULL
```

### Ledger

```
ledger_entries
  id              UUID PK
  buyer_id        UUID FK → buyers.id
  entry_type      ENUM(payment, charge, reversal, penalty)
  amount          NUMERIC(15,2) NOT NULL   -- positive = credit, negative = debit for reversals
  effective_date  DATE NOT NULL
  payment_method  ENUM(cash, ecocash, zipit, bank_transfer) NULL
  reference_number TEXT NULL
  description     TEXT
  reversal_of     UUID FK → ledger_entries.id NULL   -- for reversals
  reversal_reason TEXT NULL
  pop_submission_id UUID FK → pop_submissions.id NULL
  is_migrated     BOOLEAN DEFAULT false
  reconciliation_period_id UUID FK → reconciliation_periods.id NULL
  requires_approval BOOLEAN DEFAULT false   -- for backdated entries
  approved_at     TIMESTAMPTZ NULL
  approved_by     UUID FK → users.id NULL
  created_by      UUID FK → users.id NOT NULL
  created_at      TIMESTAMPTZ NOT NULL
  -- NO UPDATE, NO DELETE enforced via DB trigger / RLS
```

### Proof of Payment Submission

```
pop_submissions
  id              UUID PK
  buyer_id        UUID FK → buyers.id
  submitted_by    UUID FK → users.id
  file_url        TEXT NOT NULL
  file_name       TEXT
  status          ENUM(pending, approved, rejected)
  amount_claimed  NUMERIC(15,2)
  payment_date    DATE
  rejection_reason TEXT NULL
  reviewed_by     UUID FK → users.id NULL
  reviewed_at     TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ
```

### Additional Charge

```
-- Additional charges are ledger_entries with entry_type = 'charge'
-- The additional_charges table stores the metadata for bulk charges
additional_charge_batches
  id              UUID PK
  project_id      UUID FK → projects.id
  name            TEXT NOT NULL
  description     TEXT
  amount          NUMERIC(15,2) NOT NULL
  effective_date  DATE NOT NULL
  document_url    TEXT NULL
  created_by      UUID FK → users.id
  created_at      TIMESTAMPTZ
  -- ledger_entries reference this via a charge_batch_id column
```

### Penalty

```
penalty_calculations
  id              UUID PK
  buyer_id        UUID FK → buyers.id
  calculated_amount NUMERIC(15,2) NOT NULL
  period_overdue  INT
  status          ENUM(pending_review, approved, rejected, waived)
  reviewed_by     UUID FK → users.id NULL
  reviewed_at     TIMESTAMPTZ NULL
  rejection_reason TEXT NULL
  ledger_entry_id UUID FK → ledger_entries.id NULL  -- set when approved
  created_at      TIMESTAMPTZ
```

### Reconciliation Period

```
reconciliation_periods
  id              UUID PK
  project_id      UUID FK → projects.id
  period_start    DATE NOT NULL
  period_end      DATE NOT NULL
  status          ENUM(open, closed)
  closed_by       UUID FK → users.id NULL
  closed_at       TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ
```

### Document

```
documents
  id              UUID PK
  buyer_id        UUID FK → buyers.id
  category        ENUM(agreement, receipt, notice, levy, title_deed, id_document, other)
  title           TEXT NOT NULL
  current_version INT NOT NULL DEFAULT 1
  created_by      UUID FK → users.id
  created_at      TIMESTAMPTZ

document_versions
  id              UUID PK
  document_id     UUID FK → documents.id
  version_number  INT NOT NULL
  file_url        TEXT NOT NULL
  file_name       TEXT
  uploaded_by     UUID FK → users.id
  uploaded_at     TIMESTAMPTZ
```

### Audit Log

```
audit_log
  id              UUID PK
  acting_user_id  UUID FK → users.id
  action_type     TEXT NOT NULL          -- e.g. 'payment.created', 'buyer.updated'
  affected_table  TEXT NOT NULL
  affected_id     UUID NOT NULL
  old_values      JSONB NULL
  new_values      JSONB NULL
  ip_address      INET
  created_at      TIMESTAMPTZ NOT NULL
  -- NO UPDATE, NO DELETE enforced via DB trigger
```

### Milestone

```
milestones
  id              UUID PK
  buyer_id        UUID FK → buyers.id
  threshold       ENUM(deposit_cleared, pct_25, pct_50, pct_75, pct_100)
  triggered_at    TIMESTAMPTZ NOT NULL
  notified_at     TIMESTAMPTZ NULL
```

### Notification

```
notifications
  id              UUID PK
  recipient_id    UUID FK → users.id
  type            TEXT NOT NULL
  payload         JSONB
  is_read         BOOLEAN DEFAULT false
  email_sent_at   TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ
```

### Migration Import Log

```
migration_imports
  id              UUID PK
  project_id      UUID FK → projects.id
  imported_by     UUID FK → users.id
  file_name       TEXT NOT NULL
  status          ENUM(dry_run, committed, failed)
  row_count       INT
  success_count   INT
  error_count     INT
  error_report_url TEXT NULL
  reconciliation_report_url TEXT NULL
  created_at      TIMESTAMPTZ
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid credentials authenticate; invalid credentials are rejected

*For any* login attempt, the system must authenticate the user if and only if the submitted email matches a known user and the submitted password matches the stored bcrypt hash. Any other combination must be rejected with a generic error that does not reveal which field is incorrect.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Password reset link is single-use

*For any* password reset link that has been successfully used to set a new password, submitting the same reset token a second time must be rejected — the token must be invalidated after first use.

**Validates: Requirements 1.4, 1.5**

---

### Property 3: Invitation token is single-use

*For any* invitation token that has been used to set a password and activate an account, submitting the same token again must be rejected.

**Validates: Requirements 1.6, 1.7**

---

### Property 4: Buyer data isolation

*For any* two distinct buyers A and B, when buyer A is authenticated, all API requests for buyer B's account data (ledger, documents, schedule, balance) must return an authorisation error.

**Validates: Requirements 2.1**

---

### Property 5: Project administrator project isolation

*For any* project administrator and any project not assigned to that administrator, all API requests for that project's data must return an authorisation error.

**Validates: Requirements 2.2**

---

### Property 6: Buyer cannot mutate financial records

*For any* buyer and any write operation on a financial record (payment creation, charge creation, reversal creation, ledger entry modification), the request must be rejected with an authorisation error.

**Validates: Requirements 2.4**

---

### Property 7: Verified payment deletion is rejected for all roles

*For any* user (regardless of role) and any verified ledger payment entry, a DELETE request must be rejected and the entry must remain unchanged in the database.

**Validates: Requirements 2.5, 9.1**

---

### Property 8: Unauthorised access is logged

*For any* request that is rejected due to insufficient permissions, an audit log entry must be created recording the acting user, timestamp, and the resource that was attempted.

**Validates: Requirements 2.6**

---

### Property 9: Project config snapshot isolation

*For any* project configuration update, all buyers whose contracts were created before the update date must retain the original configuration values, and only buyers created after the update date should use the new configuration.

**Validates: Requirements 3.3, 3.4**

---

### Property 10: Stand status is always a valid enum value

*For any* stand record in the system, its status must always be one of: `available`, `reserved`, `allocated`, `transferred`, or `on_hold`. No other value is permitted.

**Validates: Requirements 4.2**

---

### Property 11: Stand allocation sets status to Allocated

*For any* stand that is allocated to a buyer, the stand's status must be updated to `allocated` as part of the same transaction.

**Validates: Requirements 4.8**

---

### Property 12: Buyer creation generates an instalment schedule

*For any* buyer profile that is successfully saved, an instalment schedule must be generated containing at least one instalment period with a due date and amount due.

**Validates: Requirements 5.2, 6.1**

---

### Property 13: Buyer list filter correctness

*For any* filter criteria applied to the buyer list (name, stand number, payment status, arrears status), all returned buyers must satisfy the filter criteria and no buyer satisfying the criteria must be omitted.

**Validates: Requirements 5.3**

---

### Property 14: Personal detail update does not alter ledger

*For any* buyer personal detail update (name, phone, address, next of kin, etc.), the buyer's ledger entries must remain identical before and after the update — count, amounts, and timestamps unchanged.

**Validates: Requirements 5.4**

---

### Property 15: Balance status reflects ledger state

*For any* buyer, the displayed balance status must be:
- `In Arrears` if and only if total verified payments to date < total amount due to date per schedule
- `On Track` if and only if total verified payments to date = total amount due to date per schedule
- `Ahead` if and only if total verified payments to date > total amount due to date per schedule

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

---

### Property 16: Additional charge triggers schedule recalculation with admin gate

*For any* additional charge added to a buyer's account, a new instalment schedule version must be generated with status `pending_approval` and must not be applied to the buyer's active schedule until a project administrator explicitly approves it.

**Validates: Requirements 6.6, 6.7**

---

### Property 17: Payment recording creates a ledger entry with full metadata

*For any* payment recorded by a project administrator, a new ledger entry must be created with: `entry_type = payment`, the correct amount, the creating user's identity, and a creation timestamp. The entry must be immediately reflected in the buyer's computed balance.

**Validates: Requirements 7.2, 7.3, 9.3**

---

### Property 18: Balance calculation invariant

*For any* buyer, the outstanding balance must always equal: `purchase_price + SUM(additional_charge ledger entries) - SUM(verified payment ledger entries)`. This value must be computed from ledger entries and must never be read from a stored balance field.

**Validates: Requirements 7.4, 9.2**

---

### Property 19: Reversal creates a negating ledger entry

*For any* reversal recorded against a payment, a new ledger entry must be created with a negative amount equal to the original payment, the reversal reason must be non-empty, and the creating administrator's identity and timestamp must be recorded.

**Validates: Requirements 7.6**

---

### Property 20: PoP submission enters queue as Pending

*For any* proof of payment uploaded by a buyer, a `pop_submissions` record must be created with `status = pending` and must appear in the project administrator's verification queue.

**Validates: Requirements 8.1, 8.4**

---

### Property 21: PoP approval creates a verified ledger entry

*For any* pending PoP submission that is approved by a project administrator, a new ledger entry with `entry_type = payment` must be created and the submission's status must be updated to `approved`.

**Validates: Requirements 8.2**

---

### Property 22: PoP rejection notifies buyer with reason

*For any* pending PoP submission that is rejected, the submission's status must be updated to `rejected`, the rejection reason must be stored, and a notification must be enqueued for the buyer containing the rejection reason.

**Validates: Requirements 8.3**

---

### Property 23: Ledger entries are immutable

*For any* ledger entry that has been committed to the database, any attempt to UPDATE or DELETE that row must fail at the database level (enforced by trigger or RLS policy).

**Validates: Requirements 9.1**

---

### Property 24: Audit log is append-only

*For any* audit log entry, any attempt to UPDATE or DELETE that row must fail. Every system action must produce at least one audit log entry containing: acting user, timestamp, action type, affected table, and affected record ID.

**Validates: Requirements 9.4, 9.5**

---

### Property 25: Viewed additional charge requires reversal for removal

*For any* additional charge that has been viewed by the buyer (i.e., `viewed_at` is set), a direct deletion attempt must be rejected. Removal must only be possible via a reversal entry with a logged reason.

**Validates: Requirements 9.6**

---

### Property 26: Bulk additional charge applies to all buyers in project

*For any* bulk additional charge applied to a project, every buyer in that project must receive a corresponding ledger entry with `entry_type = charge` and the correct amount.

**Validates: Requirements 10.2, 10.3**

---

### Property 27: Additional charge notifies all affected buyers

*For any* additional charge (single or bulk), a notification must be enqueued for every affected buyer containing the charge name and amount.

**Validates: Requirements 10.5**

---

### Property 28: Balance breakdown contains all four components

*For any* buyer, the balance breakdown response must contain: `original_contract_value`, `total_additional_charges`, `total_paid`, and `remaining_balance`, where `remaining_balance = original_contract_value + total_additional_charges - total_paid`.

**Validates: Requirements 10.6**

---

### Property 29: Penalty calculation respects grace period

*For any* buyer in arrears, a penalty must only be calculated if the number of days overdue exceeds the project's configured grace period. Buyers within the grace period must not have penalties calculated.

**Validates: Requirements 11.1**

---

### Property 30: Penalty requires admin approval before ledger entry

*For any* calculated penalty, it must have `status = pending_review` and must not appear as a ledger entry until a project administrator explicitly approves it.

**Validates: Requirements 11.2, 11.3, 11.4**

---

### Property 31: Penalty rejection is fully logged

*For any* rejected or waived penalty, the `penalty_calculations` record must contain: the reviewing administrator's identity, the review timestamp, and a non-empty rejection reason.

**Validates: Requirements 11.5**

---

### Property 32: Reconciliation period close requires no pending PoP

*For any* attempt to close a reconciliation period that has one or more pending PoP submissions, the close operation must be rejected until all pending submissions are resolved.

**Validates: Requirements 12.5**

---

### Property 33: Backdated payment requires approval

*For any* payment recorded with an `effective_date` that falls within a previously closed reconciliation period, the ledger entry must be created with `requires_approval = true` and must not affect the buyer's balance until explicitly approved by a project administrator.

**Validates: Requirements 12.4**

---

### Property 34: Verified payment generates a receipt document

*For any* verified payment ledger entry, a receipt document must be automatically created and attached to the buyer's document vault.

**Validates: Requirements 13.2**

---

### Property 35: Document versioning preserves all versions

*For any* document that has had a new version uploaded, all previous versions must remain accessible via the version history endpoint — no version may be deleted or overwritten.

**Validates: Requirements 13.4**

---

### Property 36: Document upload notifies buyer

*For any* document uploaded to a buyer's account, a notification must be enqueued for the buyer before the upload response is returned.

**Validates: Requirements 14.2**

---

### Property 37: Document request appears as pending task in buyer portal

*For any* document request created by a project administrator, a pending task must be visible to the buyer in their portal until the buyer uploads the requested document.

**Validates: Requirements 14.3**

---

### Property 38: Outstanding document requests are visible to administrator

*For any* document request that has not yet been fulfilled by the buyer, it must appear in the outstanding document requests list visible to the project administrator.

**Validates: Requirements 14.4**

---

### Property 39: Migration import accepts only valid file formats

*For any* file uploaded to the migration import endpoint, the system must accept `.xlsx`, `.xls`, and `.csv` formats and reject all other formats with an error.

**Validates: Requirements 15.2**

---

### Property 40: Migration import validation reports all errors

*For any* import file with validation errors, the validation step must return a report containing every error (row number, column, and error description) — no error may be silently skipped.

**Validates: Requirements 15.3**

---

### Property 41: Migration dry-run commits no data

*For any* migration import executed with `dry_run = true`, no records must be inserted, updated, or deleted in any application table. The database state must be identical before and after the dry-run.

**Validates: Requirements 15.9**

---

### Property 42: Migration does not overwrite verified payments

*For any* migration import that includes a payment record matching an existing verified ledger entry (same buyer, same amount, same date), the import must skip that record and report it as a conflict rather than overwriting it.

**Validates: Requirements 15.7**

---

### Property 43: Migrated records are tagged

*For any* ledger entry or stand record created via a migration import, the `is_migrated` field must be `true`.

**Validates: Requirements 15.6**

---

### Property 44: Migration import is logged

*For any* migration import operation (dry-run or committed), a `migration_imports` log entry must be created recording: importing user, timestamp, file name, and outcome.

**Validates: Requirements 15.8**

---

### Property 45: Report export produces a downloadable file

*For any* report generation request with a valid `format` parameter (`pdf`, `csv`, or `xlsx`), the response must be a file download with the correct MIME type and non-empty content.

**Validates: Requirements 16.2**

---

### Property 46: Open reconciliation period adds provisional notice to reports

*For any* report generated while a reconciliation period is open, the report content must include a provisional data notice.

**Validates: Requirements 16.3**

---

### Property 47: System events trigger buyer notifications

*For any* system event in the set {payment verified, payment rejected, additional charge added, document uploaded, document requested, payment reminder, milestone reached, announcement posted}, a notification must be enqueued for the affected buyer.

**Validates: Requirements 17.1**

---

### Property 48: System events trigger admin notifications

*For any* system event in the set {PoP submitted, buyer uploaded requested document, support query raised, 100% milestone reached}, a notification must be enqueued for the relevant project administrator.

**Validates: Requirements 17.2**

---

### Property 49: All notifications are delivered in-app and by email

*For any* notification created in the system, both an in-app notification record must be stored and an email delivery must be enqueued.

**Validates: Requirements 17.4**

---

### Property 50: Milestone triggered at correct thresholds

*For any* buyer whose total verified payments cross a milestone threshold (deposit cleared, 25%, 50%, 75%, 100% of total amount owed), a milestone record must be created for that threshold. The milestone must not be triggered again if payments subsequently decrease and re-cross the threshold.

**Validates: Requirements 18.1**

---

### Property 51: Milestone badges reflect triggered milestones

*For any* buyer with triggered milestones, the buyer's profile must display a badge for each triggered milestone threshold.

**Validates: Requirements 18.3**

---

## Error Handling

### Authentication Errors

- Invalid email or password: `401 Unauthorized` with message `"Invalid email or password"`
- Expired or already-used reset/invitation token: `401 Unauthorized` with message `"This link is invalid or has expired"`
- Missing or invalid session token: `401 Unauthorized`
- Account not activated: `403 Forbidden` with message `"Account is not yet activated"`

### Authorisation Errors

- Resource outside role permissions: `403 Forbidden`
- All `403` responses are written to the audit log before being returned

### Validation Errors

- Missing required fields: `422 Unprocessable Entity` with a field-level error map
- Invalid enum value (e.g., stand status, payment method): `422` with the field name and allowed values
- Duplicate stand number within a project: `409 Conflict`
- Attempt to delete a verified ledger entry: `409 Conflict` with message `"Verified ledger entries cannot be deleted"`
- Attempt to close a reconciliation period with pending PoP: `409 Conflict` with a count of pending submissions

### Financial Integrity Errors

- Backdated payment in closed period: accepted but flagged with `requires_approval = true`; response includes a `warning` field indicating the payment is pending approval
- Reversal without reason: `422` with message `"A reason is required for reversals"`
- Additional charge removal without reversal: `409 Conflict`

### File Upload Errors

- Unsupported file format: `415 Unsupported Media Type`
- File too large (configurable limit, default 10 MB): `413 Payload Too Large`
- File storage failure: `502 Bad Gateway` with a retry suggestion

### Migration Import Errors

- Validation errors: returned as a structured error report (not HTTP errors) — the import proceeds to show all errors
- Conflict with existing verified payment: recorded in the error report as a skipped row
- Partial commit failure: rows that fail are recorded in the error report; successful rows are committed

### General Errors

- Unexpected server error: `500 Internal Server Error` with a correlation ID for log tracing
- All `500` errors are logged with full stack trace and request context

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- **Unit tests** verify specific examples, integration points, and error conditions
- **Property-based tests** verify universal properties across randomly generated inputs

### Unit Tests

Unit tests should focus on:
- Specific examples demonstrating correct behaviour (e.g., a buyer with exactly 3 payments has the correct balance)
- Integration points between services (e.g., approving a PoP creates a ledger entry)
- Error conditions and edge cases (e.g., password reset token expiry boundary, grace period boundary)
- Document generation (e.g., receipt PDF contains correct buyer name and amount)

Avoid writing unit tests that duplicate what property tests already cover. Unit tests should be reserved for cases where the specific values matter.

### Property-Based Tests

**Library**: Use a property-based testing library appropriate for the target language:
- TypeScript/JavaScript: `fast-check`
- Python: `hypothesis`
- Java/Kotlin: `jqwik`

**Configuration**: Each property test must run a minimum of **100 iterations**.

**Tagging**: Each property test must include a comment referencing the design property it validates:

```
// Feature: stand-vault, Property 15: Balance status reflects ledger state
```

**Each correctness property in this document must be implemented by exactly one property-based test.**

### Property Test Generators

The following generators will be needed:

- `arbitraryBuyer` — generates a buyer with random personal details and a valid contract
- `arbitraryLedgerEntry` — generates a payment, charge, or reversal with valid fields
- `arbitraryCredentials` — generates valid and invalid email/password pairs for auth testing
- `arbitraryResetToken` — generates a reset or invitation token with a random expiry offset
- `arbitraryStand` — generates a stand with a valid status enum value
- `arbitraryProjectConfig` — generates a project configuration with valid penalty rules
- `arbitraryInstalmentSchedule` — generates a schedule with N periods and random amounts
- `arbitraryMigrationRow` — generates a row of import data (valid or intentionally invalid)
- `arbitraryUser(role)` — generates a user with a specific role

### Test Coverage Targets

- All 51 correctness properties must have a corresponding property-based test
- All error conditions in the Error Handling section must have a unit test
- All API endpoints must have at least one integration test
- Document generation (receipts, BCL, reports) must have snapshot tests

### Reconciliation Period Testing

Reconciliation period tests require careful setup of time-dependent state. Use a configurable clock abstraction (injectable `now()` function) rather than `Date.now()` directly, so tests can control the current date.

### Ledger Immutability Testing

Property tests for ledger immutability (Properties 7, 23) should attempt direct database mutations via the ORM and assert that the operation raises an error or is silently rejected, verifying the database-level constraint is in place.
