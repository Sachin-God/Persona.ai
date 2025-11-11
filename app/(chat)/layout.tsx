import React, { ReactNode } from 'react'

export default function layout({children} : {children : ReactNode}) {
  return (
    <div className='mx-auto max-w-4xl w-full h-full'>
      {children}
    </div>
  )
}
