"use client";

import { Persona, Message } from "@prisma/client";
import ChatHeader from "./ChatHeader";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCompletion } from "@ai-sdk/react"
import ChatForm from "./ChatForm";
import ChatMessages from "./ChatMessages";
import { ChatMessageProps } from "./ChatMessage";


interface ChatClientProps {
    persona: Persona & {
        messages: Message[];
        _count: {
            messages: number;
        };
    };
}

export default function ChatClient({
    persona,
}: ChatClientProps) {
    const router = useRouter();
    const [messages, setMessages] = useState<ChatMessageProps[]>(persona.messages);

    const {
        input,
        isLoading,
        handleInputChange,
        handleSubmit,
        setInput,
    } = useCompletion({
        api: `/api/chat/${persona.id}`,
        //@ts-ignore
        onFinish(prompt, completion) {
            const systemMessage = {
                role: "system",
                content: completion,
            };

            setMessages(current => [...current, systemMessage]);
            setInput("");

            router.refresh();
        },
    });

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        const userMessage = {
            role: "user",
            content: input,
        };

        setMessages((current) => [...current, userMessage]);
        handleSubmit(e);
    }
    return (
        <div className="h-full flex flex-col p-4 space-y-2">
            <ChatHeader persona={persona} />
            <ChatMessages isLoading={isLoading} messages={messages} persona={persona}/>
            <ChatForm isLoading={isLoading} input={input} handleInputChange={handleInputChange} onSubmit={onSubmit}/>
        </div>
    );
};
