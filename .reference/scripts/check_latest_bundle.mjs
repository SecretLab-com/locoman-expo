// Check if the latest bundle is a native Shopify bundle
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

// Search for Native Bundle Test 2
const searchQuery = `
  query searchProducts {
    products(first: 5, query: "title:Native Bundle Test 2") {
      edges {
        node {
          id
          title
          productType
          createdAt
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
    body: JSON.stringify({ query: searchQuery }),
  }
);

const result = await response.json();
console.log("=== Search Results ===");
console.log(JSON.stringify(result, null, 2));

const products = result.data?.products?.edges || [];
for (const { node: product } of products) {
  console.log(`\n=== ${product.title} ===`);
  console.log(`ID: ${product.id}`);
  console.log(`Type: ${product.productType}`);
  console.log(`Created: ${product.createdAt}`);
  
  if (product.bundleComponents?.edges?.length > 0) {
    console.log("\n✅ This is a NATIVE Shopify bundle!");
    console.log("Bundle Components:");
    product.bundleComponents.edges.forEach((edge) => {
      console.log(`- ${edge.node.componentProduct.title} (qty: ${edge.node.quantity})`);
    });
  } else {
    console.log("\n❌ This is NOT a native bundle (no bundle components found)");
  }
}
