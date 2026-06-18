import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Gift, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth";
import {
  createRewardRule,
  deleteRewardRule,
  listRewardRules,
  setRewardRuleActive,
  updateRewardRule,
  type RewardRule,
} from "@/lib/repository";

export const Route = createFileRoute("/_authenticated/rewards")({
  component: RewardsAdminPage,
});

function RewardsAdminPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<RewardRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RewardRule | "new" | null>(null);
  const [toDelete, setToDelete] = useState<RewardRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") {
      navigate({ to: "/app" });
    }
  }, [loading, profile, navigate]);

  async function reload() {
    setError(null);
    try {
      setRules(await listRewardRules());
    } catch {
      setError("No se pudieron cargar las recompensas.");
    }
  }

  useEffect(() => {
    if (profile?.role === "admin") void reload();
  }, [profile?.role]);

  async function handleToggle(rule: RewardRule, active: boolean) {
    try {
      const updated = await setRewardRuleActive(rule.id, active);
      setRules((prev) => (prev ?? []).map((r) => (r.id === rule.id ? updated : r)));
    } catch {
      setError("No se pudo cambiar el estado.");
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteRewardRule(toDelete.id);
      setRules((prev) => (prev ?? []).filter((r) => r.id !== toDelete.id));
      setToDelete(null);
    } catch {
      setError("No se pudo borrar la recompensa.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !profile) {
    return (
      <AppShell title="Recompensas" back={{ to: "/app" }}>
        <Skeleton className="h-24 w-full" />
      </AppShell>
    );
  }
  if (profile.role !== "admin") return null;

  return (
    <AppShell
      title="Recompensas"
      back={{ to: "/app" }}
      action={
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          title="Nueva recompensa"
          onClick={() => setEditing("new")}
        >
          <Plus />
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {rules === null ? (
          <Skeleton className="h-24 w-full" />
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <Gift className="mx-auto size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay recompensas. Crea la primera.
              </p>
              <Button onClick={() => setEditing("new")} className="h-11">
                <Plus /> Nueva recompensa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {rules.map((r) => (
              <li key={r.id}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          {r.threshold_visits} sellos
                        </p>
                        <p className="truncate text-base font-medium">{r.name}</p>
                        {r.reward_text ? (
                          <p className="text-sm text-muted-foreground">{r.reward_text}</p>
                        ) : null}
                        {r.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Switch
                          checked={r.active}
                          onCheckedChange={(c) => void handleToggle(r, c)}
                          aria-label="Activa"
                        />
                        <span className="text-xs text-muted-foreground">
                          {r.active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        onClick={() => setEditing(r)}
                      >
                        <Pencil /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 text-destructive hover:text-destructive"
                        onClick={() => setToDelete(r)}
                      >
                        <Trash2 /> Borrar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing !== null ? (
        <RewardEditor
          rule={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRules((prev) => {
              const list = prev ?? [];
              const exists = list.some((r) => r.id === saved.id);
              const next = exists ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved];
              return next.sort((a, b) => a.threshold_visits - b.threshold_visits);
            });
            setEditing(null);
          }}
        />
      ) : null}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar recompensa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.name}". Las recompensas ya conseguidas por las mascotas se
              mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Borrando…" : "Borrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function RewardEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule: RewardRule | null;
  onClose: () => void;
  onSaved: (r: RewardRule) => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [threshold, setThreshold] = useState(String(rule?.threshold_visits ?? 3));
  const [rewardText, setRewardText] = useState(rule?.reward_text ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    const th = parseInt(threshold, 10);
    if (!trimmed) return setFormError("El nombre es obligatorio.");
    if (!Number.isFinite(th) || th < 1) return setFormError("El umbral debe ser un número ≥ 1.");
    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        threshold_visits: th,
        reward_text: rewardText.trim() || null,
        description: description.trim() || null,
        active,
      };
      const saved = rule
        ? await updateRewardRule(rule.id, payload)
        : await createRewardRule(payload);
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Editar recompensa" : "Nueva recompensa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="r-name">Nombre</Label>
            <Input
              id="r-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-threshold">Umbral (sellos)</Label>
            <Input
              id="r-threshold"
              type="number"
              min={1}
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-reward">Texto de la recompensa</Label>
            <Input
              id="r-reward"
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              placeholder="Ej. Baño gratis"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-desc">Descripción</Label>
            <Textarea
              id="r-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="r-active">Activa</Label>
            <Switch id="r-active" checked={active} onCheckedChange={setActive} />
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="h-11" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" /> Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
