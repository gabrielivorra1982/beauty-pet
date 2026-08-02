# Kiwoko Spark

Proyecto NUEVO desde cero. App de mostrador MOBILE-FIRST para una pet shop con peluqueria canina (marca "Kiwoko") que recomienda cortes a partir de una foto de la mascota analizada con IA, y fideliza al cliente con historial y gamificacion. Tienda UNICA (no multi-tenant). Solo el equipo de la tienda usa la app con cuenta; el cliente final NO tiene cuenta. Idioma de TODA la UI: espanol, claro y sin tecnicismos.

Stack OBLIGATORIO: TanStack Start con file-based routing, TypeScript estricto, Tailwind + shadcn/ui, y Supabase (Postgres + Auth + Storage). Mobile-first de verdad: estilos base para viewport estrecho y escalado hacia tablet con breakpoints; objetivos tactiles grandes (minimo 44px); respeta safe-area insets.

IMPORTANTE: esto es la FASE 1 (Fundacion) de un proyecto faseado. Construye SOLO lo del alcance y respeta el "QUE NO TOCAR". No te adelantes a fases futuras.

ALCANCE DE ESTA FASE. Construye SOLO estas cinco cosas:
1. Sistema de diseno / tokens centralizados (mobile-first).
2. Modelo de datos completo como migracion SQL en Supabase (TODAS las entidades, aunque sus pantallas vengan en fases posteriores).
3. Bucket de Supabase Storage para las fotos de mascotas/visitas (privado).
4. Datos seed minimos de demo.
5. Una ruta /_debug minima que verifique lectura/escritura contra Supabase.

QUE NO TOCAR (fuera de alcance, NO lo construyas en esta fase):
- Nada de UI de negocio (ni fichas, ni panel, ni historial, ni gamificacion visible).
- Nada de login/registro ni pantallas de auth (Fase 2). Define la tabla de perfiles pero NO conectes el flujo de auth ni triggers todavia.
- Nada de camara, captura de foto ni llamadas a IA (Fase 4).
- Nada de logica de puntos/recompensas (Fase 5).
- NO actives RLS todavia (Fase 6). Deja el esquema listo para RLS, pero con las tablas accesibles de momento para poder iterar.

1) TOKENS DE DISENO (valores PROVISIONALES de marca Kiwoko, pendientes de fijar con el SVG/CSS real del logo). Centralizalos en un unico origen: variables CSS en :root + extension del theme de Tailwind que las consuma. Deja un comentario visible de que son provisionales. Respeta prefers-reduced-motion.
- Colores: --bg:#FFFFFF, --surface:#FFFFFF, --surface-2:#F5F5F5, --ink:#1A1A1A, --muted:#6B7280, --border:#E5E7EB, --primary:#E2231A, --primary-hover:#C31D15, --primary-soft:#FDECEA, --success:#2E9E5B, --warning:#F5A623, --danger:#C0392B.
- Tipografia: familia unica sans-serif geometrica redondeada 'Poppins' (Google Fonts). Pesos: 700 para logo/destacados, 600 titulares, 400 cuerpo. Escala mobile-first: body 16, small 14, h3 20, h2 26, h1 32 (escala hacia arriba en breakpoints mayores).
- Radios (marca amable/redondeada): sm 8, md 12, lg 20, full 9999. Sombras: card suave y elevacion media. Espaciado base 4px (4/8/12/16/24/32/48). Motion: fast 150ms, base 220ms, slow 360ms, easing cubic-bezier(0.4,0,0.2,1).
- Objetivos tactiles minimos 44px y uso de safe-area insets en contenedores raiz.

2) MODELO DE DATOS (migracion SQL en Supabase). Crea estas tablas. Toda tabla de negocio incluye: id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(). Usa CHECK constraints para los estados. Define las foreign keys con ON DELETE CASCADE donde se indica.
- store_config (config de la tienda unica; 1 sola fila): id uuid pk, name text not null default 'Kiwoko', logo_url text, created_at, updated_at.
- profiles (equipo de la tienda; se enlazara a auth.users en Fase 2): id uuid pk references auth.users(id) on delete cascade, full_name text, role text not null default 'operador' check (role in ('admin','operador')), created_at, updated_at. NO crees el trigger de signup todavia.
- owners (duenos; datos personales): id uuid pk, full_name text not null, phone text, email text, notes text, created_at, updated_at.
- pets (mascotas): id uuid pk, owner_id uuid not null references owners(id) on delete cascade, name text not null, breed text, coat_type text not null default 'desconocido' check (coat_type in ('con_pelo','sin_pelo','desconocido')), photo_url text, notes text, points integer not null default 0, created_at, updated_at.
- visits (visitas): id uuid pk, pet_id uuid not null references pets(id) on delete cascade, staff_id uuid references profiles(id) on delete set null, visited_at timestamptz not null default now(), photo_url text, recognized_breed text, recognized_coat text check (recognized_coat in ('con_pelo','sin_pelo','desconocido')), chosen_cut_id uuid, points_awarded integer not null default 0, created_at, updated_at.
- cut_suggestions (las 4 sugerencias generadas por visita): id uuid pk, visit_id uuid not null references visits(id) on delete cascade, position integer not null check (position between 1 and 4), title text not null, description text, image_url text, is_chosen boolean not null default false, created_at. En Fase 4 las generara la IA. Anade despues la FK visits.chosen_cut_id -> cut_suggestions(id) on delete set null.
- reward_rules (hitos/recompensas configurables): id uuid pk, name text not null, description text, threshold_visits integer not null default 1, reward_text text, active boolean not null default true, created_at, updated_at.
- pet_rewards (recompensas desbloqueadas por mascota): id uuid pk, pet_id uuid not null references pets(id) on delete cascade, reward_rule_id uuid not null references reward_rules(id) on delete cascade, unlocked_at timestamptz not null default now(), created_at.
Anade indices en pets.owner_id, visits.pet_id, cut_suggestions.visit_id, pet_rewards.pet_id. Anade triggers de updated_at en las tablas que tengan esa columna.

3) STORAGE. Crea un bucket privado 'pet-photos' para fotos de mascotas y visitas. No configures acceso publico (se endurece en Fase 6); de momento dejalo accesible para iterar.

4) SEED. Inserta: la fila de store_config (Kiwoko), 2 owners, 3 pets repartidas entre ellos (con breed y coat_type variados), y 2 reward_rules (ej. "3a visita: cepillado de regalo" threshold_visits 3, y "5 visitas: 10% en peluqueria" threshold_visits 5). Sin visitas ni sugerencias todavia.

5) VERIFICACION. Crea una ruta /_debug (no enlazada en ninguna navegacion) que: liste las pets seed con su owner, y tenga un boton para crear una pet de prueba y otro para borrarla, mostrando el resultado. Sirve para confirmar lectura/escritura contra Supabase.

REQUISITOS DE CALIDAD: TypeScript estricto sin errores (tsc 0), sin warnings de lint relevantes. Capa de acceso a datos detras de funciones tipadas (repositorio o hooks), para no acoplar la UI a Supabase directamente.

AL TERMINAR, devuelve un bloque HANDOFF FASE 1 con exactamente esto:
- Hecho: que construiste realmente.
- Tablas/columnas creadas (con tipos y constraints) y bucket de Storage.
- Estado de RLS (debe estar planificada pero NO activada) y cualquier Edge Function (no deberia haber).
- Rutas/pantallas nuevas (deberia ser solo /_debug).
- Estado de build: resultado de tsc y lint.
- Supuestos tomados o cosas pendientes.
- URL de preview y pasos para probar /_debug.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pet-pro-style.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3b9dd337-fcb1-4ad4-9c64-35e9f418cfca).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
