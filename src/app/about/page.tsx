export default function AboutPage() {
  return (
    <div className="space-y-6 fade-in-up">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-sky-50 to-white p-6 shadow-sm sm:p-10">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Über uns</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Qualität aus dem 3D-Drucker – gefertigt in der Schweiz
        </h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Alps3Dp ist ein kleines Schweizer Projekt mit einer grossen Leidenschaft für präzisen 3D-Druck. Jedes Produkt wird auf Bestellung gefertigt – individuell, langlebig und mit Liebe zum Detail.
        </p>
      </section>

      {/* Mission + Material */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Unsere Mission</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Wir glauben daran, dass gutes Design und nachhaltige Herstellung keine Gegensätze sind. Mit modernen FDM-Druckern und sorgfältig ausgewählten Materialien entstehen Produkte, die halten – nicht nur kurze Zeit, sondern langfristig.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Kein Massenimport, kein Lager voller Ware: Alles wird auf Anfrage gedruckt, was Ressourcen spart und individuelle Wünsche ermöglicht.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Materialien & Qualität</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 font-semibold text-sky-700">PLA</span>
              <span>Biologisch abbaubar, farbintensiv und ideal für Dekorations- und Alltagsobjekte.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 font-semibold text-sky-700">PETG</span>
              <span>Robust, lebensmittelecht und temperaturbeständig – für den praktischen Einsatz.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 font-semibold text-sky-700">Nachbearbeitung</span>
              <span>Schleifen, Grundieren und Lackieren auf Wunsch möglich.</span>
            </li>
          </ul>
        </section>
      </div>

      {/* Process */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">So funktioniert es</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Bestellen", desc: "Wähle dein Produkt aus dem Shop und gib deine Bestellung auf." },
            { step: "2", title: "Drucken", desc: "Wir fertigen dein Produkt frisch auf deiner Bestellung – kein Lager, kein Staub." },
            { step: "3", title: "Liefern", desc: "Schneller Versand innerhalb der Schweiz, in der Regel 3–5 Werktage." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                {item.step}
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Fragen oder individuelle Wünsche?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Wir sind offen für Sonderwünsche, Logoprints und individuelle Projekte.{" "}
          <a href="/contact" className="text-sky-700 hover:underline">Schreib uns</a> – wir melden uns schnell.
        </p>
      </section>
    </div>
  );
}

