// /app/api/webhook/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import client from "@/lib/prismadb";
import { stripe } from "@/lib/Stripe";

/**
 * Fix Stripe types for the fields we use:
 * - Stripe returns UNIX timestamps (seconds) for created, created, etc.
 * - Keep the field as number | null to avoid wrongly overriding to Date.
 */
type Sub = Stripe.Subscription & {
  created?: number | null;
};
type Inv = Stripe.Invoice & {
  subscription?: string | null;
};

/** Convert a UNIX seconds timestamp to a JS Date or return null if missing */
function toDate(sec?: number | null) {
  return typeof sec === "number" ? new Date(sec * 1000) : null;
}

/** Convert UNIX seconds timestamp to Date, or fallback to `now + 30 days` if missing */
function toDateOr30Days(sec?: number | null) {
  if (typeof sec === "number") return new Date(sec * 1000);
  // fallback: 30 days from now
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

/** Return price id of the first line item on the subscription (or null) */
function getPrice(s: Sub) {
  return s.items?.data?.[0]?.price?.id ?? null;
}

/** Helper that returns exactly 30 days from now (useful for subscribe/resubscribe) */
function thirtyDaysFromNow() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  // Read raw body (required for Stripe signature verification)
  const body = await req.text();

  // Read Stripe signature header
  const sig = (await headers()).get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    // Verify the webhook signature using your webhook secret
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    // Invalid signature -> reject the webhook
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      /* ------------------------------------- */
      case "checkout.session.completed": {
        /**
         * Fired when a Checkout Session completes (user finished checkout).
         * Typical for initial subscription creation and resubscribe flows when
         * you use Stripe Checkout for subscriptions.
         *
         * We: - get userId from session metadata (guard if missing),
         *      - retrieve full subscription from Stripe,
         *      - upsert the DB record for that user.
         *
         * Important: per your request, for subscribe/resubscribe we set
         * stripeCurrentPeriodEnd = now + 30 days (hard 30-day period).
         */
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId || !session.subscription) return NextResponse.json({});

        // Retrieve full subscription object from Stripe
        const sub = (await stripe.subscriptions.retrieve(
          session.subscription as string
        )) as Sub;

        // Upsert subscription in DB. For create/update here we set the period end
        // to exactly 30 days from now (subscribe/resubscribe requirement).
        await client.userSubscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: sub.customer as string,
            stripePriceId: getPrice(sub),
            // Use 30 days from now for initial subscribe/resubscribe
            stripeCurrentPeriodEnd: thirtyDaysFromNow(),
          },
          update: {
            stripeSubscriptionId: sub.id,
            stripeCustomerId: sub.customer as string,
            stripePriceId: getPrice(sub),
            // Keep the same behavior on update (resubscribe) -> 30 days from now
            stripeCurrentPeriodEnd: thirtyDaysFromNow(),
          },
        });

        break;
      }

      /* ------------------------------------- */
      case "invoice.payment_succeeded": {
        /**
         * Fired when an invoice is successfully paid.
         * This can indicate a renewal/recurring payment.
         *
         * We: - read invoice.subscription, retrieve the subscription,
         *      - update existing DB rows matching the subscription id.
         *
         * For renewals we prefer Stripe's reported `created`.
         * If Stripe doesn't provide it for some reason, we fall back to `now + 30 days`.
         */
        const invoice = event.data.object as Inv;
        if (!invoice.subscription) return NextResponse.json({});

        const sub = (await stripe.subscriptions.retrieve(invoice.subscription)) as Sub;

        await client.userSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripePriceId: getPrice(sub),
            // Prefer the subscription's provided period end; fallback to 30 days
            stripeCurrentPeriodEnd: toDateOr30Days(sub.created),
          },
        });

        break;
      }

      /* ------------------------------------- */
      case "customer.subscription.deleted": {
        /**
         * Fired when a subscription is deleted/cancelled.
         * We clear subscription-related fields in the DB.
         */
        const sub = event.data.object as Sub;

        await client.userSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });

        break;
      }

      /* ------------------------------------- */
      default:
        // ignore other events
        break;
    }

    return NextResponse.json({});
  } catch (err) {
    console.error("[Webhook Error]", err);
    return new NextResponse("Webhook error", { status: 500 });
  }
}
