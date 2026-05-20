import nodemailer from "nodemailer";

function makeTransporter(user: string, pass: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendCartEmail({
  to,
  subject,
  html,
  unsubscribeUrl,
  fromName,
  fromAddress,
  appPassword,
}: {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl: string;
  fromName?: string | null;
  fromAddress?: string | null;
  appPassword?: string | null;
}) {
  const fullHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="padding:40px 16px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(83,74,183,0.12);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#534AB7 0%,#7F77DD 100%);padding:36px 40px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 20px;margin-bottom:12px;">
          <span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:1px;">CART REMINDER</span>
        </div>
        <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">You left something behind!</h1>
        <p style="color:rgba(255,255,255,0.75);margin:10px 0 0;font-size:15px;">Your cart is waiting for you</p>
      </div>

      <!-- Body -->
      <div style="padding:36px 40px;">
        <div style="font-size:15px;color:#374151;line-height:1.7;margin-bottom:28px;">${html}</div>

        <!-- CTA Button -->
        <div style="text-align:center;margin-top:32px;">
          <div style="font-size:13px;color:#9ca3af;text-align:center;">(Your cart items and checkout link are shown below)</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:24px 40px;border-top:1px solid #f0f0f0;background:#fafafa;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
          You're receiving this because you left items in your cart.<br/>
          <a href="${unsubscribeUrl}" style="color:#534AB7;text-decoration:underline;">Unsubscribe</a> from future emails.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;

  const user = fromAddress || process.env.GMAIL_USER!;
  const pass = appPassword || process.env.GMAIL_APP_PASSWORD!;
  const senderName = fromName || "CartPulse";

  const transporter = makeTransporter(user, pass);

  await transporter.sendMail({
    from: `"${senderName}" <${user}>`,
    to,
    subject,
    html: fullHtml,
  });

  console.log(`✅ Email sent to ${to}`);
}
