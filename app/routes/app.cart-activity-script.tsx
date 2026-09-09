import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "../cartActivityDefaults";

const TRACKER_PATH = "/cart-activity-tracker.js";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;
    const formData = await request.formData();
    const intent = formData.get("intent");

    try {
        const listResponse = await admin.graphql(`
          query {
            scriptTags(first: 20) {
              edges { node { id src } }
            }
          }
        `);
        const listData: any = await listResponse.json();

        if (listData.errors) {
            console.error("scriptTags query errors:", JSON.stringify(listData.errors));
            return { success: false, error: listData.errors[0]?.message ?? "Failed to list script tags" };
        }

        const existing = listData.data.scriptTags.edges.filter((e: any) => e.node.src.includes(TRACKER_PATH));

        for (const tag of existing) {
            await admin.graphql(`
              mutation scriptTagDelete($id: ID!) {
                scriptTagDelete(id: $id) { deletedScriptTagId }
              }
            `, { variables: { id: tag.node.id } });
        }

        if (intent === "disable") {
            await db.cartActivitySettings.upsert({
                where: { shop },
                update: { trackerInstalled: false },
                create: { shop, trackerInstalled: false, subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },
            });
            return { success: true, installed: false };
        }

        const url = new URL(request.url);
        const appUrl = url.host ? `https://${url.host}` : process.env.APP_URL;

        const response = await admin.graphql(`
          mutation scriptTagCreate($input: ScriptTagInput!) {
            scriptTagCreate(input: $input) {
              scriptTag { id src }
              userErrors { field message }
            }
          }
        `, {
            variables: {
                input: { src: `${appUrl}${TRACKER_PATH}`, displayScope: "ALL" },
            },
        });

        const data: any = await response.json();

        if (data.errors) {
            console.error("scriptTagCreate errors:", JSON.stringify(data.errors));
            return { success: false, error: data.errors[0]?.message ?? "Failed to create script tag" };
        }

        const userErrors = data.data.scriptTagCreate.userErrors;
        if (userErrors?.length) {
            console.error("scriptTagCreate userErrors:", JSON.stringify(userErrors));
            return { success: false, error: userErrors[0].message };
        }

        await db.cartActivitySettings.upsert({
            where: { shop },
            update: { trackerInstalled: true },
            create: { shop, trackerInstalled: true, subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },
        });

        return { success: true, installed: true };
    } catch (error) {
        console.error("Cart activity script toggle failed:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
};
