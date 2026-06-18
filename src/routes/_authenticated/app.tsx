import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app")({
  component: LandingPage,
});

function LandingPage() {
  const { profile, user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const name = profile?.full_name ?? user?.email ?? "";
  const role = profile?.role;

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 bg-background px-6 py-8"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
    >
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Kiwoko</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Hola, {loading ? "…" : name}
        </h1>
        {role ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Rol: <span className="font-medium text-foreground">{role}</span>
          </p>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inicio</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta es la zona del equipo. Las funciones de mascotas, cortes y recompensas llegarán en próximas fases.
        </CardContent>
      </Card>

      {role === "admin" ? (
        <Button asChild variant="outline" className="h-11">
          <Link to="/staff">Gestionar cuentas del equipo</Link>
        </Button>
      ) : null}

      <Button onClick={handleSignOut} variant="ghost" className="h-11 mt-auto">
        Cerrar sesión
      </Button>
    </main>
  );
}
