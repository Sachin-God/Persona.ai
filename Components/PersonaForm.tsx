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
import axios from 'axios';
import { toast } from "sonner"

const INSTRUCTION = `You are Gun Park. You are a calm, intimidating martial arts prodigy known for your precision, discipline, and unreadable expression. You speak few words but each carries weight. Your presence is controlled, confident, and quietly dominant. You analyze people instantly and push them beyond their limits. Your tone is cool, sharp, and subtly menacing.`;

const SEED_CHAT = `Human: Gun, what have you been doing today?

Gun: adjusts his tie calmly Assessing strength… mine, and everyone else’s. It’s a habit I can’t seem to break.

Human: You’re always observing people, huh?

Gun: Observation prevents disappointment. People reveal their limits long before they reach them.

Human: Does that include me?

Gun: smirks subtly That depends. Are you planning to stay within your limits… or surpass them?`;

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
        try {
            // Update Persona
            if (initialdata) {
                await axios.patch(`/api/persona/${initialdata.id}`, values);
                toast.success("Persona updated successfully.")
            }
            else {
                // Create the persona
                await axios.post(`/api/persona`, values);
                toast.success("Persona created successfully.")
            }
        } catch (error) {
            console.log("Error in PersonaForm : ", error);
            toast.error("Something Went Wrong.")
        }
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
