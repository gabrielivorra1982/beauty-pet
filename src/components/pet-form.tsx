import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listOwners, type Owner, type Pet, type PetInsert } from "@/lib/repository";

interface PetFormProps {
  initial?: Partial<Pet>;
  defaultOwnerId?: string;
  submitLabel: string;
  onSubmit: (values: PetInsert) => Promise<void>;
}

export function PetForm({ initial, defaultOwnerId, submitLabel, onSubmit }: PetFormProps) {
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? defaultOwnerId ?? "");
  const [breed, setBreed] = useState(initial?.breed ?? "");
  const [coatType, setCoatType] = useState(initial?.coat_type ?? "desconocido");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOwners()
      .then((d) => !cancelled && setOwners(d))
      .catch(() => !cancelled && setError("No se pudieron cargar los dueños."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (!ownerId) return setError("Selecciona un dueño.");
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        owner_id: ownerId,
        breed: breed.trim() || null,
        coat_type: coatType,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pet_name">Nombre *</Label>
        <Input
          id="pet_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="owner_id">Dueño *</Label>
        {owners === null ? (
          <p className="text-sm text-muted-foreground">Cargando dueños…</p>
        ) : owners.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Primero crea un dueño desde la pestaña “Dueños”.
          </p>
        ) : (
          <select
            id="owner_id"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            required
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Selecciona un dueño
            </option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="breed">Raza</Label>
        <Input
          id="breed"
          value={breed ?? ""}
          onChange={(e) => setBreed(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="coat_type">Pelaje</Label>
        <select
          id="coat_type"
          value={coatType}
          onChange={(e) => setCoatType(e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="con_pelo">Con pelo</option>
          <option value="sin_pelo">Sin pelo</option>
          <option value="desconocido">Desconocido</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pet_notes">Notas</Label>
        <Textarea
          id="pet_notes"
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting || owners?.length === 0} className="h-11 w-full">
        {submitting ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
