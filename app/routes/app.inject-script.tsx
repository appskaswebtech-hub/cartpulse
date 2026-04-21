import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // First delete all existing script tags
  const listResponse = await admin.graphql(`
    query {
      scriptTags(first: 10) {
        edges {
          node {
            id
          }
        }
      }
    }
  `);

  const listData = await listResponse.json();
  const tags = listData.data.scriptTags.edges;

  for (const tag of tags) {
    await admin.graphql(`
      mutation scriptTagDelete($id: ID!) {
        scriptTagDelete(id: $id) {
          deletedScriptTagId
        }
      }
    `, { variables: { id: tag.node.id } });
  }

  // Create new script tag with current tunnel URL
  const response = await admin.graphql(`
    mutation scriptTagCreate($input: ScriptTagInput!) {
      scriptTagCreate(input: $input) {
        scriptTag {
          id
          src
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      input: {
        src: "https://unreproducible-chemiluminescent-jacquiline.ngrok-free.dev/cart-pulse.js",
        displayScope: "ALL",
      },
    },
  });

  const data = await response.json();
  console.log("Script tag updated:", JSON.stringify(data.data.scriptTagCreate.scriptTag));

  return new Response(
    JSON.stringify({ success: true, data: data.data.scriptTagCreate.scriptTag }),
    { headers: { "Content-Type": "application/json" } }
  );
};