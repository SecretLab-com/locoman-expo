# Debug Notes - Bundle Approvals Issue

## Issue Summary
The Bundle Approvals page shows "Pending Review (0)" and returns a 403 "Manager access required" error.

## Key Findings

1. **Two Different Browser Sessions**: 
   - The webdev_check_status screenshot shows a logged-in manager with 2 Pending Approvals, 10 Active Trainers, 13 Published Bundles
   - The browser tool shows a different session with 0 Active Trainers, 0 Published Bundles, 0 Pending Approvals

2. **Authentication Issue**:
   - The browser session appears to have a different/invalid session cookie
   - The tRPC calls to `admin.pendingBundles` return 403 "Manager access required"
   - This suggests the user's role is not being recognized as "manager" or "coordinator"

3. **Database State**:
   - There are bundles with `pending_review` status in the database
   - The `getPendingBundleReviews` function queries for `status = 'pending_review'`

## Root Cause
The browser session cookie is either:
1. From a different user who is not a manager
2. Expired or invalid
3. Not being sent properly with the tRPC requests

## Solution Options
1. The user needs to log in again to get a fresh session
2. The BundleApprovals page needs to handle the 403 error gracefully
3. Add a check to redirect non-managers away from the /manager routes

## Next Steps
- Add proper error handling to the BundleApprovals page
- Add a redirect for non-manager users
- Test with a fresh login
