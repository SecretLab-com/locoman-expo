# LocoMotivate User Management & Content Review Plan

**Version:** 1.0  
**Last Updated:** January 2025  
**Author:** Manus AI

---

## Executive Summary

This document presents a comprehensive plan for user management and content review systems within the LocoMotivate platform. The plan builds upon the existing five-tier role hierarchy (Shopper, Client, Trainer, Manager, Coordinator) and introduces structured workflows for user lifecycle management, content moderation, and quality assurance. The goal is to create a scalable, auditable system that maintains platform integrity while enabling trainers to deliver high-quality fitness content to their clients.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [User Management System](#user-management-system)
3. [Content Review System](#content-review-system)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Database Schema Extensions](#database-schema-extensions)
6. [API Specifications](#api-specifications)
7. [UI/UX Requirements](#uiux-requirements)

---

## Current State Analysis

### Existing User Management Capabilities

The platform currently supports basic user management through the following mechanisms:

| Capability | Current Implementation | Gaps |
|------------|----------------------|------|
| User Registration | OAuth via Manus | No self-registration, no email verification |
| Role Assignment | Manual via `auth.updateRole` | No approval workflow, no role request system |
| Trainer Onboarding | `trainers.approve/reject` mutations | Limited vetting process, no documentation requirements |
| User Suspension | `trainers.suspend` mutation | Only for trainers, no general user suspension |
| Activity Logging | `activityLogs` table | Limited to specific actions, no comprehensive audit trail |

### Existing Content Review Capabilities

Content review is currently limited to bundle approval:

| Capability | Current Implementation | Gaps |
|------------|----------------------|------|
| Bundle Review | `bundleApproval.*` routes | No trainer profile review, no message moderation |
| Review Queue | `/manager/approvals` page | Single queue, no priority system |
| Review History | `bundleReviews` table | Limited metadata, no reviewer notes |
| Rejection Feedback | `rejectionReason` field | No structured feedback categories |

---

## User Management System

### 2.1 User Lifecycle States

The proposed user lifecycle introduces clear states with defined transitions:

```
                                    ┌──────────────┐
                                    │   PENDING    │
                                    │ (New signup) │
                                    └──────┬───────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                       ┌──────────┐  ┌──────────┐  ┌──────────┐
                       │ VERIFIED │  │ REJECTED │  │ EXPIRED  │
                       │          │  │          │  │          │
                       └────┬─────┘  └──────────┘  └──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  ACTIVE  │  │ SUSPENDED│  │ BANNED   │
        │          │◄─┤          │  │          │
        └────┬─────┘  └──────────┘  └──────────┘
             │
             ▼
        ┌──────────┐
        │ INACTIVE │
        │(Voluntary)│
        └──────────┘
```

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| **Pending** | New user awaiting verification | Complete profile, verify email |
| **Verified** | Email verified, awaiting activation | Request role upgrade |
| **Active** | Fully functional account | All role-based actions |
| **Suspended** | Temporarily restricted | View-only access, appeal |
| **Banned** | Permanently restricted | None (account locked) |
| **Inactive** | Voluntarily deactivated | Reactivate |
| **Rejected** | Application denied | Reapply after cooldown |
| **Expired** | Verification timeout | Re-register |

### 2.2 Role Upgrade Workflow

Users can request role upgrades through a structured application process:

**Shopper → Client Pathway**

This transition occurs automatically when a user accepts a trainer invitation or has their join request approved. No manual application is required.

**Shopper/Client → Trainer Pathway**

Trainers require vetting before they can create bundles and manage clients. The application process includes:

| Step | Description | Responsible Party |
|------|-------------|-------------------|
| 1. Application Submission | User submits trainer application with credentials | Applicant |
| 2. Document Upload | Certifications, insurance, business registration | Applicant |
| 3. Initial Review | Automated checks (completeness, duplicates) | System |
| 4. Manual Review | Manager reviews application and documents | Manager |
| 5. Interview (Optional) | Video call for high-volume applicants | Manager |
| 6. Decision | Approve, reject, or request more information | Manager |
| 7. Onboarding | Welcome email, training materials, profile setup | System |

**Trainer → Manager Pathway**

Manager promotions are internal decisions made by coordinators and require:

| Requirement | Description |
|-------------|-------------|
| Tenure | Minimum 6 months as active trainer |
| Performance | Positive client feedback, no policy violations |
| Training | Completion of manager training module |
| Nomination | Recommendation from existing manager |
| Approval | Coordinator sign-off |

### 2.3 User Suspension & Appeals

The suspension system provides graduated enforcement:

| Level | Duration | Trigger | Appeal Window |
|-------|----------|---------|---------------|
| **Warning** | N/A | Minor policy violation | N/A |
| **Temporary Suspension** | 7 days | Repeated warnings, content violation | 48 hours |
| **Extended Suspension** | 30 days | Serious violation, client complaints | 7 days |
| **Permanent Ban** | Indefinite | Fraud, harassment, legal issues | 30 days |

The appeals process follows this workflow:

```
User Submits Appeal → Manager Reviews → Decision
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐         ┌──────────┐         ┌──────────┐
              │ UPHELD   │         │ MODIFIED │         │ REVERSED │
              │(No change)│        │(Reduced) │         │(Restored)│
              └──────────┘         └──────────┘         └──────────┘
```

### 2.4 User Profile Management

Each user type has specific profile requirements:

**Shopper Profile (Minimal)**

| Field | Required | Editable | Visible To |
|-------|----------|----------|------------|
| Name | Yes | Yes | Self, Trainers |
| Email | Yes | Yes | Self only |
| Phone | No | Yes | Self only |
| Photo | No | Yes | Self, Trainers |

**Client Profile (Extended)**

| Field | Required | Editable | Visible To |
|-------|----------|----------|------------|
| All Shopper fields | Yes | Yes | As above |
| Goals | No | Yes | Self, Assigned Trainer |
| Health Notes | No | Yes | Self, Assigned Trainer |
| Preferences | No | Yes | Self, Assigned Trainer |

**Trainer Profile (Public)**

| Field | Required | Editable | Reviewable |
|-------|----------|----------|------------|
| All Client fields | Yes | Yes | No |
| Username | Yes | Yes | Yes (uniqueness) |
| Bio | Yes | Yes | Yes (content) |
| Specialties | Yes | Yes | Yes (accuracy) |
| Certifications | Yes | Upload only | Yes (verification) |
| Social Links | No | Yes | Yes (validity) |
| Profile Photo | Yes | Yes | Yes (appropriateness) |

---

## Content Review System

### 3.1 Content Types Requiring Review

The platform generates multiple content types that require moderation:

| Content Type | Creator | Review Trigger | Priority |
|--------------|---------|----------------|----------|
| **Bundle Drafts** | Trainer | Submit for review | High |
| **Trainer Profiles** | Trainer | Initial setup, major edits | High |
| **Profile Photos** | All users | Upload | Medium |
| **Bundle Images** | Trainer | Upload custom image | Medium |
| **Messages** | All users | Flagged by recipient | Low |
| **Reviews/Ratings** | Clients | Automatic (future feature) | Medium |

### 3.2 Review Queue Architecture

The review system implements a priority-based queue with multiple channels:

```
                    ┌─────────────────────────────────────┐
                    │         CONTENT SUBMISSION          │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         AUTOMATED SCREENING         │
                    │  • Profanity filter                 │
                    │  • Image safety check               │
                    │  • Duplicate detection              │
                    │  • Spam detection                   │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │   AUTO-APPROVE  │     │  MANUAL QUEUE   │     │  AUTO-REJECT    │
    │                 │     │                 │     │                 │
    │ • Low risk      │     │ • Medium risk   │     │ • High risk     │
    │ • Trusted user  │     │ • New user      │     │ • Policy viol.  │
    │ • Minor edit    │     │ • Major change  │     │ • Flagged       │
    └─────────────────┘     └────────┬────────┘     └─────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ PRIORITY │    │ STANDARD │    │   LOW    │
              │  QUEUE   │    │  QUEUE   │    │  QUEUE   │
              │          │    │          │    │          │
              │ • New    │    │ • Edits  │    │ • Minor  │
              │   trainer│    │ • Updates│    │   flags  │
              │ • First  │    │          │    │          │
              │   bundle │    │          │    │          │
              └──────────┘    └──────────┘    └──────────┘
```

### 3.3 Review Workflow States

Each reviewable item follows a standardized state machine:

| State | Description | Next States |
|-------|-------------|-------------|
| **Draft** | Work in progress | Submitted |
| **Submitted** | Awaiting review | In Review, Auto-Approved, Auto-Rejected |
| **In Review** | Assigned to reviewer | Approved, Rejected, Changes Requested |
| **Changes Requested** | Returned for revision | Submitted (resubmit) |
| **Approved** | Passed review | Published |
| **Rejected** | Failed review | Draft (appeal), Archived |
| **Published** | Live on platform | Flagged, Unpublished |
| **Flagged** | Reported by users | In Review |
| **Unpublished** | Removed from public | Draft (edit), Archived |
| **Archived** | Permanently removed | None |

### 3.4 Review Actions & Feedback

Reviewers have structured options for each decision:

**Approval Actions**

| Action | Description | Effect |
|--------|-------------|--------|
| Approve | Content meets all guidelines | Publish immediately |
| Approve with Notes | Minor suggestions for future | Publish + notify creator |
| Conditional Approve | Requires minor fix | Publish after auto-check |

**Rejection Actions**

| Action | Description | Effect |
|--------|-------------|--------|
| Request Changes | Specific issues to address | Return to creator |
| Reject | Does not meet guidelines | Block + notify creator |
| Reject & Warn | Policy violation | Block + add warning to account |
| Reject & Suspend | Serious violation | Block + suspend account |

**Feedback Categories**

| Category | Examples |
|----------|----------|
| **Content Quality** | Incomplete description, poor image quality |
| **Accuracy** | Misleading claims, incorrect pricing |
| **Policy Violation** | Prohibited products, inappropriate content |
| **Legal Concern** | Copyright infringement, health claims |
| **Technical Issue** | Broken links, formatting errors |

### 3.5 Automated Screening Rules

The system implements automated checks before human review:

**Text Content Screening**

| Check | Action | Threshold |
|-------|--------|-----------|
| Profanity filter | Flag for review | Any match |
| Spam detection | Auto-reject | Score > 0.8 |
| Contact info in bio | Flag for review | Email/phone detected |
| Competitor mentions | Flag for review | Brand name match |
| Health claims | Flag for review | Medical terminology |

**Image Content Screening**

| Check | Action | Threshold |
|-------|--------|-----------|
| Adult content | Auto-reject | Confidence > 0.7 |
| Violence | Auto-reject | Confidence > 0.7 |
| Text overlay | Flag for review | > 20% coverage |
| Low quality | Flag for review | Resolution < 400px |
| Stock photo | Flag for review | Reverse image match |

### 3.6 Trust Score System

Users accumulate trust scores that affect review requirements:

| Factor | Points | Description |
|--------|--------|-------------|
| Account age | +1/month | Max 12 points |
| Verified email | +5 | One-time |
| Completed profile | +5 | One-time |
| First approved content | +10 | One-time |
| Each approved content | +2 | Ongoing |
| Client positive feedback | +1 | Per feedback |
| Warning received | -10 | Per warning |
| Content rejected | -5 | Per rejection |
| Suspension | -25 | Per suspension |

**Trust Tiers**

| Tier | Score Range | Review Treatment |
|------|-------------|------------------|
| **New** | 0-20 | All content manually reviewed |
| **Established** | 21-50 | Minor edits auto-approved |
| **Trusted** | 51-100 | Most content auto-approved |
| **Verified** | 100+ | Expedited review, priority support |

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add user status field to schema | High | 2h | None |
| Create user_status_history table | High | 2h | None |
| Implement status transition API | High | 4h | Schema changes |
| Add suspension/ban UI for managers | High | 4h | API |
| Create appeals table and API | Medium | 4h | Status system |

### Phase 2: Role Management (Weeks 3-4)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create trainer_applications table | High | 2h | None |
| Build trainer application form | High | 6h | Schema |
| Implement document upload for certifications | High | 4h | S3 storage |
| Create application review queue | High | 6h | Application form |
| Add application status notifications | Medium | 3h | Review queue |

### Phase 3: Content Review Enhancement (Weeks 5-6)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create unified review_queue table | High | 3h | None |
| Implement priority queue logic | High | 4h | Queue table |
| Add review assignment system | Medium | 4h | Queue logic |
| Create reviewer dashboard | High | 8h | Assignment system |
| Implement feedback templates | Medium | 3h | Dashboard |

### Phase 4: Automated Screening (Weeks 7-8)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Integrate text moderation API | Medium | 4h | None |
| Integrate image moderation API | Medium | 4h | None |
| Create screening rules engine | Medium | 6h | Moderation APIs |
| Implement trust score calculation | Medium | 4h | None |
| Add auto-approve/reject logic | Medium | 4h | Trust scores |

### Phase 5: Reporting & Analytics (Weeks 9-10)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create moderation analytics dashboard | Low | 6h | Review system |
| Implement reviewer performance metrics | Low | 4h | Review system |
| Add content quality trends | Low | 4h | Analytics |
| Create compliance reports | Low | 4h | All systems |

---

## Database Schema Extensions

### New Tables

**user_status_history**

```sql
CREATE TABLE user_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  previousStatus ENUM('pending', 'verified', 'active', 'suspended', 'banned', 'inactive') NOT NULL,
  newStatus ENUM('pending', 'verified', 'active', 'suspended', 'banned', 'inactive') NOT NULL,
  reason TEXT,
  changedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (changedBy) REFERENCES users(id)
);
```

**trainer_applications**

```sql
CREATE TABLE trainer_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  status ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'withdrawn') DEFAULT 'draft',
  businessName VARCHAR(255),
  yearsExperience INT,
  certifications JSON,
  insuranceInfo JSON,
  specialties JSON,
  motivation TEXT,
  references JSON,
  documentsJson JSON,
  reviewerId INT,
  reviewNotes TEXT,
  submittedAt TIMESTAMP,
  reviewedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (reviewerId) REFERENCES users(id)
);
```

**appeals**

```sql
CREATE TABLE appeals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  appealType ENUM('suspension', 'ban', 'content_rejection', 'application_rejection') NOT NULL,
  relatedEntityType VARCHAR(64),
  relatedEntityId INT,
  reason TEXT NOT NULL,
  evidence JSON,
  status ENUM('pending', 'in_review', 'upheld', 'modified', 'reversed') DEFAULT 'pending',
  reviewerId INT,
  reviewNotes TEXT,
  decision TEXT,
  submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (reviewerId) REFERENCES users(id)
);
```

**review_queue**

```sql
CREATE TABLE review_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contentType ENUM('bundle', 'profile', 'image', 'message', 'review') NOT NULL,
  contentId INT NOT NULL,
  creatorId INT NOT NULL,
  priority ENUM('urgent', 'high', 'standard', 'low') DEFAULT 'standard',
  status ENUM('pending', 'assigned', 'in_review', 'completed') DEFAULT 'pending',
  assignedTo INT,
  screeningResults JSON,
  trustScore INT,
  submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assignedAt TIMESTAMP,
  completedAt TIMESTAMP,
  FOREIGN KEY (creatorId) REFERENCES users(id),
  FOREIGN KEY (assignedTo) REFERENCES users(id)
);
```

**content_flags**

```sql
CREATE TABLE content_flags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contentType ENUM('bundle', 'profile', 'image', 'message', 'review') NOT NULL,
  contentId INT NOT NULL,
  reporterId INT NOT NULL,
  reason ENUM('inappropriate', 'spam', 'misleading', 'harassment', 'copyright', 'other') NOT NULL,
  details TEXT,
  status ENUM('pending', 'reviewed', 'actioned', 'dismissed') DEFAULT 'pending',
  reviewerId INT,
  action ENUM('none', 'warning', 'content_removed', 'user_suspended', 'user_banned'),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewedAt TIMESTAMP,
  FOREIGN KEY (reporterId) REFERENCES users(id),
  FOREIGN KEY (reviewerId) REFERENCES users(id)
);
```

**user_trust_scores**

```sql
CREATE TABLE user_trust_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL UNIQUE,
  score INT DEFAULT 0,
  tier ENUM('new', 'established', 'trusted', 'verified') DEFAULT 'new',
  lastCalculatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  factors JSON,
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

### Schema Modifications

**users table additions**

```sql
ALTER TABLE users ADD COLUMN status ENUM('pending', 'verified', 'active', 'suspended', 'banned', 'inactive') DEFAULT 'active';
ALTER TABLE users ADD COLUMN suspendedAt TIMESTAMP;
ALTER TABLE users ADD COLUMN suspendedUntil TIMESTAMP;
ALTER TABLE users ADD COLUMN suspensionReason TEXT;
ALTER TABLE users ADD COLUMN warningCount INT DEFAULT 0;
```

---

## API Specifications

### User Management Routes

```typescript
userManagement: router({
  // Status management
  getStatus: protectedProcedure.query(/* Get current user status */),
  suspend: managerProcedure.input(/* userId, reason, duration */).mutation(/* Suspend user */),
  unsuspend: managerProcedure.input(/* userId */).mutation(/* Remove suspension */),
  ban: coordinatorProcedure.input(/* userId, reason */).mutation(/* Permanently ban */),
  
  // Appeals
  submitAppeal: protectedProcedure.input(/* appealType, reason, evidence */).mutation(/* Submit appeal */),
  listAppeals: managerProcedure.query(/* Get pending appeals */),
  reviewAppeal: managerProcedure.input(/* appealId, decision, notes */).mutation(/* Process appeal */),
  
  // Trainer applications
  submitApplication: protectedProcedure.input(/* application data */).mutation(/* Submit trainer app */),
  getApplication: protectedProcedure.query(/* Get own application status */),
  listApplications: managerProcedure.query(/* Get pending applications */),
  reviewApplication: managerProcedure.input(/* appId, decision, notes */).mutation(/* Review app */),
})
```

### Content Review Routes

```typescript
contentReview: router({
  // Queue management
  getQueue: managerProcedure.input(/* filters */).query(/* Get review queue */),
  assignToMe: managerProcedure.input(/* itemId */).mutation(/* Self-assign item */),
  getMyAssignments: managerProcedure.query(/* Get assigned items */),
  
  // Review actions
  approve: managerProcedure.input(/* itemId, notes */).mutation(/* Approve content */),
  reject: managerProcedure.input(/* itemId, reason, feedback */).mutation(/* Reject content */),
  requestChanges: managerProcedure.input(/* itemId, feedback */).mutation(/* Request changes */),
  escalate: managerProcedure.input(/* itemId, reason */).mutation(/* Escalate to coordinator */),
  
  // Flagging
  flagContent: protectedProcedure.input(/* contentType, contentId, reason */).mutation(/* Report content */),
  listFlags: managerProcedure.query(/* Get flagged content */),
  resolveFlag: managerProcedure.input(/* flagId, action */).mutation(/* Resolve flag */),
  
  // Trust scores
  getTrustScore: protectedProcedure.query(/* Get own trust score */),
  recalculateTrustScore: managerProcedure.input(/* userId */).mutation(/* Recalculate score */),
})
```

---

## UI/UX Requirements

### Manager Dashboard Enhancements

The manager dashboard should display key metrics and quick actions:

| Widget | Content | Priority |
|--------|---------|----------|
| **Pending Reviews** | Count by type, oldest item age | High |
| **Pending Applications** | Trainer applications awaiting review | High |
| **Active Suspensions** | Users currently suspended | Medium |
| **Recent Flags** | Content flagged in last 24h | Medium |
| **Trust Score Distribution** | Chart of user trust tiers | Low |

### Review Queue Interface

The review queue should support efficient processing:

| Feature | Description |
|---------|-------------|
| **Filters** | By content type, priority, status, date range |
| **Sorting** | By priority, submission date, creator trust score |
| **Bulk Actions** | Approve/reject multiple similar items |
| **Preview Panel** | Side panel showing content details |
| **Quick Actions** | One-click approve/reject with default feedback |
| **History** | View previous reviews for same creator |

### Trainer Application Flow

The application process should be mobile-friendly with clear progress:

| Step | Screen | Fields |
|------|--------|--------|
| 1 | Basic Info | Business name, years experience, motivation |
| 2 | Certifications | Upload certificates, expiry dates |
| 3 | Specialties | Select from predefined list, add custom |
| 4 | Insurance | Upload proof of insurance |
| 5 | References | Contact info for 2-3 references |
| 6 | Review | Summary of all entered information |
| 7 | Submit | Terms acceptance, submission confirmation |

### User Status Indicators

Visual indicators should communicate user status across the platform:

| Status | Badge Color | Icon | Tooltip |
|--------|-------------|------|---------|
| Pending | Yellow | ⏳ | "Account pending verification" |
| Verified | Blue | ✓ | "Email verified" |
| Active | Green | ● | "Active account" |
| Suspended | Orange | ⚠ | "Account suspended until [date]" |
| Banned | Red | ✕ | "Account permanently banned" |
| Trusted | Gold | ★ | "Trusted member" |

---

## Appendix: Policy Templates

### Suspension Notice Template

```
Subject: Your LocoMotivate Account Has Been Suspended

Dear [User Name],

Your account has been suspended for [duration] due to [reason].

Suspension Details:
- Start Date: [date]
- End Date: [date]
- Reason: [detailed reason]

During this suspension, you will have limited access to the platform.

If you believe this suspension was made in error, you may submit an appeal
within [appeal window] days by visiting [appeal link].

Please review our Community Guidelines at [link] to understand our policies.

Best regards,
The LocoMotivate Team
```

### Content Rejection Template

```
Subject: Your [Content Type] Requires Changes

Dear [User Name],

Your [content type] "[content title]" has been reviewed and requires changes
before it can be published.

Feedback:
[Structured feedback from reviewer]

Suggested Improvements:
[Specific actionable suggestions]

Please make the requested changes and resubmit for review.

If you have questions about this feedback, please contact support.

Best regards,
The LocoMotivate Review Team
```

---

## Summary

This plan provides a comprehensive framework for user management and content review that:

1. **Establishes clear user lifecycle states** with defined transitions and enforcement levels
2. **Creates structured role upgrade pathways** with appropriate vetting for trainers
3. **Implements a priority-based review queue** with automated screening
4. **Introduces a trust score system** to reward good behavior and reduce review burden
5. **Provides detailed implementation roadmap** with effort estimates
6. **Defines database schema extensions** for all new functionality
7. **Specifies API contracts** for frontend integration
8. **Outlines UI/UX requirements** for manager tools

The phased implementation approach allows for incremental delivery while building toward a complete moderation system that scales with platform growth.

---

*This document should be reviewed and updated as implementation progresses and requirements evolve.*
