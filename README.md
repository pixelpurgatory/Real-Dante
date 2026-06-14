# DANTE: The Descent

A short, hand-crafted dark-fantasy action-platformer in the spirit of *Hollow Knight*,
set at the threshold of Dante's *Inferno*. You play Dante, chasing the spirit of his
beloved Beatrice out of a moonlit Italian village, down a ruined Greek road, past the
Gates of Hell — guarded by **Asterion, the Infernal Bull** (the Minotaur) — and into the
grey hush of Limbo, the First Circle.

Everything (art, animation, music, SFX) is generated procedurally in code — no external
asset downloads, so it loads instantly, runs offline, and holds a steady 60 fps on a
modern laptop.

## Play

Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari). No build step,
no server required. Click or press a key once to enable sound.

### Controls (keyboard + mouse)

| Action            | Keys                                   |
|-------------------|----------------------------------------|
| Move              | `A` / `D` or `←` / `→`                  |
| Jump (hold higher)| `Space` (or `Z`)                        |
| Drop through ledge| `S` + `Space` on a thin platform        |
| Strike            | `J` / `X` / **Left Click**              |
| Up / Down strike  | `W` + strike  ·  `S` + strike (in air)  |
| Dash (i-frames)   | `Shift` / `C` / `K`                     |
| Focus / Heal      | hold `F` (on the ground, costs SOUL)    |
| Pause             | `P` / `Esc`                             |
| Mute              | `M`                                     |

### Mobile (phone / tablet)

Works in the mobile browser on iOS and Android (Chrome, Brave, Safari). On-screen
touch controls appear automatically the first time you touch the screen (desktop
stays mouse + keyboard, untouched): a movement pad, Jump / Strike / Dash / Heal
buttons (hold Strike to auto-attack), and pause + fullscreen buttons. Up/Down on
the pad aim the up- and down-strikes.

- **Landscape** fills the whole screen at the device's aspect ratio — no black
  bars — and requests true fullscreen (hides browser chrome on Android).
- **Portrait** is fully playable too: the game shows in a band at the top with
  the controls in a comfortable thumb area below (a hint suggests rotating for a
  larger view).
- The view re-fits cleanly on rotation, the screen is kept awake during play,
  and internal render resolution is capped for a steady 60 fps.
- Tap anywhere on a menu to start or to descend again.

For an app-like, chrome-free experience on iPhone (where Safari can't hide its
bars via script), use **Share → Add to Home Screen** and launch from the icon.

## Combat depth

- **SOUL economy** — landing hits fills the orb (top-left); hold `F` to spend it and mend
  a mask of health, just like Hollow Knight's Focus. Healing roots you in place, so make
  the opening.
- **Down-strike pogo** — strike downward in the air to bounce off enemies, spikes and the
  boss. The big spike pit in the descent is crossed this way off a floating spirit.
- **Enemy variety**
  - *Shades* — drifting souls that lunge.
  - *Harpies* — patrol the air, hover-telegraph, then dive.
  - *Hoplite skeletons* — **shielded**: frontal level strikes are blocked, so go over,
    behind, or punish the spear-thrust recovery.
  - *Hellhounds* — crouch-telegraph, then charge; sidestep and hit the recovery.
  - *Wraiths* — phase out and reappear flanking you before charging.
  - *Weepers* — Limbo mourners that fire slow homing tear-orbs you can slash apart.
- **Boss — Asterion** has a telegraphed move set (ground-shaking charge that leaves him
  stunned and double-damage-vulnerable when he hits the wall, an overhead axe cleave, and
  in phase two a leaping double shockwave). Read the tells, punish the openings.

## Structure

```
index.html        entry point, loads scripts in order
js/core.js        constants, math, input, fixed-timestep helpers
js/audio.js       procedural SFX + generative per-zone music
js/level.js       geometry, hazards, spawns, palettes, dialogue triggers
js/background.js  pre-baked parallax layers, sky, water, fog, particles
js/actors.js      particles, the player (Dante), all enemies, Beatrice
js/boss.js        Asterion the Minotaur + shockwaves
js/ui.js          dialogue bubbles, HUD, slash FX, vignette, screens
js/main.js        game state machine, loop, camera, world interactions
test/sim.js       headless harness: crash + boss + ending regression
test/navbot.js    headless navigation bot proving the level is traversable
```

## Tests

The game logic is exercised headlessly with stubbed browser APIs:

```
node test/sim.js          # no-crash run, boss fight, ending, restart
node test/navbot.js --pure  # navigation bot reaches the boss (geometry is completable)
```
