# Drawing Board web app

Next.js app and API (deployed on Vercel), with its Supabase schema in
`supabase/`. The frame talks to `/api/frame/*`; see
`../docs/frame-protocol.md`.

```
app/api/frame/   state + ack routes the frame calls
lib/render/      image -> frame file (port of examples/image-dither/convert.py)
lib/frames/      board auth, check-ins, "send to frame"
lib/supabase/    clients and generated database types
scripts/         create-board, send-image, preview
supabase/        config and migrations
```

## Setup

1. `npm install`
2. `cp .env.example .env.local` and fill in the keys from the Supabase
   dashboard (Project Settings -> API Keys).
3. Apply the schema to the Supabase project (asks for the database password):

   ```sh
   npx supabase login
   npx supabase link --project-ref ofmpqffpjgvolcppeemu
   npx supabase db push
   ```

4. In the dashboard, turn on **Authentication -> Sign In / Providers ->
   Allow anonymous sign-ins** (each phone gets an anonymous session).

## Sending an image to the frame

```sh
npx tsx scripts/create-board.ts "Living room"   # once; writes the token into config.h
npx tsx scripts/send-image.ts path/to/image.jpg  # frame shows it on its next check
npx tsx scripts/preview.ts path/to/image.jpg out.png --dither atkinson  # no database
```

Flash the frame with `SERVER_BASE_URL` pointing at `npm run dev` on your Mac
(`http://<your-mac-ip>:3000`; `next dev -H 0.0.0.0` so the frame can reach it)
or at the Vercel deployment.

## Local Supabase

`npx supabase start` runs the whole stack in Docker with the migrations
applied. `npm run db:types` regenerates `lib/supabase/database.types.ts`
after a schema change.

## Checks

```sh
npm test            # render pipeline
npm run typecheck
npm run lint
```
