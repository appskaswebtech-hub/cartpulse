import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { authenticate } from "../shopify.server";
import { notifyDashboard } from "../support-chat.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  void notifyDashboard(session.shop, { type: "typing" }).catch(() => {});
  return data({ ok: true });
};
