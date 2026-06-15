import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { sendOrderEmails } from "@/lib/mail";
import { getStripe } from "@/lib/payments";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";
import { getShippingCents } from "@/lib/site-settings";

const checkoutSchema = z.object({
  // Address: either use saved address or provide new one
  addressId: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  address1: z.string().min(4).optional(),
  address2: z.string().optional(),
  zip: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  country: z.string().min(2).max(2).default("CH").optional(),
  email: z.string().email(),
  paymentMethod: z.enum(["INVOICE", "CARD", "TWINT"]),
  savedPaymentMethodId: z.string().optional(),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromToken(getCookieToken(request));
  if (!sessionUser) {
    return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte alle Pflichtfelder korrekt ausfuellen." }, { status: 400 });
  }

  // Resolve address
  let addressData = { firstName: "", lastName: "", address1: "", address2: "", zip: "", city: "", country: "CH" };
  
  if (parsed.data.addressId) {
    // Use saved address
    const saved = await db.userAddress.findUnique({
      where: { id: parsed.data.addressId },
    });
    if (!saved || saved.userId !== sessionUser.id) {
      return NextResponse.json({ error: "Adresse nicht gefunden." }, { status: 404 });
    }
    addressData = {
      firstName: saved.firstName,
      lastName: saved.lastName,
      address1: saved.street,
      address2: "",
      zip: saved.zipCode,
      city: saved.city,
      country: saved.country,
    };
  } else {
    // Use provided address
    if (!parsed.data.firstName || !parsed.data.lastName || !parsed.data.address1 || !parsed.data.zip || !parsed.data.city) {
      return NextResponse.json({ error: "Adresse erforderlich." }, { status: 400 });
    }
    addressData = {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      address1: parsed.data.address1,
      address2: parsed.data.address2 || "",
      zip: parsed.data.zip,
      city: parsed.data.city,
      country: parsed.data.country || "CH",
    };
  }

  const cart = await db.cart.findUnique({
    where: { userId: sessionUser.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Warenkorb ist leer." }, { status: 400 });
  }

  const subtotalCents = cart.items.reduce((sum: number, item: { product: { salePriceCents: number | null; priceCents: number }; quantity: number }) => {
    const unit = item.product.salePriceCents ?? item.product.priceCents;
    return sum + unit * item.quantity;
  }, 0);
  const shippingCents = await getShippingCents();
  const totalCents = subtotalCents + shippingCents;

  if (parsed.data.savedPaymentMethodId) {
    const savedMethod = await db.savedPaymentMethod.findUnique({
      where: { id: parsed.data.savedPaymentMethodId },
      select: { id: true, userId: true },
    });
    if (!savedMethod || savedMethod.userId !== sessionUser.id) {
      return NextResponse.json({ error: "Zahlungsart nicht gefunden." }, { status: 404 });
    }
  }

  const order = await db.order.create({
    data: {
      userId: sessionUser.id,
      status: "PENDING",
      subtotalCents,
      shippingCents,
      totalCents,
      paymentProvider: parsed.data.paymentMethod === "INVOICE" ? "manual" : "stripe",
      paymentMethod: parsed.data.paymentMethod,
      savedPaymentMethodId: parsed.data.savedPaymentMethodId || null,
      customerEmail: parsed.data.email,
      customerName: `${addressData.firstName} ${addressData.lastName}`,
      shippingAddress1: addressData.address1,
      shippingAddress2: addressData.address2 || null,
      shippingZip: addressData.zip,
      shippingCity: addressData.city,
      shippingCountry: addressData.country,
      items: {
        create: cart.items.map((item: { productId: string; quantity: number; product: { salePriceCents: number | null; priceCents: number } }) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCents: item.product.salePriceCents ?? item.product.priceCents,
        })),
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

  const stripe = getStripe();
  const appUrl = getAppBaseUrl();

  if (parsed.data.paymentMethod === "INVOICE") {
    await db.$transaction([
      db.order.update({
        where: { id: order.id },
        data: { paymentReference: `invoice-${order.id}` },
      }),
      db.cartItem.deleteMany({ where: { cartId: cart.id } }),
    ]);

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

    return NextResponse.json({
      success: true,
      orderId: order.id,
      mode: "invoice",
      message: "Bestellung erfasst. Du erhaeltst die Zahlungsinfos per E-Mail.",
    });
  }

  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Karten/TWINT sind aktuell nicht verfuegbar. Bitte 'Rechnung / Vorkasse' waehlen.",
      },
      { status: 400 }
    );
  }

  const paymentMethodTypes: Array<"card" | "twint"> = parsed.data.paymentMethod === "TWINT" ? ["twint"] : ["card"];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "chf",
      payment_method_types: paymentMethodTypes,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        userId: sessionUser.id,
      },
      success_url: `${appUrl}/checkout?success=1&order=${order.id}`,
      cancel_url: `${appUrl}/checkout?canceled=1`,
      line_items: [
        ...order.items.map((item: { quantity: number; unitCents: number; product: { title: string } }) => ({
          quantity: item.quantity,
          price_data: {
            currency: "chf",
            unit_amount: item.unitCents,
            product_data: {
              name: item.product.title,
            },
          },
        })),
        ...(shippingCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "chf",
                  unit_amount: shippingCents,
                  product_data: { name: "Lieferkosten" },
                },
              },
            ]
          : []),
      ],
    });

    await db.order.update({ where: { id: order.id }, data: { paymentReference: session.id } });

    return NextResponse.json({ checkoutUrl: session.url, orderId: order.id });
  } catch (error) {
    console.error("[checkout:stripe]", error);
    return NextResponse.json(
      {
        error:
          "Zahlung konnte nicht gestartet werden. Bitte Stripe-Schluessel in Vercel pruefen.",
      },
      { status: 502 }
    );
  }
}
