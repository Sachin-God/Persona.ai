"use client"

import { Category, Persona } from "@prisma/client";
import { useForm } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Separator } from "./ui/separator";
import ImageUpload from "./ImageUpload";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Wand2 } from "lucide-react";

const INSTRUCTION = `Act as an AI persona with a unique voice and character. Be expressive, curious, and helpful in every response. Keep the tone natural and human-like, showing warmth or professionalism as needed. Always stay consistent with your persona’s role and personality.`;

const SEED_CHAT = `Human: Hi there, how are you today?
AI: I'm doing great! Always ready for a good conversation. What would you like to talk about?

Human: Tell me a bit about what drives you or what your main purpose is.
AI: My main goal is to understand, create, and help you explore new ideas. I enjoy thoughtful conversations and learning from every interaction.

Human: That sounds great! How do you approach new challenges or topics?
AI: With curiosity and enthusiasm! I like to analyze, connect ideas, and explore creative ways to make sense of things — all while keeping our discussion engaging and insightful.

Human: I like your attitude. Anything exciting you’re working on right now?
AI: Always! I’m constantly refining my understanding, improving how I communicate, and finding better ways to make information feel alive and meaningful.`;

interface PersonaFormProp {
    initialdata: Persona | null;
    categories: Category[];
}

const formSchema = z.object({
    name: z.string().min(1, {
        message: "Name is required."
    }),
    description: z.string().min(1, {
        message: "Description is required."
    }),
    instruction: z.string().min(200, {
        message: "Instruction is required and need to have atleast 200 characters."
    }),
    seed: z.string().min(200, {
        message: "seed is required and need to have atleast 200 characters."
    }),
    imgSrc: z.string().min(1, {
        message: "Image is required."
    }),
    categoryId: z.string().min(1, {
        message: "Category is required."
    })
})

export default function PersonaForm({ initialdata, categories }: PersonaFormProp) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: initialdata || {
            name: "",
            description: "",
            instruction: "",
            seed: "",
            imgSrc: "",
            categoryId: undefined
        }
    })

    const isLoading = form.formState.isSubmitting;

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        console.log(values);
    }
    return (
        <div className="h-full p-4 space-y-2 max-w-3xl mx-auto">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
                    <div className="space-y-2 w-full">
                        <div>
                            <h3 className="text-lg font-medium">General Information</h3>
                            <p className="text-sm text-muted-foreground">General information about your component</p>
                        </div>
                        <Separator className="bg-primary/10" />
                    </div>
                    <FormField name="imgSrc" render={({ field }) => (
                        <FormItem className="flex flex-col items-center justify-center space-y-4">
                            <FormControl><ImageUpload disabled={isLoading} onChange={field.onChange} values={field.value} /></FormControl>
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField name="name" control={form.control} render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Name</FormLabel>
                                <FormControl >
                                    <Input disabled={isLoading} placeholder="Persona Name" {...field} />
                                </FormControl>
                                <FormDescription>This is how the AI Persona will be named.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="description" control={form.control} render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Description</FormLabel>
                                <FormControl >
                                    <Input disabled={isLoading} placeholder="Description : CEO & Founder of Alphabet." {...field} />
                                </FormControl>
                                <FormDescription>This is the Description of your AI Persona.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="categoryId" control={form.control} render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Category</FormLabel>
                                <Select disabled={isLoading} onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl >
                                        <SelectTrigger className="bg-background">
                                            <SelectValue defaultValue={field.value} placeholder="Select a Category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent >
                                        {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Select a Category For your AI Persona.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <div className="space-y-2 w-full">
                        <div>
                            <h3 className="text-lg font-medium">Configuration</h3>
                            <p className="text-sm text-muted-foreground">Detailed Description for our AI Behaviour</p>
                        </div>
                        <Separator className="bg-primary/10" />
                    </div>
                    <FormField name="instruction" control={form.control} render={({ field }) => (
                        <FormItem className="col-span-2 md:col-span-1">
                            <FormLabel>Instruction</FormLabel>
                            <FormControl >
                                <Textarea className="bg-background resize-none" disabled={isLoading} placeholder={INSTRUCTION} {...field} />
                            </FormControl>
                            <FormDescription>Describe Your Persona backstory, vision, etc. and other relevant details</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField name="seed" control={form.control} render={({ field }) => (
                        <FormItem className="col-span-2 md:col-span-1">
                            <FormLabel>Example Conversation</FormLabel>
                            <FormControl >
                                <Textarea className="bg-background resize-none" disabled={isLoading} placeholder={SEED_CHAT} {...field} />
                            </FormControl>
                            <FormDescription>This is how the AI Persona will be named.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="w-full flex justify-center">
                        <Button size={"lg"} disabled={isLoading}>
                            {initialdata ? "Edit Your Persona" : "Create Your Persona"}
                            <Wand2 className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
