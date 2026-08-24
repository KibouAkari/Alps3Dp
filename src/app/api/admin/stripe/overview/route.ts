import { NextResponse } from "next/server";

import { requireAdminFromRequest } from "@/lib/admin-auth";
import { getAppBaseUrl, getConfiguredAppBaseUrl, getRequestBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/payments";

// Read-only dashboard summary for admins: whether Stripe is configured, plus
// a quick snapshot of recent orders. No secrets are ever included in the response.
export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const stripe = getStripe();
  const publishableKeyConfigured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const webhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  const configuredBaseUrl = getConfiguredAppBaseUrl();
  const requestBaseUrl = getRequestBaseUrl(request);
  const preferredWebhookUrl = `${getAppBaseUrl(request)}/api/webhooks/payment`;
  const configuredWebhookUrl = `${configuredBaseUrl}/api/webhooks/payment`;
  const requestHostWebhookUrl = requestBaseUrl ? `${requestBaseUrl}/api/webhooks/payment` : null;

  // Compare loosely (ignore protocol/www/trailing slash) so an
  // APP_URL/NEXT_PUBLIC_APP_URL that differs only by a "www." prefix doesn't
  // produce a false "not registered" result.
  const normalizeUrl = (value: string) => value.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
  const normalizePath = (value: string) => {
    try {
      return new URL(value).pathname.replace(/\/+$/, "");
    } catch {
      return value.replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "");
    }
  };

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
    const [sessions, paymentIntents, account, webhookEndpoints] = await Promise.all([
      stripe.checkout.sessions.list({ limit: 10 }),
      stripe.paymentIntents.list({ limit: 10 }),
      stripe.accounts.retrieve(),
      stripe.webhookEndpoints.list({ limit: 20 }),
    ]);

    const candidateUrls = [preferredWebhookUrl, configuredWebhookUrl, requestHostWebhookUrl].filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
    );
    const exactMatchingWebhook = webhookEndpoints.data.find((endpoint) =>
      candidateUrls.some((candidate) => normalizeUrl(endpoint.url) === normalizeUrl(candidate)),
    );
    const pathMatchingWebhook =
      exactMatchingWebhook ||
      webhookEndpoints.data.find((endpoint) => normalizePath(endpoint.url) === "/api/webhooks/payment");
    const requiredEvents = ["checkout.session.completed", "checkout.session.expired"];
    const webhookStatus = {
      expectedUrl: preferredWebhookUrl,
      configuredUrl: configuredWebhookUrl,
      requestHostUrl: requestHostWebhookUrl,
      appUrlMismatch: Boolean(
        requestHostWebhookUrl && normalizeUrl(requestHostWebhookUrl) !== normalizeUrl(configuredWebhookUrl),
      ),
      registeredUrls: webhookEndpoints.data.map((endpoint) => endpoint.url),
      registered: Boolean(pathMatchingWebhook),
      exactMatch: Boolean(exactMatchingWebhook),
      matchedUrl: pathMatchingWebhook?.url || null,
      domainMismatch: Boolean(pathMatchingWebhook && !exactMatchingWebhook),
      enabled: pathMatchingWebhook?.status === "enabled",
      missingEvents: pathMatchingWebhook
        ? requiredEvents.filter((event) => !pathMatchingWebhook.enabled_events.includes(event) && !pathMatchingWebhook.enabled_events.includes("*"))
        : requiredEvents,
      otherEndpointsCount: webhookEndpoints.data.filter(
        (endpoint) => !candidateUrls.some((candidate) => normalizeUrl(endpoint.url) === normalizeUrl(candidate)),
      ).length,
    };

    return NextResponse.json({
      configured: true,
      dashboardUrl: process.env.STRIPE_DASHBOARD_URL || "https://dashboard.stripe.com",
      publishableKeyConfigured,
      webhookSecretConfigured,
      webhookStatus,
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
