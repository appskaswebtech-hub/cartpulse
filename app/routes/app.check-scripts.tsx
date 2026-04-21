import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
    query {
      scriptTags(first: 10) {
        edges {
          node {
            id
            src
            displayScope
          }
        }
      }
    }
  `);

    const data = await response.json();
    console.log("Script tags:", JSON.stringify(data, null, 2));

    return new Response(
        JSON.stringify(data, null, 2),
        { headers: { "Content-Type": "application/json" } }
    );
};