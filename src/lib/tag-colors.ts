const TAG_COLORS = [
  {
    bg: "bg-blue-100 dark:bg-blue-950/40",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-900",
  },
  {
    bg: "bg-green-100 dark:bg-green-950/40",
    text: "text-green-800 dark:text-green-300",
    border: "border-green-200 dark:border-green-900",
  },
  {
    bg: "bg-purple-100 dark:bg-purple-950/40",
    text: "text-purple-800 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-900",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-900",
  },
  {
    bg: "bg-cyan-100 dark:bg-cyan-950/40",
    text: "text-cyan-800 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-900",
  },
  {
    bg: "bg-orange-100 dark:bg-orange-950/40",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-900",
  },
  {
    bg: "bg-indigo-100 dark:bg-indigo-950/40",
    text: "text-indigo-800 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-900",
  },
  {
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-900",
  },
  {
    bg: "bg-pink-100 dark:bg-pink-950/40",
    text: "text-pink-800 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-900",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-950/40",
    text: "text-teal-800 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-900",
  },
  {
    bg: "bg-yellow-100 dark:bg-yellow-950/40",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-900",
  },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getTagColor(tag: string) {
  return TAG_COLORS[hashString(tag.toLowerCase()) % TAG_COLORS.length];
}

export function tagClassName(tag: string): string {
  const c = getTagColor(tag);
  return `${c.bg} ${c.text} ${c.border} border`;
}
