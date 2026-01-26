# Shopify Bundles Research Findings

## Key Discovery

From the Shopify community forum (Jan 27, 2025):

> "When I use the productBundleCreate GraphQL mutation (via my own app), the bundle instance I create is not editable via Shopify Bundles. Instead, there is an edit link that points to my own application (the one that actually runs the mutation)."

**This means:**
1. Bundles created via `productBundleCreate` API are **owned by the app that created them**
2. The "Bundled products" UI block shows an **edit link to the owning app**
3. You **cannot** create bundles via API that are managed by the Shopify Bundles app
4. Each app that creates bundles needs its own UI extension to display/edit them

## Solution Options

### Option 1: Build Admin UI Extension
Create a Shopify Admin UI extension that displays bundle components on the product page.

Requirements:
- Shopify app with proper scopes
- Admin block extension targeting `admin.product-details.block.render`
- React components using Shopify's Admin UI components

### Option 2: Use Shopify Bundles App Directly
Have users create bundles through the Shopify Bundles app instead of our API.

Limitations:
- Loses integration with our trainer workflow
- No automated bundle creation
- Manual process

### Option 3: Accept Current Behavior
Our bundles work correctly via API:
- Bundle components are linked
- Inventory is shared
- Variants are created properly

Just without the visual "Bundled products" block in admin.

## Admin UI Extension Architecture

To show the "Bundled products" block, we need:

1. **Shopify App** with:
   - `read_products` scope
   - Admin UI extension capability

2. **Extension target**: `admin.product-details.block.render`

3. **Extension code** that:
   - Queries the product's bundleComponents via GraphQL
   - Displays them in a similar UI to Shopify Bundles app

## References
- https://shopify.dev/docs/apps/build/admin/actions-blocks
- https://community.shopify.dev/t/how-to-create-bundles-in-shopify-bundles-programmatically/6849
