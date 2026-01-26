// Check the Direct API Test Bundle v2 which we know has working bundle components
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function main() {
  const searchQuery = `
    query searchProducts($query: String!) {
      products(first: 5, query: $query) {
        edges {
          node {
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
            variants(first: 10) {
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
        query: searchQuery,
        variables: { query: "title:Direct API Test Bundle v2" },
      }),
    }
  );

  const result = await response.json();
  console.log("=== Direct API Test Bundle v2 ===");
  console.log(JSON.stringify(result, null, 2));
  
  const products = result.data?.products?.edges || [];
  for (const edge of products) {
    const product = edge.node;
    console.log(`\n=== ${product.title} ===`);
    console.log(`Status: ${product.status}`);
    console.log(`Has Only Default Variant: ${product.hasOnlyDefaultVariant}`);
    console.log(`Variants: ${product.variants?.edges?.length || 0}`);
    
    if (product.bundleComponents?.edges?.length > 0) {
      console.log("✅ This is a NATIVE Shopify bundle!");
      console.log("Bundle Components:");
      product.bundleComponents.edges.forEach((comp) => {
        console.log(`- ${comp.node.componentProduct.title} (qty: ${comp.node.quantity})`);
      });
    } else {
      console.log("❌ This is NOT a native bundle (no bundle components found)");
    }
  }
}

main().catch(console.error);
