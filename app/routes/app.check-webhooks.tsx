import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
    query {
      webhookSubscriptions(first: 10) {
        edges {
          node {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `);

    const data = await response.json();
    console.log("Webhooks:", JSON.stringify(data.data, null, 2));

    return new Response(
        JSON.stringify(data.data, null, 2),
        { headers: { "Content-Type": "application/json" } }
    );
};