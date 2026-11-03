/** The app's shared look in one place, so cards, titles, buttons and text fields stay the same everywhere. */
export const cardClass = "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";

export const sectionTitleClass = "text-sm font-semibold uppercase tracking-wide text-slate-500";

export const buttonClass =
  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

export const textareaClass =
  "w-full resize-y rounded-md border border-slate-300 p-3 text-sm leading-relaxed shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

export function ErrorMessage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={`rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200 ${className}`}
    >
      {children}
    </p>
  );
}
