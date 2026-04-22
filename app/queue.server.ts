import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import nodemailer from "nodemailer";
import db from "./db.server";

const connection = new Redis(process.env.UPSTASH_REDIS_URL!, {
    maxRetriesPerRequest: null,
    tls: {},
});

connection.on("connect", () => {
    console.log("✅ Redis connected successfully");
});

connection.on("error", (err) => {
    console.error("❌ Redis connection error:", err.message);
});

export const cartQueue = new Queue("cart-recovery", { connection });

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export async function scheduleCartNotifications(cart: {
    id: string;
    customerEmail: string | null;
    cartData: string;
    totalPrice: string;
    shop: string;
}) {
    if (!cart.customerEmail) return;

    const items = JSON.parse(cart.cartData);
    const productNames = items.map((i: any) => i.title).join(", ");

    // Job 1 — Push notification after 1 hour
    await cartQueue.add(
        "push-notification",
        {
            cartId: cart.id,
            customerEmail: cart.customerEmail,
            totalPrice: cart.totalPrice,
            productNames,
            shop: cart.shop,
        },
        { delay: 5000 }
    );

    // Job 2 — Email with discount after 3 hours
    await cartQueue.add(
        "email-notification",
        {
            cartId: cart.id,
            customerEmail: cart.customerEmail,
            totalPrice: cart.totalPrice,
            productNames,
            shop: cart.shop,
            discount: "10",
        },
        { delay: 10000 } // 3 hours
    );

    // Job 3 — Final email reminder after 24 hours
    await cartQueue.add(
        "email-final",
        {
            cartId: cart.id,
            customerEmail: cart.customerEmail,
            totalPrice: cart.totalPrice,
            productNames,
            shop: cart.shop,
        },
        { delay: 15000 } // 24 hours
    );

    console.log(`✅ Notifications scheduled for cart: ${cart.id}`);
}

export const cartWorker = new Worker(
    "cart-recovery",
    async (job) => {
        console.log(`Processing job: ${job.name}`);
        const { cartId, customerEmail, totalPrice, productNames, shop, discount } = job.data;

        if (job.name === "push-notification") {
            console.log(`🔔 Sending push notification to ${customerEmail}`);

            await db.cartNotification.create({
                data: {
                    cartId,
                    type: "push",
                    channel: "push",
                    status: "pending",
                },
            });

            console.log(`✅ Push notification queued for cart: ${cartId}`);
        }

        if (job.name === "email-notification") {
            console.log(`📧 Sending first email to ${customerEmail}`);

            await transporter.sendMail({
                from: `"CartPulse" <${process.env.GMAIL_USER}>`,
                to: customerEmail,
                subject: "You left something behind! Here's 10% off",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hey, you forgot something!</h2>
            <p>You left these items in your cart:</p>
            <p><strong>${productNames}</strong></p>
            <p>Total: <strong>$${totalPrice}</strong></p>
            <p>Come back and get <strong>${discount}% off</strong> your order!</p>
            <a href="https://${shop}" 
               style="background:#1D9E75; color:white; padding:12px 24px; 
                      text-decoration:none; border-radius:6px; display:inline-block;">
              Claim My ${discount}% Discount
            </a>
            <p style="color:#999; font-size:12px; margin-top:20px;">
              You received this because you abandoned your cart.
            </p>
          </div>
        `,
            });

            await db.cartNotification.create({
                data: {
                    cartId,
                    type: "email",
                    channel: "email",
                    status: "sent",
                    sentAt: new Date(),
                },
            });

            console.log(`✅ First email sent to ${customerEmail}`);
        }

        if (job.name === "email-final") {
            console.log(`📧 Sending final email to ${customerEmail}`);

            await transporter.sendMail({
                from: `"CartPulse" <${process.env.GMAIL_USER}>`,
                to: customerEmail,
                subject: "Last chance! Your cart is about to expire",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Last chance!</h2>
            <p>Your cart is about to expire. Don't miss out on:</p>
            <p><strong>${productNames}</strong></p>
            <p>Total: <strong>$${totalPrice}</strong></p>
            <a href="https://${shop}" 
               style="background:#D85A30; color:white; padding:12px 24px; 
                      text-decoration:none; border-radius:6px; display:inline-block;">
              Complete My Purchase Now
            </a>
            <p style="color:#999; font-size:12px; margin-top:20px;">
              You received this because you abandoned your cart.
            </p>
          </div>
        `,
            });

            await db.cartNotification.create({
                data: {
                    cartId,
                    type: "email",
                    channel: "email",
                    status: "sent",
                    sentAt: new Date(),
                },
            });

            console.log(`✅ Final email sent to ${customerEmail}`);
        }
    },
    { connection }
);

cartWorker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
});

cartWorker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});