# PT Onboarding + KYC Process (Bright.Blue / Adyen)

## Overview

This document outlines the proposed onboarding and KYC process for
Personal Trainers (PTs) using the Bright.Blue platform integrated with
Adyen. The goal is to provide a simple onboarding experience while
ensuring compliance with Adyen's KYC requirements.

The Bright.Blue app acts as the **control and status layer**, while the
**regulated KYC process is completed via Adyen's hosted verification
flow**.

------------------------------------------------------------------------

# 1. PT Submits Basic Onboarding Form in the App

The PT should complete a simple onboarding form inside the app with the
core details required to start the setup.

## Suggested Fields

-   First name
-   Last name
-   Business / trading name (if applicable)
-   Email address
-   Mobile number
-   Date of birth
-   Address
-   Bank account details (if required later)
-   Any additional minimum information required for Adyen onboarding

At minimum, the form **must include an email address or mobile number**
so a KYC link can be sent.

------------------------------------------------------------------------

# 2. Bright.Blue Creates the KYC Request in Adyen

Once the PT submits the onboarding form:

1.  Bright.Blue receives the form submission.
2.  Bright.Blue creates a **KYC / onboarding request in Adyen**.
3.  Adyen generates a **secure identity verification link**.
4.  The link is sent to the PT via **email or SMS**.

------------------------------------------------------------------------

# 3. App Displays Onboarding / KYC Status

The app must show a clear onboarding status so PTs can see progress
without needing support.

## Example Status States

-   Start setup
-   Details submitted
-   Verification required
-   Under review
-   More information required
-   Active
-   Verification failed
-   Account rejected

This ensures transparency and reduces support requests.

------------------------------------------------------------------------

# 4. PT Completes KYC Outside the App

The PT clicks the secure link and completes identity verification
directly in the **Adyen-hosted KYC flow**.

This approach:

-   Keeps regulated identity verification **outside the mobile app**
-   Uses **Adyen's compliant infrastructure**
-   Allows the Bright.Blue app to remain a **tracking and status
    interface**

------------------------------------------------------------------------

# 5. App Updates Status After Submission

After the PT submits their documents in Adyen:

-   The onboarding status should update to:
    -   **KYC Submitted**
    -   or **Under Review**

Ideally this update happens **automatically via Adyen webhook or API
status updates**.

------------------------------------------------------------------------

# 6. Adyen Reviews and Approves

Once Adyen completes verification:

### If Approved

The status updates to:

-   **Approved**
-   **Active**

The PT account becomes fully active and can access all platform
features.

### If More Information is Required

The status updates to:

-   **Additional Information Required**
-   or **Rejected**

The PT is prompted to provide additional information or repeat
verification.

------------------------------------------------------------------------

# User Flow

    PT opens app
       ↓
    PT completes onboarding form
       ↓
    Bright.Blue receives submission
       ↓
    Bright.Blue creates Adyen KYC request
       ↓
    Adyen sends verification link via Email/SMS
       ↓
    App status = "KYC Link Sent"
       ↓
    PT completes verification in Adyen
       ↓
    App status = "Under Review"
       ↓
    Adyen approves verification
       ↓
    App status = "Active"

------------------------------------------------------------------------

# Status Logic

  -----------------------------------------------------------------------
  Status                  Meaning                 Action
  ----------------------- ----------------------- -----------------------
  Start setup             PT has not filled the   Prompt to start
                          form                    onboarding

  Details submitted       Basic details completed Bright.Blue initiates
                                                 KYC manually

  Verification required   Adyen verification link PT must complete
                          sent / waiting on PT    verification

  Under review            KYC submitted to Adyen  Await approval

  More information        Adyen needs additional  Prompt PT to update
  required                information             details / documents

  Active                  Verification approved   Platform access enabled

  Verification failed     Documents or data were  Prompt PT to correct
                          invalid                 and retry

  Account rejected        Compliance failed       Final rejection /
                                                  support follow-up
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# Adyen Documentation Alignment

Adyen's own verification docs describe lower-level verification and
capability statuses such as:

- `AWAITING_DATA`
- `DATA_PROVIDED`
- `PENDING`
- `INVALID_DATA`
- `RETRY_LIMIT_REACHED`
- `PASSED`
- `FAILED`

For the Bright.Blue trainer app, these are mapped into simpler
user-facing statuses:

- `Start setup` covers no trainer intake submitted yet
- `Details submitted` covers Bright.Blue receiving the trainer's intake
- `Verification required` covers the Adyen verification step waiting on
  the trainer
- `Under review` maps to Adyen verification in progress / pending review
- `More information required` maps to cases where Adyen requires more
  data or remediation
- `Verification failed` maps to retryable invalid verification outcomes
- `Account rejected` maps to final compliance failure / non-retryable
  rejection
- `Active` maps to successful verification and payout activation

------------------------------------------------------------------------

# Wireframe Concepts

## 1. PT Onboarding Form Screen

    ------------------------------------------------
    Header: Complete Your Setup

    Intro:
    Please fill in your details to start onboarding.

    First name            [____________]
    Last name             [____________]
    Email                 [____________]
    Mobile number         [____________]
    Date of birth         [____________]
    Address               [____________]
    Business name         [____________]

    [ Continue ]
    Submit and start verification
    ------------------------------------------------

------------------------------------------------------------------------

## 2. KYC Status Screen

    ------------------------------------------------
    Header: Account Setup

    Status Tracker

    1. Basic details submitted        ✓
    2. KYC link sent                  ✓
    3. Identity verification          ...
    4. Adyen review                   ...
    5. Account active                 ...

    Current Status: KYC link sent

    Please complete your identity verification
    using the secure link sent to your email
    or mobile phone.

    Buttons:
    [ Resend KYC Link ]
    [ Update Contact Details ]
    [ Contact Support ]
    ------------------------------------------------

------------------------------------------------------------------------

## 3. Under Review Screen

    ------------------------------------------------
    Header: Account Setup

    Status Tracker

    1. Basic details submitted        ✓
    2. KYC completed                  ✓
    3. Under review                   ...
    4. Account active                 ...

    Current Status: Under review

    Your verification has been submitted
    and is currently being reviewed.

    We will notify you once approval
    is completed.

    Button:
    [ Contact Support ]
    ------------------------------------------------

------------------------------------------------------------------------

## 4. Approved / Active Screen

    ------------------------------------------------
    Header: Your Account Is Active

    Status Tracker

    1. Basic details submitted        ✓
    2. KYC completed                  ✓
    3. Approved                       ✓
    4. Account active                 ✓

    Success Message:

    Your account has been successfully approved
    and is now active.

    Button:
    [ Go to Dashboard ]
    ------------------------------------------------

------------------------------------------------------------------------

# Key Product & Technical Principles

1.  The **app should not host the KYC process** if Adyen's hosted flow
    is used.
2.  The app should act as the **control layer and status dashboard**.
3.  Status should automatically **sync from Adyen via webhook/API**.
4.  PTs should always see:
    -   Current onboarding stage
    -   Required next step
    -   Any issues blocking approval
5.  The system should allow **easy KYC link resending**.
6.  If KYC expires or fails, the app should clearly display the **next
    required action**.

------------------------------------------------------------------------

# Product Requirement Summary

## Objective

Allow PTs to onboard easily through the Bright.Blue app, complete KYC
via Adyen, and track progress until activation.

## Core Flow

In‑app onboarding → Adyen KYC link → External verification → Status
updates → Approval → Active account.

## App Responsibilities

-   Capture onboarding data
-   Display onboarding progress
-   Show required user actions
-   Update activation status

## Adyen Responsibilities

-   Identity verification
-   Compliance checks
-   KYC approval workflow
