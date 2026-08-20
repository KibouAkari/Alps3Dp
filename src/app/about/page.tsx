import { LeafIcon, PackageIcon, PrinterIcon, ShieldIcon, TruckIcon, WrenchIcon } from "@/components/icons";

export default function AboutPage() {
  return (
    <div className="space-y-6 fade-in-up">
      {/* Hero */}
      <section className="hero-shell blueprint-bg overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-10">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Über uns</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Qualität aus dem 3D-Drucker – gefertigt in der Schweiz
        </h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Alps3Dp ist ein kleines Schweizer Projekt mit einer grossen Leidenschaft für präzisen 3D-Druck. Jedes Produkt wird auf Bestellung gefertigt – individuell, langlebig und mit Liebe zum Detail.
        </p>
        <div className="stagger-grid mt-6 flex flex-wrap gap-3">
          {[
            { icon: ShieldIcon, label: "Schweizer Qualität" },
            { icon: LeafIcon, label: "Ressourcenschonend" },
            { icon: WrenchIcon, label: "Individuell gefertigt" },
          ].map((badge) => (
            <div key={badge.label} className="hover-lift theme-pill flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-slate-700">
              <badge.icon className="h-4 w-4 text-violet-600" />
              {badge.label}
            </div>
          ))}
        </div>
      </section>

      {/* Mission + Material */}
      <div className="stagger-grid grid gap-6 md:grid-cols-2">
        <section className="panel-surface hover-lift rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Unsere Mission</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Wir glauben daran, dass gutes Design und nachhaltige Herstellung keine Gegensätze sind. Mit modernen FDM-Druckern und sorgfältig ausgewählten Materialien entstehen Produkte, die halten – nicht nur kurze Zeit, sondern langfristig.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Kein Massenimport, kein Lager voller Ware: Alles wird auf Anfrage gedruckt, was Ressourcen spart und individuelle Wünsche ermöglicht.
          </p>
        </section>

        <section className="panel-surface hover-lift rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Materialien & Qualität</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">PLA</span>
              <span>Biologisch abbaubar, farbintensiv und ideal für Dekorations- und Alltagsobjekte.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">PETG</span>
              <span>Robust, lebensmittelecht und temperaturbeständig – für den praktischen Einsatz.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <WrenchIcon className="h-4 w-4" />
              </span>
              <span>Nachbearbeitung: Schleifen, Grundieren und Lackieren auf Wunsch möglich.</span>
            </li>
          </ul>
        </section>
      </div>

      {/* Process */}
      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">So funktioniert es</h2>
        <div className="stagger-grid mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: PackageIcon, title: "Bestellen", desc: "Wähle dein Produkt aus dem Shop und gib deine Bestellung auf." },
            { icon: PrinterIcon, title: "Drucken", desc: "Wir fertigen dein Produkt frisch auf deiner Bestellung – kein Lager, kein Staub." },
            { icon: TruckIcon, title: "Liefern", desc: "Schneller Versand innerhalb der Schweiz, in der Regel 3–5 Werktage." },
          ].map((item) => (
            <div key={item.title} className="panel-soft hover-lift rounded-xl p-4">
              <span className="process-step-icon inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="panel-surface hover-lift rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Fragen oder individuelle Wünsche?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Wir sind offen für Sonderwünsche, Logoprints und individuelle Projekte.{" "}
          <a href="/contact" className="text-sky-700 hover:underline">Schreib uns</a> – wir melden uns schnell.
        </p>
      </section>
    </div>
  );
}

