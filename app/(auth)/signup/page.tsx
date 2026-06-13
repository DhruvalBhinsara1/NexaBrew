"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Coffee } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { SignupSchema, type SignupInput } from "@/schemas/auth.schema";
import { useToast } from "@/hooks/use-toast";
import { SlideTextButton } from "@/components/kokonutui";
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
    <div className="w-full">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-wise bg-wise-primary text-wise-ink">
          <Coffee className="h-5 w-5" />
        </span>
        <span className="font-display text-lg font-extrabold tracking-tight text-wise-ink">NexaBrew</span>
      </div>

      <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-wise-ink">
        Create your account.
      </h1>
      <p className="mt-3 text-base text-wise-body">
        Browse the menu and track your orders live.
      </p>

      <Form {...form}>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-wise-ink">Name</FormLabel>
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
                <FormLabel className="text-wise-ink">Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="you@nexabrew.com" {...field} />
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
                <FormLabel className="text-wise-ink">Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="At least 6 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SlideTextButton type="submit" loading={submitting}>
            Create Account
          </SlideTextButton>
        </form>
      </Form>

      <p className="mt-8 text-sm text-wise-body">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-wise-ink-deep hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
