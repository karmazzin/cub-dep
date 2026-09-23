# Animal Faces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every pet and animal mob a friendly face with shader-independent highlights, asynchronous blinking, and occasional pupil glances.

**Architecture:** A small `faces3d` IIFE owns deterministic, testable eye-animation math and per-model face dimensions. `renderer3d` builds thin face parts on each animal head and applies the shared animation state during its existing mob and pet synchronization passes.

**Tech Stack:** Browser JavaScript, Three.js, Node smoke tests.

**Spec:** `SPEC.md`, section 20.

## Global Constraints

- Keep the sequential script-loading pattern and expose APIs through `window.CubDep`.
- Add no JavaScript or CSS dependencies.
- Preserve existing public entity type ids and file structure.
- Keep the change scoped to animal faces and their animation.
- Work in the current checkout because the user explicitly asked to implement here; do not create commits unless requested.

## Review Focus

- Unknown or empty entity ids must still produce finite, deterministic animation values.
- Pupil offsets must remain inside the eye instead of exposing clipping or a wild stare.
- Different animals must not blink in lockstep.
- Sleeping bears must keep their eyes closed.
- All supported pets and animal mob types must receive a face profile.

---

### Task 1: Deterministic eye animation

**Files:**
- Create: `src/3d/faces3d.js`
- Create: `tests/animal-faces-smoke.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `Game.faces3d.getFaceAnimation3D(id, timeSeconds)` returning finite `eyeOpen`, `pupilX`, and `pupilY` values.
- Produces: `Game.faces3d.getFaceProfile3D(type)` returning copied face dimensions for each supported animal type.

- [x] **Step 1: Write the failing smoke test**

Test deterministic output, asynchronous phases, a sampled complete blink, bounded pupil motion, idle moments, and profiles for `cat`, `dog`, `capybara`, `parrot`, `sheep`, `boar`, `turtle`, `snake`, `goat`, `fish`, `fox`, and `bear`.

- [x] **Step 2: Run the test and verify RED**

Run: `node tests/animal-faces-smoke.js`

Expected: FAIL because `src/3d/faces3d.js` does not exist.

- [x] **Step 3: Implement the minimal animation module and script load**

Use a stable string hash for per-entity blink/glance phases. Clamp `eyeOpen` to `0..1` and pupil offsets to `-1..1`; return defensive copies of face profiles.

- [x] **Step 4: Run the test and verify GREEN**

Run: `node tests/animal-faces-smoke.js`

Expected: PASS with all animation and profile assertions satisfied.

### Task 2: Render and animate every animal face

**Files:**
- Modify: `src/3d/renderer3d.js`
- Modify: `SPEC.md`
- Test: `tests/animal-faces-smoke.js`

**Interfaces:**
- Consumes: `Game.faces3d.getFaceAnimation3D(id, timeSeconds)` and `Game.faces3d.getFaceProfile3D(type)`.
- Produces: `root.userData.faceEyes` containing eye assemblies whose pupils and highlights animate together.

- [x] **Step 1: Extend the failing test for renderer integration**

Load `renderer3d.js` with a minimal Three.js double, invoke its exposed face-construction test API, and assert that each supported type creates two thin eyes, two pupils, two shader-independent highlights, and a mouth where its profile requests one.

- [x] **Step 2: Run the test and verify RED**

Run: `node tests/animal-faces-smoke.js`

Expected: FAIL because the shared animal-face renderer is not exposed or used yet.

- [x] **Step 3: Implement shared face construction and animation**

Attach thin eyes to each head so head animation carries the face. Make each highlight a `MeshBasicMaterial` child of its pupil. Apply eye openness and bounded pupil offsets in `syncSheepMeshes` and `syncPetMeshes`; force sleeping eyes closed.

- [x] **Step 4: Document the behavior**

Add the implemented face behavior to `SPEC.md` section 20, including supported animals, asynchronous blinking, subtle glances, shader-independent highlights, and sleeping bear closure.

- [x] **Step 5: Run full verification**

Run: `for test_file in tests/*-smoke.js; do node "$test_file"; done`

Expected: every smoke test exits successfully.
