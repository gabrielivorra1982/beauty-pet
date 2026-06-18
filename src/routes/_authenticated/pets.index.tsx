import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PetAvatar } from "@/components/pet-avatar";
import { listPetsWithOwner, type PetWithOwner } from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/pets/")({
  component: PetsListPage,
});

function PetsListPage() {
  const [search, setSearch] = useState("");
  const [pets, setPets] = useState<PetWithOwner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPets(null);
    const handle = setTimeout(() => {
      listPetsWithOwner(search)
        .then((d) => !cancelled && setPets(d))
        .catch(() => !cancelled && setError("No se pudieron cargar las mascotas."));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search]);

  return (
    <AppShell
      title="Mascotas"
      action={
        <Button asChild size="icon" variant="ghost" className="h-10 w-10" title="Nueva mascota">
          <Link to="/pets/new">
            <Plus />
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por mascota o dueño"
            className="h-11 pl-9"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {pets === null ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : pets.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <ul className="space-y-2">
            {pets.map((p) => (
              <li key={p.id}>
                <Link to="/pets/$petId" params={{ petId: p.id }}>
                  <Card className="flex min-h-11 items-center gap-3 p-3 transition-colors hover:border-foreground/30">
                    <PetAvatar name={p.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.owner?.full_name ?? "Sin dueño"} ·{" "}
                        {p.breed ?? "Sin raza"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ search }: { search: string }) {
  if (search) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Ninguna mascota coincide con “{search}”.
      </Card>
    );
  }
  return (
    <Card className="space-y-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">Todavía no hay mascotas registradas.</p>
      <Button asChild className="h-11">
        <Link to="/pets/new">
          <Plus /> Crear primera mascota
        </Link>
      </Button>
    </Card>
  );
}
