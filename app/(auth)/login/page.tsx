"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Coffee } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { LoginSchema, type LoginInput } from "@/schemas/auth.schema";
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

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@nexabrew.com" },
  { label: "Cashier", email: "alice@nexabrew.com" },
  { label: "Kitchen", email: "kitchen@nexabrew.com" },
];

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput): Promise<void> {
    setSubmitting(true);
    const supabase = createBrowserClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error || !data.user) {
      setSubmitting(false);
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error?.message ?? "Invalid email or password.",
      });
      return;
    }

    // Role-based redirect (admin → dashboard, employee → POS).
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = (profile as { role: string } | null)?.role;
    const home =
      role === "admin"
        ? "/dashboard"
        : role === "customer"
          ? "/menu"
          : role === "kitchen"
            ? "/kds"
            : "/pos/terminal";
    router.replace(home);
    router.refresh();
  }

  return (
    <div className="w-full">
      {/* Brand lockup */}
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-wise bg-wise-primary text-wise-ink">
          <Coffee className="h-5 w-5" />
        </span>
        <span className="font-display text-lg font-extrabold tracking-tight text-wise-ink">NexaBrew</span>
      </div>

      <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-wise-ink">
        Welcome back.
      </h1>
      <p className="mt-3 text-base text-wise-body">
        Sign in to run orders, the kitchen, and the till.
      </p>

      <Form {...form}>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
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
                  <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SlideTextButton type="submit" loading={submitting}>
            Sign In
          </SlideTextButton>
        </form>
      </Form>

      {/* Demo quick-fill */}
      <div className="mt-7">
        <p className="text-xs font-medium uppercase tracking-wider text-wise-mute">Try a demo account</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                form.setValue("email", acc.email, { shouldValidate: true });
                form.setValue("password", "Password@123", { shouldValidate: true });
              }}
              className="rounded-wisePill border border-wise-border bg-white px-3.5 py-1.5 text-sm font-medium text-wise-body transition-colors hover:border-wise-primary hover:bg-wise-primary-pale hover:text-wise-ink-deep"
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-sm text-wise-body">
        No account?{" "}
        <Link href="/signup" className="font-semibold text-wise-ink-deep hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
