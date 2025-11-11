"use client";

import { Persona, Message } from "@prisma/client";
import ChatHeader from "./ChatHeader";

interface ChatClientProps {
    persona: Persona & {
        messages: Message[];
        _count: {
            messages: number;
        };
    };
}

export default function ChatClient ({
    persona,
}: ChatClientProps) {
    return (
        <div className="flex flex-col h-full p-4 space-y-2">
            <ChatHeader persona={persona} />
        </div>
    );
};
