# INDTEC LABZ / DRUMS

> A deliberately small browser-based drum practice experiment: import MusicXML, render the score, select a practice range and keep the timing engine independent from the notation renderer.

`STATUS / EXPERIMENTAL` · `React` · `TypeScript` · `MusicXML` · `OpenSheetMusicDisplay` · `Vite`

## The problem

Drum play-along videos are useful, but they are passive. This lab explores a practice workflow where the score is interactive: a musician imports a chart, selects the measures that need work and loops only that section.

The first version intentionally stops before MIDI input. It proves the score/timeline boundary first so MIDI can later become another input to the practice engine instead of leaking into UI components.

## Current vertical slice

```text
MusicXML file
     │
     ├──────────────→ OpenSheetMusicDisplay → score
     │
     └──────────────→ MusicXmlParser → Chart
                                      │
                                      ↓
                              Practice Timeline
                                      │
                                      ↓
                                Practice Loop
```

Today the POC supports:

- MusicXML import in the browser;
- score rendering through OpenSheetMusicDisplay;
- extraction of title, tempo, time signature and measures into a small internal `Chart` model;
- play/pause/restart timeline simulation;
- measure selection for a repeating practice loop;
- renderer and practice state kept independent.

## Domain

```text
Chart
├── title
├── bpm
├── time signature
├── Measure[]
└── total beats

PracticeLoop
├── start measure
└── end measure
```

`Chart` is intentionally not an OSMD model. MusicXML is an input format and OSMD is a rendering dependency; neither should become the application's domain.

## Engineering decisions

### Why parse MusicXML twice?

OSMD receives the original MusicXML because engraving music notation is already a solved problem. A deliberately small parser extracts only the information the practice engine needs.

```text
                    ┌─→ OSMD → visual notation
MusicXML ───────────┤
                    └─→ parser → Chart → practice logic
```

This prevents scoring, loops and future MIDI matching from depending on the internals of the notation renderer.

### Why no backend yet?

Nothing in this slice requires one. File import, rendering and practice timing are local concerns. A backend earns its place when sessions, progress, analytics, shared charts or post-processing exist.

### Why no MIDI yet?

MIDI is the next meaningful boundary, but adding it before the score/timeline model exists would mix device input with rendering concerns. The intended next flow is:

```text
Web MIDI ───────┐
                ↓
Chart ───→ Timing / Matching Engine ───→ Session Result
                ↑
Practice Clock ─┘
```

## Run locally

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
```

## Roadmap

```text
MusicXML import + score
→ timeline + loop
→ Web MIDI device mapping
→ expected hit vs played hit
→ timing windows (perfect / early / late / miss)
→ practice speed control
→ session summary / backend analytics
```

The important constraint remains the same as the other INDTEC LABZ experiments: patterns and infrastructure are introduced when a requirement gives them a reason to exist.

---

**INDTEC LABZ** is a portfolio engineering series. Each repository keeps the problem small enough that the technical decisions remain visible.