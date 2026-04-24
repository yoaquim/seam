export interface Person {
  id: string;
  name: string;
  role?: string;
  notes?: string;
  /** Auto-imported from Pocket speaker labels */
  source: "manual" | "pocket" | "inferred";
  createdAt: string;
}
