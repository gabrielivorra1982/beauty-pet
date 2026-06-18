import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, PawPrint, Users, LogOut, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppShellProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  back?: { to: string; label?: string };
}

export function AppShell({ title, children, action, back }: AppShellProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  const isActive = (prefix: string) =>
    prefix === "/app" ? pathname === "/app" : pathname.startsWith(prefix);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          {back ? (
            <Button asChild variant="ghost" size="sm" className="h-9 -ml-2">
              <Link to={back.to}>{back.label ?? "Volver"}</Link>
            </Button>
          ) : (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Kiwoko
            </span>
          )}
          <h1 className="ml-auto text-base font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-1">
            {action}
            {profile?.role === "admin" ? (
              <Button asChild variant="ghost" size="icon" className="h-10 w-10" title="Equipo">
                <Link to="/staff">
                  <UsersRound />
                </Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleSignOut}
              title="Cerrar sesión"
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-16 w-full max-w-2xl grid-cols-3">
          <TabLink to="/app" label="Inicio" active={isActive("/app")} icon={<Home />} />
          <TabLink to="/pets" label="Mascotas" active={isActive("/pets")} icon={<PawPrint />} />
          <TabLink to="/owners" label="Dueños" active={isActive("/owners")} icon={<Users />} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  label,
  active,
  icon,
}: {
  to: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="[&_svg]:size-5">{icon}</span>
      <span className={cn(active && "font-medium")}>{label}</span>
    </Link>
  );
}
