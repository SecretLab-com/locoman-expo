// Check the Fixed Native Bundle Test
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function main() {
  // First, find the Fixed Native Bundle Test product
  const searchQuery = `
    query {
      products(first: 5, query: "title:Fixed Native Bundle Test") {
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
  
  console.log("=== Fixed Native Bundle Test ===");
  const products = result.data?.products?.edges || [];
  
  if (products.length === 0) {
    console.log("Product not found!");
    return;
  }
  
  const product = products[0].node;
  console.log(`Title: ${product.title}`);
  console.log(`Status: ${product.status}`);
  console.log(`Product Type: ${product.productType}`);
  console.log(`Has Only Default Variant: ${product.hasOnlyDefaultVariant}`);
  
  console.log("\n=== Options ===");
  product.options.forEach(opt => {
    console.log(`- ${opt.name}: ${opt.values.join(", ")}`);
  });
  
  console.log("\n=== Variants ===");
  product.variants.edges.forEach(v => {
    console.log(`- ${v.node.title} ($${v.node.price})`);
    v.node.selectedOptions.forEach(so => {
      console.log(`    ${so.name}: ${so.value}`);
    });
  });
  
  console.log("\n=== Bundle Components ===");
  const components = product.bundleComponents?.edges || [];
  if (components.length === 0) {
    console.log("❌ No bundle components - NOT a native bundle!");
  } else {
    console.log("✅ This is a NATIVE Shopify bundle!");
    components.forEach(c => {
      console.log(`- ${c.node.componentProduct.title} (qty: ${c.node.quantity})`);
    });
  }
}

main().catch(console.error);
