import ChatClient from '@/Components/ChatClient';
import client from '@/lib/prismadb';
import { RedirectToSignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface chatProps {
  params: {
    chatId: string
  }
}
export default async function page({ params }: chatProps) {
  const { chatId } = await params;
  const { userId } = await auth();

  if (!userId) return <RedirectToSignIn />;

  const persona = await client.persona.findUnique({
    where: {
      id: chatId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        where: {
          userId,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  if (!persona) {
    return redirect("/")
  }


  return (
    <div className='h-full'>
      <ChatClient persona={persona} />
    </div>
  )
}
