export interface SizeChartTemplate {
  key: string;
  label: string;
  description: string;
  unitSystem: "cm" | "in";
  columns: string[];
  rows: string[][];
}

export const SIZE_CHART_TEMPLATES: SizeChartTemplate[] = [
  {
    key: "women-tops",
    label: "Women — Tops & Dresses",
    description: "Measurements are taken on the body, not the garment.",
    unitSystem: "cm",
    columns: ["Size", "Bust", "Waist", "Hips"],
    rows: [
      ["XS", "80", "62", "88"],
      ["S", "84", "66", "92"],
      ["M", "88", "70", "96"],
      ["L", "94", "76", "102"],
      ["XL", "100", "82", "108"],
      ["XXL", "106", "88", "114"],
    ],
  },
  {
    key: "men-tops",
    label: "Men — Tops & Shirts",
    description: "Measurements are taken on the body, not the garment.",
    unitSystem: "cm",
    columns: ["Size", "Chest", "Waist", "Neck", "Sleeve"],
    rows: [
      ["S", "88", "76", "37", "60"],
      ["M", "96", "84", "39", "62"],
      ["L", "104", "92", "41", "64"],
      ["XL", "112", "100", "43", "66"],
      ["XXL", "120", "108", "45", "68"],
    ],
  },
  {
    key: "kids",
    label: "Kids — Age & Height",
    description: "Pick the size that matches your child's height.",
    unitSystem: "cm",
    columns: ["Size", "Age", "Height", "Chest", "Waist"],
    rows: [
      ["2T", "1-2 yrs", "86-92", "53", "51"],
      ["3T", "2-3 yrs", "92-98", "55", "52"],
      ["4", "3-4 yrs", "98-104", "57", "53"],
      ["5", "4-5 yrs", "104-110", "59", "54"],
      ["6", "5-6 yrs", "110-116", "61", "55"],
    ],
  },
  {
    key: "shoes-unisex",
    label: "Shoes — Unisex",
    description: "Measure your foot from heel to longest toe.",
    unitSystem: "cm",
    columns: ["EU", "UK", "US", "Foot length"],
    rows: [
      ["38", "5", "6", "24.0"],
      ["39", "6", "7", "24.7"],
      ["40", "6.5", "7.5", "25.3"],
      ["41", "7.5", "8.5", "26.0"],
      ["42", "8", "9", "26.7"],
      ["43", "9", "10", "27.3"],
      ["44", "9.5", "10.5", "28.0"],
    ],
  },
  {
    key: "lingerie",
    label: "Lingerie & Bras",
    description: "Band size is measured directly under the bust.",
    unitSystem: "cm",
    columns: ["Size", "Underbust", "Bust", "Cup"],
    rows: [
      ["32A", "68-72", "80-82", "A"],
      ["32B", "68-72", "82-84", "B"],
      ["34B", "73-77", "86-88", "B"],
      ["34C", "73-77", "88-90", "C"],
      ["36C", "78-82", "92-94", "C"],
      ["36D", "78-82", "94-96", "D"],
    ],
  },
  {
    key: "pets",
    label: "Pets — Collars & Apparel",
    description: "Measure around the neck and the widest part of the chest.",
    unitSystem: "cm",
    columns: ["Size", "Neck", "Chest", "Back length", "Weight"],
    rows: [
      ["XS", "20-25", "30-36", "20", "1-3 kg"],
      ["S", "25-30", "36-43", "26", "3-6 kg"],
      ["M", "30-36", "43-51", "33", "6-11 kg"],
      ["L", "36-43", "51-61", "41", "11-18 kg"],
      ["XL", "43-51", "61-71", "48", "18-27 kg"],
    ],
  },
  {
    key: "custom",
    label: "Blank chart",
    description: "",
    unitSystem: "cm",
    columns: ["Size", "Chest", "Waist"],
    rows: [
      ["S", "", ""],
      ["M", "", ""],
      ["L", "", ""],
    ],
  },
];

export function getTemplate(key: string): SizeChartTemplate {
  return (
    SIZE_CHART_TEMPLATES.find((tpl) => tpl.key === key) ||
    SIZE_CHART_TEMPLATES[SIZE_CHART_TEMPLATES.length - 1]
  );
}

const CM_PER_INCH = 2.54;

/** Converts every numeric token in a cell, keeping ranges and units intact. */
export function convertCell(value: string, from: "cm" | "in", to: "cm" | "in"): string {
  if (from === to) return value;
  const factor = from === "cm" ? 1 / CM_PER_INCH : CM_PER_INCH;
  return value.replace(/\d+(\.\d+)?/g, (match) => {
    const converted = parseFloat(match) * factor;
    return (Math.round(converted * 10) / 10).toString();
  });
}
