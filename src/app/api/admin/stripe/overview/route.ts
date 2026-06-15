import { NextResponse } from "next/server";

import { requireAdminFromRequest } from "@/lib/admin-auth";
import { getStripe } from "@/lib/payments";

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({
      configured: false,
      dashboardUrl: "https://dashboard.stripe.com",
      message: "Stripe ist noch nicht konfiguriert (STRIPE_SECRET_KEY fehlt).",
    });
  }

  const sessions = await stripe.checkout.sessions.list({ limit: 10 });
  const paymentIntents = await stripe.paymentIntents.list({ limit: 10 });

  return NextResponse.json({
    configured: true,
    dashboardUrl: process.env.STRIPE_DASHBOARD_URL || "https://dashboard.stripe.com",
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
}
