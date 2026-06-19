import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth";
import {
  listPetsWithOwner,
  listOwners,
  createPet,
  deletePet,
  type PetWithOwner,
} from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/debug")({
  head: () => ({
    meta: [
      { title: "Debug — Kiwoko" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DebugPage,
});

function DebugPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") {
      navigate({ to: "/app" });
    }
  }, [loading, profile, navigate]);

  if (loading || !profile) {
    return <main className="p-6 text-sm text-muted-foreground">Cargando…</main>;
  }
  if (profile.role !== "admin") return null;

  return <DebugPageInner />;
}

function DebugPageInner() {
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<string>("");

  const pets = useQuery({ queryKey: ["pets"], queryFn: () => listPetsWithOwner() });
  const owners = useQuery({ queryKey: ["owners"], queryFn: () => listOwners() });

  const createMut = useMutation({
    mutationFn: async () => {
      const firstOwner = owners.data?.[0];
      if (!firstOwner) throw new Error("No hay dueños en la base de datos");
      return createPet({
        owner_id: firstOwner.id,
        name: `Mascota prueba ${new Date().toLocaleTimeString("es-ES")}`,
        breed: "Mestizo",
        coat_type: "desconocido",
      });
    },
    onSuccess: (p) => {
      setLastResult(`Creada mascota ${p.name} (id ${p.id.slice(0, 8)}…)`);
      qc.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (e: Error) => setLastResult(`Error al crear: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await deletePet(id);
      return id;
    },
    onSuccess: (id) => {
      setLastResult(`Borrada mascota ${id.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ["pets"] });
    },
    onError: (e: Error) => setLastResult(`Error al borrar: ${e.message}`),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 safe-top safe-bottom">
      <header className="mb-6">
        <h1>Debug Kiwoko</h1>
        <p className="text-muted mt-1 text-sm">
          Verificación de lectura/escritura contra la base de datos. No usar en
          producción.
        </p>
      </header>

      <section className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || !owners.data?.length}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {createMut.isPending ? "Creando…" : "Crear mascota de prueba"}
        </button>
        <button
          type="button"
          onClick={() => pets.refetch()}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
        >
          Recargar
        </button>
      </section>

      {lastResult && (
        <p className="mb-4 rounded-md bg-primary-soft px-3 py-2 text-sm text-ink">
          {lastResult}
        </p>
      )}

      <section className="space-y-3">
        <h2>Mascotas ({pets.data?.length ?? 0})</h2>
        {pets.isLoading && <p className="text-muted text-sm">Cargando…</p>}
        {pets.error && (
          <p className="text-sm text-danger">
            Error: {(pets.error as Error).message}
          </p>
        )}
        <ul className="space-y-2">
          {pets.data?.map((p: PetWithOwner) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 shadow-card"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{p.name}</p>
                <p className="text-muted truncate text-sm">
                  {p.breed ?? "Sin raza"} · {p.coat_type} · Dueño:{" "}
                  {p.owner?.full_name ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteMut.mutate(p.id)}
                disabled={deleteMut.isPending}
                className="ml-3 rounded-md border border-border px-3 py-2 text-sm text-danger hover:bg-surface-2 disabled:opacity-50"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
