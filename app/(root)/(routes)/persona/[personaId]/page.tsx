import CompanionForm from "@/Components/PersonaForm";
import client from "@/lib/prismadb"

export default async function PersonaPage({ params }: { params: { personaId: string } }) {
  const persona = await client.persona.findUnique({
    where: {
      id: params.personaId,
    },
  });

  const categories = await client.category.findMany() ;
  return (
    <div>
      <CompanionForm initialdata={null} categories={categories} />
    </div>
  )
}
