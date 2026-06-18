import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Trash2, StickyNote, User as UserIcon, Sparkles, Camera } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PetAvatar } from "@/components/pet-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deletePet,
  getPetWithOwner,
  listVisitsByPet,
  type PetWithOwner,
  type VisitWithChosen,
} from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/pets/$petId")({
  component: PetDetailPage,
});

function PetDetailPage() {
  const { petId } = Route.useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState<PetWithOwner | null | undefined>(undefined);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPetWithOwner(petId), listVisitsByPet(petId)])
      .then(([p, v]) => {
        if (cancelled) return;
        setPet(p);
        setVisits(v);
      })
      .catch(() => !cancelled && setError("No se pudo cargar la ficha."));
    return () => {
      cancelled = true;
    };
  }, [petId]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deletePet(petId);
      navigate({ to: "/pets" });
    } catch {
      setError("No se pudo borrar la mascota.");
      setDeleting(false);
    }
  }

  if (pet === undefined) {
    return (
      <AppShell title="Mascota" back={{ to: "/pets" }}>
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }
  if (pet === null) {
    return (
      <AppShell title="Mascota" back={{ to: "/pets" }}>
        <p className="text-sm text-muted-foreground">No se encontró esta mascota.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Mascota"
      back={{ to: "/pets" }}
      action={
        <Button asChild size="icon" variant="ghost" className="h-10 w-10" title="Editar">
          <Link to="/pets/$petId/edit" params={{ petId }}>
            <Pencil />
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <PetAvatar name={pet.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {pet.breed ?? "Sin raza"}
              </p>
              <h2 className="truncate text-xl font-semibold tracking-tight">{pet.name}</h2>
              <p className="text-sm text-muted-foreground">{labelCoat(pet.coat_type)}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Puntos</span>
              <span className="inline-flex items-center gap-1 text-xl font-semibold tracking-tight">
                <Sparkles className="size-4" /> {pet.points}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dueño</CardTitle>
          </CardHeader>
          <CardContent>
            {pet.owner ? (
              <Link
                to="/owners/$ownerId"
                params={{ ownerId: pet.owner.id }}
                className="flex min-h-11 items-center gap-3"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserIcon className="size-4" />
                </span>
                <span className="text-sm font-medium underline-offset-2 hover:underline">
                  {pet.owner.full_name}
                </span>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Sin dueño asignado.</p>
            )}
          </CardContent>
        </Card>

        {pet.notes ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="size-4" /> Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{pet.notes}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de visitas</CardTitle>
          </CardHeader>
          <CardContent>
            {visits === null ? (
              <Skeleton className="h-10 w-full" />
            ) : visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin visitas todavía.</p>
            ) : (
              <ul className="divide-y divide-border">
                {visits.map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    {new Date(v.visited_at).toLocaleDateString("es-ES")}
                    {v.recognized_breed ? ` · ${v.recognized_breed}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="h-11 w-full text-destructive hover:text-destructive">
              <Trash2 /> Borrar mascota
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar a {pet.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará la mascota y su historial.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Borrando…" : "Borrar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

function labelCoat(c: string) {
  if (c === "con_pelo") return "Con pelo";
  if (c === "sin_pelo") return "Sin pelo";
  return "Pelaje desconocido";
}
