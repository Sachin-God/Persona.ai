"use client"
import { Menu, Sparkles } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import Logo from '../public/persona.png'
import { Poppins } from 'next/font/google'
import {cn} from "@/lib/utils"
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/Components/ui/button'
import { ModeToggle } from './Theme-Toggle'

const font = Poppins({
    weight: "600",
    subsets : ['latin']
})

export default function Navbar() {
    return (
        <div className='fixed w-full z-50 flex items-center justify-between px-4 py-2 bg-secondary border-b border-primary/10'>
            <div className='flex items-center'>
                <Menu className='block md:hidden' />
                <Link href={"/"}>
                    <div className='flex gap-2 items-center'>
                        <Image src={Logo} alt='Logo' className='hidden md:block h-8 w-8 object-fill'/>
                        <h1 className={cn('hidden md:block text-xl md:text-3xl font-bold text-primary', font.className)}>Persona.ai</h1>
                    </div>
                </Link>
            </div>
            <div className='flex items-center gap-x-3'>
                <Button variant={'premium'} size={"sm"}>
                    Upgrade
                    <Sparkles className='h-4 w-4 fill-white text-white ml-2'/>
                </Button>
                <ModeToggle />
                <UserButton />
            </div>
        </div>
    )
}
