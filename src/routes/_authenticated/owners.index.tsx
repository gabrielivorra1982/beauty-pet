import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listOwners, type Owner } from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/owners/")({
  component: OwnersListPage,
});

function OwnersListPage() {
  const [search, setSearch] = useState("");
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOwners(null);
    const handle = setTimeout(() => {
      listOwners(search)
        .then((d) => !cancelled && setOwners(d))
        .catch(() => !cancelled && setError("No se pudieron cargar los dueños."));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search]);

  return (
    <AppShell
      title="Dueños"
      action={
        <Button asChild size="icon" variant="ghost" className="h-10 w-10" title="Nuevo dueño">
          <Link to="/owners/new">
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
            placeholder="Buscar por nombre"
            className="h-11 pl-9"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {owners === null ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : owners.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <ul className="space-y-2">
            {owners.map((o) => (
              <li key={o.id}>
                <Link to="/owners/$ownerId" params={{ ownerId: o.id }}>
                  <Card className="flex min-h-11 items-center justify-between p-4 transition-colors hover:border-foreground/30">
                    <div>
                      <p className="text-sm font-medium">{o.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.phone ?? o.email ?? "Sin contacto"}
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
        Ningún dueño coincide con “{search}”.
      </Card>
    );
  }
  return (
    <Card className="space-y-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">Todavía no hay dueños registrados.</p>
      <Button asChild className="h-11">
        <Link to="/owners/new">
          <Plus /> Crear primer dueño
        </Link>
      </Button>
    </Card>
  );
}
