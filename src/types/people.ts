export interface Person {
  id: string;
  name: string;
  role?: string;
  notes?: string;
  /** Alternate names that map to this person (e.g. "Joaquin" → "Yoaquim") */
  aliases?: string[];
  /** Auto-imported from Pocket speaker labels */
  source: "manual" | "pocket" | "inferred";
  createdAt: string;
}
