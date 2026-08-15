import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeConfigurationError() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return "STRIPE_SECRET_KEY fehlt.";
  }
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    return "STRIPE_SECRET_KEY muss ein Secret Key sein (sk_test_... oder sk_live_...). Der Publishable Key beginnt mit pk_.";
  }
  return null;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || getStripeConfigurationError()) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil",
    });
  }

  return stripeClient;
}
