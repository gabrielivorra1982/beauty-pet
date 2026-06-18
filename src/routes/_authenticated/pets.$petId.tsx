import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pets/$petId")({
  component: PetLayout,
});

function PetLayout() {
  return <Outlet />;
}
