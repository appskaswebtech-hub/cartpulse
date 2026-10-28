import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import supportPrisma from "./support-db.server";

const AUTO_REPLY_TEXT =
  "Thank you for messaging us! One of our support members will reach you soon.";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "support");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

type SupportlyNotification = { message: unknown; name?: string; email?: string } | { type: string };

let warnedAboutSupportlyConfiguration = false;

export async function getOrCreateThread(shop: string) {
  return supportPrisma.supportThread.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });
}

export async function getMessages(shop: string, limit = 100) {
  const thread = await getOrCreateThread(shop);
  const messages = await supportPrisma.supportMessage.findMany({
    where: {
      threadId: thread.id,
      ...(thread.lastResetAt ? { createdAt: { gt: thread.lastResetAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return { thread, messages };
}

export async function markRead(shop: string, who: "shop" | "admin") {
  const thread = await getOrCreateThread(shop);
  await supportPrisma.supportThread.update({
    where: { id: thread.id },
    data:
      who === "shop"
        ? { shopUnreadCount: 0, shopLastReadAt: new Date() }
        : { adminUnreadCount: 0, adminLastReadAt: new Date() },
  });
  if (who === "shop") {
    void notifyDashboard(shop, { type: "seen" }).catch((error: unknown) => {
      console.error("Could not notify Supportly that the merchant read the chat.", error);
    });
  }
}

async function saveAttachment(file: File, threadId: string) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachment is larger than 10MB.");
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw new Error("That file type isn't supported. Use an image, PDF, Word doc or text file.");
  }
  const dir = path.join(UPLOAD_DIR, threadId);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.name) || "";
  const safeName = crypto.randomUUID() + ext;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, safeName), buffer);
  const baseUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  return {
    url: `${baseUrl}/uploads/support/${threadId}/${safeName}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function sendMessage(opts: {
  shop: string;
  sender: "shop" | "admin";
  body?: string | null;
  file?: File | null;
  name?: string | null;
  email?: string | null;
}) {
  const thread = await getOrCreateThread(opts.shop);
  const body = (opts.body || "").trim();
  if (!body && !opts.file) throw new Error("Write a message or attach a file.");
  if (opts.sender === "shop" && thread.closedAt) throw new Error("This conversation is closed.");

  const isConversationStart =
    opts.sender === "shop" &&
    (await supportPrisma.supportMessage.count({
      where: {
        threadId: thread.id,
        ...(thread.lastResetAt ? { createdAt: { gt: thread.lastResetAt } } : {}),
      },
    })) === 0;

  let attachment: Awaited<ReturnType<typeof saveAttachment>> | null = null;
  if (opts.file && opts.file.size > 0) attachment = await saveAttachment(opts.file, thread.id);

  const message = await supportPrisma.supportMessage.create({
    data: {
      threadId: thread.id,
      sender: opts.sender,
      body: body || null,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentType: attachment?.type ?? null,
      attachmentSize: attachment?.size ?? null,
    },
  });

  const updateData: Record<string, unknown> =
    opts.sender === "shop"
      ? { adminUnreadCount: { increment: 1 } }
      : { shopUnreadCount: { increment: 1 }, closedAt: null };

  if (isConversationStart && opts.name) updateData.contactName = opts.name.trim();
  if (isConversationStart && opts.email) updateData.contactEmail = opts.email.trim();

  await supportPrisma.supportThread.update({ where: { id: thread.id }, data: updateData });

  const contactName = isConversationStart && opts.name ? opts.name.trim() : (thread as { contactName?: string | null }).contactName ?? undefined;
  const contactEmail = isConversationStart && opts.email ? opts.email.trim() : (thread as { contactEmail?: string | null }).contactEmail ?? undefined;

  if (opts.sender === "shop") {
    void notifyDashboard(opts.shop, { message, name: contactName, email: contactEmail }).catch((error: unknown) => {
      console.error("Could not notify Supportly about a new message.", error);
    });
  }

  if (isConversationStart) {
    await supportPrisma.supportMessage.create({
      data: { threadId: thread.id, sender: "admin", body: AUTO_REPLY_TEXT },
    });
  }

  return message;
}

export async function closeThread(shop: string) {
  const thread = await getOrCreateThread(shop);
  await supportPrisma.supportThread.update({ where: { id: thread.id }, data: { closedAt: new Date() } });
  void notifyDashboard(shop, { type: "closed" }).catch((error: unknown) => {
    console.error("Could not notify Supportly about chat close.", error);
  });
}

export async function reopenThread(shop: string) {
  const thread = await getOrCreateThread(shop);
  await supportPrisma.supportThread.update({
    where: { id: thread.id },
    data: { closedAt: null, lastResetAt: new Date() },
  });
  void notifyDashboard(shop, { type: "reset" }).catch((error: unknown) => {
    console.error("Could not notify Supportly about a chat reset.", error);
  });
}

export async function notifyDashboard(shop: string, notification: SupportlyNotification) {
  const url = process.env.ADMIN_DASHBOARD_URL;
  const secret = process.env.SUPPORT_INTERNAL_SECRET;
  if (!url || !secret) {
    if (!warnedAboutSupportlyConfiguration) {
      console.warn(
        "Supportly notifications are disabled; set ADMIN_DASHBOARD_URL and SUPPORT_INTERNAL_SECRET to enable them.",
      );
      warnedAboutSupportlyConfiguration = true;
    }
    return;
  }
  const response = await fetch(`${url.replace(/\/$/, "")}/embedded/internal/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
    body: JSON.stringify({ shop, ...notification }),
  });
  if (!response.ok) {
    throw new Error(`Supportly notification failed with status ${response.status}.`);
  }
}
