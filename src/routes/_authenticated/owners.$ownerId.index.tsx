import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, ChevronRight, Trash2, Mail, Phone, StickyNote, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getOwnerWithPets, type Owner, type Pet } from "@/lib/repository";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth";

export const Route = createFileRoute("/_authenticated/owners/$ownerId/")({
  component: OwnerDetailPage,
});

function OwnerDetailPage() {
  const { ownerId } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [data, setData] = useState<(Owner & { pets: Pet[] }) | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOwnerWithPets(ownerId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError("No se pudo cargar la ficha."));
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  async function handleGdprDelete() {
    setDeleting(true);
    setError(null);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("gdpr-delete-owner", {
        body: { owner_id: ownerId },
      });
      if (fnErr) throw fnErr;
      if (!res?.ok) throw new Error(res?.error ?? "No se pudo completar el borrado RGPD.");
      navigate({ to: "/owners" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo completar el borrado RGPD.";
      setError(msg);
      setDeleting(false);
    }
  }

  if (data === undefined) {
    return (
      <AppShell title="Dueño" back={{ to: "/owners" }}>
        <Skeleton className="h-32 w-full" />
      </AppShell>
    );
  }
  if (data === null) {
    return (
      <AppShell title="Dueño" back={{ to: "/owners" }}>
        <p className="text-sm text-muted-foreground">No se encontró este dueño.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dueño"
      back={{ to: "/owners" }}
      action={
        <Button asChild size="icon" variant="ghost" className="h-10 w-10" title="Editar">
          <Link to="/owners/$ownerId/edit" params={{ ownerId }}>
            <Pencil />
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</p>
              <p className="text-lg font-semibold tracking-tight">{data.full_name}</p>
            </div>
            {data.phone ? (
              <Row icon={<Phone className="size-4" />} label="Teléfono" value={data.phone} />
            ) : null}
            {data.email ? (
              <Row icon={<Mail className="size-4" />} label="Email" value={data.email} />
            ) : null}
            {data.notes ? (
              <Row icon={<StickyNote className="size-4" />} label="Notas" value={data.notes} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Mascotas ({data.pets.length})</CardTitle>
            <Button asChild size="sm" variant="ghost" className="h-9">
              <Link to="/pets/new" search={{ ownerId }}>
                <Plus /> Añadir
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.pets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este dueño aún no tiene mascotas.</p>
            ) : (
              <ul className="-mx-2 divide-y divide-border">
                {data.pets.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/pets/$petId"
                      params={{ petId: p.id }}
                      className="flex min-h-11 items-center justify-between px-2 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.breed ?? "Sin raza"} · {labelCoat(p.coat_type)}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="size-4" /> Zona RGPD
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Elimina al dueño y todos sus datos personales. Acción reservada a administradores.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="h-11 w-full text-destructive hover:text-destructive">
                    <Trash2 /> Eliminar dueño y todos sus datos (RGPD)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar a {data.full_name} y todos sus datos?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción es <strong>irreversible</strong>. Se eliminarán de forma
                      permanente: la ficha del dueño, todas sus mascotas
                      {data.pets.length > 0 ? ` (${data.pets.length})` : ""}, su historial de
                      visitas y cortes, sus recompensas y todas sus fotos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleGdprDelete}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? "Eliminando…" : "Eliminar definitivamente"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="break-words text-sm">{value}</p>
      </div>
    </div>
  );
}

function labelCoat(c: string) {
  if (c === "con_pelo") return "Con pelo";
  if (c === "sin_pelo") return "Sin pelo";
  return "Pelaje desconocido";
}
