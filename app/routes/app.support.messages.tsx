import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { authenticate } from "../shopify.server";
import { getMessages, markRead, sendMessage } from "../support-chat.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { thread, messages } = await getMessages(session.shop);
  await markRead(session.shop, "shop");
  return data({ thread, messages });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const contentType = request.headers.get("content-type") ?? "";

  let body: string | null = null;
  let file: File | null = null;
  let name: string | null = null;
  let email: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    body = (formData.get("body") as string | null) ?? null;
    const f = formData.get("file");
    if (f instanceof File && f.size > 0) file = f;
  } else {
    const d = (await request.json()) as { body?: string; name?: string; email?: string };
    body = d.body ?? null;
    name = d.name ?? null;
    email = d.email ?? null;
  }

  try {
    const message = await sendMessage({ shop: session.shop, sender: "shop", body, file, name, email });
    return data({ message });
  } catch (err) {
    return data({ error: (err as Error).message }, { status: 400 });
  }
};
