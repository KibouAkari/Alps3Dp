import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { getStripe, getStripeConfigurationError } from "@/lib/payments";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashPassword, createOpaqueToken } from "@/lib/security";
import { getSessionTokenFromRequest, getSessionUserFromToken } from "@/lib/session";
import { getShippingCents } from "@/lib/site-settings";

const guestItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const checkoutSchema = z.object({
  guestItems: z.array(guestItemSchema).optional(),
  addressId: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  address1: z.string().min(4).optional(),
  address2: z.string().optional(),
  zip: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  country: z.string().min(2).max(2).default("CH").optional(),
  email: z.string().email(),
  paymentMethod: z.enum(["CARD", "TWINT"]),
  savedPaymentMethodId: z.string().optional(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRateLimit = checkRateLimit({
    namespace: "checkout-ip",
    identifier: ip,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (ipRateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Checkout-Versuche. Bitte kurz warten." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRateLimit.retryAfterSeconds) },
      },
    );
  }

  const sessionUser = await getSessionUserFromToken(getSessionTokenFromRequest(request));
  const isGuest = !sessionUser;

  // Per-user rate limit for logged-in users
  if (!isGuest) {
    const userRateLimit = checkRateLimit({
      namespace: "checkout-user",
      identifier: sessionUser!.id,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (userRateLimit.limited) {
      return NextResponse.json(
        { error: "Zu viele Checkout-Versuche. Bitte kurz warten." },
        {
          status: 429,
          headers: { "Retry-After": String(userRateLimit.retryAfterSeconds) },
        },
      );
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte alle Pflichtfelder korrekt ausfüllen." }, { status: 400 });
  }

  // For logged-in users, check email verification
  if (!isGuest) {
    const account = await db.user.findUnique({
      where: { id: sessionUser!.id },
      select: { emailVerifiedAt: true },
    });
    if (!account?.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Bitte bestätige zuerst deine E-Mail-Adresse." },
        { status: 403 },
      );
    }
  }

  // Resolve address
  let addressData = { firstName: "", lastName: "", address1: "", address2: "", zip: "", city: "", country: "CH" };

  if (!isGuest && parsed.data.addressId) {
    const saved = await db.userAddress.findUnique({ where: { id: parsed.data.addressId } });
    if (!saved || saved.userId !== sessionUser!.id) {
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

  // Resolve cart items
  type CartLine = { productId: string; quantity: number; unitCents: number; title: string };
  let cartLines: CartLine[] = [];
  let cartDbId: string | null = null;

  if (isGuest) {
    // Guest: items come from request body
    const guestItems = parsed.data.guestItems;
    if (!guestItems || guestItems.length === 0) {
      return NextResponse.json({ error: "Warenkorb ist leer." }, { status: 400 });
    }
    const productIds = guestItems.map((item) => item.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, isHidden: false },
      select: { id: true, title: true, priceCents: true, salePriceCents: true, stock: true },
    });
    for (const item of guestItems) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `Produkt nicht gefunden: ${item.productId}` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Nicht genug auf Lager: ${product.title}` }, { status: 400 });
      }
      cartLines.push({
        productId: product.id,
        quantity: item.quantity,
        unitCents: product.salePriceCents ?? product.priceCents,
        title: product.title,
      });
    }
  } else {
    // Logged-in: use DB cart
    const cart = await db.cart.findUnique({
      where: { userId: sessionUser!.id },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: "Warenkorb ist leer." }, { status: 400 });
    }
    cartDbId = cart.id;
    cartLines = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitCents: item.product.salePriceCents ?? item.product.priceCents,
      title: item.product.title,
    }));
  }

  const subtotalCents = cartLines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  const shippingCents = await getShippingCents();
  const totalCents = subtotalCents + shippingCents;

  // For logged-in: validate savedPaymentMethodId
  if (!isGuest && parsed.data.savedPaymentMethodId) {
    const savedMethod = await db.savedPaymentMethod.findUnique({
      where: { id: parsed.data.savedPaymentMethodId },
      select: { id: true, userId: true },
    });
    if (!savedMethod || savedMethod.userId !== sessionUser!.id) {
      return NextResponse.json({ error: "Zahlungsart nicht gefunden." }, { status: 404 });
    }
  }

  // For guests: create a ghost user to satisfy the DB FK constraint on Order.userId
  let orderUserId = sessionUser?.id;
  if (isGuest) {
    const guestEmail = `guest.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@alps3dp.internal`;
    const ghostUser = await db.user.create({
      data: {
        email: guestEmail,
        passwordHash: await hashPassword(createOpaqueToken()),
        emailVerifiedAt: new Date(),
        role: "CUSTOMER",
      },
    });
    orderUserId = ghostUser.id;
  }

  const order = await db.order.create({
    data: {
      userId: orderUserId!,
      status: "PENDING",
      subtotalCents,
      shippingCents,
      totalCents,
      paymentProvider: "stripe",
      paymentMethod: parsed.data.paymentMethod,
      savedPaymentMethodId: !isGuest ? (parsed.data.savedPaymentMethodId || null) : null,
      customerEmail: parsed.data.email,
      customerName: `${addressData.firstName} ${addressData.lastName}`,
      shippingAddress1: addressData.address1,
      shippingAddress2: addressData.address2 || null,
      shippingZip: addressData.zip,
      shippingCity: addressData.city,
      shippingCountry: addressData.country,
      items: {
        create: cartLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCents: line.unitCents,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  const appUrl = getAppBaseUrl();

  const paymentMethodTypes: Array<"card" | "twint"> = parsed.data.paymentMethod === "TWINT" ? ["twint"] : ["card"];

  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: `Stripe ist nicht korrekt konfiguriert: ${getStripeConfigurationError()}` },
        { status: 503 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "chf",
      payment_method_types: paymentMethodTypes,
      customer_email: order.customerEmail,
      client_reference_id: order.id,
      metadata: { orderId: order.id, userId: orderUserId! },
      success_url: `${appUrl}/success?order=${order.id}`,
      cancel_url: `${appUrl}/failed?order=${order.id}`,
      line_items: [
        ...order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "chf",
            unit_amount: item.unitCents,
            product_data: { name: item.product.title },
          },
        })),
        ...(shippingCents > 0
          ? [{ quantity: 1, price_data: { currency: "chf", unit_amount: shippingCents, product_data: { name: "Lieferkosten" } } }]
          : []),
      ],
    });

    await db.order.update({ where: { id: order.id }, data: { paymentReference: session.id } });

    if (!isGuest && cartDbId) {
      await db.cartItem.deleteMany({ where: { cartId: cartDbId } });
    }

    return NextResponse.json({ checkoutUrl: session.url, orderId: order.id });
  } catch (error) {
    console.error("[checkout:stripe]", error);
    const stripeMessage = error instanceof Error ? error.message : "Unbekannter Stripe-Fehler";
    return NextResponse.json(
      {
        error: `Zahlung konnte nicht gestartet werden: ${stripeMessage}`,
        code: "STRIPE_CHECKOUT_FAILED",
      },
      { status: 502 },
    );
  }
}

