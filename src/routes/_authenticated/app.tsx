import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PawPrint, Users, Plus, Activity, Gift, Users as UsersIcon, HelpCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { countOwners, countPets, listRecentVisits, type RecentVisit } from "@/lib/repository";
import { useAuth } from "@/contexts/auth";


export const Route = createFileRoute("/_authenticated/app")({
  component: HomePage,
});

function HomePage() {
  const { profile } = useAuth();
  const [pets, setPets] = useState<number | null>(null);
  const [owners, setOwners] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([countPets(), countOwners(), listRecentVisits(5)])
      .then(([p, o, r]) => {
        if (cancelled) return;
        setPets(p);
        setOwners(o);
        setRecent(r);
      })
      .catch(() => !cancelled && setError("No se pudieron cargar los totales."));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell title="Inicio">
      <div className="space-y-6">
        <section>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Panel del equipo</h2>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <StatCard label="Mascotas" value={pets} icon={<PawPrint className="size-5" />} />
          <StatCard label="Dueños" value={owners} icon={<Users className="size-5" />} />
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <section className="grid grid-cols-2 gap-3">
          <Button asChild className="h-12">
            <Link to="/pets/new">
              <Plus /> Nueva mascota
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12">
            <Link to="/owners/new">
              <Plus /> Nuevo dueño
            </Link>
          </Button>
        </section>

        {profile?.role === "admin" ? (
          <section className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="h-12">
              <Link to="/rewards">
                <Gift /> Recompensas
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12">
              <Link to="/staff">
                <UsersIcon /> Equipo
              </Link>
            </Button>
          </section>
        ) : null}


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" /> Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent === null ? (
              <Skeleton className="h-16 w-full" />
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin actividad todavía. Las visitas aparecerán aquí cuando empieces a registrarlas.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((v) => (
                  <li key={v.id} className="py-2">
                    {v.pet ? (
                      <Link
                        to="/pets/$petId"
                        params={{ petId: v.pet.id }}
                        className="flex items-center gap-3"
                      >
                        <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-background-muted">
                          {v.chosen_cut?.image_url ? (
                            <img
                              src={v.chosen_cut.image_url}
                              alt={v.chosen_cut.title}
                              className="block h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="truncate font-medium">{v.pet.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {new Date(v.visited_at).toLocaleDateString("es-ES")}
                            {v.chosen_cut?.title ? ` · ${v.chosen_cut.title}` : ""}
                          </p>
                        </div>
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wider">{label}</span>
          {icon}
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
