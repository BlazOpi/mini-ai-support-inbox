import { ACTOR_LABELS, CATEGORY_LABELS, EVENT_LABELS, type Category, type MessageEventDto } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { cardClass, sectionTitleClass } from "./ui";

/** The conversation's change log from `message_events`, oldest first. */
export function MessageHistory({ events }: { events: MessageEventDto[] }) {
  if (events.length === 0) return null;

  return (
    <section className={cardClass}>
      <h2 className={`mb-4 ${sectionTitleClass}`}>Zgodovina sprememb</h2>
      <ol className="space-y-4 border-l border-slate-200 pl-4">
        {events.map((event) => (
          <li key={event.id} className="relative text-sm">
            <span aria-hidden className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-indigo-400" />
            <p className="font-medium text-slate-800">{EVENT_LABELS[event.type]}</p>
            <p className="text-xs text-slate-500">
              {ACTOR_LABELS[event.actor]} · <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
            </p>
            <EventDetail event={event} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function EventDetail({ event }: { event: MessageEventDto }) {
  if (event.error) return <p className="mt-1 text-rose-700">{event.error}</p>;

  if (event.type === "category_changed") {
    return (
      <p className="mt-1 text-slate-600">
        {categoryLabel(event.oldValue)} → {categoryLabel(event.newValue)}
      </p>
    );
  }

  if (!event.oldValue && !event.newValue) return null;

  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Pokaži besedilo</summary>
      {event.oldValue && <EventText label="Prej" text={event.oldValue} />}
      {event.newValue && <EventText label={event.oldValue ? "Potem" : "Besedilo"} text={event.newValue} />}
    </details>
  );
}

function EventText({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-slate-600">{text}</p>
    </div>
  );
}

function categoryLabel(value: string | null): string {
  return value ? (CATEGORY_LABELS[value as Category] ?? value) : "—";
}
