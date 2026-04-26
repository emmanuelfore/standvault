# Requirements Document

## Introduction

StandVault is a stand purchase and instalment management system for land development projects. It replaces Excel-based record-keeping with a structured, auditable web application. The system supports two interfaces: an Admin Panel for project administrators and system administrators to manage buyers, record payments, and monitor projects; and a Buyer Portal for buyers to view their account, track payments, access documents, and sign agreements. The core workflow centres on buyers making payments (cash or bank deposit), submitting proof of payment, and administrators recording those payments against buyer ledgers.

## Glossary

- **System**: The StandVault web application as a whole
- **Buyer**: A person who has purchased or is purchasing a stand in a land development project
- **Project_Administrator**: A user responsible for managing buyers, payments, and documents within one or more assigned projects
- **System_Administrator**: A superuser who creates projects, assigns administrators, and has system-wide access
- **Stand**: A plot of land within a development project, identified by a stand number
- **Ledger**: The immutable, append-only record of all financial entries (payments, charges, reversals) for a buyer's account
- **Instalment_Schedule**: The generated timetable of expected payment amounts and due dates for a buyer's contract
- **Proof_of_Payment**: A document (image or PDF) submitted by a buyer or administrator as evidence of a payment
- **Additional_Charge**: A levy or development charge added to a buyer's account by a Project_Administrator, increasing the total amount owed
- **Reversal**: A corrective ledger entry that negates a previously recorded payment, logged with a reason
- **Reconciliation_Period**: A configurable time window (default monthly) during which payments are reviewed and finalised by the administrator
- **PoP**: Proof of Payment
- **Arrears**: The state where a buyer's total amount paid to date is less than the total amount due to date per their instalment schedule
- **Milestone**: A payment progress threshold (deposit cleared, 25%, 50%, 75%, 100%) that triggers notifications and badges
- **Balance_Confirmation_Letter**: A system-generated document stating a buyer's current outstanding balance, generated on demand
- **Migration_Import**: A batch import of historical buyer, stand, and payment records from an Excel file into StandVault

---

## Requirements

### Requirement 1: Email and Password Authentication

**User Story:** As a buyer or administrator, I want to log in using my email address and password, so that I can access the system securely.

#### Acceptance Criteria

1. WHEN a user submits a valid email address and password on the login screen, THE System SHALL authenticate the user and establish a session.
2. IF a user submits an incorrect email address or password, THEN THE System SHALL reject the login attempt and display a generic error message without revealing which field is incorrect.
3. WHEN a user requests a password reset, THE System SHALL send a password reset link to the user's registered email address within 60 seconds.
4. WHEN a user follows a valid password reset link, THE System SHALL allow the user to set a new password, then invalidate the reset link so it cannot be reused.
5. IF a password reset link has expired or has already been used, THEN THE System SHALL reject the reset attempt and display an error message.
6. WHEN a Project_Administrator is invited by the System_Administrator, THE System SHALL send the administrator an invitation email containing a link to set their password and activate their account.
7. WHEN a Buyer account is created by a Project_Administrator, THE System SHALL send the Buyer an invitation email containing a link to set their password and access their portal.

---

### Requirement 2: User Role Access Control

**User Story:** As a system owner, I want each user role to access only the data and actions appropriate to their role, so that financial records and buyer data are protected.

#### Acceptance Criteria

1. WHILE a Buyer is authenticated, THE System SHALL restrict the Buyer's view to their own account data only.
2. WHILE a Project_Administrator is authenticated, THE System SHALL restrict the Project_Administrator's access to buyers and projects assigned to them.
3. WHILE a System_Administrator is authenticated, THE System SHALL grant access to all projects and system-wide configuration settings.
4. THE System SHALL prevent a Buyer from creating, editing, or deleting any financial record.
5. THE System SHALL prevent a Project_Administrator from deleting a verified payment record.
6. WHEN a user attempts to access a resource outside their role's permissions, THE System SHALL return an authorisation error and log the attempt.

---

### Requirement 3: Project Configuration

**User Story:** As a System_Administrator, I want to create and configure projects with stand pricing, instalment rules, and penalty settings, so that buyer contracts and schedules are generated correctly.

#### Acceptance Criteria

1. THE System_Administrator SHALL be able to create a project with: project name, location, stand sizes and prices, minimum deposit amount or percentage, instalment duration in months, monthly instalment amount or calculation basis, penalty rules (flat fee or percentage per month overdue), and grace period in days.
2. WHEN a project is created, THE System SHALL store the project configuration as the baseline for all buyer contracts created under that project.
3. WHEN a project's configuration is updated, THE System SHALL apply the updated settings only to buyer contracts created after the update date.
4. THE System SHALL preserve the original configuration values for all existing buyer contracts when project settings change.
5. THE System_Administrator SHALL be able to assign one or more Project_Administrators to a project.

---

### Requirement 4: Stand Management

**User Story:** As a Project_Administrator, I want to manage stands within a project, so that I can track availability and allocate stands to buyers.

#### Acceptance Criteria

1. THE Project_Administrator SHALL be able to add a stand with: stand number, size in square metres, price, and status.
2. THE System SHALL enforce that each stand's status is one of: Available, Reserved, Allocated, Transferred, or On Hold.
3. WHERE GPS coordinates are provided, THE System SHALL store and display the coordinates on the stand record.
4. WHERE servicing information is provided (water, sewer, electricity), THE System SHALL store and display the servicing status on the stand record.
5. THE Project_Administrator SHALL be able to view all stands as a sortable, filterable list.
6. THE Project_Administrator SHALL be able to view all stands on a visual site map colour-coded by status.
7. THE Project_Administrator SHALL be able to import stands in bulk from an Excel file using the Migration_Import wizard.
8. WHEN a stand is allocated to a Buyer, THE System SHALL update the stand's status to Allocated.

---

### Requirement 5: Buyer Profile Management

**User Story:** As a Project_Administrator, I want to create and manage buyer profiles, so that each buyer's personal details and contract information are recorded accurately.

#### Acceptance Criteria

1. THE Project_Administrator SHALL be able to create a Buyer profile containing: full name, national ID number, phone number, email address, physical address, next of kin name, next of kin relationship, next of kin contact number, assigned stand, contract start date, purchase price, and deposit amount.
2. WHEN a Buyer profile is saved, THE System SHALL generate an Instalment_Schedule for the Buyer based on the project configuration and the Buyer's contract terms.
3. THE Project_Administrator SHALL be able to search and filter the buyer list by name, stand number, payment status, and arrears status.
4. THE Project_Administrator SHALL be able to update a Buyer's personal details without altering the Buyer's financial records.
5. THE System SHALL display a Buyer's balance status as one of: Ahead (paid more than due to date), On Track (paid the expected amount to date), or In Arrears (paid less than due to date).

---

### Requirement 6: Instalment Schedule Generation

**User Story:** As a buyer, I want to see a full instalment schedule when my stand is allocated, so that I know exactly what I owe and when each payment is due.

#### Acceptance Criteria

1. WHEN a stand is allocated to a Buyer, THE System SHALL generate an Instalment_Schedule showing: due date, amount due, amount paid, and running balance for each instalment period.
2. THE System SHALL calculate arrears as the difference between the total amount due to date per the Instalment_Schedule and the total verified payments recorded to date.
3. WHILE a Buyer's total verified payments to date are less than the total amount due to date, THE System SHALL display the Buyer's balance status as In Arrears.
4. WHILE a Buyer's total verified payments to date equal the total amount due to date, THE System SHALL display the Buyer's balance status as On Track.
5. WHILE a Buyer's total verified payments to date exceed the total amount due to date, THE System SHALL display the Buyer's balance status as Ahead.
6. WHEN an Additional_Charge is added to a Buyer's account, THE System SHALL recalculate the Instalment_Schedule to reflect the additional amount across the remaining instalments or as a separate line item, according to the project's configuration.
7. WHEN the recalculated Instalment_Schedule is ready, THE System SHALL present it to the Project_Administrator for review before applying it to the Buyer's account.

---

### Requirement 7: Payment Recording by Administrator

**User Story:** As a Project_Administrator, I want to record payments against a buyer's account, so that the buyer's ledger and balance are updated immediately.

#### Acceptance Criteria

1. THE Project_Administrator SHALL be able to record a payment by entering: buyer name (searchable), amount paid, date of payment, payment method (Cash, EcoCash, ZIPIT, or Bank Transfer), optional reference number, and optional Proof_of_Payment attachment (image or PDF).
2. WHEN a Project_Administrator saves a payment record, THE System SHALL add the payment as a new Ledger entry immediately and recalculate the Buyer's outstanding balance.
3. THE System SHALL record on every Ledger entry: the user who created it, the timestamp of creation, and the payment details.
4. THE System SHALL calculate the Buyer's outstanding balance as the total contract value plus all Additional_Charges minus the sum of all verified Ledger payment entries.
5. IF a Project_Administrator attempts to delete a verified payment record, THEN THE System SHALL reject the deletion and display an error message.
6. WHEN a Project_Administrator records a Reversal for a payment, THE System SHALL add a new Ledger entry negating the original amount, require a reason to be entered, and log the reversal with the administrator's identity and timestamp.

---

### Requirement 8: Buyer-Submitted Proof of Payment

**User Story:** As a buyer, I want to upload my proof of payment through my portal, so that the administrator can verify and record my payment without requiring me to contact them separately.

#### Acceptance Criteria

1. WHEN a Buyer uploads a Proof_of_Payment via the Buyer Portal, THE System SHALL add the submission to the Project_Administrator's verification queue with a status of Pending.
2. WHEN a Project_Administrator approves a Pending Proof_of_Payment submission, THE System SHALL record the payment as a verified Ledger entry and update the Buyer's balance.
3. WHEN a Project_Administrator rejects a Pending Proof_of_Payment submission, THE System SHALL notify the Buyer by in-app notification and email, including the reason for rejection.
4. THE System SHALL display all Pending Proof_of_Payment submissions to the Project_Administrator in a dedicated queue screen.

---

### Requirement 9: Ledger Integrity

**User Story:** As a system owner, I want all financial records to be immutable and fully auditable, so that the integrity of buyer accounts cannot be compromised.

#### Acceptance Criteria

1. THE System SHALL store all payments, Additional_Charges, and Reversals as individual, append-only Ledger entries — no Ledger entry shall be modified or deleted after it is saved.
2. THE System SHALL calculate a Buyer's current balance at all times from the sum of all Ledger entries, never from a stored balance field.
3. WHEN a Ledger entry is created, THE System SHALL record the creating user's identity, the entry timestamp, the entry type (payment, charge, reversal), and the entry amount.
4. THE System SHALL maintain an audit log of every action performed in the system, recording: the acting user, the timestamp, the action type, the affected record, and any changed values.
5. THE System SHALL prevent any user from editing or deleting an entry in the audit log.
6. WHEN an Additional_Charge has been viewed by the Buyer, THE System SHALL prevent the charge from being silently removed — any removal requires a Reversal entry with a logged reason.

---

### Requirement 10: Additional Development Charges

**User Story:** As a Project_Administrator, I want to add development charges to one or all buyer accounts, so that buyers are informed of and billed for additional project costs.

#### Acceptance Criteria

1. THE Project_Administrator SHALL be able to add an Additional_Charge to a single Buyer's account by providing: charge name or description, amount, effective date, and an optional supporting document or notice.
2. THE Project_Administrator SHALL be able to add an Additional_Charge to all Buyers in a project simultaneously using the same charge details.
3. WHEN an Additional_Charge is saved, THE System SHALL add it to the affected Buyer's Ledger as a distinct line item labelled as an additional charge, not a payment.
4. WHEN an Additional_Charge is saved, THE System SHALL immediately increase the affected Buyer's total amount owed by the charge amount.
5. WHEN an Additional_Charge is added, THE System SHALL notify each affected Buyer by in-app notification and email, including the charge name, amount, and any attached explanation or document.
6. THE System SHALL display a Buyer's balance breakdown as: original contract value, total additional charges, total paid, and remaining balance.

---

### Requirement 11: Penalty Calculation and Approval

**User Story:** As a Project_Administrator, I want the system to calculate penalties for late payments and present them for my review, so that penalties are applied consistently but with administrator oversight.

#### Acceptance Criteria

1. THE System SHALL calculate penalties automatically based on the project's configured penalty rules (flat fee or percentage per month overdue) and grace period.
2. WHEN a penalty is calculated, THE System SHALL present it to the Project_Administrator for review before applying it to the Buyer's Ledger.
3. THE System SHALL not apply any calculated penalty to a Buyer's Ledger without explicit Project_Administrator approval.
4. WHEN a Project_Administrator approves a penalty, THE System SHALL add it to the Buyer's Ledger as a separate entry.
5. WHEN a Project_Administrator rejects or waives a penalty, THE System SHALL log the rejection with the administrator's identity, timestamp, and reason.

---

### Requirement 12: Reconciliation

**User Story:** As a Project_Administrator, I want to close reconciliation periods and lock balances, so that month-end figures are final and auditable.

#### Acceptance Criteria

1. THE System SHALL support a configurable reconciliation period, defaulting to monthly.
2. WHILE a reconciliation period is open, THE System SHALL display a visible note on all reports and in the Buyer Portal indicating that figures are provisional.
3. WHEN a Project_Administrator closes a reconciliation period, THE System SHALL mark all balances as at the closing date as final.
4. WHEN a payment is recorded with a date that falls within a previously closed reconciliation period, THE System SHALL flag the payment and require explicit Project_Administrator approval before applying it to the Ledger.
5. WHEN a reconciliation period is closed, THE System SHALL require the Project_Administrator to resolve all Pending Proof_of_Payment entries before the period can be closed.

---

### Requirement 13: Document Management

**User Story:** As a buyer, I want to access all documents related to my account in one place, so that I can review agreements, receipts, and notices at any time.

#### Acceptance Criteria

1. THE System SHALL make the following document types available to a Buyer in their portal: Agreement of Sale, amendments, payment receipts, Proof_of_Payment images, Balance_Confirmation_Letters, title deed, notices, levy documents, and any other documents uploaded by the Project_Administrator.
2. WHEN a verified payment is recorded, THE System SHALL automatically generate a payment receipt and attach it to the Buyer's document vault.
3. THE Project_Administrator SHALL be able to upload a document to a Buyer's account and categorise it as one of: Agreement, Receipt, Notice, Levy, Title Deed, ID Document, or Other.
4. WHEN a new version of a document is uploaded, THE System SHALL retain all previous versions and make the version history accessible.
5. THE Project_Administrator SHALL be able to generate a Balance_Confirmation_Letter on demand for any Buyer.
6. THE Project_Administrator SHALL be able to request a document from a Buyer, which THE System SHALL display as a task in the Buyer's portal.

---

### Requirement 14: Document Requests

**User Story:** As a Project_Administrator, I want to request documents from buyers, so that required paperwork can be collected without requiring physical meetings.

#### Acceptance Criteria

1. THE Project_Administrator SHALL be able to upload a document to a Buyer's account and categorise it for the Buyer's reference.
2. WHEN a document is uploaded to a Buyer's account, THE System SHALL notify the Buyer by in-app notification and email.
3. THE Project_Administrator SHALL be able to request a specific document from a Buyer, which THE System SHALL display as a pending task in the Buyer's portal.
4. THE System SHALL display all outstanding document requests visible to the Project_Administrator.

---

### Requirement 15: Excel Migration Import

**User Story:** As a Project_Administrator, I want to import existing buyer, stand, and payment records from Excel, so that I can migrate from the old system without losing historical data.

#### Acceptance Criteria

1. THE System SHALL provide a Migration_Import wizard with the following steps in order: download template, upload file, map columns, validate, preview, and commit.
2. THE System SHALL accept upload files in .xlsx, .xls, and .csv formats.
3. WHEN the validation step is run, THE System SHALL display all errors in a table and provide a downloadable error report.
4. WHEN the preview step is reached, THE System SHALL display a summary and the first 10 rows of the mapped data.
5. WHEN the commit step is executed, THE System SHALL process the import as a batch operation, allow partial success, and display a progress indicator.
6. THE System SHALL tag all imported historical payment records with the label "Migrated from Excel".
7. THE System SHALL prevent a Migration_Import from overwriting any verified payment record already stored in the Ledger.
8. THE System SHALL log every Migration_Import operation, recording the importing user, timestamp, file name, and outcome.
9. THE System SHALL provide a dry-run option that validates and previews the import without committing any data.
10. WHEN a Migration_Import is committed, THE System SHALL generate a migration reconciliation report showing, for each Buyer: the Excel balance, the StandVault balance, and any discrepancies.

---

### Requirement 16: Reporting

**User Story:** As a Project_Administrator, I want to generate and export reports, so that I can monitor project health and communicate financial status to stakeholders.

#### Acceptance Criteria

1. THE Project_Administrator SHALL be able to generate the following reports: Aged Debt, Collection Summary, Defaulters List, Project Summary, Projected Cashflow, Month-End Report, and Additional Charges Report.
2. THE Project_Administrator SHALL be able to export any report to a downloadable file format.
3. WHILE a reconciliation period is open, THE System SHALL include a visible provisional data notice on all generated reports.

---

### Requirement 17: Notifications and Communications

**User Story:** As a Project_Administrator, I want the system to send automatic notifications to buyers and administrators, so that all parties are kept informed without manual follow-up.

#### Acceptance Criteria

1. THE System SHALL automatically notify a Buyer when: a payment is verified, a payment is rejected, an Additional_Charge is added, a document is uploaded to their account, a document is requested from them, a payment due reminder is triggered, a Milestone is reached, or an announcement is posted.
2. THE System SHALL automatically notify the Project_Administrator when: a Buyer submits a Proof_of_Payment, a Buyer uploads a requested document, a Buyer raises a support query, or a Buyer reaches full payment (100% Milestone).
3. THE Project_Administrator SHALL be able to send an announcement to all Buyers in a project or to a selected subset of Buyers.
4. THE System SHALL deliver all notifications both in-app and by email.

---

### Requirement 18: Payment Milestones

**User Story:** As a buyer, I want to receive recognition when I reach payment milestones, so that I feel motivated and informed about my progress toward full ownership.

#### Acceptance Criteria

1. THE System SHALL trigger a Milestone notification when a Buyer's total verified payments reach each of the following thresholds: deposit cleared, 25%, 50%, 75%, and 100% of the total amount owed.
2. WHEN a Milestone is triggered, THE System SHALL send the Buyer an in-app notification and email with a congratulatory message.
3. THE System SHALL display earned Milestone badges on the Buyer's profile in the Admin Panel.
4. WHEN a Buyer reaches the 100% Milestone, THE System SHALL notify the Project_Administrator to begin the title deed handover process.

---

### Requirement 19: Admin Panel Dashboard and Screens

**User Story:** As a Project_Administrator, I want a dashboard and structured screens for managing all aspects of my project, so that I can work efficiently without navigating complex menus.

#### Acceptance Criteria

1. THE System SHALL provide a dashboard displaying: total buyers, total collected, total outstanding, pending Proof_of_Payment submissions, and recent activity.
2. THE System SHALL provide a Buyer List screen with searchable and filterable table of all buyers in the administrator's assigned projects.
3. THE System SHALL provide a Buyer Profile screen showing: full buyer details, complete Ledger, document vault, and audit trail for that buyer.
4. THE System SHALL provide an Additional Charges screen for adding charges to a single Buyer or all Buyers in a project.
5. THE System SHALL provide a Proof_of_Payment Queue screen listing all Pending submissions with approve and reject actions.

---

### Requirement 20: Buyer Portal Screens

**User Story:** As a buyer, I want a clear and informative portal, so that I can understand my account status and access everything I need without contacting the administrator.

#### Acceptance Criteria

1. THE System SHALL provide a Buyer Portal dashboard displaying: balance breakdown (contract value, additional charges, total paid, remaining balance), a payment progress bar, and a balance status badge (Ahead, On Track, or In Arrears).
2. THE System SHALL provide a Payment History screen showing the Buyer's complete Ledger in chronological order.
3. THE System SHALL provide an Instalment Schedule screen showing the Buyer's full schedule with due dates, amounts due, amounts paid, and running balance.
4. THE System SHALL provide a Documents screen where the Buyer can view, download, and upload documents in their vault.
5. THE System SHALL provide an Additional Charges screen where the Buyer can view all charges added to their account with descriptions and amounts.
6. THE System SHALL provide an Announcements screen where the Buyer can view all project announcements.
7. THE System SHALL provide a Support or Disputes screen where the Buyer can raise a query or dispute.
