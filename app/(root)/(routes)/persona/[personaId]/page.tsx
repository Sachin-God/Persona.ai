import PersonaForm from "@/Components/PersonaForm";
import client from "@/lib/prismadb";
import { RedirectToSignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function PersonaPage({ params }: { params: { personaId: string } }) {
  const { personaId } = await params;
  const {userId} = await auth();

  if (!userId) return <RedirectToSignIn />

  const persona = await client.persona.findUnique({
    where: { id: personaId, userid : userId },
  });

  const categories = await client.category.findMany();

  return (
    <div>
      <PersonaForm initialdata={persona} categories={categories} />
    </div>
  );
}
