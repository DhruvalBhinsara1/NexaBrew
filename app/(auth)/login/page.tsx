"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBrowserClient } from "@/lib/supabase/client";
import { LoginSchema, type LoginInput } from "@/schemas/auth.schema";
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
    <Card className="border-surface-border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
          Welcome back
        </CardTitle>
        <CardDescription>Sign in to your NexaBrew account</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
                      autoComplete="current-password"
                      placeholder="••••••••"
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
              Sign In
            </SlideTextButton>
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link
                href="/signup"
                className="font-medium text-brand-600 hover:underline"
              >
                Create one
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
