import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Ni najdeno</h1>
      <p className="mt-1 text-sm text-slate-500">Sporočilo ne obstaja ali je bilo odstranjeno.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
        Nazaj na zgodovino
      </Link>
    </div>
  );
}
