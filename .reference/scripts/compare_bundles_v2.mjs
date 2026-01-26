// Compare working supertest bundle with our Fixed Native Bundle Test
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function getBundle(productId) {
  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        productType
        status
        bundleComponents(first: 10) {
          edges {
            node {
              componentProduct {
                id
                title
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

  const result = await response.json();
  return result;
}

async function main() {
  console.log("=== WORKING: supertest bundle (9980651438366) ===");
  const working = await getBundle(9980651438366);
  if (working.errors) {
    console.log("Errors:", JSON.stringify(working.errors, null, 2));
  }
  console.log(JSON.stringify(working.data?.product, null, 2));
  
  console.log("\n=== OUR: Fixed Native Bundle Test (9980652159262) ===");
  const ours = await getBundle(9980652159262);
  if (ours.errors) {
    console.log("Errors:", JSON.stringify(ours.errors, null, 2));
  }
  console.log(JSON.stringify(ours.data?.product, null, 2));
  
  // Key comparison
  console.log("\n=== KEY COMPARISON ===");
  const w = working.data?.product;
  const o = ours.data?.product;
  
  if (w && o) {
    console.log(`Working bundle components: ${w.bundleComponents?.edges?.length || 0}`);
    console.log(`Our bundle components: ${o.bundleComponents?.edges?.length || 0}`);
    
    if (w.bundleComponents?.edges?.length > 0) {
      console.log("\nWorking bundle component details:");
      w.bundleComponents.edges.forEach((c, i) => {
        console.log(`  Component ${i+1}: ${c.node.componentProduct.title}`);
        console.log(`    Quantity: ${c.node.quantity}`);
        console.log(`    Option Selections: ${c.node.optionSelections?.length || 0}`);
        c.node.optionSelections?.forEach(os => {
          console.log(`      - Component Option: ${os.componentOption?.name}`);
          console.log(`        Parent Option: ${os.parentOption?.name}`);
          console.log(`        Values: ${os.values?.map(v => `${v.label}(${v.selectionStatus})`).join(", ")}`);
        });
      });
    }
    
    if (o.bundleComponents?.edges?.length > 0) {
      console.log("\nOur bundle component details:");
      o.bundleComponents.edges.forEach((c, i) => {
        console.log(`  Component ${i+1}: ${c.node.componentProduct.title}`);
        console.log(`    Quantity: ${c.node.quantity}`);
        console.log(`    Option Selections: ${c.node.optionSelections?.length || 0}`);
        c.node.optionSelections?.forEach(os => {
          console.log(`      - Component Option: ${os.componentOption?.name}`);
          console.log(`        Parent Option: ${os.parentOption?.name}`);
          console.log(`        Values: ${os.values?.map(v => `${v.label}(${v.selectionStatus})`).join(", ")}`);
        });
      });
    }
  }
}

main().catch(console.error);
