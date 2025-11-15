import { auth } from "@clerk/nextjs/server";
import client from "@/lib/prismadb";

const DAY_IN_MS = 86400000;

export const checkSubscription = async () => {
  // `auth()` is synchronous — do NOT await
  const { userId } = await auth();

  if (!userId) {
    return false;
  }

  // Fetch only necessary subscription fields
  const userSubscription = await client.userSubscription.findUnique({
    where: { userId },
    select: {
      stripeCurrentPeriodEnd: true,
      stripeCustomerId: true,
      stripePriceId: true,
      stripeSubscriptionId: true,
    },
  });

  // No subscription found → invalid
  if (!userSubscription) {
    return false;
  }

  // Must have price + expiration date to be valid
  if (
    !userSubscription.stripePriceId ||
    !userSubscription.stripeCurrentPeriodEnd
  ) {
    return false;
  }

  // Compute whether subscription is still active
  const expirationMs = userSubscription.stripeCurrentPeriodEnd.getTime();
  const now = Date.now();

  const isValid = expirationMs > now;

  return isValid;
};
