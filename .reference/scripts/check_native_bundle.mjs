// Check if product is a native Shopify bundle using GraphQL
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function main() {
  const productId = 9980648980766; // Direct API Test Bundle v2

  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        productType
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

  const result = await response.json();
  console.log("=== GraphQL Response ===");
  console.log(JSON.stringify(result, null, 2));

  if (result.data?.product?.bundleComponents?.edges?.length > 0) {
    console.log("\n✅ This is a NATIVE Shopify bundle!");
    console.log("Bundle Components:");
    result.data.product.bundleComponents.edges.forEach((edge) => {
      console.log(`- ${edge.node.componentProduct.title} (qty: ${edge.node.quantity})`);
    });
  } else {
    console.log("\n❌ This is NOT a native bundle (no bundle components found)");
  }
}

main().catch(console.error);
