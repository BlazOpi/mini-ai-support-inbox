import { Spinner } from "./ai-status";

/**
 * Suspense fallback for a page's data. The page's static parts (header, form) arrive first, so this
 * covers the whole screen to show only a spinner until the data is in. React then replaces it, so
 * no script has to hide it, and an error page replaces it the same way.
 */
export function PageLoader() {
  return (
    <div role="status" aria-label="Nalagam" className="fixed inset-0 z-50 grid place-items-center bg-slate-50">
      <Spinner className="size-10 text-indigo-600" />
    </div>
  );
}
