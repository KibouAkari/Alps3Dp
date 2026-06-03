import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
      <h1 className="text-2xl font-bold text-slate-100">Seite nicht gefunden</h1>
      <p className="mt-2 text-slate-400">Die angeforderte Ressource existiert nicht.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
        Zur Startseite
      </Link>
    </div>
  );
}
