import { Persona } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "./ChatMessage";
import { ElementRef, useEffect, useRef, useState } from "react";

interface ChatMessagesProps {
  isLoading: boolean;
  messages: ChatMessageProps[];
  persona: Persona;
}

export default function ChatMessages({ isLoading, messages = [], persona }: ChatMessagesProps) {
  const scrollRef = useRef<ElementRef<'div'>>(null);

  const [fakeLoading, setFakeLoading] = useState(messages.length === 0 ? true
    : false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFakeLoading(false);
    }, 1000);

    return () => {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto pr-4">
      <ChatMessage isLoading={fakeLoading} src={persona.imgSrc} role="system" content={`Hello! I am ${persona.name}'s Persona, who is a ${persona.description}`} />
      {messages.map((message) => (
        <ChatMessage
          key={message.content}
          role={message.role}
          content={message.content}
          src={message.src}
        />
      ))}
      {isLoading && (
        <ChatMessage
          role="system"
          src={persona.imgSrc}
          isLoading
        />
      )}
      <div ref={scrollRef} />
    </div>
  )
}
