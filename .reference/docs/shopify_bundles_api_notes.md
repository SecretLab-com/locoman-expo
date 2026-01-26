# Shopify Native Bundles API Integration

## Overview

Shopify provides a native Bundles API that creates "real" bundles that display the "Bundled products" UI in the Shopify admin. This is different from our current approach of creating regular products with metafields.

## Key API: `productBundleCreate` Mutation

**Requirements:**
- `write_products` access scope
- Shop must have access to bundles feature

**GraphQL Mutation:**
```graphql
mutation ProductBundleCreate($input: ProductBundleCreateInput!) {
  productBundleCreate(input: $input) {
    productBundleOperation {
      id
      status
    }
    userErrors {
      message
      field
    }
  }
}
```

**Input Variables:**
```json
{
  "input": {
    "title": "The hair and skin bundle",
    "components": [
      {
        "quantity": 1,
        "productId": "gid://shopify/Product/1",
        "optionSelections": [
          {
            "componentOptionId": "gid://shopify/ProductOption/1",
            "name": "Shampoo scent",
            "values": ["Lavender", "Mint"]
          }
        ]
      },
      {
        "quantity": 1,
        "productId": "gid://shopify/Product/2",
        "optionSelections": [
          {
            "componentOptionId": "gid://shopify/ProductOption/2",
            "name": "Soap scent",
            "values": ["Rose", "Lemon"]
          }
        ]
      }
    ]
  }
}
```

## How It Works

1. **Async Operation**: The mutation runs asynchronously and returns a `ProductBundleOperation` object
2. **Poll for Status**: Use `productOperation` query to check when bundle is ready
3. **Bundle Relationships**: Products are linked via `bundleComponents` relationship
4. **Inventory**: Bundle inventory is calculated from component products automatically
5. **Pricing**: Price is determined by the parent bundle variant

## Limitations

- Maximum 30 components per bundle
- Maximum 3 options per bundle
- Nested bundles not supported (bundle can't contain another bundle)
- After an app assigns components, only that app can manage them
- Combined options count as one option

## Step 2: Poll Status

```graphql
query productBundleOperation($id: ID!) {
  productOperation(id: $id) {
    ... on ProductBundleOperation {
      id
      status
      product {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
}
```

## Step 3: Update Bundle

Use `productBundleUpdate` mutation with similar structure to update components.

## Implementation Plan for LocoMotivate

1. **Switch from REST to GraphQL**: Need to use GraphQL Admin API for bundle creation
2. **Update `publishBundle` function**: Replace `createProduct` with `productBundleCreate`
3. **Add polling logic**: Wait for bundle operation to complete
4. **Handle component products**: Pass actual Shopify product GIDs as components
5. **Test with Shopify Bundles app**: Verify the "Bundled products" UI appears

## Benefits of Native Bundles

- Native "Bundled products" UI in Shopify admin
- Automatic inventory tracking from components
- Proper bundle pricing allocation
- Works with Shopify's ecosystem (discounts, taxes, reports)
- Better storefront integration
