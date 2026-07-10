# Alp3D Shop

Alp3D Shop ist ein professioneller E-Commerce-Prototyp fuer 3D-gedruckte Produkte auf Basis von Next.js (App Router), TypeScript, Prisma und Stripe.

Der Fokus des Projekts liegt auf einer klaren Architektur, nachvollziehbaren API-Flows und einer soliden Basis fuer einen produktionsnahen Betrieb.

## Highlights

- Next.js 15 mit App Router und Server-first Architektur
- TypeScript im gesamten Stack
- Prisma als Datenzugriffsschicht
- Stripe-Integration inklusive Webhook-Verarbeitung
- Auth-, Account-, Cart- und Checkout-Flows
- Admin-Bereich fuer Produkt- und Betriebsfunktionen
- Grundlegende Security-Massnahmen (Headers, Rate Limits, Input Validation)

## Tech Stack

- Runtime: Next.js, React
- Sprache: TypeScript
- Datenbank: Prisma + Postgres
- Payments: Stripe
- Mail: Resend oder SMTP
- Deployment: Vercel

## Projektstruktur

- `src/app`: Pages und API Routes
- `src/components`: UI-Komponenten
- `src/lib`: Business-Logik, Integrationen, Utilities
- `prisma`: Schema und Seed
- `public`: Statische Assets

## Schnellstart

1. Abhaengigkeiten installieren

```bash
npm install
```

2. Env-Datei anlegen

```bash
cp .env.example .env.local
```

3. Lokale Datenbank vorbereiten

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

4. Entwicklungsserver starten

```bash
npm run dev
```

App starten unter http://localhost:3000.

## Wichtige Umgebungsvariablen

Pflicht fuer lokalen Betrieb:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`

Pflicht fuer Stripe-Zahlungen:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Stripe Setup

1. Im Stripe Dashboard API Keys erstellen.
2. Werte in `.env.local` eintragen.
3. Webhook-Endpunkt konfigurieren:

```text
https://<deine-domain>/api/webhooks/payment
```

4. In Entwicklung mit Test-Keys arbeiten.

## Sicherheit

- Keine Secrets ins Repository committen
- Produktive Keys nur in Vercel/CI Secret Stores halten
- Webhook Signaturen immer validieren
- Admin-Routen strikt autorisieren
- Rate Limits fuer sensible Endpunkte aktiv halten

Details: siehe `SECURITY.md`.

## NPM Scripts

- `npm run dev`: Development Server
- `npm run build`: Produktionsbuild
- `npm run start`: Produktionsstart
- `npm run typecheck`: TypeScript-Pruefung
- `npm run db:generate`: Prisma Client generieren
- `npm run db:migrate`: Migration ausfuehren
- `npm run db:seed`: Seed ausfuehren

## Deployment

Empfohlenes Ziel ist Vercel.

- Build Command: `npm run build`
- Alle Produktions-Secrets als Environment Variables setzen
- Nach Datenbankaenderungen Migrationen kontrolliert ausfuehren

## Repository Standards

- Beitragsregeln: `CONTRIBUTING.md`
- Sicherheitsmeldungen: `SECURITY.md`
- Lizenz: `LICENSE`

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz veroeffentlicht. Details in `LICENSE`.
