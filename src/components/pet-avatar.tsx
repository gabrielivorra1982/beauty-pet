import { PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

export function PetAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "";
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : "h-11 w-11 text-base";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
        dims,
      )}
      aria-hidden
    >
      {initial || <PawPrint className="size-5" />}
    </div>
  );
}
