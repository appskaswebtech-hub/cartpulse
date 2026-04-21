import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { cartQueue } from "../queue.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);

    try {
        const job = await cartQueue.add(
            "email-notification",
            {
                cartId: "test-123",
                customerEmail: process.env.GMAIL_USER,
                totalPrice: "99.99",
                productNames: "Test Snowboard",
                shop: "notifier-grjfsliy.myshopify.com",
            },
            { delay: 5000 }
        );

        console.log(`✅ Test job added with ID: ${job.id}`);

        return new Response(
            JSON.stringify({
                success: true,
                jobId: job.id,
                message: "Job added! Email will send in 5 seconds"
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("❌ Queue error:", error.message);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { "Content-Type": "application/json" } }
        );
    }
};