import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS, MESSAGE_STATUSES, STATUS_LABELS, type MessageDto } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import type { ListMessagesQuery } from "@/lib/validation";
import { CategoryBadge, StatusBadge } from "./badges";

export function MessageFilters({ query }: { query: ListMessagesQuery }) {
  const href = (patch: Partial<Pick<ListMessagesQuery, "category" | "status">>) => {
    const next = { category: query.category, status: query.status, ...patch };
    const params = new URLSearchParams();
    if (next.category) params.set("category", next.category);
    if (next.status) params.set("status", next.status);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div className="space-y-2">
      <FilterRow label="Kategorija">
        <Chip href={href({ category: undefined })} active={!query.category}>
          Vse
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} href={href({ category: c })} active={query.category === c}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </FilterRow>
      <FilterRow label="Status">
        <Chip href={href({ status: undefined })} active={!query.status}>
          Vsi
        </Chip>
        {MESSAGE_STATUSES.map((s) => (
          <Chip key={s} href={href({ status: s })} active={query.status === s}>
            {STATUS_LABELS[s]}
          </Chip>
        ))}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition ${
        active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}

export function MessageList({ messages, filtered }: { messages: MessageDto[]; filtered: boolean }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        {filtered ? "Ni sporočil, ki bi ustrezala filtru." : "Še ni sporočil. Vnesi prvo sporočilo stranke na levi."}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {messages.map((m) => (
        <li key={m.id}>
          <Link href={`/messages/${m.id}`} className="block px-4 py-3 transition hover:bg-slate-50">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={m.category} />
              <StatusBadge status={m.status} />
              {m.threadId && <span className="text-xs text-slate-500">· nadaljevanje pogovora</span>}
              {m.reply?.edited && <span className="text-xs text-slate-500">· ročno urejeno</span>}
              <time dateTime={m.createdAt} className="ml-auto text-xs text-slate-400">
                {formatDateTime(m.createdAt)}
              </time>
            </div>
            <p className="mt-1.5 text-sm font-medium text-slate-800">
              {m.customerName ?? m.customerEmail ?? "Anonimna stranka"}
            </p>
            <p className="line-clamp-2 text-sm text-slate-600">{m.body}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Nalagam sporočila">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200/70" />
      ))}
    </div>
  );
}
