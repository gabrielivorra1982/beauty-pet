import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PetForm } from "@/components/pet-form";
import { createPet } from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/pets/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    ownerId: typeof search.ownerId === "string" ? search.ownerId : undefined,
  }),
  component: NewPetPage,
});

function NewPetPage() {
  const navigate = useNavigate();
  const { ownerId } = Route.useSearch();
  return (
    <AppShell title="Nueva mascota" back={{ to: "/pets" }}>
      <PetForm
        defaultOwnerId={ownerId}
        submitLabel="Crear mascota"
        onSubmit={async (values) => {
          const created = await createPet(values);
          navigate({ to: "/pets/$petId", params: { petId: created.id } });
        }}
      />
    </AppShell>
  );
}
