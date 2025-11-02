import React from 'react'

export default function AuthLayout
({children} : Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='flex justify-center items-center h-full bg-blue-50'>
      {children}
    </div>
  )
}
