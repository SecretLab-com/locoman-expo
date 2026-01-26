// Check if Shopify Bundles app is installed
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function main() {
  // Check shop capabilities and installed apps
  const query = `
    query {
      shop {
        name
        plan {
          displayName
        }
        features {
          bundles {
            eligibleForBundles
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
      body: JSON.stringify({ query }),
    }
  );

  const result = await response.json();
  console.log("=== Shop Info ===");
  console.log(JSON.stringify(result, null, 2));
  
  if (result.data?.shop?.features?.bundles?.eligibleForBundles) {
    console.log("\n✅ Shop is eligible for bundles!");
  } else {
    console.log("\n❌ Shop is NOT eligible for bundles");
  }
  

}

main().catch(console.error);
