import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  DataTable,
  Badge,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const carts = await db.abandonedCart.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const total = carts.length;
  const recovered = carts.filter((c) => c.isRecovered).length;
  const recoveryRate = total > 0 ? Math.round((recovered / total) * 100) : 0;
  const revenue = carts
    .filter((c) => c.isRecovered)
    .reduce((sum, c) => sum + parseFloat(c.totalPrice), 0)
    .toFixed(2);

  return { stats: { total, recovered, recoveryRate, revenue }, carts };
};

export default function Index() {
  const { stats, carts } = useLoaderData<typeof loader>();

  const rows = carts.map((cart) => {
    const items = JSON.parse(cart.cartData as string);
    const productNames = items.map((i: any) => i.title).join(", ");

    return [
      cart.customerEmail || "Guest",
      productNames.length > 50
        ? productNames.substring(0, 50) + "..."
        : productNames,
      `$${cart.totalPrice}`,
      new Date(cart.createdAt).toLocaleDateString(),
      cart.isRecovered ? "Recovered" : "Abandoned",
    ];
  });

  return (
    <Page title="CartPulse Dashboard">
      <BlockStack gap="500">

        <InlineGrid columns={4} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Abandoned Carts
              </Text>
              <Text as="p" variant="headingXl">
                {stats.total}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Recovered
              </Text>
              <Text as="p" variant="headingXl">
                {stats.recovered}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Recovery Rate
              </Text>
              <Text as="p" variant="headingXl">
                {stats.recoveryRate}%
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Revenue Recovered
              </Text>
              <Text as="p" variant="headingXl">
                ${stats.revenue}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Abandoned Carts
            </Text>
            {carts.length === 0 ? (
              <Text as="p" tone="subdued">
                No abandoned carts yet.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={[
                  "text", "text", "numeric", "text", "text",
                ]}
                headings={[
                  "Customer", "Products", "Total", "Date", "Status",
                ]}
                rows={rows}
              />
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}