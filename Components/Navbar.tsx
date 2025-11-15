"use client";

import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Logo from "../public/persona.png";
import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/Components/ui/button";
import { ModeToggle } from "./Theme-Toggle";
import MobileSidebar from "./MobileSidebar";
import { useProModal } from "@/hooks/use-pro-model";

const font = Poppins({
  weight: "600",
  subsets: ["latin"],
});

export default function Navbar({ isPro }: { isPro: boolean }) {
  const promodal = useProModal();
  return (
    <div className="fixed w-full h-16 z-50 flex items-center justify-between px-4 py-2 bg-secondary border-b border-primary/10">
      {/* Left side: logo and title */}
      <div className="flex items-center">
        <MobileSidebar isPro={isPro}/>
        <Link href={"/"}>
          <div className="flex gap-2 items-center">
            <Image
              src={Logo}
              alt="Logo"
              className="hidden md:block h-8 w-8 object-fill"
            />
            <h1
              className={cn(
                "hidden md:block text-xl md:text-3xl font-bold text-primary",
                font.className
              )}
            >
              Persona.ai
            </h1>
          </div>
        </Link>
      </div>

      {/* Right side: buttons */}
      <div className="flex items-center gap-x-3">
        {!isPro && <Button onClick={promodal.onOpen} variant={"premium"} size={"sm"}>
          Upgrade
          <Sparkles className="h-4 w-4 fill-white text-white ml-2" />
        </Button>}

        <ModeToggle />

        {/* 👇 Auth buttons based on sign-in state */}
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </div>
  );
}
