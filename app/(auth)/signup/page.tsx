"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBrowserClient } from "@/lib/supabase/client";
import { SignupSchema, type SignupInput } from "@/schemas/auth.schema";
import { useToast } from "@/hooks/use-toast";
import { SlideTextButton } from "@/components/kokonutui";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function SignupPage(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupInput): Promise<void> {
    setSubmitting(true);
    const supabase = createBrowserClient();

    // Role is omitted — the handle_new_user trigger defaults public signups to
    // 'customer' (and auto-links a CRM row). Staff are provisioned by an admin
    // via User Management.
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { name: values.name } },
    });

    if (error) {
      setSubmitting(false);
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
      return;
    }

    if (data.session) {
      // Email confirmation disabled — user is signed in immediately.
      toast({ title: "Welcome to NexaBrew", description: "Account created." });
      router.replace("/pos/terminal");
      router.refresh();
      return;
    }

    // Email confirmation enabled — no active session yet.
    setSubmitting(false);
    toast({
      title: "Account created",
      description: "Check your email to confirm, then sign in.",
    });
    router.replace("/login");
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight text-brand-700">
          Create your account
        </CardTitle>
        <CardDescription>NexaBrew — create a customer account to browse the menu and track your orders</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@nexabrew.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <SlideTextButton type="submit" loading={submitting}>
              Create Account
            </SlideTextButton>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-brand-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
