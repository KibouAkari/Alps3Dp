import { NextResponse } from "next/server";
import Stripe from "stripe";

import { db } from "@/lib/db";
import { sendOrderEmails } from "@/lib/mail";
import { getStripe } from "@/lib/payments";

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
