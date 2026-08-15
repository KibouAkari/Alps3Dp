import { NextResponse } from "next/server";

import { requireAdminFromRequest } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/payments";

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const stripe = getStripe();
  const publishableKeyConfigured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const webhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  const [pendingOrders, paidOrders, latestPaidOrder] = await Promise.all([
    db.order.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "PAID" } }),
    db.order.findFirst({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, select: { paidAt: true } }),
  ]);

  if (!stripe) {
    return NextResponse.json({
      configured: false,
      dashboardUrl: "https://dashboard.stripe.com",
      message: "Stripe ist noch nicht konfiguriert (STRIPE_SECRET_KEY fehlt).",
      publishableKeyConfigured,
      webhookSecretConfigured,
      paymentSummary: {
        pendingOrders,
        paidOrders,
        latestPaidAt: latestPaidOrder?.paidAt || null,
      },
    });
  }

  try {
    const [sessions, paymentIntents, account] = await Promise.all([
      stripe.checkout.sessions.list({ limit: 10 }),
      stripe.paymentIntents.list({ limit: 10 }),
      stripe.accounts.retrieve(),
    ]);

    return NextResponse.json({
      configured: true,
      dashboardUrl: process.env.STRIPE_DASHBOARD_URL || "https://dashboard.stripe.com",
      publishableKeyConfigured,
      webhookSecretConfigured,
      mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test",
      account: {
        id: account.id,
        country: account.country,
        defaultCurrency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
      paymentSummary: {
        pendingOrders,
        paidOrders,
        latestPaidAt: latestPaidOrder?.paidAt || null,
      },
      sessions: sessions.data.map((entry) => ({
        id: entry.id,
        created: entry.created,
        amountTotal: entry.amount_total,
        currency: entry.currency,
        paymentStatus: entry.payment_status,
        status: entry.status,
        customerEmail: entry.customer_details?.email || null,
      })),
      paymentIntents: paymentIntents.data.map((entry) => ({
        id: entry.id,
        created: entry.created,
        amount: entry.amount,
        currency: entry.currency,
        status: entry.status,
      })),
    });
  } catch (error) {
    console.error("[admin:stripe:overview]", error);
    return NextResponse.json({
      configured: true,
      dashboardUrl: process.env.STRIPE_DASHBOARD_URL || "https://dashboard.stripe.com",
      publishableKeyConfigured,
      webhookSecretConfigured,
      message: "Stripe ist konfiguriert, aber die Account-Daten konnten nicht geladen werden.",
      paymentSummary: {
        pendingOrders,
        paidOrders,
        latestPaidAt: latestPaidOrder?.paidAt || null,
      },
      sessions: [],
      paymentIntents: [],
    });
  }
}
