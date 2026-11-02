import { CATEGORY_LABELS, STATUS_LABELS, type Category, type MessageStatus } from "@/lib/domain";

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const CATEGORY_STYLES: Record<Category, string> = {
  question: "bg-sky-50 text-sky-700 ring-sky-200",
  complaint: "bg-rose-50 text-rose-700 ring-rose-200",
  praise: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  other: "bg-slate-100 text-slate-700 ring-slate-200",
};

const STATUS_STYLES: Record<MessageStatus, string> = {
  processing: "bg-amber-50 text-amber-700 ring-amber-200",
  draft_ready: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  approved: "bg-emerald-600 text-white ring-emerald-600",
  failed: "bg-rose-600 text-white ring-rose-600",
};

export function CategoryBadge({ category }: { category: Category | null }) {
  if (!category) return <span className={`${base} bg-white text-slate-400 ring-slate-200`}>Neklasificirano</span>;
  return <span className={`${base} ${CATEGORY_STYLES[category]}`}>{CATEGORY_LABELS[category]}</span>;
}

export function StatusBadge({ status }: { status: MessageStatus }) {
  return <span className={`${base} ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
