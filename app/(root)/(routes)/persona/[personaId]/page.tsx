import PersonaForm from "@/Components/PersonaForm";
import client from "@/lib/prismadb";

export default async function PersonaPage({ params }: { params: { personaId: string } }) {
  const { personaId } = await params;

  const persona = await client.persona.findUnique({
    where: { id: personaId },
  });

  const categories = await client.category.findMany();

  return (
    <div>
      <PersonaForm initialdata={persona} categories={categories} />
    </div>
  );
}
