import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Form,
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "react-router";
import { ConfirmDialog, SaveLabel, Toast } from "../components/Feedback";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  SIZE_CHART_TEMPLATES,
  convertCell,
  getTemplate,
} from "../lib/size-chart-templates";

type UnitSystem = "cm" | "in";

interface ChartDraft {
  id: string | null;
  name: string;
  status: string;
  unitSystem: UnitSystem;
  template: string;
  description: string;
  assignType: string;
  assignValue: string;
  columns: string[];
  rows: string[][];
}

const PAGE_PATH = "/app/size-charts";

/**
 * Embedded admin pages must keep Shopify's params (host, shop, id_token,
 * embedded) on every navigation. A bare path drops them, the loader can no
 * longer resolve the shop, and the request gets bounced to login.
 */
function buildHref(current: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? PAGE_PATH + "?" + query : PAGE_PATH;
}

function safeRedirectTarget(value: FormDataEntryValue | null) {
  const target = String(value || "");
  return target.startsWith(PAGE_PATH) ? target : PAGE_PATH;
}

/** Carries the outcome across the redirect so the list can show a toast. */
function withFlash(target: string, flash: string) {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  params.set("done", flash);
  return `${path}?${params.toString()}`;
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const CATALOG_QUERY = `#graphql
  query SizeChartCatalog {
    products(first: 100, sortKey: TITLE) {
      nodes { handle title tags }
    }
    collections(first: 100, sortKey: TITLE) {
      nodes { handle title }
    }
  }
`;

interface CatalogEntry {
  handle: string;
  title: string;
}

interface Catalog {
  products: CatalogEntry[];
  collections: CatalogEntry[];
  tags: string[];
}

const EMPTY_CATALOG: Catalog = { products: [], collections: [], tags: [] };

async function loadCatalog(admin: { graphql: (q: string) => Promise<Response> }): Promise<Catalog> {
  try {
    const response = await admin.graphql(CATALOG_QUERY);
    const body = await response.json();
    const products = body?.data?.products?.nodes ?? [];
    const collections = body?.data?.collections?.nodes ?? [];

    const tags = new Set<string>();
    for (const product of products) {
      for (const tag of product.tags ?? []) tags.add(tag);
    }

    return {
      products: products.map((p: any) => ({ handle: p.handle, title: p.title })),
      collections: collections.map((c: any) => ({ handle: c.handle, title: c.title })),
      tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
    };
  } catch {
    // A catalog failure must not block editing the chart itself.
    return EMPTY_CATALOG;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const editId = url.searchParams.get("id");
  const newTemplate = url.searchParams.get("new");

  const charts = await db.sizeChart.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
  });

  const list = charts.map((chart) => ({
    id: chart.id,
    name: chart.name,
    status: chart.status,
    unitSystem: chart.unitSystem,
    template: chart.template,
    assignType: chart.assignType,
    assignValue: chart.assignValue ?? "",
    rowCount: safeParse<string[][]>(chart.rows, []).length,
    columnCount: safeParse<string[]>(chart.columns, []).length,
    updatedAt: chart.updatedAt.toISOString(),
  }));

  let draft: ChartDraft | null = null;

  if (editId) {
    const chart = charts.find((c) => c.id === editId);
    if (chart) {
      draft = {
        id: chart.id,
        name: chart.name,
        status: chart.status,
        unitSystem: (chart.unitSystem === "in" ? "in" : "cm") as UnitSystem,
        template: chart.template,
        description: chart.description ?? "",
        assignType: chart.assignType,
        assignValue: chart.assignValue ?? "",
        columns: safeParse<string[]>(chart.columns, ["Size"]),
        rows: safeParse<string[][]>(chart.rows, [[""]]),
      };
    }
  } else if (newTemplate) {
    const tpl = getTemplate(newTemplate);
    draft = {
      id: null,
      name: tpl.key === "custom" ? "" : tpl.label,
      status: "draft",
      unitSystem: tpl.unitSystem,
      template: tpl.key,
      description: tpl.description,
      assignType: "all",
      assignValue: "",
      columns: tpl.columns,
      rows: tpl.rows,
    };
  }

  // Only the editor needs the catalog, so the list view skips the API call.
  const catalog = draft ? await loadCatalog(admin) : EMPTY_CATALOG;

  return {
    list,
    draft,
    catalog,
    templates: SIZE_CHART_TEMPLATES.map((t) => ({ key: t.key, label: t.label })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const id = String(formData.get("id") || "");
  const back = safeRedirectTarget(formData.get("redirectTo"));

  if (intent === "delete" && id) {
    await db.sizeChart.deleteMany({ where: { id, shop: session.shop } });
    return redirect(withFlash(back, "deleted"));
  }

  if (intent === "toggle" && id) {
    const existing = await db.sizeChart.findFirst({ where: { id, shop: session.shop } });
    if (existing) {
      await db.sizeChart.update({
        where: { id },
        data: { status: existing.status === "active" ? "draft" : "active" },
      });
    }
    return redirect(withFlash(back, "updated"));
  }

  if (intent === "duplicate" && id) {
    const existing = await db.sizeChart.findFirst({ where: { id, shop: session.shop } });
    if (existing) {
      await db.sizeChart.create({
        data: {
          shop: session.shop,
          name: existing.name + " (copy)",
          status: "draft",
          unitSystem: existing.unitSystem,
          template: existing.template,
          columns: existing.columns,
          rows: existing.rows,
          description: existing.description,
          assignType: existing.assignType,
          assignValue: existing.assignValue,
        },
      });
    }
    return redirect(withFlash(back, "duplicated"));
  }

  if (intent === "save" || intent === "save-active" || intent === "save-draft") {
    // The clicked button decides the status, so it can never lag React state.
    const status =
      intent === "save-active"
        ? "active"
        : intent === "save-draft"
          ? "draft"
          : String(formData.get("status") || "draft");

    const data = {
      name: String(formData.get("name") || "").trim() || "Untitled size chart",
      status,
      unitSystem: String(formData.get("unitSystem") || "cm"),
      template: String(formData.get("template") || "custom"),
      description: String(formData.get("description") || ""),
      assignType: String(formData.get("assignType") || "all"),
      assignValue: String(formData.get("assignValue") || ""),
      columns: String(formData.get("columns") || "[]"),
      rows: String(formData.get("rows") || "[]"),
    };

    if (id) {
      await db.sizeChart.updateMany({ where: { id, shop: session.shop }, data });
    } else {
      await db.sizeChart.create({ data: { ...data, shop: session.shop } });
    }
    return redirect(withFlash(back, "saved"));
  }

  return redirect(back);
};

const COLORS = {
  green: "#1D9E75",
  greenDark: "#085041",
  greenSoft: "#E1F5EE",
  purple: "#534AB7",
  purpleSoft: "#EEEDFE",
  border: "#f0f0f0",
  muted: "#9ca3af",
};

const STYLES = `
  .cp-card { background: #fff; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .cp-table { width: 100%; border-collapse: collapse; }
  .cp-table th { font-size: 12px; color: #534AB7; font-weight: 600; padding: 10px 16px; text-align: left; border-bottom: 1px solid #f0f0f0; }
  .cp-table td { font-size: 13px; color: #374151; padding: 12px 16px; border-bottom: 1px solid #f9f9f9; vertical-align: middle; }
  .cp-table tr:hover td { background: #fafafa; }
  .cp-table tr:last-child td { border-bottom: none; }
  .badge-active { background: #DCFCE7; color: #166534; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
  .badge-draft { background: #FEF9C3; color: #854D0E; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
  .cp-btn { border: none; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; background: #1D9E75; color: #fff; font-family: inherit; }
  .cp-btn:hover { background: #178763; }
  .cp-btn:disabled { opacity: .5; cursor: not-allowed; }
  .cp-btn-ghost { background: #fff; color: #374151; border: 1px solid #e5e7eb; }
  .cp-btn-ghost:hover { background: #f9fafb; }
  .cp-btn-danger { background: #fff; color: #b42318; border: 1px solid #fecdca; }
  .cp-btn-danger:hover { background: #fef3f2; }
  .cp-input { border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px 12px; font-size: 13px; width: 100%; box-sizing: border-box; font-family: inherit; }
  .cp-input:focus { outline: 2px solid #1D9E75; outline-offset: -1px; }
  .cp-label { display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
  .cp-grid-cell { border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 10px; font-size: 13px; width: 100%; box-sizing: border-box; font-family: inherit; }
  .cp-grid-cell:focus { outline: 2px solid #534AB7; outline-offset: -1px; }
  .cp-head-cell { border: 1px solid #ddd6fe; background: #EEEDFE; border-radius: 8px; padding: 7px 10px; font-size: 12px; font-weight: 600; color: #3C3489; width: 100%; box-sizing: border-box; font-family: inherit; }
  .cp-tpl { text-align: left; background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 16px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: all .15s; display: block; text-decoration: none; }
  .cp-tpl:hover { border-color: #1D9E75; box-shadow: 0 4px 16px rgba(29,158,117,0.15); }
  .cp-x { border: none; background: transparent; color: #9ca3af; cursor: pointer; font-size: 15px; line-height: 1; padding: 4px 6px; border-radius: 6px; }
  .cp-x:hover { background: #fef3f2; color: #b42318; }
  .cp-picker { border: 1px solid #e5e7eb; border-radius: 10px; max-height: 220px; overflow-y: auto; background: #fff; }
  .cp-opt { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 13px; color: #374151; cursor: pointer; border-bottom: 1px solid #f9fafb; }
  .cp-opt:last-child { border-bottom: none; }
  .cp-opt:hover { background: #fafafa; }
  .cp-opt-on { background: #E1F5EE; }
  .cp-opt-on:hover { background: #d3efe4; }
  .cp-opt input { accent-color: #1D9E75; }
  .cp-opt span:first-of-type { flex: 1; }
`;

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <p style={{ fontSize: "15px", fontWeight: 600, color: "#111", margin: 0 }}>{title}</p>
      {hint ? (
        <p style={{ fontSize: "12px", color: COLORS.muted, margin: "2px 0 0" }}>{hint}</p>
      ) : null}
    </div>
  );
}

function AssignmentPicker({
  assignType,
  selected,
  onToggle,
  catalog,
}: {
  assignType: string;
  selected: string[];
  onToggle: (value: string) => void;
  catalog: Catalog;
}) {
  const [filter, setFilter] = useState("");

  const options: CatalogEntry[] =
    assignType === "products"
      ? catalog.products
      : assignType === "collections"
        ? catalog.collections
        : catalog.tags.map((tag) => ({ handle: tag, title: tag }));

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? options.filter(
        (o) =>
          o.title.toLowerCase().includes(needle) || o.handle.toLowerCase().includes(needle)
      )
    : options;

  const noun =
    assignType === "products" ? "products" : assignType === "collections" ? "collections" : "tags";

  if (options.length === 0) {
    return (
      <p style={{ fontSize: "13px", color: COLORS.muted, margin: 0 }}>
        No {noun} found in this store.
      </p>
    );
  }

  return (
    <div>
      <input
        className="cp-input"
        value={filter}
        placeholder={"Search " + noun + "..."}
        onChange={(e) => setFilter(e.currentTarget.value)}
        style={{ marginBottom: "8px" }}
      />
      <div className="cp-picker">
        {visible.length === 0 ? (
          <p style={{ fontSize: "13px", color: COLORS.muted, margin: "8px" }}>No matches.</p>
        ) : (
          visible.map((option) => {
            const checked = selected.includes(option.handle);
            return (
              <label key={option.handle} className={checked ? "cp-opt cp-opt-on" : "cp-opt"}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.handle)}
                />
                <span>{option.title}</span>
                {assignType !== "tags" ? (
                  <span style={{ color: COLORS.muted, fontSize: "11px" }}>{option.handle}</span>
                ) : null}
              </label>
            );
          })
        )}
      </div>
      <p style={{ fontSize: "12px", color: COLORS.muted, margin: "8px 0 0" }}>
        {selected.length} selected
      </p>
    </div>
  );
}

function ChartEditor({
  draft,
  searchParams,
  catalog,
}: {
  draft: ChartDraft;
  searchParams: URLSearchParams;
  catalog: Catalog;
}) {
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const listHref = buildHref(searchParams, { id: null, new: null });

  const [name, setName] = useState(draft.name);
  const [status, setStatus] = useState(draft.status);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(draft.unitSystem);
  const [description, setDescription] = useState(draft.description);
  const [assignType, setAssignType] = useState(draft.assignType);
  const [assignValue, setAssignValue] = useState(draft.assignValue);

  const selectedTargets = assignValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const toggleTarget = (value: string) => {
    const next = selectedTargets.includes(value)
      ? selectedTargets.filter((entry) => entry !== value)
      : [...selectedTargets, value];
    setAssignValue(next.join(","));
  };

  const [columns, setColumns] = useState<string[]>(draft.columns);
  const [rows, setRows] = useState<string[][]>(draft.rows);

  // Re-seed the editor when a different chart is opened.
  useEffect(() => {
    setName(draft.name);
    setStatus(draft.status);
    setUnitSystem(draft.unitSystem);
    setDescription(draft.description);
    setAssignType(draft.assignType);
    setAssignValue(draft.assignValue);
    setColumns(draft.columns);
    setRows(draft.rows);
  }, [draft]);

  const setCell = (rowIndex: number, colIndex: number, value: string) => {
    setRows((prev) =>
      prev.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row
      )
    );
  };

  const setColumn = (colIndex: number, value: string) => {
    setColumns((prev) => prev.map((col, c) => (c === colIndex ? value : col)));
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, "Column " + (prev.length + 1)]);
    setRows((prev) => prev.map((row) => [...row, ""]));
  };

  const removeColumn = (colIndex: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, c) => c !== colIndex));
    setRows((prev) => prev.map((row) => row.filter((_, c) => c !== colIndex)));
  };

  const addRow = () => setRows((prev) => [...prev, columns.map(() => "")]);

  const removeRow = (rowIndex: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, r) => r !== rowIndex));
  };

  // Only measurement cells convert — the first column holds size labels.
  const switchUnits = (next: UnitSystem) => {
    if (next === unitSystem) return;
    setRows((prev) =>
      prev.map((row) =>
        row.map((cell, c) => (c === 0 ? cell : convertCell(cell, unitSystem, next)))
      )
    );
    setUnitSystem(next);
  };

  return (
    <div>
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div>
          <Link
            to={listHref}
            style={{ fontSize: "12px", color: COLORS.purple, textDecoration: "none", fontWeight: 600 }}
          >
            &larr; All size charts
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "6px 0 0", color: "#111" }}>
            {draft.id ? "Edit size chart" : "New size chart"}
          </h1>
        </div>
        <span className={status === "active" ? "badge-active" : "badge-draft"}>
          {status === "active" ? "Active" : "Draft"}
        </span>
      </div>

      <Form method="post" action={listHref}>
        <input type="hidden" name="redirectTo" value={listHref} />
        <input type="hidden" name="id" value={draft.id ?? ""} />
        <input type="hidden" name="template" value={draft.template} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="unitSystem" value={unitSystem} />
        <input type="hidden" name="columns" value={JSON.stringify(columns)} />
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />

        <div className="cp-card" style={{ marginBottom: "16px" }}>
          <SectionHeading title="Details" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label className="cp-label" htmlFor="sc-name">
                Chart name
              </label>
              <input
                id="sc-name"
                className="cp-input"
                name="name"
                value={name}
                placeholder="e.g. Womens t-shirts"
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </div>
            <div>
              <span className="cp-label">Units</span>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["cm", "in"] as UnitSystem[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={unitSystem === unit ? "cp-btn" : "cp-btn cp-btn-ghost"}
                    style={{ flex: 1 }}
                    onClick={() => switchUnits(unit)}
                  >
                    {unit === "cm" ? "Centimetres" : "Inches"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="cp-label" htmlFor="sc-description">
              Note shown under the chart (optional)
            </label>
            <textarea
              id="sc-description"
              className="cp-input"
              name="description"
              rows={2}
              value={description}
              placeholder="e.g. Measurements are taken on the body, not the garment."
              onChange={(e) => setDescription(e.currentTarget.value)}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>

        <div className="cp-card" style={{ marginBottom: "16px" }}>
          <SectionHeading
            title="Measurements"
            hint="The first column holds the size labels and is never unit-converted."
          />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "6px" }}>
              <thead>
                <tr>
                  <th style={{ width: "28px" }} />
                  {columns.map((col, colIndex) => (
                    <th key={colIndex} style={{ minWidth: "120px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                        <input
                          className="cp-head-cell"
                          value={col}
                          aria-label={"Column " + (colIndex + 1) + " name"}
                          onChange={(e) => setColumn(colIndex, e.currentTarget.value)}
                        />
                        {columns.length > 1 ? (
                          <button
                            type="button"
                            className="cp-x"
                            title="Remove column"
                            onClick={() => removeColumn(colIndex)}
                          >
                            &times;
                          </button>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td style={{ textAlign: "center" }}>
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          className="cp-x"
                          title="Remove row"
                          onClick={() => removeRow(rowIndex)}
                        >
                          &times;
                        </button>
                      ) : null}
                    </td>
                    {columns.map((_, colIndex) => (
                      <td key={colIndex}>
                        <input
                          className="cp-grid-cell"
                          value={row[colIndex] ?? ""}
                          aria-label={"Row " + (rowIndex + 1) + " " + columns[colIndex]}
                          onChange={(e) => setCell(rowIndex, colIndex, e.currentTarget.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button type="button" className="cp-btn cp-btn-ghost" onClick={addRow}>
              + Add row
            </button>
            <button type="button" className="cp-btn cp-btn-ghost" onClick={addColumn}>
              + Add column
            </button>
          </div>
        </div>

        <div className="cp-card" style={{ marginBottom: "16px" }}>
          <SectionHeading
            title="Where it shows"
            hint="Saved with the chart now; the storefront button gets wired up in the next phase."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
            <div>
              <label className="cp-label" htmlFor="sc-assign">
                Applies to
              </label>
              <select
                id="sc-assign"
                className="cp-input"
                name="assignType"
                value={assignType}
                onChange={(e) => setAssignType(e.currentTarget.value)}
              >
                <option value="all">All products</option>
                <option value="tags">Products with tags</option>
                <option value="collections">Collections</option>
                <option value="products">Specific products</option>
              </select>
            </div>
            <div>
              <span className="cp-label">
                {assignType === "all" ? "Shows on every product" : "Pick from your store"}
              </span>
              <input type="hidden" name="assignValue" value={selectedTargets.join(",")} />
              {assignType === "all" ? (
                <p style={{ fontSize: "13px", color: COLORS.muted, margin: 0 }}>
                  Nothing to choose — this chart applies to all products.
                </p>
              ) : (
                <AssignmentPicker
                  assignType={assignType}
                  selected={selectedTargets}
                  onToggle={toggleTarget}
                  catalog={catalog}
                />
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="submit"
            name="intent"
            value="save"
            className={saving ? "cp-btn" : "cp-btn"}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}
          >
            <SaveLabel saving={saving} saved={false} idleLabel="Save chart" />
          </button>
          <button
            type="submit"
            name="intent"
            value={status === "active" ? "save-draft" : "save-active"}
            className="cp-btn cp-btn-ghost"
            disabled={saving}
          >
            {status === "active" ? "Save as draft" : "Save and activate"}
          </button>
          <Link
            to={listHref}
            className="cp-btn cp-btn-ghost"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}

const FLASH_MESSAGES: Record<string, { text: string; tone: "success" | "danger" }> = {
  saved: { text: "Size chart saved", tone: "success" },
  deleted: { text: "Size chart deleted", tone: "danger" },
  duplicated: { text: "Size chart duplicated", tone: "success" },
  updated: { text: "Size chart updated", tone: "success" },
};

export default function SizeCharts() {
  const { list, draft, templates, catalog } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deleteFetcher = useFetcher();

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const flashKey = searchParams.get("done");
  const flash = flashKey ? FLASH_MESSAGES[flashKey] : undefined;

  // Drop the flag from the URL so a refresh does not replay the toast.
  const clearFlash = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("done");
    const query = next.toString();
    navigate(query ? `${PAGE_PATH}?${query}` : PAGE_PATH, { replace: true });
  }, [navigate, searchParams]);

  // Let the row finish animating out before the delete is submitted.
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setRemovingId(id);

    window.setTimeout(() => {
      deleteFetcher.submit(
        { intent: "delete", id, redirectTo: buildHref(searchParams, { id: null, new: null }) },
        { method: "post", action: buildHref(searchParams, { id: null, new: null }) }
      );
    }, 300);
  };

  if (draft) {
    return (
      <Page>
        <style>{STYLES}</style>
        <ChartEditor
          draft={draft as ChartDraft}
          searchParams={searchParams}
          catalog={catalog}
          key={searchParams.toString()}
        />
      </Page>
    );
  }

  const activeCount = list.filter((c) => c.status === "active").length;
  const listHref = buildHref(searchParams, { id: null, new: null });

  return (
    <Page>
      <style>{STYLES}</style>

      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: COLORS.purpleSoft,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.purple} strokeWidth="2">
                <path d="M3 7h18v10H3z" />
                <path d="M7 7v4M11 7v4M15 7v4M19 7v4" />
              </svg>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#111" }}>Size charts</h1>
          </div>
          <p style={{ fontSize: "13px", color: COLORS.muted, margin: 0 }}>
            Build size guides from a template, then assign them to products.
          </p>
        </div>
        <div
          style={{
            background: COLORS.greenSoft,
            borderRadius: "10px",
            padding: "8px 16px",
            fontSize: "13px",
            color: COLORS.greenDark,
            fontWeight: 500,
          }}
        >
          {list.length} chart{list.length === 1 ? "" : "s"} &middot; {activeCount} active
        </div>
      </div>

      <div className="cp-card" style={{ marginBottom: "16px" }}>
        <SectionHeading
          title="Start from a template"
          hint="Everything stays editable after you pick one."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: "12px",
          }}
        >
          {templates.map((tpl) => (
            <Link
              key={tpl.key}
              to={buildHref(searchParams, { id: null, new: tpl.key })}
              className="cp-tpl"
            >
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", margin: "0 0 4px" }}>
                {tpl.label}
              </p>
              <p style={{ fontSize: "12px", color: COLORS.purple, margin: 0, fontWeight: 600 }}>
                Use template &rarr;
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="cp-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid " + COLORS.border }}>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>Your size charts</span>
        </div>

        {list.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                background: "#F1F5F9",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth="2">
                <path d="M3 7h18v10H3z" />
                <path d="M7 7v4M11 7v4M15 7v4M19 7v4" />
              </svg>
            </div>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
              No size charts yet
            </p>
            <p style={{ fontSize: "13px", color: COLORS.muted, margin: 0 }}>
              Pick a template above to create your first one.
            </p>
          </div>
        ) : (
          <table className="cp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Size</th>
                <th>Applies to</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((chart) => (
                <tr key={chart.id} className={removingId === chart.id ? "ui-row-removing" : undefined}>
                  <td>
                    <Link
                      to={buildHref(searchParams, { new: null, id: chart.id })}
                      style={{ color: "#111", fontWeight: 600, textDecoration: "none" }}
                    >
                      {chart.name}
                    </Link>
                    <p style={{ fontSize: "11px", color: COLORS.muted, margin: "2px 0 0" }}>
                      {chart.unitSystem}
                    </p>
                  </td>
                  <td>
                    <span className={chart.status === "active" ? "badge-active" : "badge-draft"}>
                      {chart.status === "active" ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td>
                    {chart.rowCount} &times; {chart.columnCount}
                  </td>
                  <td>
                    {chart.assignType === "all"
                      ? "All products"
                      : chart.assignType + ": " + (chart.assignValue || "-")}
                  </td>
                  <td>{new Date(chart.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <Form method="post" action={listHref}>
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="redirectTo" value={listHref} />
                        <input type="hidden" name="id" value={chart.id} />
                        <button type="submit" className="cp-btn cp-btn-ghost">
                          {chart.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </Form>
                      <Form method="post" action={listHref}>
                        <input type="hidden" name="intent" value="duplicate" />
                        <input type="hidden" name="redirectTo" value={listHref} />
                        <input type="hidden" name="id" value={chart.id} />
                        <button type="submit" className="cp-btn cp-btn-ghost">
                          Duplicate
                        </button>
                      </Form>
                      <button
                        type="button"
                        className="cp-btn cp-btn-danger"
                        onClick={() => setPendingDelete({ id: chart.id, name: chart.name })}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ textAlign: "center", fontSize: "12px", color: COLORS.muted, marginTop: "20px" }}>
        Next phase: a theme app extension so the size guide button places itself on product pages.
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this size chart?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed permanently. Any product using it will stop showing a size guide. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete chart"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Toast message={flash?.text ?? null} tone={flash?.tone ?? "success"} onDone={clearFlash} />
    </Page>
  );
}
