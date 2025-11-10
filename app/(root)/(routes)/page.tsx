import Categories from "@/Components/Categories";
import PersonaPage from "@/Components/PersonaPage";
import SearchInput from "@/Components/SearchInput";
import client from "@/lib/prismadb";

interface RootPageParams {
  searchParams: {
    categoryId: string;
    name: string;
  }
}

export default async function Home({ searchParams }: RootPageParams) {
  const { categoryId, name } = await searchParams;
  const data = await client.persona.findMany({
    where: {
      categoryId: categoryId,
      name: name
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      _count: {
        select: { messages: true }
      }
    }
  });
  const categories = await client.category.findMany()
  return (
    <div className="h-full p-4 space-y-2 text-primary">
      <SearchInput />
      <Categories data={categories} />
      <PersonaPage data={data} />
    </div>
  );
}
