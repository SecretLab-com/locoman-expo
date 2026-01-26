// Compare the working supertest bundle with our bundles
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function getProductDetails(productId) {
  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        productType
        status
        hasOnlyDefaultVariant
        options {
          id
          name
          position
          values
        }
        variants(first: 20) {
          edges {
            node {
              id
              title
              price
              selectedOptions {
                name
                value
              }
            }
          }
        }
        bundleComponents(first: 10) {
          edges {
            node {
              componentProduct {
                id
                title
              }
              quantity
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${SHOPIFY_STORE}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { id: `gid://shopify/Product/${productId}` },
      }),
    }
  );

  return response.json();
}

async function main() {
  // Working bundle
  console.log("=== WORKING: supertest bundle (9980651438366) ===");
  const working = await getProductDetails(9980651438366);
  console.log(JSON.stringify(working.data?.product, null, 2));
  
  console.log("\n\n=== OUR BUNDLE: Native Bundle Final Test (9980649865502) ===");
  const ours = await getProductDetails(9980649865502);
  console.log(JSON.stringify(ours.data?.product, null, 2));
  
  console.log("\n\n=== OUR BUNDLE: Direct API Test Bundle v2 (9980648980766) ===");
  const api = await getProductDetails(9980648980766);
  console.log(JSON.stringify(api.data?.product, null, 2));
  
  // Summary
  console.log("\n\n=== SUMMARY ===");
  const workingProduct = working.data?.product;
  const oursProduct = ours.data?.product;
  const apiProduct = api.data?.product;
  
  console.log("\nWorking (supertest bundle):");
  console.log(`  - hasOnlyDefaultVariant: ${workingProduct?.hasOnlyDefaultVariant}`);
  console.log(`  - variants: ${workingProduct?.variants?.edges?.length}`);
  console.log(`  - bundleComponents: ${workingProduct?.bundleComponents?.edges?.length}`);
  console.log(`  - options: ${JSON.stringify(workingProduct?.options?.map(o => o.name))}`);
  
  console.log("\nOurs (Native Bundle Final Test):");
  console.log(`  - hasOnlyDefaultVariant: ${oursProduct?.hasOnlyDefaultVariant}`);
  console.log(`  - variants: ${oursProduct?.variants?.edges?.length}`);
  console.log(`  - bundleComponents: ${oursProduct?.bundleComponents?.edges?.length}`);
  console.log(`  - options: ${JSON.stringify(oursProduct?.options?.map(o => o.name))}`);
  
  console.log("\nAPI Test (Direct API Test Bundle v2):");
  console.log(`  - hasOnlyDefaultVariant: ${apiProduct?.hasOnlyDefaultVariant}`);
  console.log(`  - variants: ${apiProduct?.variants?.edges?.length}`);
  console.log(`  - bundleComponents: ${apiProduct?.bundleComponents?.edges?.length}`);
  console.log(`  - options: ${JSON.stringify(apiProduct?.options?.map(o => o.name))}`);
}

main().catch(console.error);
