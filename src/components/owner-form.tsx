import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Owner, OwnerInsert } from "@/lib/repository";

interface OwnerFormProps {
  initial?: Partial<Owner>;
  submitLabel: string;
  onSubmit: (values: OwnerInsert) => Promise<void>;
}

export function OwnerForm({ initial, submitLabel, onSubmit }: OwnerFormProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("El email no parece válido.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
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
        <Label htmlFor="full_name">Nombre *</Label>
        <Input
          id="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="h-11"
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          value={phone ?? ""}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          value={email ?? ""}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
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

      <Button type="submit" disabled={submitting} className="h-11 w-full">
        {submitting ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
