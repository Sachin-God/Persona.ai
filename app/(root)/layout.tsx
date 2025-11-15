import Navbar from '@/Components/Navbar';
import Sidebar from '@/Components/Sidebar';
import { checkSubscription } from '@/lib/subscription';
import React from 'react'

export default async function RootLayout
  ({ children }: Readonly<{
    children: React.ReactNode;
  }>) {
    const isPro = await checkSubscription();
  return (
    <div className='h-full'>
      <Navbar isPro={isPro}/>
      <div className='hidden md:flex flex-col mt-16 w-20 fixed inset-y-0'>
        <Sidebar isPro={isPro}/>
      </div>
      <main className='md:pl-20 pt-16 h-full'>{children}</main>
    </div>
  )
}