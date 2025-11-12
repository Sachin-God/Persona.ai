import { SendHorizontal } from "lucide-react";
import { ChangeEvent, FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface chatformprops {
    isLoading: boolean,
    input: string,
    handleInputChange: (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export default function ChatForm({ isLoading, input, handleInputChange, onSubmit }: chatformprops) {
    return (
        <form
            onSubmit={onSubmit}
            className="border-t border-primary/10 py-4 flex items-center gap-x-2"
        >
            <Input
                disabled={isLoading}
                value={input}
                onChange={handleInputChange}
                placeholder="Type a message"
                className="rounded-lg bg-primary/10"
            />
            <Button disabled={isLoading} variant="ghost">
                <SendHorizontal className="h-6 w-6" />
            </Button>
        </form>
    )
}
