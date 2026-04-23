import db from "./db.server";
import nodemailer from "nodemailer";

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

    const payload = JSON.stringify({
        cartId: cart.id,
        customerEmail: cart.customerEmail,
        totalPrice: cart.totalPrice,
        productNames,
        shop: cart.shop,
    });

    const now = new Date();

    // Job 1 — Push after 1 hour
    await db.jobQueue.create({
        data: {
            jobName: "push-notification",
            payload,
            scheduledAt: new Date(now.getTime() + 5000), // 5 seconds for testing
        },
    });

    // Job 2 — Email after 24 hours
    await db.jobQueue.create({
        data: {
            jobName: "email-notification",
            payload,
            scheduledAt: new Date(now.getTime() + 10000), // 10 seconds for testing
        },
    });

    // Job 3 — Final email after 1 week
    await db.jobQueue.create({
        data: {
            jobName: "email-final",
            payload,
            scheduledAt: new Date(now.getTime() + 15000), // 15 seconds for testing
        },
    });

    console.log(`✅ Notifications scheduled for cart: ${cart.id}`);
}

export async function processJobQueue() {
    const now = new Date();

    const dueJobs = await db.jobQueue.findMany({
        where: {
            status: "pending",
            scheduledAt: { lte: now },
        },
        take: 10,
    });

    for (const job of dueJobs) {
        try {
            // Mark as processing first
            await db.jobQueue.update({
                where: { id: job.id },
                data: { status: "processing" },
            });

            const data = JSON.parse(job.payload);
            const { cartId, customerEmail, totalPrice, productNames, shop } = data;

            if (job.jobName === "push-notification") {
                console.log(`🔔 Push notification for ${customerEmail}`);
                await db.cartNotification.create({
                    data: {
                        cartId,
                        type: "push",
                        channel: "push",
                        status: "pending",
                    },
                });
            }

            if (job.jobName === "email-notification") {
                console.log(`📧 Sending first email to ${customerEmail}`);
                await transporter.sendMail({
                    from: `"CartPulse" <${process.env.GMAIL_USER}>`,
                    to: customerEmail,
                    subject: "You left something behind!",
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Hey, you forgot something!</h2>
              <p>You left these items in your cart:</p>
              <p><strong>${productNames}</strong></p>
              <p>Total: <strong>$${totalPrice}</strong></p>
              <a href="https://${shop}" style="background:#1D9E75; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">
                Complete My Purchase
              </a>
              <p style="color:#999; font-size:12px; margin-top:20px;">You received this because you abandoned your cart.</p>
            </div>
          `,
                });

                await db.cartNotification.create({
                    data: { cartId, type: "email", channel: "email", status: "sent", sentAt: new Date() },
                });

                console.log(`✅ First email sent to ${customerEmail}`);
            }

            if (job.jobName === "email-final") {
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
              <a href="https://${shop}" style="background:#D85A30; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">
                Complete My Purchase Now
              </a>
              <p style="color:#999; font-size:12px; margin-top:20px;">You received this because you abandoned your cart.</p>
            </div>
          `,
                });

                await db.cartNotification.create({
                    data: { cartId, type: "email", channel: "email", status: "sent", sentAt: new Date() },
                });

                console.log(`✅ Final email sent to ${customerEmail}`);
            }

            // Mark as done
            await db.jobQueue.update({
                where: { id: job.id },
                data: { status: "completed" },
            });

            console.log(`✅ Job ${job.id} completed`);

        } catch (error: any) {
            console.error(`❌ Job ${job.id} failed:`, error.message);
            await db.jobQueue.update({
                where: { id: job.id },
                data: { status: "failed" },
            });
        }
    }
}