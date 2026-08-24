# Express example

A tiny Express server that verifies an incoming Tolt webhook with `@tolt/webhooks` and reacts to the typed event. Open `src/server.ts` in your editor and hover `event.data` inside each `case`, it narrows to the resource for that event.

## Run it

```bash
bun install
bun start
```

The example depends on the package next to it (`file:../..`), so build the package once first if you haven't:

```bash
cd ../.. && bun run build
```

## See the types

```bash
bun run typecheck
```

That runs `tsc --noEmit` against `src/server.ts`. Change `event.data.amount` to a field that doesn't exist on that resource and it'll fail, which is the point: the event is fully typed.

## Send it a test request

With the server running, a raw POST without a valid signature returns `400` (verification working):

```bash
curl -i -X POST http://localhost:3000/webhooks/tolt \
  -H "Content-Type: application/json" \
  -d '{"type":"commission.created","data":{"id":"com_1"},"timestamp":"2026-08-24T14:25:41.000Z"}'
```
