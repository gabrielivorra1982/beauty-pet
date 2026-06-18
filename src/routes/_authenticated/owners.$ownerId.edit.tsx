import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { OwnerForm } from "@/components/owner-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getOwner, updateOwner, type Owner } from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/owners/$ownerId/edit")({
  component: EditOwnerPage,
});

function EditOwnerPage() {
  const { ownerId } = Route.useParams();
  const navigate = useNavigate();
  const [owner, setOwner] = useState<Owner | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getOwner(ownerId).then((o) => !cancelled && setOwner(o));
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  return (
    <AppShell title="Editar dueño" back={{ to: "/owners/$ownerId", label: "Volver" }}>
      {owner === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : owner === null ? (
        <p className="text-sm text-muted-foreground">No se encontró este dueño.</p>
      ) : (
        <OwnerForm
          initial={owner}
          submitLabel="Guardar cambios"
          onSubmit={async (values) => {
            await updateOwner(ownerId, values);
            navigate({ to: "/owners/$ownerId", params: { ownerId } });
          }}
        />
      )}
    </AppShell>
  );
}
