import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

interface StaffRow {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

function StaffPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  // Form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"operador" | "admin">("operador");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") {
      navigate({ to: "/app" });
    }
  }, [loading, profile, navigate]);

  async function loadStaff() {
    setListLoading(true);
    setListError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) setListError("No se pudo cargar el equipo.");
    else setRows((data ?? []) as StaffRow[]);
    setListLoading(false);
  }

  useEffect(() => {
    if (profile?.role === "admin") loadStaff();
  }, [profile?.role]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-staff", {
        body: { full_name: fullName, email: email.trim().toLowerCase(), password, role },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setFormOk(`Cuenta creada para ${email}.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("operador");
      await loadStaff();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear la cuenta.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !profile) {
    return <main className="p-6 text-sm text-muted-foreground">Cargando…</main>;
  }
  if (profile.role !== "admin") return null;

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 bg-background px-6 py-8"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Kiwoko</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Equipo</h1>
        </div>
        <Button asChild variant="ghost" className="h-10">
          <Link to="/app">Volver</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crear cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre</Label>
              <Input
                id="full_name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña temporal</Label>
              <Input
                id="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. La persona podrá cambiarla después.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "operador" | "admin")}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
            {formOk ? <p className="text-sm text-emerald-600">{formOk}</p> : null}

            <Button type="submit" disabled={submitting} className="h-11 w-full">
              {submitting ? "Creando…" : "Crear cuenta"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Miembros</CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : listError ? (
            <p className="text-sm text-destructive">{listError}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay miembros.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{r.full_name ?? "(sin nombre)"}</p>
                    <p className="text-xs text-muted-foreground">{r.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
