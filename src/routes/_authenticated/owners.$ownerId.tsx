import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owners/$ownerId")({
  component: OwnerLayout,
});

function OwnerLayout() {
  return <Outlet />;
}
