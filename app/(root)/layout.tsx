import Navbar from '@/Components/Navbar';
import Sidebar from '@/Components/Sidebar';
import React from 'react'

export default function RootLayout
  ({ children }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <div className='h-full'>
      <Navbar />
      <div className='hidden md:flex flex-col mt-16 w-20 fixed inset-y-0'>
        <Sidebar />
      </div>
      <main className='md:pl-20 pt-16 h-full'>{children}</main>
    </div>
  )
}