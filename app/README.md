# Veridian Digital Twin Prototype

Veridian is a speculative React prototype for explaining a future-facing idea: nanobot-style telemetry scans a body, forms a digital twin, detects a fictional disease pattern, and lets a user fake-test chemical combinations on the twin.

This is not a real medical product. All patient states, disease names, chemicals, and outcomes are simulated for storytelling only.

## Prototype Flow

1. On page load, the 3D human body twin enters a scanning state.
2. After the scan animation, the app reveals the fictional disease: Aster-17 Cellular Drift.
3. Search for fake chemicals and add them to the selected combination shelf.
4. Drag the selected combination onto the 3D body, or use the test button.
5. The body runs a testing animation and returns pass or fail.

## Demo Pass Combination

Only this exact combination passes:

```text
NanoClear X + Immunorin B + Stabilin-7
```

Every other combination fails, including partial matches or combinations with extra chemicals.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production build.
- `npm run lint` runs Oxlint.
