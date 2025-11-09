import Categories from "@/Components/Categories";
import SearchInput from "@/Components/SearchInput";
import client from "@/lib/prismadb";

export default async function Home() {
  const categories = await client.category.findMany()
  return (
    <div className="h-full p-4 space-y-2 text-primary">
      <SearchInput />
      <Categories data={categories} />
    </div>
  );
}
