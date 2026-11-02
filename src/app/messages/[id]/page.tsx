import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge } from "@/components/badges";
import { ReplyPanel } from "@/components/reply-panel";
import { formatDateTime } from "@/lib/format";
import { idSchema } from "@/lib/validation";
import { getContainer } from "@/server/container";
import { NotFoundError } from "@/server/errors";

export default function MessagePage({ params }: PageProps<"/messages/[id]">) {
  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← Nazaj na zgodovino
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-slate-200/70" />}>
        <MessageDetail params={params} />
      </Suspense>
    </div>
  );
}

async function MessageDetail({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const message = await getContainer()
    .messageService.get(id)
    .catch((err: unknown) => {
      if (err instanceof NotFoundError) notFound();
      throw err;
    });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Sporočilo stranke</h1>
          <StatusBadge status={message.status} />
        </div>
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Stranka</dt>
          <dd>{message.customerName ?? "—"}</dd>
          <dt className="text-slate-500">E-pošta</dt>
          <dd className="break-all">{message.customerEmail ?? "—"}</dd>
          <dt className="text-slate-500">Prejeto</dt>
          <dd>
            <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
          </dd>
        </dl>
        {/* Rendered as text (React escapes it) — customer content is never injected as HTML. */}
        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-relaxed ring-1 ring-slate-200">
          {message.body}
        </p>
      </section>

      <ReplyPanel key={`${message.status}:${message.updatedAt}:${message.reply?.updatedAt ?? ""}`} message={message} />
    </div>
  );
}
