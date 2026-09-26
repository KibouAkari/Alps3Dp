import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getStripe } from "@/lib/payments";

const cancelSchema = z.object({ orderId: z.string().min(1) });

// Expire the specific open Checkout Session after Stripe returns to cancel_url.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Bestellnummer." }, { status: 400 });
  }

  const order = await db.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true, status: true, paymentProvider: true, paymentReference: true },
  });
  if (!order || order.status !== "PENDING" || !["stripe", "stripe-test"].includes(order.paymentProvider) || !order.paymentReference) {
    return NextResponse.json({ received: true });
  }

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ received: true });

  try {
    let session = await stripe.checkout.sessions.retrieve(order.paymentReference);
    const sessionOrderId = session.metadata?.orderId || session.client_reference_id;
    if (sessionOrderId !== order.id) {
      return NextResponse.json({ error: "Checkout-Session stimmt nicht mit der Bestellung überein." }, { status: 409 });
    }

    if (session.status === "open") {
      session = await stripe.checkout.sessions.expire(session.id);
    }

    if (session.status === "expired") {
      await db.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    return NextResponse.json({ received: true, sessionStatus: session.status });
  } catch (error) {
    console.error("[checkout:cancel] Could not expire Stripe Checkout Session", error);
    return NextResponse.json({ received: true });
  }
}
