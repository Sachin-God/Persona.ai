import client from "@/lib/prismadb";
import { checkSubscription } from "@/lib/subscription";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: {
    params: { personaId: string }
}) {
    try {
        const { personaId } = await params;
        if (!personaId) {
            return NextResponse.json(
                { error: "PersonaId is Required." },
                { status: 400 }
            );
        }


        const user = await currentUser();
        if (!user || !user.id || !user.firstName) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { imgSrc, name, description, instruction, seed, categoryId } = body;
        if (!imgSrc || !name || !description || !instruction || !seed || !categoryId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const isPro = await checkSubscription();

        if (!isPro) {
            return new NextResponse("Pro subscription required", { status: 403 });
        }


        const persona = await client.persona.update({
            where: {
                id: personaId,
                userid: user.id
            },
            data: {
                categoryId,
                name,
                description,
                instruction,
                seed,
                imgSrc,

                userid: user.id,
                username: user.firstName
            }
        });

        return NextResponse.json({
            message: "User Updated Successfully",
        }, { status: 200 });
    } catch (error) {
        console.log("Error in /api/persona/Patch Route : ", error);
    }
}

export async function DELETE(req: NextRequest, { params }: {
    params: { personaId: string }
}) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { personaId } = await params;
        if (!personaId) {
            return NextResponse.json(
                { error: "PersonaId is Required." },
                { status: 400 }
            );
        }

        const persona = await client.persona.delete({
            where: {
                userid: userId,
                id: personaId
            }
        })

        return NextResponse.json({
            message: "User Deleted Successfully",
        }, { status: 200 });
    } catch (error) {
        console.log("Error in /api/persona/delete Route : ", error);
    }
}