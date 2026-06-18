import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { AppShell } from "@/components/app-shell";
import { PetForm } from "@/components/pet-form";
import { createPet } from "@/lib/repository";

const searchSchema = z.object({
  ownerId: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/pets/new")({
  validateSearch: zodValidator(searchSchema),
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
