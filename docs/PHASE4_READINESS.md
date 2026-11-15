# IGNIS Atlas — FireTruth Phase 4 Readiness

Phase 4 introduces a guided scientific story, a shared visual/accessibility foundation,
and view-level code splitting without changing the verified scientific artifacts.

## Design system

- **Palette:** midnight navy surfaces, neutral text, cyan observational accents,
  ember-orange warnings and emerald evidence states.
- **Typography:** display headings use the existing display stack; measurements and
  provenance use the existing monospace stack.
- **Spacing:** shared 4/8/12/16/24/32 px tokens are defined in `src/index.css`.
- **Interaction:** visible `:focus-visible` rings, 24 px-plus control targets,
  reduced-motion support, and mobile layouts at 300, 390, 768 and 1440 px widths.
- **Scientific language:** observational mode identifies active-fire detections and
  cell-days; VIIRS is a comparison sensor, never ground truth.

## Guided story

The `Guided Story` entry point presents six chapters:

1. Observation problem
2. Sensor disagreement
3. Harmonization
4. External context
5. Cross-region transfer
6. Verified findings and limitations

Each chapter links to the complete research view. The ten existing research views
remain directly available through the primary navigation.

## Performance measurement

The pre-Phase-4 production entry chunk was approximately **680 KB minified /
204 KB gzip**. After view-level dynamic imports, the production entry chunk is
approximately **352 KB minified / 119 KB gzip**. Research views and Leaflet are
loaded in separate chunks.

These are local Vite build measurements, not production-network or Core Web Vitals
measurements. No claim is made about LCP or transferred bytes on a deployed network.
The remaining build output includes a separately loaded Leaflet chunk.

## Static deployment readiness

- Vite output directory: `dist/`
- Public scientific artifacts load from `/data/`
- No runtime dependency on ignored NASA raw files
- No server-side credentials required
- No API key is bundled
- Direct client-side navigation should be served with the host's SPA fallback
- No Vercel deployment or custom domain is configured by this change

## Scientific release gate

Phase 4 must preserve:

- California MODIS/VIIRS observational artifacts and CAL FIRE context
- Pacific Northwest 60-month transfer artifact
- Training/holdout separation and zero-shot failure evidence
- Explicit `NOT_EVALUATED`, `INSUFFICIENT_EVIDENCE`, and limited-coverage states
- The distinction between active cell-days, fires, burned area, and ground truth

The previously exposed NASA FIRMS MAP_KEY remains a credential-management issue
outside the repository; its revocation requires independent NASA confirmation.
