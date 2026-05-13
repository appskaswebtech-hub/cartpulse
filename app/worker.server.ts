import db from "./db.server";
import { sendPushNotification } from "./push.server";
import nodemailer from "nodemailer";

let workerStarted = false;

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER!,
        pass: process.env.GMAIL_APP_PASSWORD!,
    },
});

async function sendEmail(to: string, customerName: string | null, productNames: string, totalPrice: string, shop: string) {
    const name = customerName ?? "there";
    await transporter.sendMail({
        from: `"CartPulse" <${process.env.GMAIL_USER}>`,
        to,
        subject: "You left something in your cart!",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1D9E75;">Hey ${name}, you forgot something! 🛒</h2>
            <p>You left the following items in your cart:</p>
            <p style="background: #f6f6f7; padding: 12px; border-radius: 8px;"><strong>${productNames}</strong></p>
            <p>Total: <strong>$${totalPrice}</strong></p>
            <a href="https://${shop}" style="display:inline-block; margin-top:16px; padding: 12px 24px; background: #1D9E75; color: #fff; border-radius: 8px; text-decoration: none;">
              Complete Your Purchase
            </a>
            <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">
              You're receiving this because you left items in your cart at ${shop}.
            </p>
          </div>
        `,
    });
    console.log(`✅ Email sent to ${to}`);
}

export function startWorker() {
    if (workerStarted) return;
    workerStarted = true;

    console.log("🔄 Worker started");

    setInterval(async () => {
        try {
            const now = new Date();

            const jobs = await db.jobQueue.findMany({
                where: {
                    status: "pending",
                    scheduledAt: { lte: now },
                },
                take: 10,
            });

            for (const job of jobs) {
                await db.jobQueue.update({
                    where: { id: job.id },
                    data: { status: "processing" },
                });

                try {
                    const payload = JSON.parse(job.payload);

                    if (job.jobName === "push-notification") {
                        await sendPushNotification(payload.shop, {
                            title: "You left something behind!",
                            body: `Complete your purchase — $${payload.totalPrice} waiting in your cart`,
                            url: `https://${payload.shop}`,
                        });

                        await db.cartNotification.create({
                            data: {
                                cartId: payload.cartId,
                                type: "abandoned",
                                channel: "push",
                                status: "sent",
                                sentAt: new Date(),
                            },
                        });
                    }

                    if (job.jobName === "email-notification" || job.jobName === "email-final") {
                        await sendEmail(
                            payload.customerEmail,
                            payload.customerName ?? null,
                            payload.productNames,
                            payload.totalPrice,
                            payload.shop,
                        );

                        await db.cartNotification.create({
                            data: {
                                cartId: payload.cartId,
                                type: "abandoned",
                                channel: "email",
                                status: "sent",
                                sentAt: new Date(),
                            },
                        });
                    }

                    await db.jobQueue.update({
                        where: { id: job.id },
                        data: { status: "completed" },
                    });

                    console.log(`✅ Job completed: ${job.jobName} for cart ${payload.cartId}`);

                } catch (err) {
                    console.error(`❌ Job failed: ${job.jobName}`, err);
                    await db.jobQueue.update({
                        where: { id: job.id },
                        data: { status: "failed" },
                    });
                }
            }

        } catch (err) {
            console.error("❌ Worker error:", err);
        }
    }, 10000);
}