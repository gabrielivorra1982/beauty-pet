import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PetForm } from "@/components/pet-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getPetWithOwner, updatePet, type Pet } from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/pets/$petId/edit")({
  component: EditPetPage,
});

function EditPetPage() {
  const { petId } = Route.useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState<Pet | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getPetWithOwner(petId).then((p) => !cancelled && setPet(p));
    return () => {
      cancelled = true;
    };
  }, [petId]);

  return (
    <AppShell title="Editar mascota" back={{ to: "/pets/$petId", label: "Volver" }}>
      {pet === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : pet === null ? (
        <p className="text-sm text-muted-foreground">No se encontró esta mascota.</p>
      ) : (
        <PetForm
          initial={pet}
          submitLabel="Guardar cambios"
          onSubmit={async (values) => {
            await updatePet(petId, values);
            navigate({ to: "/pets/$petId", params: { petId } });
          }}
        />
      )}
    </AppShell>
  );
}
