// /app/api/persona/[personaId]/route.ts
import client from "@/lib/prismadb";
import { checkSubscription } from "@/lib/subscription";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

type ContextParams =
  | { params: { personaId: string } }
  | { params: Promise<{ personaId: string }> };

/** Helper to uniformly resolve params whether they are a Promise or plain object */
async function resolveParams(context: ContextParams) {
  // context.params might be a Promise<{ personaId }>
  const raw = (context as any).params;
  return await Promise.resolve(raw) as { personaId: string };
}

export async function PATCH(req: NextRequest, context: ContextParams) {
  try {
    const { personaId } = await resolveParams(context);
    if (!personaId) {
      return NextResponse.json({ error: "personaId is required." }, { status: 400 });
    }

    const user = await currentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { imgSrc, name, description, instruction, seed, categoryId } = body ?? {};

    // validate required fields -> return 400 for bad request
    if (!imgSrc || !name || !description || !instruction || !seed || !categoryId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const isPro = await checkSubscription();
    if (!isPro) {
      return NextResponse.json({ error: "Pro subscription required." }, { status: 403 });
    }

    // Update persona — adjust `where` if your Prisma schema uses a different unique constraint
    await client.persona.update({
      where: {
        id: personaId, // if you require user scoping as well, use a composite unique or separate check
      },
      data: {
        categoryId,
        name,
        description,
        instruction,
        seed,
        imgSrc,
        userid: user.id,
        username: user.firstName ?? undefined,
      },
    });

    return NextResponse.json({ message: "Persona updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Error in PATCH /api/persona/[personaId]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: ContextParams) {
  try {
    const authData = await auth();
    const userId = authData?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { personaId } = await resolveParams(context);
    if (!personaId) {
      return NextResponse.json({ error: "personaId is required." }, { status: 400 });
    }

    await client.persona.delete({
      where: {
        id: personaId, // if your schema requires scoping by user, validate ownership first
      },
    });

    return NextResponse.json({ message: "Persona deleted successfully." }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/persona/[personaId]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
