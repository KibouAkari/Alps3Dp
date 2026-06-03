export const integrationRoadmap = {
  auth: [
    "Install next-auth and bcrypt.",
    "Add credentials provider with secure password hashing.",
    "Protect /admin routes by role.",
  ],
  database: [
    "Install prisma and @prisma/client.",
    "Run migrations against Vercel Postgres.",
    "Replace demo data with DB queries.",
  ],
  payments: [
    "Use Stripe Checkout for card + wallet support.",
    "Enable TWINT through your payment provider if available.",
    "Handle webhook signatures and idempotent order updates.",
  ],
  email: [
    "Send admin order summary and customer receipt on payment confirmation.",
    "Use templates and include invoice PDF as next step.",
  ],
};
