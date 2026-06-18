import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, RefreshCw, Check, Loader2, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth";
import {
  createVisitWithSuggestions,
  getPetWithOwner,
  uploadPetPhoto,
  type PetWithOwner,
} from "@/lib/repository";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pets/$petId/visit")({
  component: NewVisitPage,
});

type Coat = "con_pelo" | "sin_pelo" | "desconocido";
type Suggestion = { title: string; description: string };
type AnalyzeResult = { breed: string; coat: Coat; suggestions: Suggestion[] };

type ImageState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

function NewVisitPage() {
  const { petId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pet, setPet] = useState<PetWithOwner | null | undefined>(undefined);

  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [images, setImages] = useState<ImageState[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPetWithOwner(petId).then((p) => !cancelled && setPet(p));
    return () => {
      cancelled = true;
    };
  }, [petId]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handleFile(file: File | null | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado no es una imagen.");
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
    setImages([]);
    setChosen(null);
    setPhotoUrl(null);
  }

  async function startAnalysis() {
    if (!photoFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const { signedUrl } = await uploadPetPhoto(petId, photoFile);
      setPhotoUrl(signedUrl);

      const { data, error: fnErr } = await supabase.functions.invoke<AnalyzeResult>("analyze-pet", {
        body: { image_url: signedUrl },
      });
      if (fnErr || !data) {
        throw new Error(fnErr?.message ?? "No se pudo analizar la foto.");
      }
      setAnalysis(data);
      setImages(data.suggestions.map(() => ({ status: "loading" as const })));
      // Disparar las 4 imágenes en paralelo, pasando la URL original recién firmada.
      data.suggestions.forEach((s, idx) => {
        void generateImage(idx, s, data.breed, data.coat, signedUrl);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateImage(
    idx: number,
    s: Suggestion,
    breed: string,
    coat: Coat,
    originalUrl: string | null,
  ) {
    setImages((prev) => {
      const next = [...prev];
      next[idx] = { status: "loading" };
      return next;
    });
    try {
      const { data, error: fnErr } = await supabase.functions.invoke<{ image_url: string }>(
        "generate-cut-image",
        {
          body: {
            pet_id: petId,
            title: s.title,
            description: s.description,
            breed,
            coat,
            image_url: originalUrl ?? undefined,
          },
        },
      );
      if (fnErr || !data?.image_url) {
        throw new Error(fnErr?.message ?? "Error generando imagen.");
      }
      setImages((prev) => {
        const next = [...prev];
        next[idx] = { status: "ready", url: data.image_url };
        return next;
      });
    } catch (e) {
      setImages((prev) => {
        const next = [...prev];
        next[idx] = {
          status: "error",
          message: e instanceof Error ? e.message : "Error generando imagen.",
        };
        return next;
      });
    }
  }


  async function confirmVisit() {
    if (!analysis || chosen === null) return;
    setSaving(true);
    setError(null);
    try {
      await createVisitWithSuggestions({
        pet_id: petId,
        staff_id: user?.id ?? null,
        photo_url: photoUrl,
        recognized_breed: analysis.breed,
        recognized_coat: analysis.coat,
        suggestions: analysis.suggestions.map((s, idx) => {
          const img = images[idx];
          return {
            position: idx + 1,
            title: s.title,
            description: s.description,
            image_url: img && img.status === "ready" ? img.url : null,
            is_chosen: idx === chosen,
          };
        }),
      });
      navigate({ to: "/pets/$petId", params: { petId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la visita.");
      setSaving(false);
    }
  }

  if (pet === undefined) {
    return (
      <AppShell title="Nueva visita" back={{ to: "/pets/$petId" }}>
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }
  if (pet === null) {
    return (
      <AppShell title="Nueva visita" back={{ to: "/pets" }}>
        <p className="text-sm text-muted-foreground">No se encontró esta mascota.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Nueva visita" back={{ to: "/pets/$petId" }}>
      <div className="space-y-5">
        <section>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Mascota</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{pet.name}</h2>
          {pet.owner ? (
            <p className="text-sm text-muted-foreground">{pet.owner.full_name}</p>
          ) : null}
        </section>

        {/* 1. CAPTURA */}
        <Card>
          <CardContent className="space-y-3 p-4">
            {photoPreview ? (
              <div className="overflow-hidden rounded-md border border-border bg-muted">
                <img
                  src={photoPreview}
                  alt="Foto de la mascota"
                  className="block aspect-square w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border bg-muted text-sm text-muted-foreground">
                Sin foto todavía
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            {!analysis ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-12"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={analyzing}
                >
                  <Camera /> Hacer foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={analyzing}
                >
                  <ImageIcon /> Galería
                </Button>
              </div>
            ) : null}

            {photoFile && !analysis ? (
              <Button
                type="button"
                className="h-12 w-full"
                onClick={startAnalysis}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="animate-spin motion-reduce:animate-none" /> Analizando…
                  </>
                ) : (
                  "Analizar con IA"
                )}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {error ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        ) : null}

        {/* 2. RECONOCIMIENTO */}
        {analysis ? (
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Reconocido</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-muted px-2 py-1 text-sm">
                {analysis.breed}
              </span>
              <span className="rounded-md border border-border bg-muted px-2 py-1 text-sm">
                {labelCoat(analysis.coat)}
              </span>
            </div>
          </section>
        ) : null}

        {/* 3. SUGERENCIAS */}
        {analysis ? (
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Sugerencias de corte
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {analysis.suggestions.map((s, idx) => {
                const img = images[idx];
                const isChosen = chosen === idx;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => setChosen(idx)}
                      className={cn(
                        "block w-full overflow-hidden rounded-lg border bg-background text-left transition-colors",
                        isChosen
                          ? "border-foreground ring-2 ring-foreground/10"
                          : "border-border hover:border-border",
                      )}
                    >
                      <div className="relative aspect-square w-full bg-muted">
                        {img?.status === "ready" ? (
                          <img
                            src={img.url}
                            alt={s.title}
                            className="block h-full w-full object-cover"
                          />
                        ) : img?.status === "error" ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground">
                            <AlertCircle className="size-5" />
                            <span>No se pudo generar.</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                void generateImage(idx, s, analysis.breed, analysis.coat, photoUrl);
                              }}
                            >
                              <RefreshCw /> Reintentar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
                          </div>
                        )}
                        {isChosen ? (
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-xs text-primary-foreground">
                            <Check className="size-3" /> Elegido
                          </span>
                        ) : null}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium">{s.title}</p>
                        {s.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {s.description}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* 4. CONFIRMAR */}
        {analysis ? (
          <div className="sticky bottom-20 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            <div className="flex gap-2">
              <Button asChild variant="outline" className="h-12 flex-1">
                <Link to="/pets/$petId" params={{ petId }}>
                  Cancelar
                </Link>
              </Button>
              <Button
                type="button"
                className="h-12 flex-1"
                onClick={confirmVisit}
                disabled={chosen === null || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin motion-reduce:animate-none" /> Guardando…
                  </>
                ) : (
                  "Registrar visita"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function labelCoat(c: Coat) {
  if (c === "con_pelo") return "Con pelo";
  if (c === "sin_pelo") return "Sin pelo";
  return "Pelaje desconocido";
}
