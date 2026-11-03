import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiLoadingOverlay } from "@/components/ai-status";
import { StatusBadge } from "@/components/badges";
import { CustomerReplyPanel } from "@/components/customer-reply-panel";
import { MessageHistory } from "@/components/message-history";
import { PageLoader } from "@/components/page-loader";
import { ReplyPanel } from "@/components/reply-panel";
import { cardClass } from "@/components/ui";
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
      <Suspense fallback={<PageLoader />}>
        <MessageDetail params={params} />
      </Suspense>
    </div>
  );
}

async function MessageDetail({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const thread = await getContainer()
    .messageService.getThread(id)
    .catch((err: unknown) => {
      if (err instanceof NotFoundError) notFound();
      throw err;
    });
  // The panels on the right always work on the latest message; earlier ones are read-only context.
  const message = thread[thread.length - 1];
  const history = await getContainer().messageService.getHistory(id);

  return (
    <div className="group/page grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        <section className={`relative ${cardClass}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{thread.length > 1 ? "Pogovor s stranko" : "Sporočilo stranke"}</h1>
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
          <ol aria-label="Pogovor" className="space-y-3">
            {thread.map((turn) => (
              <li key={turn.id} className="space-y-2">
                <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed ring-1 ring-slate-200">
                  {turn.body}
                </p>
                {/* A draft isn't part of the conversation until it's approved: the customer hasn't got it yet. */}
                {turn.status === "approved" && turn.reply && (
                  <p className="ml-6 whitespace-pre-wrap rounded-md bg-emerald-50/60 p-3 text-sm leading-relaxed ring-1 ring-emerald-200">
                    {turn.reply.body}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {/* Shown while a panel on the right has `data-chat-busy`: until the conversation's new data is in. */}
          <div className="hidden group-has-[[data-chat-busy]]/page:block">
            <AiLoadingOverlay label="Osvežujem pogovor…" />
          </div>
        </section>
        <MessageHistory events={history} />
      </div>

      <div className="space-y-5">
        <ReplyPanel
          key={`${message.id}:${message.status}:${message.updatedAt}:${message.reply?.updatedAt ?? ""}`}
          message={message}
        />
        <CustomerReplyPanel key={message.id} message={message} customerMessages={thread.map((m) => m.body)} />
      </div>
    </div>
  );
}
