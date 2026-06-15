"use client";

export default function ContactPage() {
  return (
    <div className="space-y-6 fade-in-up">
      <section className="hero-shell overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-10">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Kontakt</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Wir freuen uns von dir zu hören</h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Bei Fragen zu Bestellungen, individuellen Anfragen oder allgemeinen Themen – schreib uns einfach.
        </p>
      </section>

      <div className="stagger-grid grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Contact Form */}
        <section className="panel-surface rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Nachricht senden</h2>
          <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-600">
                <span className="mb-1 block font-medium">Vorname</span>
                <input
                  type="text"
                  placeholder="Max"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
                />
              </label>
              <label className="block text-sm text-slate-600">
                <span className="mb-1 block font-medium">Nachname</span>
                <input
                  type="text"
                  placeholder="Muster"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block font-medium">E-Mail</span>
              <input
                type="email"
                placeholder="max@beispiel.ch"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
              />
            </label>
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block font-medium">Betreff</span>
              <input
                type="text"
                placeholder="Bestellung / Anfrage / Sonstiges"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
              />
            </label>
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block font-medium">Nachricht</span>
              <textarea
                rows={5}
                placeholder="Deine Nachricht…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Nachricht senden
            </button>
          </form>
        </section>

        {/* Contact Info */}
        <aside className="space-y-4">
          <section className="panel-surface rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Kontaktdaten</h2>
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              <li>
                <span className="block text-xs text-slate-400">E-Mail</span>
                <a href="mailto:support@alps3dp.ch" className="text-sky-700 hover:underline">support@alps3dp.ch</a>
              </li>
              <li>
                <span className="block text-xs text-slate-400">Antwortzeit</span>
                Werktags innerhalb von 24 Stunden
              </li>
              <li>
                <span className="block text-xs text-slate-400">Standort</span>
                Schweiz
              </li>
            </ul>
          </section>

          <section className="panel-surface rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Häufige Fragen</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="border-b border-slate-100 pb-2">
                <p className="font-medium text-slate-800">Wie lange dauert der Versand?</p>
                <p className="mt-0.5">In der Regel 3–5 Werktage ab Bestelldatum.</p>
              </li>
              <li className="border-b border-slate-100 pb-2">
                <p className="font-medium text-slate-800">Sind individuelle Bestellungen möglich?</p>
                <p className="mt-0.5">Ja, schreib uns einfach über das Formular.</p>
              </li>
              <li>
                <p className="font-medium text-slate-800">Welche Materialien werden verwendet?</p>
                <p className="mt-0.5">PLA und PETG – umweltfreundlich und langlebig.</p>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
