import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Toast } from "../components/Feedback";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getEntitlement } from "../lib/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);

  const settings = await db.merchantSettings.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });

  const entitlement = await getEntitlement(admin, billing);

  return {
    settings: {
      emailEnabled: settings.emailEnabled,
      pushEnabled: settings.pushEnabled,
      discountPercent: settings.discountPercent,
      discountExpiry: settings.discountExpiry,
      emailFromName: settings.emailFromName ?? "",
      emailFromAddress: settings.emailFromAddress ?? "",
    },
    entitlement,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await db.merchantSettings.upsert({
    where: { shop: session.shop },
    update: {
      emailEnabled: formData.get("emailEnabled") === "true",
      pushEnabled: formData.get("pushEnabled") === "true",
      emailFromName: String(formData.get("emailFromName") || "") || null,
      emailFromAddress: String(formData.get("emailFromAddress") || "") || null,
    },
    create: {
      shop: session.shop,
      emailEnabled: formData.get("emailEnabled") === "true",
      pushEnabled: formData.get("pushEnabled") === "true",
      emailFromName: String(formData.get("emailFromName") || "") || null,
      emailFromAddress: String(formData.get("emailFromAddress") || "") || null,
    },
  });

  return { ok: true };
};

export default function Settings() {
  const { settings, entitlement } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  const saving = navigation.state === "submitting";

  const [toast, setToast] = useState<string | null>(null);
  const wasSaving = useRef(false);

  // Announce the save once the submission settles.
  useEffect(() => {
    if (saving) {
      wasSaving.current = true;
      return;
    }
    if (wasSaving.current && actionData?.ok) {
      wasSaving.current = false;
      setToast("Settings saved");
    }
  }, [saving, actionData]);

  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled);
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);
  const [fromName, setFromName] = useState(settings.emailFromName);
  const [fromAddress, setFromAddress] = useState(settings.emailFromAddress);

  const save = () =>
    submit(
      {
        emailEnabled: String(emailEnabled),
        pushEnabled: String(pushEnabled),
        emailFromName: fromName,
        emailFromAddress: fromAddress,
      },
      { method: "post" }
    );

  return (
    <Page
      title="Settings"
      subtitle="Control what CartPulse sends to your shoppers"
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{ content: "Save", onAction: save, loading: saving }}
    >
      <BlockStack gap="500">
        {!entitlement.entitled ? (
          <Banner tone="warning" title="No active plan">
            <p>
              These switches are saved, but nothing is sent until a plan is active on this store.
            </p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Abandoned cart recovery
                  </Text>
                  <Badge tone={emailEnabled || pushEnabled ? "success" : "critical"}>
                    {emailEnabled || pushEnabled ? "On" : "Off"}
                  </Badge>
                </InlineStack>

                <Divider />

                <Checkbox
                  label="Send recovery emails"
                  helpText="Sends a first reminder and a final notice to shoppers who leave a cart behind. Turn this off and no recovery email is ever sent."
                  checked={emailEnabled}
                  onChange={setEmailEnabled}
                />

                <Checkbox
                  label="Send browser push notifications"
                  helpText="Sends a push notification to shoppers who allowed notifications on your storefront."
                  checked={pushEnabled}
                  onChange={setPushEnabled}
                />

                <Text as="p" variant="bodySm" tone="subdued">
                  Carts are always recorded in your reports, even with both switches off.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Email sender
                </Text>
                <Divider />
                <TextField
                  label="From name"
                  value={fromName}
                  onChange={setFromName}
                  placeholder="CartPulse"
                  autoComplete="off"
                  disabled={!emailEnabled}
                />
                <TextField
                  label="Reply-to address"
                  type="email"
                  value={fromAddress}
                  onChange={setFromAddress}
                  placeholder="support@yourstore.com"
                  autoComplete="off"
                  disabled={!emailEnabled}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <InlineStack align="end">
          <Button variant="primary" loading={saving} onClick={save}>
            Save
          </Button>
        </InlineStack>
      </BlockStack>

      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
