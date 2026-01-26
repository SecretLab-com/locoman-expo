// Check product options and variants
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

const query = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      hasOnlyDefaultVariant
      options {
        id
        name
        position
        optionValues {
          id
          name
        }
      }
      variants(first: 10) {
        edges {
          node {
            id
            title
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

const productId = "gid://shopify/Product/9623095705886"; // Selling Plans Ski Wax

const response = await fetch(
  `https://${SHOPIFY_STORE}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables: { id: productId } }),
  }
);

const result = await response.json();
console.log("=== Product Options ===");
console.log(JSON.stringify(result, null, 2));
