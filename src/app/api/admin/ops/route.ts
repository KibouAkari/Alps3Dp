import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminFromRequest } from "@/lib/admin-auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { sendOrderEmails } from "@/lib/mail";
import { getStripe, getStripeConfigurationError } from "@/lib/payments";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Admin-only utility actions for staging/QA: simulate an order to test the
// email pipeline, or reset dashboard demo data. Destructive actions require
// an explicit confirmation string in addition to admin auth.
const schema = z.object({
  action: z.enum(["simulate-order-and-email", "simulate-stripe-checkout", "reset-dashboard-data"]),
  email: z.string().email().optional(),
  confirmation: z.string().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    namespace: "admin-ops",
    identifier: `${admin.id}:${getClientIp(request)}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Admin-Operationen. Bitte kurz warten." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingaben." }, { status: 400 });
  }

  if (parsed.data.action === "simulate-order-and-email") {
    const sampleProduct = await db.product.findFirst({
      where: { isHidden: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!sampleProduct) {
      return NextResponse.json({ error: "Keine Produkte für Testbestellung vorhanden." }, { status: 400 });
    }

    const quantity = 1;
    const unitCents = sampleProduct.salePriceCents ?? sampleProduct.priceCents;
    const subtotalCents = unitCents * quantity;

    const order = await db.order.create({
      data: {
        userId: admin.id,
        status: "PAID",
        subtotalCents,
        shippingCents: 0,
        totalCents: subtotalCents,
        paymentProvider: "manual-test",
        paymentMethod: "INVOICE",
        paymentReference: `test-${Date.now()}`,
        customerEmail: parsed.data.email || admin.email,
        customerName: admin.name,
        shippingAddress1: "Teststrasse 1",
        shippingAddress2: null,
        shippingZip: "8000",
        shippingCity: "Zürich",
        shippingCountry: "CH",
        paidAt: new Date(),
        items: {
          create: {
            productId: sampleProduct.id,
            quantity,
            unitCents,
          },
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    await sendOrderEmails({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      lines: order.items.map((item: { quantity: number; unitCents: number; product: { title: string } }) => ({
        title: item.product.title,
        quantity: item.quantity,
        unitCents: item.unitCents,
      })),
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: "Testbestellung erstellt und E-Mail-Flow ausgelöst.",
    });
  }

  if (parsed.data.action === "simulate-stripe-checkout") {
    // Unlike simulate-order-and-email (which only exercises the DB + mail
    // path), this creates a *real* Stripe test-mode Checkout Session so the
    // admin can complete a test payment and confirm the webhook actually
    // marks the order PAID and sends the emails end-to-end.
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: `Stripe ist nicht korrekt konfiguriert: ${getStripeConfigurationError()}` },
        { status: 503 },
      );
    }

    const sampleProduct = await db.product.findFirst({
      where: { isHidden: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!sampleProduct) {
      return NextResponse.json({ error: "Keine Produkte für Testbestellung vorhanden." }, { status: 400 });
    }

    const quantity = 1;
    const unitCents = sampleProduct.salePriceCents ?? sampleProduct.priceCents;

    const order = await db.order.create({
      data: {
        userId: admin.id,
        status: "PENDING",
        subtotalCents: unitCents,
        shippingCents: 0,
        totalCents: unitCents,
        paymentProvider: "stripe",
        paymentMethod: "CARD",
        customerEmail: parsed.data.email || admin.email,
        customerName: admin.name,
        shippingAddress1: "Teststrasse 1",
        shippingAddress2: null,
        shippingZip: "8000",
        shippingCity: "Zürich",
        shippingCountry: "CH",
        items: { create: { productId: sampleProduct.id, quantity, unitCents } },
      },
    });

    const appUrl = getAppBaseUrl(request);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "chf",
        payment_method_types: ["card"],
        customer_email: order.customerEmail,
        client_reference_id: order.id,
        metadata: { orderId: order.id, userId: admin.id, source: "admin-stripe-test" },
        success_url: `${appUrl}/success?order=${order.id}`,
        cancel_url: `${appUrl}/failed?order=${order.id}`,
        line_items: [
          {
            quantity,
            price_data: {
              currency: "chf",
              unit_amount: unitCents,
              product_data: { name: `[TEST] ${sampleProduct.title}` },
            },
          },
        ],
      });

      await db.order.update({ where: { id: order.id }, data: { paymentReference: session.id } });

      return NextResponse.json({
        success: true,
        orderId: order.id,
        checkoutUrl: session.url,
        message: "Stripe-Testsession erstellt. Öffne den Link und schliesse die Zahlung mit einer Stripe-Testkarte ab, um den Webhook zu prüfen.",
      });
    } catch (error) {
      console.error("[admin:ops:stripe-test]", error);
      const stripeMessage = error instanceof Error ? error.message : "Unbekannter Stripe-Fehler";
      return NextResponse.json({ error: `Stripe-Testsession fehlgeschlagen: ${stripeMessage}` }, { status: 502 });
    }
  }

  if (parsed.data.action === "reset-dashboard-data") {
    if (parsed.data.confirmation !== "RESET") {
      return NextResponse.json(
        {
          error: "Diese Aktion ist destruktiv. Bitte Bestätigung 'RESET' mitsenden.",
        },
        { status: 400 },
      );
    }

    const [deletedOrders, deletedCartItems, resetClicks] = await db.$transaction([
      db.order.deleteMany({}),
      db.cartItem.deleteMany({}),
      db.product.updateMany({ data: { clicks: 0 } }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Dashboard-Testdaten wurden zurückgesetzt.",
      deletedOrders: deletedOrders.count,
      deletedCartItems: deletedCartItems.count,
      resetProductClicks: resetClicks.count,
    });
  }

  return NextResponse.json({ error: "Aktion nicht unterstützt." }, { status: 400 });
}
