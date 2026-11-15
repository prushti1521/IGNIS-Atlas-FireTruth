# IGNIS Atlas — FireTruth Windsor 2026 Submission Readiness

**Prepared:** 2026-11-15  
**Repository:** `prushti1521/IGNIS-Atlas-FireTruth`  
**Verified release checkpoint:** `5cbf5ad2a7c26a6d80093dc22c1c15dbd6a1c6f9`  
**Submission deadline supplied by organizers:** 2026-11-15 at 11:59 PM EST

## Eligibility disclosure

The repository history contains development before the orientation rule quoted
in the submission brief. The initial release is timestamped 2026-10-29, and
additional commits exist on 2026-11-14 before the stated 2026-11-14 09:00
local-time threshold. This history is preserved and has not been rewritten,
deleted, or concealed.

The project is **not represented as eligible**. Organizers must clarify whether
the rule applies to this repository, the current team, a particular challenge
entry, or another definition of project development. See
[ELIGIBILITY_TIMELINE.md](./ELIGIBILITY_TIMELINE.md).

## A. Five-criterion judging evidence matrix

| Criterion | Evidence judges can inspect | Honest claim | Limitation |
|---|---|---|---|
| Impact | Guided Story, Overview, Evidence Resolver | Makes sensor discontinuity and evidence quality understandable for fire analysis workflows. | Does not provide operational fire detection or burned-area estimates. |
| Creativity | Equal-area cell-day harmonization, six-gate resolver, transfer-failure lab | Combines spatial normalization, calibration, provenance, and explicit failure evidence in one interface. | The method is a research demonstrator, not a validated operational product. |
| Validity | NASA FIRMS-derived artifacts, 25 km grid, chronological holdouts, tests | Results are reproducible from documented derived artifacts and authentic local observations. | VIIRS is a comparison sensor, not ground truth; coverage completeness is not established. |
| Relevance | MODIS–VIIRS sensor transition, California and Pacific Northwest studies | Directly addresses comparing MODIS and VIIRS hot spots without treating raw counts as one series. | Results cover selected study boundaries, not global fire activity. |
| Presentation | Guided Story, ten-view navigation, transfer charts, evidence disclosures | A judge can follow the research question to measured findings in approximately three minutes. | Browser checks are practical QA, not a formal accessibility certification. |

## B. Project description

### Title

**IGNIS Atlas — FireTruth**

### Tagline

**One Planet. Multiple Fire Sensors. A Clearer View of the Evidence.**

### Short description

FireTruth is an evidence-gated NASA Earth-observation research interface that
shows why MODIS and VIIRS active-fire counts cannot be compared naively. It
aligns authentic observations on a 25 km equal-area cell-day grid, evaluates
calibration and holdout behavior, and makes regional transfer failures visible.

### Full submission description

NASA MODIS and VIIRS observe active fire at different native resolutions and
sampling characteristics. A raw count series can therefore mix physical
activity with sensor behavior. FireTruth addresses that problem by normalizing
qualified detections to UTC active cell-days on a 25 km authalic equal-area grid,
then comparing baseline and calibrated models with chronological holdouts.

The application includes authentic California MODIS/VIIRS observations,
California calibration and holdout results, a CAL FIRE 2020 perimeter context
study, and an Oregon/Washington transfer experiment. In the transfer holdout,
California-trained zero-shot B2 has RMSE 400.95 versus B0 RMSE 389.21; a
destination-local B2 reaches RMSE 132.75. This is a useful failure result:
regional calibration matters, and local agreement does not prove operational
accuracy. VIIRS is a comparison sensor, not ground truth. Active cell-days are
not individual fires, burned area, or complete occurrence.

## C. Three-minute judge walkthrough

1. **0:00–0:25 — Guided Story:** open **Guided Story**. Read the
   observation-problem chapter and scope note.
2. **0:25–0:55 — Fire Explorer:** open **2. Fire Explorer**, select a year,
   switch MODIS, VIIRS, shared, and disagreement layers, and open one
   equal-area cell. Explain that sensor-only activity does not prove a missed
   fire.
3. **0:55–1:25 — Harmonization Lab:** open **4. Harmonization Lab**. Show B0,
   B1, B2, and the training/holdout distinction. Active cell-days are the
   modeled unit, not fire counts.
4. **1:25–1:50 — Evidence Resolver:** open **6. Evidence Resolver** and expand
   calibration, observation, and independent-context gates. Missing evidence
   remains `NOT_EVALUATED` or limited.
5. **1:50–2:10 — California context:** open **9. California 2020 Case Study**.
   CAL FIRE final perimeters are external context, not complete daily labels or
   satellite ground truth.
6. **2:10–2:50 — Transfer test:** open **10. Cross-Region Transfer Lab**.
   Show zero-shot B2 RMSE **400.95**, B0 **389.21**, and local B2 **132.75**.
7. **2:50–3:00 — Dossier:** open **7. Scientific Dossier** and close with:
   “FireTruth does not claim that harmonization creates truth; it makes
   disagreement, assumptions, and failure cases inspectable.”

## D. Reproducibility checklist

- [x] California and cross-region derived artifacts are versioned.
- [x] Raw NASA and CAL FIRE downloads remain outside Git.
- [x] Source products, periods, boundaries, filters, and hashes are recorded.
- [x] 25 km equal-area projection and UTC cell-day deduplication are documented.
- [x] California and Pacific Northwest training/holdout separation is documented.
- [x] Frozen California parameters are distinguished from local parameters.
- [x] VIIRS is labeled as a comparison sensor, not ground truth.
- [x] Scientific limitations and `NOT_EVALUATED` states remain visible.
- [x] `python -m pytest` passes.
- [x] `npm test` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `git diff --check` passes.

## E. Production deployment readiness

### Ready

- Vite production output is `dist/`.
- Public derived artifacts load from `/data/`.
- The app has no runtime dependency on ignored local NASA files.
- No server-side secret is required for the browser build.
- View-level code splitting reduces the initial entry chunk to approximately
  352 KB minified / 119 KB gzip in the local build.
- Static preview has been checked at 300×532, 390×844, 768×1024, and 1440×900.

### Blockers and cautions

- Vercel has not been deployed and must not be deployed without approval.
- Configure SPA fallback behavior for direct client-side navigation.
- Verify public artifact caching and deployment-time asset paths in staging.
- Do not configure a custom domain without explicit approval.
- Previous NASA FIRMS MAP_KEY revocation remains unverified.

## F. Security and provenance

- No MAP_KEY is present in source or public assets.
- No `.env` files, raw NASA files, or raw CAL FIRE downloads are tracked.
- No authenticated NASA request is needed for the static app.
- The prior exposed key must be treated as compromised until NASA confirms
  revocation.

## G. Final submission checklist

- [ ] Organizer clarifies eligibility rule in writing.
- [ ] Team confirms final project title, members, and challenge association.
- [ ] Team reviews the factual timeline and does not claim pre-event work was
  event-period work.
- [ ] Team deploys only after explicit approval and verifies the public URL.
- [ ] Team records the final public URL and repository URL in the official form.
- [ ] Team uploads descriptions without overstating accuracy.
- [ ] Team submits before 2026-11-15 23:59 EST.

## Exact publish and submit steps

1. Obtain organizer clarification about eligibility.
2. Review and approve the current worktree diff.
3. Commit only approved documentation/UI changes.
4. Push to the intended GitHub branch; do not rewrite history.
5. Run `npm run build` and deploy `dist/` through the approved static host only
   after approval.
6. Verify the public app, direct navigation, `/data/` artifacts, mobile layout,
   and scientific disclaimer.
7. Copy the repository URL, public app URL, title, tagline, descriptions, and
   judging matrix into the official submission form.
8. Submit before the stated deadline and save the confirmation receipt.
