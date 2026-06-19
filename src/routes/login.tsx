import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid")) setError("Email o contraseña incorrectos.");
      else if (msg.includes("network")) setError("Sin conexión. Inténtalo de nuevo.");
      else setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
      return;
    }
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      setError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-background px-6"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
            K
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Kiwoko</h1>
          <p className="mt-2 text-sm text-muted-foreground">Accede con tu cuenta de equipo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className="h-11 w-full">
            {submitting ? "Entrando…" : "Entrar"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">o</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googleLoading || submitting}
            className="h-11 w-full gap-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
              <path fill="#EA4335" d="M12 10.2v3.96h5.51c-.24 1.42-1.69 4.17-5.51 4.17-3.31 0-6.02-2.75-6.02-6.13S8.69 6.07 12 6.07c1.89 0 3.15.81 3.87 1.5l2.64-2.54C16.83 3.5 14.62 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.93 0 9.5-4.87 9.5-7.4 0-.5-.06-.88-.13-1.27H12z" />
            </svg>
            {googleLoading ? "Conectando con Google…" : "Continuar con Google"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            ¿No tienes cuenta? Pídele a un administrador que te dé acceso.
          </p>
        </form>

        <div className="mt-8 rounded-md border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">Acceso de demostración</p>
          <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between gap-2">
              <dt>Email</dt>
              <dd className="font-mono text-foreground">nico@gmail.com</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Contraseña</dt>
              <dd className="font-mono text-foreground">nico12345678</dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEmail("nico@gmail.com");
              setPassword("nico12345678");
            }}
            className="mt-3 h-11 w-full"
          >
            Usar cuenta de demo
          </Button>
        </div>
      </div>
    </main>
  );
}
