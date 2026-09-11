"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type IdentifierKind = "email" | "phone";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [kind, setKind] = useState<IdentifierKind>("email");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        [kind]: identifier.trim(),
        password,
        name: name.trim() || undefined,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app p-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors duration-[120ms] hover:text-text-secondary"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back to WeatherGPT
        </Link>

        <div className="rounded-xl bg-surface-1 p-6 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/chat-mascot.png"
              alt=""
              width={1188}
              height={1324}
              className="h-16 w-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
            />
            <h1 className="mt-2 text-lg font-semibold text-text-primary">Create your account</h1>
            <p className="mt-1 text-xs text-text-tertiary">
              Get personalized weather alerts and advice from WeatherGPT
            </p>
          </div>

          <div className="mt-5 flex h-9 items-center gap-1 rounded-full bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => {
                setKind("email");
                setIdentifier("");
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[13px] font-semibold transition-colors duration-[200ms] ${
                kind === "email" ? "bg-accent-primary text-text-inverse" : "text-text-secondary"
              }`}
            >
              <Mail size={14} strokeWidth={1.75} />
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("phone");
                setIdentifier("");
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[13px] font-semibold transition-colors duration-[200ms] ${
                kind === "phone" ? "bg-accent-primary text-text-inverse" : "text-text-secondary"
              }`}
            >
              <Phone size={14} strokeWidth={1.75} />
              Phone
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              autoFocus
              className="h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong"
            />

            <input
              type={kind === "email" ? "email" : "tel"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={kind === "email" ? "you@example.com" : "+91 98765 43210"}
              required
              className="h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 8 characters)"
                required
                minLength={8}
                className="h-11 w-full rounded-md bg-surface-2 px-3 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors duration-[120ms] hover:text-text-secondary"
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>

            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              minLength={8}
              className="h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-border-strong"
            />

            {error && <p className="text-xs text-alert">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent-primary text-sm font-semibold text-text-inverse transition-opacity duration-[120ms] hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" strokeWidth={2} />}
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-text-tertiary">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
