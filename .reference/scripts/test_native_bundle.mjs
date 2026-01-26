// Test creating a native bundle directly
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_NAME || "bright-express-dev";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2024-10";

async function main() {
  // First, get product options for a product
  const optionsQuery = `
    query getProductOptions($id: ID!) {
      product(id: $id) {
        id
        title
        hasOnlyDefaultVariant
        options {
          id
          name
          optionValues {
            id
            name
          }
        }
      }
    }
  `;

  // The Collection Snowboard: Hydrogen product ID (has only default variant)
  const productId = 9623095771422;

  const optionsResponse = await fetch(
    `https://${SHOPIFY_STORE}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ 
        query: optionsQuery, 
        variables: { id: `gid://shopify/Product/${productId}` } 
      }),
    }
  );

  const optionsResult = await optionsResponse.json();
  console.log("=== Product Options ===");
  console.log(JSON.stringify(optionsResult, null, 2));

  // Now try to create a bundle
  const createMutation = `
    mutation ProductBundleCreate($input: ProductBundleCreateInput!) {
      productBundleCreate(input: $input) {
        productBundleOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const product = optionsResult.data?.product;
  
  // ALWAYS include option selections, even for default variants
  const optionSelections = product.options.map(opt => ({
    componentOptionId: opt.id,
    name: opt.name,
    values: opt.optionValues.map(v => v.id)
  }));

  console.log("\n=== Option Selections ===");
  console.log(JSON.stringify(optionSelections, null, 2));

  const input = {
    title: "Direct API Test Bundle v2",
    components: [
      {
        quantity: 1,
        productId: `gid://shopify/Product/${productId}`,
        optionSelections: optionSelections
      }
    ]
  };

  console.log("\n=== Input ===");
  console.log(JSON.stringify(input, null, 2));

  const createResponse = await fetch(
    `https://${SHOPIFY_STORE}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: createMutation, variables: { input } }),
    }
  );

  const createResult = await createResponse.json();
  console.log("\n=== Create Result ===");
  console.log(JSON.stringify(createResult, null, 2));
  
  // If successful, poll for completion
  if (createResult.data?.productBundleCreate?.productBundleOperation?.id) {
    const operationId = createResult.data.productBundleCreate.productBundleOperation.id;
    console.log(`\n=== Polling for operation ${operationId} ===`);
    
    const pollQuery = `
      query pollOperation($id: ID!) {
        node(id: $id) {
          ... on ProductBundleOperation {
            id
            status
            product {
              id
              title
            }
          }
        }
      }
    `;
    
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          },
          body: JSON.stringify({ query: pollQuery, variables: { id: operationId } }),
        }
      );
      
      const pollResult = await pollResponse.json();
      console.log(`Poll ${i + 1}:`, JSON.stringify(pollResult, null, 2));
      
      const status = pollResult.data?.node?.status;
      if (status === "COMPLETE" || status === "FAILED") {
        break;
      }
    }
  }
}

main().catch(console.error);
