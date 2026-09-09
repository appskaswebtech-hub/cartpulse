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

export async function sendCartActivityEmail({
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
  const masthead = (fromName || "").trim();

  const fullHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eeece7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your selection is being held for you.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eeece7;">
    <tr>
      <td align="center" style="padding:56px 16px;">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

          ${masthead ? `
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:4px;color:#3a3a35;text-transform:uppercase;">${masthead}</p>
            </td>
          </tr>` : ""}

          <tr>
            <td style="border-top:1px solid #d8d5cd;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
                <tr>
                  <td align="center" style="padding:44px 48px 0;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:#a3a19a;text-transform:uppercase;">A gentle reminder</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:14px 48px 8px;">
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2a2a26;">Your selection is still here</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 48px 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#5a5a53;">
                    ${html}
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 48px 40px;border-top:1px solid #f0efeb;font-family:Arial,Helvetica,sans-serif;" align="center">
                    <p style="margin:0;font-size:11px;color:#b3b1a9;line-height:1.8;letter-spacing:0.2px;">
                      You're receiving this because items remain in your cart.<br/>
                      <a href="${unsubscribeUrl}" style="color:#9a988f;text-decoration:underline;">Unsubscribe</a> from future emails.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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

  console.log(`✅ Cart activity email sent to ${to}`);
}
