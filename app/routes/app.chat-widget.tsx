import { useTranslation } from "../i18n/LanguageContext";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const SCRIPT_SRC_MATCH = "support-chat.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      scriptTags(first: 25) {
        edges {
          node {
            id
            src
          }
        }
      }
    }
  `);
  const data = await response.json();
  const tags = data.data.scriptTags.edges as Array<{
    node: { id: string; src: string };
  }>;
  const existing = tags.find((tag) => tag.node.src.includes(SCRIPT_SRC_MATCH));

  return { installed: Boolean(existing), src: existing?.node.src ?? null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const listResponse = await admin.graphql(`
    query {
      scriptTags(first: 25) {
        edges {
          node {
            id
            src
          }
        }
      }
    }
  `);
  const listData = await listResponse.json();
  const tags = listData.data.scriptTags.edges as Array<{
    node: { id: string; src: string };
  }>;
  const existing = tags.filter((tag) =>
    tag.node.src.includes(SCRIPT_SRC_MATCH),
  );

  for (const tag of existing) {
    await admin.graphql(
      `mutation scriptTagDelete($id: ID!) {
        scriptTagDelete(id: $id) {
          deletedScriptTagId
        }
      }`,
      { variables: { id: tag.node.id } },
    );
  }

  const appUrl = process.env.SHOPIFY_APP_URL || process.env.APP_URL || "";
  const response = await admin.graphql(
    `mutation scriptTagCreate($input: ScriptTagInput!) {
      scriptTagCreate(input: $input) {
        scriptTag {
          id
          src
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: {
          src: `${appUrl}/support-chat.js`,
          displayScope: "ALL",
        },
      },
    },
  );

  const data = await response.json();
  return { result: data.data.scriptTagCreate };
};

export default function ChatWidgetSettings() {
  const { tr, locale } = useTranslation();

  const { installed, src } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <Page title={tr("Support Chat")}>
      <div style={{ padding: "16px" }}>
        <p>
          {tr(" Status: ")}
          <strong>{installed ? tr("Installed") : tr("Not installed")}</strong>
        </p>
        {src && <p style={{ color: "#64748b", fontSize: "13px" }}>{tr(src)}</p>}
        <Form method="post" style={{ marginTop: "16px" }}>
          <button type="submit" disabled={busy}>
            {busy
              ? tr("Working...")
              : installed
                ? tr("Reinstall widget")
                : tr("Install widget")}
          </button>
        </Form>
      </div>
    </Page>
  );
}
