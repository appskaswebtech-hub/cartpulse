import { useTranslation } from "../i18n/LanguageContext";
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
import {
  SizeChartIcon,
  SizeChartsHero,
  SizeChartsEmptyArt,
} from "../components/SizeChartsVisuals";
import pageStylesheet from "../styles/size-charts.css?url";

export const links = () => [{ rel: "stylesheet", href: pageStylesheet }];
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
function buildHref(
  current: URLSearchParams,
  changes: Record<string, string | null>,
) {
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

async function loadCatalog(admin: {
  graphql: (q: string) => Promise<Response>;
}): Promise<Catalog> {
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
      products: products.map((p: any) => ({
        handle: p.handle,
        title: p.title,
      })),
      collections: collections.map((c: any) => ({
        handle: c.handle,
        title: c.title,
      })),
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
    templates: SIZE_CHART_TEMPLATES.map((t) => ({
      key: t.key,
      label: t.label,
    })),
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
    const existing = await db.sizeChart.findFirst({
      where: { id, shop: session.shop },
    });
    if (existing) {
      await db.sizeChart.update({
        where: { id },
        data: { status: existing.status === "active" ? "draft" : "active" },
      });
    }
    return redirect(withFlash(back, "updated"));
  }

  if (intent === "duplicate" && id) {
    const existing = await db.sizeChart.findFirst({
      where: { id, shop: session.shop },
    });
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

  if (
    intent === "save" ||
    intent === "save-active" ||
    intent === "save-draft"
  ) {
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
      await db.sizeChart.updateMany({
        where: { id, shop: session.shop },
        data,
      });
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
  muted: "#52627a",
};

function SectionHeading({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: string;
}) {
  const { tr } = useTranslation();
  return (
    <div className="sc-editor-section-heading">
      {icon && (
        <span className="sc-editor-section-icon">
          <SizeChartIcon name={icon} />
        </span>
      )}
      <div>
        <h2>{tr(title)}</h2>
        {hint && <p>{tr(hint)}</p>}
      </div>
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
  const { tr, locale } = useTranslation();

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
          o.title.toLowerCase().includes(needle) ||
          o.handle.toLowerCase().includes(needle),
      )
    : options;

  const noun =
    assignType === "products"
      ? "products"
      : assignType === "collections"
        ? "collections"
        : "tags";

  if (options.length === 0) {
    return (
      <p style={{ fontSize: "13px", color: COLORS.muted, margin: 0 }}>
        {tr(" No ")}
        {tr(noun)} {tr(" found in this store. ")}
      </p>
    );
  }

  return (
    <div>
      <input
        className="cp-input"
        value={filter}
        placeholder={tr("Search " + noun + "...")}
        onChange={(e) => setFilter(e.currentTarget.value)}
        style={{ marginBottom: "8px" }}
      />
      <div className="cp-picker">
        {visible.length === 0 ? (
          <p style={{ fontSize: "13px", color: COLORS.muted, margin: "8px" }}>
            {tr(" No matches. ")}
          </p>
        ) : (
          visible.map((option) => {
            const checked = selected.includes(option.handle);
            return (
              <label
                key={option.handle}
                className={checked ? "cp-opt cp-opt-on" : "cp-opt"}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.handle)}
                />
                <span>{tr(option.title)}</span>
                {assignType !== "tags" ? (
                  <span style={{ color: COLORS.muted, fontSize: "11px" }}>
                    {tr(option.handle)}
                  </span>
                ) : null}
              </label>
            );
          })
        )}
      </div>
      <p style={{ fontSize: "12px", color: COLORS.muted, margin: "8px 0 0" }}>
        {tr(selected.length)} {tr(" selected ")}
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
  const { tr, locale } = useTranslation();

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
        r === rowIndex
          ? row.map((cell, c) => (c === colIndex ? value : cell))
          : row,
      ),
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
        row.map((cell, c) =>
          c === 0 ? cell : convertCell(cell, unitSystem, next),
        ),
      ),
    );
    setUnitSystem(next);
  };

  return (
    <div className="sc-editor">
      <Link className="sc-editor-back" to={listHref}>
        {tr("? All size charts")}
      </Link>
      <header className="sc-editor-header">
        <svg
          className="sc-editor-header-wave"
          viewBox="0 0 700 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 120C170-30 210 130 420 52S620 15 700 0V120Z"
            fill="#dff7ed"
            opacity=".6"
          />
        </svg>
        <span className="sc-editor-title-icon">
          <SizeChartIcon name="ruler" />
        </span>
        <div>
          <h1>{draft.id ? tr("Edit size chart") : tr("New size chart")}</h1>
          <p>
            {draft.id
              ? tr("Update the size chart for your products.")
              : tr("Create a new size chart for your products.")}
          </p>
        </div>
        <span className={status === "active" ? "badge-active" : "badge-draft"}>
          {status === "active" ? tr("Active") : tr("Draft")}
        </span>
      </header>

      <Form method="post" action={listHref}>
        <input type="hidden" name="redirectTo" value={listHref} />
        <input type="hidden" name="id" value={draft.id ?? ""} />
        <input type="hidden" name="template" value={draft.template} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="unitSystem" value={unitSystem} />
        <input type="hidden" name="columns" value={JSON.stringify(columns)} />
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />

        <div className="cp-card sc-editor-card sc-editor-details">
          <SectionHeading title={tr("Details")} icon="details" />
          <div className="sc-editor-details-grid">
            <div>
              <label className="cp-label" htmlFor="sc-name">
                {tr(" Chart name ")}
                <span className="sc-editor-required" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="sc-name"
                className="cp-input"
                name="name"
                value={name}
                placeholder={tr("e.g. Womens t-shirts")}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </div>
            <div>
              <span className="cp-label">{tr("Units")}</span>
              <div
                className="sc-editor-units"
                role="group"
                aria-label={tr("Units")}
              >
                {(["cm", "in"] as UnitSystem[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={
                      unitSystem === unit ? "cp-btn" : "cp-btn cp-btn-ghost"
                    }
                    style={{ flex: 1 }}
                    aria-pressed={unitSystem === unit}
                    onClick={() => switchUnits(unit)}
                  >
                    {unit === "cm" ? tr("Centimetres") : tr("Inches")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="cp-label" htmlFor="sc-description">
              {tr(" Note shown under the chart (optional) ")}
            </label>
            <textarea
              id="sc-description"
              className="cp-input"
              name="description"
              rows={2}
              value={description}
              placeholder={tr(
                "e.g. Measurements are taken on the body, not the garment.",
              )}
              onChange={(e) => setDescription(e.currentTarget.value)}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>

        <div className="cp-card sc-editor-card sc-editor-measurements">
          <SectionHeading
            title={tr("Measurements")}
            icon="measurements"
            hint={tr(
              "The first column holds the size labels and is never unit-converted.",
            )}
          />
          <div className="sc-editor-table-scroll">
            <table
              className="sc-editor-table"
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "6px",
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: "28px" }} />
                  {columns.map((col, colIndex) => (
                    <th key={colIndex} style={{ minWidth: "120px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        <input
                          className="cp-head-cell"
                          value={col}
                          aria-label={tr("Column " + (colIndex + 1) + " name")}
                          onChange={(e) =>
                            setColumn(colIndex, e.currentTarget.value)
                          }
                        />
                        {columns.length > 1 ? (
                          <button
                            type="button"
                            className="cp-x"
                            title={tr("Remove column")}
                            onClick={() => removeColumn(colIndex)}
                          >
                            {tr(" &times; ")}
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
                          title={tr("Remove row")}
                          onClick={() => removeRow(rowIndex)}
                        >
                          {tr(" &times; ")}
                        </button>
                      ) : null}
                    </td>
                    {columns.map((_, colIndex) => (
                      <td key={colIndex}>
                        <input
                          className="cp-grid-cell"
                          value={row[colIndex] ?? ""}
                          aria-label={tr(
                            "Row " + (rowIndex + 1) + " " + columns[colIndex],
                          )}
                          onChange={(e) =>
                            setCell(rowIndex, colIndex, e.currentTarget.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sc-editor-grid-actions">
            <button
              type="button"
              className="cp-btn cp-btn-ghost"
              onClick={addRow}
            >
              {tr(" + Add row ")}
            </button>
            <button
              type="button"
              className="cp-btn cp-btn-ghost"
              onClick={addColumn}
            >
              {tr(" + Add column ")}
            </button>
          </div>
        </div>

        <div className="cp-card sc-editor-card sc-editor-assignment">
          <SectionHeading
            title={tr("Where it shows")}
            icon="layers"
            hint={tr(
              "Saved with the chart now; the storefront button gets wired up in the next phase.",
            )}
          />
          <div className="sc-editor-assignment-grid">
            <div>
              <label className="cp-label" htmlFor="sc-assign">
                {tr(" Applies to ")}
              </label>
              <select
                id="sc-assign"
                className="cp-input"
                name="assignType"
                value={assignType}
                onChange={(e) => setAssignType(e.currentTarget.value)}
              >
                <option value="all">{tr("All products")}</option>
                <option value="tags">{tr("Products with tags")}</option>
                <option value="collections">{tr("Collections")}</option>
                <option value="products">{tr("Specific products")}</option>
              </select>
            </div>
            <div>
              <span className="cp-label">
                {assignType === "all"
                  ? tr("Shows on every product")
                  : tr("Pick from your store")}
              </span>
              <input
                type="hidden"
                name="assignValue"
                value={selectedTargets.join(",")}
              />
              {assignType === "all" ? (
                <p style={{ fontSize: "13px", color: COLORS.muted, margin: 0 }}>
                  {tr(
                    " Nothing to choose — this chart applies to all products. ",
                  )}
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

        <div className="sc-editor-actions">
          <button
            type="submit"
            name="intent"
            value="save"
            className={saving ? "cp-btn" : "cp-btn"}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}
          >
            {!saving && <SizeChartIcon name="save" />}
            <SaveLabel saving={saving} saved={false} idleLabel="Save chart" />
          </button>
          <button
            type="submit"
            name="intent"
            value={status === "active" ? "save-draft" : "save-active"}
            className="cp-btn cp-btn-ghost"
            disabled={saving}
          >
            <SizeChartIcon name="play" />
            {status === "active"
              ? tr("Save as draft")
              : tr("Save and activate")}
          </button>
          <Link
            to={listHref}
            className="cp-btn cp-btn-ghost"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            <SizeChartIcon name="close" />
            {tr(" Cancel ")}
          </Link>
        </div>
      </Form>
    </div>
  );
}

const FLASH_MESSAGES: Record<
  string,
  { text: string; tone: "success" | "danger" }
> = {
  saved: { text: "Size chart saved", tone: "success" },
  deleted: { text: "Size chart deleted", tone: "danger" },
  duplicated: { text: "Size chart duplicated", tone: "success" },
  updated: { text: "Size chart updated", tone: "success" },
};

export default function SizeCharts() {
  const { tr, locale } = useTranslation();

  const { list, draft, templates, catalog } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deleteFetcher = useFetcher();

  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
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
        {
          intent: "delete",
          id,
          redirectTo: buildHref(searchParams, { id: null, new: null }),
        },
        {
          method: "post",
          action: buildHref(searchParams, { id: null, new: null }),
        },
      );
    }, 300);
  };

  if (draft) {
    return (
      <div className="size-charts-shell">
        <div className="size-charts-page">
          <ChartEditor
            draft={draft as ChartDraft}
            searchParams={searchParams}
            catalog={catalog}
            key={searchParams.toString()}
          />
        </div>
      </div>
    );
  }

  const activeCount = list.filter((c) => c.status === "active").length;
  const listHref = buildHref(searchParams, { id: null, new: null });

  return (
    <div className="size-charts-shell">
      <div className="size-charts-page">
        <header className="size-charts-header">
          <span className="size-charts-title-icon">
            <SizeChartIcon name="ruler" />
          </span>
          <div>
            <h1>{tr("Size Charts")}</h1>
            <p>
              {tr(
                " Build size guides from a template, then assign them to products. ",
              )}
            </p>
          </div>
          <span className="size-charts-count">
            <SizeChartIcon name="layers" />
            {tr(list.length === 1 ? "{0} chart" : "{0} charts", [
              list.length,
            ])}{" "}
            {tr(" &middot;")}
            {tr(" ")}
            {tr(activeCount)} {tr(" active ")}
          </span>
        </header>
        <SizeChartsHero />
        <section
          className="cp-card size-charts-templates"
          aria-labelledby="size-charts-template-title"
        >
          <div className="size-charts-section-heading">
            <SizeChartIcon name="layers" />
            <div>
              <h2 id="size-charts-template-title">
                {tr("Start from a template")}
              </h2>
              <p>{tr("Everything stays editable after you pick one.")}</p>
            </div>
          </div>
          <div className="size-charts-template-grid">
            {templates.map((tpl) => (
              <Link
                key={tpl.key}
                to={buildHref(searchParams, { id: null, new: tpl.key })}
                className="cp-tpl"
              >
                <span className="size-charts-template-icon">
                  <SizeChartIcon name={tpl.key} />
                </span>
                <span className="size-charts-template-copy">
                  <strong>{tr(tpl.label)}</strong>
                  <span>{tr("Use template &rarr;")}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="cp-card size-charts-list"
          aria-labelledby="size-charts-list-title"
        >
          <div className="size-charts-list-heading">
            <SizeChartIcon name="chart" />
            <h2 id="size-charts-list-title">{tr("Your size charts")}</h2>
          </div>

          {list.length === 0 ? (
            <div className="size-charts-empty">
              <SizeChartsEmptyArt />
              <h3>{tr("No size charts yet")}</h3>
              <p>{tr("Pick a template above to create your first one.")}</p>
            </div>
          ) : (
            <table className="cp-table">
              <thead>
                <tr>
                  <th>{tr("Name")}</th>
                  <th>{tr("Status")}</th>
                  <th>{tr("Size")}</th>
                  <th>{tr("Applies to")}</th>
                  <th>{tr("Updated")}</th>
                  <th style={{ textAlign: "right" }}>{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((chart) => (
                  <tr
                    key={chart.id}
                    className={
                      removingId === chart.id ? "ui-row-removing" : undefined
                    }
                  >
                    <td>
                      <Link
                        to={buildHref(searchParams, {
                          new: null,
                          id: chart.id,
                        })}
                        style={{
                          color: "#111",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        {chart.name}
                      </Link>
                      <p
                        style={{
                          fontSize: "11px",
                          color: COLORS.muted,
                          margin: "2px 0 0",
                        }}
                      >
                        {tr(chart.unitSystem)}
                      </p>
                    </td>
                    <td>
                      <span
                        className={
                          chart.status === "active"
                            ? "badge-active"
                            : "badge-draft"
                        }
                      >
                        {chart.status === "active" ? tr("Active") : tr("Draft")}
                      </span>
                    </td>
                    <td>
                      {tr(chart.rowCount)} {tr(" &times; ")}
                      {tr(chart.columnCount)}
                    </td>
                    <td>
                      {chart.assignType === "all"
                        ? tr("All products")
                        : tr(
                            chart.assignType +
                              ": " +
                              (chart.assignValue || "-"),
                          )}
                    </td>
                    <td>
                      {tr(new Date(chart.updatedAt).toLocaleDateString(locale))}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Form method="post" action={listHref}>
                          <input type="hidden" name="intent" value="toggle" />
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={listHref}
                          />
                          <input type="hidden" name="id" value={chart.id} />
                          <button type="submit" className="cp-btn cp-btn-ghost">
                            {chart.status === "active"
                              ? tr("Deactivate")
                              : tr("Activate")}
                          </button>
                        </Form>
                        <Form method="post" action={listHref}>
                          <input
                            type="hidden"
                            name="intent"
                            value="duplicate"
                          />
                          <input
                            type="hidden"
                            name="redirectTo"
                            value={listHref}
                          />
                          <input type="hidden" name="id" value={chart.id} />
                          <button type="submit" className="cp-btn cp-btn-ghost">
                            {tr(" Duplicate ")}
                          </button>
                        </Form>
                        <button
                          type="button"
                          className="cp-btn cp-btn-danger"
                          onClick={() =>
                            setPendingDelete({ id: chart.id, name: chart.name })
                          }
                        >
                          {tr(" Delete ")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: COLORS.muted,
            marginTop: "20px",
          }}
        >
          {tr(
            " Next phase: a theme app extension so the size guide button places itself on product pages. ",
          )}
        </p>

        <ConfirmDialog
          open={pendingDelete !== null}
          title={tr("Delete this size chart?")}
          message={
            pendingDelete
              ? tr(
                  '"{0}" will be removed permanently. Any product using it will stop showing a size guide. This cannot be undone.',
                  [pendingDelete.name],
                )
              : tr("")
          }
          confirmLabel={tr("Delete chart")}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />

        <Toast
          message={tr(flash?.text ?? null)}
          tone={flash?.tone ?? "success"}
          onDone={clearFlash}
        />
      </div>
    </div>
  );
}
