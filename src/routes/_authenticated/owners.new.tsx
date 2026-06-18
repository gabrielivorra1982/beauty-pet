import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { OwnerForm } from "@/components/owner-form";
import { createOwner } from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/owners/new")({
  component: NewOwnerPage,
});

function NewOwnerPage() {
  const navigate = useNavigate();
  return (
    <AppShell title="Nuevo dueño" back={{ to: "/owners" }}>
      <OwnerForm
        submitLabel="Crear dueño"
        onSubmit={async (values) => {
          const created = await createOwner(values);
          navigate({ to: "/owners/$ownerId", params: { ownerId: created.id } });
        }}
      />
    </AppShell>
  );
}
