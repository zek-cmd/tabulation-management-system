// Single source of truth for gender values used across the tabulation system.
// The database enum (prisma `Sex`) must match GENDERS exactly.

export const GENDERS = ["MALE", "FEMALE", "MIX"] as const;

export type GenderValue = (typeof GENDERS)[number];

// Values shown in dropdowns when adding or editing a contestant
export const GENDER_OPTIONS: { value: GenderValue; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "MIX", label: "Mix" },
];

// Sort / render order everywhere (contestants without a gender come last)
export const GENDER_ORDER = ["MALE", "FEMALE", "MIX", "OTHER"] as const;

export type GenderKey = (typeof GENDER_ORDER)[number];

export const GENDER_GROUP_LABELS: Record<GenderKey, string> = {
  MALE: "Male Contestants",
  FEMALE: "Female Contestants",
  MIX: "Mix Contestants",
  OTHER: "Other Contestants",
};

// Group key for a contestant: a known gender, or OTHER for null/unknown values
export function genderKey(sex?: string | null): GenderKey {
  return (GENDERS as readonly string[]).includes(sex ?? "")
    ? (sex as GenderValue)
    : "OTHER";
}

// Numeric order for sorting (MALE, FEMALE, MIX, then the rest)
export function sexSortOrder(sex?: string | null): number {
  const index = GENDERS.indexOf(sex as GenderValue);
  return index === -1 ? GENDERS.length : index;
}

// Short tag used in front of a contestant number, e.g. "M-1", "F-2", "X-3"
export function sexTag(sex?: string | null): string {
  if (!sex) return "";
  return sex === "MIX" ? "X" : sex.charAt(0);
}

// Row tint used in score sheets so judges can tell the groups apart
export function sexRowClass(sex?: string | null): string {
  if (sex === "MALE") return "bg-blue-50 dark:bg-blue-950/20";
  if (sex === "FEMALE") return "bg-pink-50 dark:bg-pink-950/20";
  if (sex === "MIX") return "bg-violet-50 dark:bg-violet-950/20";
  return "";
}
