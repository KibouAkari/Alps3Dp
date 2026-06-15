import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminFromRequest } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sendOrderEmails } from "@/lib/mail";

const schema = z.object({
  action: z.enum(["simulate-order-and-email"]),
  email: z.string().email().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingaben." }, { status: 400 });
  }

  if (parsed.data.action === "simulate-order-and-email") {
    const sampleProduct = await db.product.findFirst({
      where: { isHidden: false },
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
      totalCents: order.totalCents,
      lines: order.items.map((item) => ({
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

  return NextResponse.json({ error: "Aktion nicht unterstützt." }, { status: 400 });
}
