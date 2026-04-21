import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    const topics = [
        { topic: "CHECKOUTS_CREATE", uri: "/webhooks/cart/abandoned" },
        { topic: "CHECKOUTS_UPDATE", uri: "/webhooks/cart/abandoned" },
        { topic: "ORDERS_CREATE", uri: "/webhooks/orders/create" },
        { topic: "APP_UNINSTALLED", uri: "/webhooks/app/uninstalled" },
    ];

    const results = [];

    for (const { topic, uri } of topics) {
        const response = await admin.graphql(`
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            topic
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
            variables: {
                topic,
                webhookSubscription: {
                    callbackUrl: `https://computing-tongue-warned-labeled.trycloudflare.com${uri}`,
                    format: "JSON",
                },
            },
        });

        const data = await response.json();
        console.log(`Webhook ${topic}:`, JSON.stringify(data.data.webhookSubscriptionCreate));
        results.push(data.data.webhookSubscriptionCreate);
    }

    return new Response(
        JSON.stringify({ success: true, results }, null, 2),
        { headers: { "Content-Type": "application/json" } }
    );
};