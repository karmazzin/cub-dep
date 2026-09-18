# Pets Design

## Goal

Add a lightweight named-pet carrier to the existing 3D game without changing wild mob spawning or combat.

## Player flow

- A `Создать питомца` button is visible in the upper-left corner while playing.
- The pet window creates a cat, dog, capybara, or parrot. A non-empty name is required.
- The carrier is unlimited, but no more than five pets may be active in the world at once.
- An inactive pet has a `Продолжить играть с питомцем <name>` action. Active pets are marked as playing with the player.
- Left-clicking an aimed pet hides it temporarily in the carrier. The pet window also provides an `Убрать <имя> в Переноску` action for every active pet.
- A short right-click opens the pet mode chooser: follow, wait, or walk nearby.
- The aimed pet's name is shown in the HUD.

## Parrot recording

- Holding right-click on an aimed parrot for one second starts microphone recording.
- The button may be released after recording starts; recording continues with no artificial duration limit.
- A microphone marker is shown under the parrot while recording.
- A later short right-click on the same parrot stops recording and immediately plays it once.
- The recording is discarded after playback and is never written to world saves.
- Hiding the parrot, leaving the world, or losing microphone access cancels an unfinished recording.

## State and saving

The pet carrier is stored in `worldMeta.pets`. Each record stores a stable id, type, name, active flag, mode, position, yaw, and wandering anchor/timers where useful. Transient browser microphone objects and recorded audio are module runtime state only. Existing world-meta manual saving and autosaving persist the carrier.

## Architecture

`src/3d/pets3d.js` owns normalization, carrier commands, pet AI, aiming, interaction timing, microphone capture, and the DOM pet window. `state3d.js` restores the carrier, `main3d.js` initializes and updates it, and `renderer3d.js` renders separate expressive pet meshes and transient markers. Wild mobs remain in `state.entities.sheep` and pets live in `state.entities.pets`.

## Visual direction

Models remain voxel-shaped but use larger heads, bright eyes with pupils, readable ears, tails, beaks, and species-specific silhouettes. Idle and movement animation use small head, tail, wing, and body motions. Cat, dog, capybara, and parrot must not be recolors of one shared silhouette.

## Verification

Automated smoke coverage checks carrier behavior, validation, active limits, hiding/resuming, and modes. Syntax checks cover every changed JavaScript file. Final visual and microphone behavior require gameplay verification by the user in a browser because the project has no browser automation suite.
