import { NextResponse } from "next/server";
import Stripe from "stripe";

import { db } from "@/lib/db";
import { sendOrderEmails } from "@/lib/mail";
import { getStripe } from "@/lib/payments";

// Stripe's source of truth for payment outcomes. This is the only place an
// order is marked PAID — the checkout route only ever creates it as PENDING.
// Every code path re-derives trust from the verified Stripe event instead of
// trusting the client, and updates are idempotent so retried webhook
// deliveries can't apply side effects (like sending emails) twice.
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId || session.client_reference_id;

    if (orderId) {
      // Ignore events for sessions that haven't actually completed payment yet
      // (e.g. an async payment method still pending).
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true, ignored: "payment-not-paid" });
      }

      const existingOrder = await db.order.findUnique({
        where: { id: orderId },
        select: { id: true, totalCents: true, customerEmail: true },
      });

      if (!existingOrder) {
        return NextResponse.json({ received: true, ignored: "order-not-found" });
      }

      // Defense in depth: reject anything that doesn't match what we charged
      // for, in case a session were ever tampered with or replayed.
      if (session.currency !== "chf") {
        return NextResponse.json({ received: true, ignored: "currency-mismatch" });
      }

      if (typeof session.amount_total === "number" && session.amount_total !== existingOrder.totalCents) {
        return NextResponse.json({ received: true, ignored: "amount-mismatch" });
      }

      const checkoutEmail = session.customer_details?.email?.trim().toLowerCase();
      const expectedEmail = existingOrder.customerEmail.trim().toLowerCase();
      if (checkoutEmail && checkoutEmail !== expectedEmail) {
        return NextResponse.json({ received: true, ignored: "email-mismatch" });
      }

      // Conditioning the update on the current status makes this handler safe
      // to run more than once for the same event (Stripe retries webhooks).
      const updateResult = await db.order.updateMany({
        where: {
          id: orderId,
          status: {
            in: ["PENDING", "FAILED"],
          },
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentReference: session.id,
        },
      });

      if (updateResult.count === 0) {
        return NextResponse.json({ received: true, deduplicated: true });
      }

      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        return NextResponse.json({ received: true, deduplicated: true });
      }

      const cart = await db.cart.findUnique({ where: { userId: order.userId } });
      if (cart) {
        await db.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

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
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId || session.client_reference_id;

    if (orderId) {
      await db.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
