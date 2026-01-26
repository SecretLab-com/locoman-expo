// Detailed comparison between working supertest bundle and our bundles
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function graphql(query) {
  const response = await fetch(
    `https://${SHOPIFY_STORE}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query }),
    }
  );
  return response.json();
}

async function getProductDetails(productId) {
  const query = `
    query {
      product(id: "gid://shopify/Product/${productId}") {
        id
        title
        productType
        status
        publishedAt
        createdAt
        hasOnlyDefaultVariant
        templateSuffix
        tags
        vendor
        options {
          id
          name
          position
          values
        }
        variants(first: 5) {
          edges {
            node {
              id
              title
              price
              inventoryPolicy
              inventoryQuantity
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
                hasOnlyDefaultVariant
              }
              quantity
              optionSelections {
                componentOption {
                  id
                  name
                }
                parentOption {
                  id
                  name
                }
                values {
                  label
                  selectionStatus
                }
              }
            }
          }
        }
        metafields(first: 20) {
          edges {
            node {
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `;
  return graphql(query);
}

async function main() {
  // Working bundle: supertest bundle (9980651438366)
  // Our bundle: Fixed Native Bundle Test (find it first)
  
  // Find our bundle
  const searchResult = await graphql(`
    query {
      products(first: 3, query: "title:Fixed Native Bundle Test") {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  `);
  
  const ourBundleId = searchResult.data?.products?.edges?.[0]?.node?.id?.split('/').pop();
  console.log("Our bundle ID:", ourBundleId);
  
  console.log("\n" + "=".repeat(80));
  console.log("WORKING BUNDLE: supertest bundle (9980651438366)");
  console.log("=".repeat(80));
  
  const workingBundle = await getProductDetails("9980651438366");
  console.log(JSON.stringify(workingBundle.data?.product, null, 2));
  
  console.log("\n" + "=".repeat(80));
  console.log("OUR BUNDLE: Fixed Native Bundle Test (" + ourBundleId + ")");
  console.log("=".repeat(80));
  
  const ourBundle = await getProductDetails(ourBundleId);
  console.log(JSON.stringify(ourBundle.data?.product, null, 2));
  
  // Key differences
  console.log("\n" + "=".repeat(80));
  console.log("KEY DIFFERENCES");
  console.log("=".repeat(80));
  
  const working = workingBundle.data?.product;
  const ours = ourBundle.data?.product;
  
  if (working && ours) {
    console.log("\nStatus:");
    console.log(`  Working: ${working.status}`);
    console.log(`  Ours: ${ours.status}`);
    
    console.log("\nProduct Type:");
    console.log(`  Working: "${working.productType}"`);
    console.log(`  Ours: "${ours.productType}"`);
    
    console.log("\nVendor:");
    console.log(`  Working: ${working.vendor}`);
    console.log(`  Ours: ${ours.vendor}`);
    
    console.log("\nTemplate Suffix:");
    console.log(`  Working: ${working.templateSuffix}`);
    console.log(`  Ours: ${ours.templateSuffix}`);
    
    console.log("\nTags:");
    console.log(`  Working: ${JSON.stringify(working.tags)}`);
    console.log(`  Ours: ${JSON.stringify(ours.tags)}`);
    
    console.log("\nBundle Components Count:");
    console.log(`  Working: ${working.bundleComponents?.edges?.length || 0}`);
    console.log(`  Ours: ${ours.bundleComponents?.edges?.length || 0}`);
    
    console.log("\nBundle Component Option Selections:");
    working.bundleComponents?.edges?.forEach((c, i) => {
      console.log(`  Working Component ${i + 1} (${c.node.componentProduct.title}):`);
      c.node.optionSelections?.forEach(os => {
        console.log(`    - ${os.componentOption?.name} -> ${os.parentOption?.name}`);
        console.log(`      Values: ${JSON.stringify(os.values?.map(v => v.label))}`);
      });
    });
    
    ours.bundleComponents?.edges?.forEach((c, i) => {
      console.log(`  Our Component ${i + 1} (${c.node.componentProduct.title}):`);
      c.node.optionSelections?.forEach(os => {
        console.log(`    - ${os.componentOption?.name} -> ${os.parentOption?.name}`);
        console.log(`      Values: ${JSON.stringify(os.values?.map(v => v.label))}`);
      });
    });
    
    console.log("\nMetafields:");
    console.log(`  Working: ${working.metafields?.edges?.map(m => `${m.node.namespace}.${m.node.key}`).join(", ") || "none"}`);
    console.log(`  Ours: ${ours.metafields?.edges?.map(m => `${m.node.namespace}.${m.node.key}`).join(", ") || "none"}`);
  }
}

main().catch(console.error);
