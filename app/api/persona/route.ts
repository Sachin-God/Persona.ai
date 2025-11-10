import client from "@/lib/prismadb";
import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const user = await currentUser();
        const { imgSrc, name, description, instruction, seed, categoryId } = body;

        if (!user || !user.id || !user.firstName) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        if (!imgSrc || !name || !description || !instruction || !seed || !categoryId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const persona = await client.persona.create({
            data : {
                categoryId,
                name,
                description,
                instruction,
                seed,
                imgSrc,

                userid : user.id,
                username : user.firstName
            }
        });

        return NextResponse.json({
            message: "User Created Successfully",
        }, {status : 200});
    } catch (error) {
        console.log("Error in /api/persona/POST Route : ", error);
    }
}