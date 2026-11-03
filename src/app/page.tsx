import { Suspense } from "react";
import { MessageFilters, MessageList } from "@/components/message-list";
import { NewMessageForm } from "@/components/new-message-form";
import { PageLoader } from "@/components/page-loader";
import { cardClass } from "@/components/ui";
import { listMessagesQuerySchema } from "@/lib/validation";
import { getContainer } from "@/server/container";

export default function InboxPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
      <section className={`${cardClass} lg:sticky lg:top-6`}>
        <h1 className="text-lg font-semibold">Novo sporočilo</h1>
        <p className="mb-4 text-sm text-slate-500">AI ga razvrsti in pripravi predlog odgovora.</p>
        <NewMessageForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Zgodovina sporočil</h2>
        {/* searchParams + DB are request-time data: stream them behind a Suspense boundary. */}
        <Suspense fallback={<PageLoader />}>
          <FilteredMessages searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function FilteredMessages({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const query = listMessagesQuerySchema.parse({ category: first(raw.category), status: first(raw.status) });
  const messages = await getContainer().messageService.list(query);

  return (
    <>
      <MessageFilters query={query} />
      <MessageList messages={messages} filtered={Boolean(query.category || query.status)} />
    </>
  );
}
