# E2E Testing Notes - Bundle Workflow

## Test Date: Jan 18, 2026

### Bundle Creation Test - PASSED
- Created "E2E Test Bundle" as Alex Thompson (trainer)
- Bundle saved successfully with toast notification "Bundle saved as draft"
- Bundle appears in trainer's bundle list with status "draft"
- Price: $49.99/weekly
- Product: Selling Plans Ski Wax

### Issues Found:

1. **Bundle Filtering NOT Working** - CRITICAL
   - Bundles are still showing in the product selection list
   - Products tagged as "Bundle" are visible when they shouldn't be
   - Examples: "Muscle Builder jb", "Test Bundle Publish", "Test SQL Error Bundle"
   - These all show "Bundle" tag and should be filtered out

2. **Submit for Review Button** - TO VERIFY
   - Need to check if "Submit for Review" button appears for draft bundles
   - Current UI only shows "Save Draft" on new bundle creation page

### Next Steps:
1. Fix bundle filtering in product list
2. Verify Submit for Review workflow
3. Test admin approval flow
4. Test Shopify sync after approval
