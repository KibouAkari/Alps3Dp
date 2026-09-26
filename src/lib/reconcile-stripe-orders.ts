import { db } from "@/lib/db";
import { sendOrderEmails } from "@/lib/mail";
import { getStripe } from "@/lib/payments";
import { getSessionUser } from "@/lib/session";

// Reconcile recent local orders against Stripe when webhook delivery was missed.
export async function reconcileRecentStripeOrders() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return 0;

  const stripe = getStripe();
  if (!stripe) return 0;

  const orders = await db.order.findMany({
    where: {
      paymentProvider: { in: ["stripe", "stripe-test"] },
      status: "PENDING",
      paymentReference: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { items: { include: { product: true } } },
  });

  let reconciled = 0;
  for (const order of orders) {
    if (!order.paymentReference) continue;

    try {
      const checkout = await stripe.checkout.sessions.retrieve(order.paymentReference);
      const checkoutOrderId = checkout.metadata?.orderId || checkout.client_reference_id;
      if (checkoutOrderId !== order.id || checkout.currency !== "chf" || checkout.amount_total !== order.totalCents) {
        console.error("[admin:stripe:reconcile] Session does not match order", order.id);
        continue;
      }

      if (checkout.payment_status === "paid" && checkout.status === "complete") {
        const updated = await db.order.updateMany({
          where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
          data: { status: "PAID", paidAt: new Date(), paymentReference: checkout.id },
        });
        if (updated.count === 0) continue;

        reconciled += 1;
        const cart = await db.cart.findUnique({ where: { userId: order.userId }, select: { id: true } });
        if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id } });

        try {
          await sendOrderEmails({
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalCents: order.totalCents,
            lines: order.items.map((item) => ({
              title: item.product.title,
              quantity: item.quantity,
              unitCents: item.unitCents,
            })),
          });
        } catch (error) {
          console.error("[admin:stripe:reconcile:order-mail]", error);
        }
      } else if (checkout.status === "expired") {
        const updated = await db.order.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        reconciled += updated.count;
      }
    } catch (error) {
      console.error("[admin:stripe:reconcile] Could not retrieve Checkout Session", order.id, error);
    }
  }

  return reconciled;
}
