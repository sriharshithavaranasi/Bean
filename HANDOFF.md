# Bean: handoff

State of `main` at `bba38b1` (2026-11-15). For the full design, see `docs/spec.md`; for team rules, `AGENTS.md`.

## Run it

```sh
npm install            # once: TypeScript and Node types for the type check
npm start              # http://localhost:8000
npm run typecheck      # tsc; run after every change
npm test               # node:test over app/**/*.test.ts and scripts/*.test.ts
sh scripts/servo-test.sh   # car check over USB, no app: head middle, left, middle, right, middle
```

- Chrome or Edge on a laptop. Node 22.18+ (TypeScript is stripped on serve; no build step).
- **Keys** go in `.env` at the repo root (git-ignored; `.env.example` lists them). Each line needs its name: `GEMINI_API_KEY=...`, `ELEVENLABS_API_KEY=...`. The server loads `.env` at start, so restart it after editing.
- **The car:** press **Connect by cable** and pick *USB-SERIAL CH340 (COMn)* (COM4 on this laptop). Every page reload drops the cable and falls back to the pretend robot. The servo test and the app cannot hold the port at the same time.
- **Restart the server after any change in `scripts/`** (it loads routes once). Changes in `app/` only need a page reload (Ctrl+Shift+R).

## What the app does

Two tabs, each its own mode behind one shell (`app/mode.ts` is the contract).

### Play with Bean (`app/play.ts`)

- Opens on a **games list**: Red Light, Green Light, plus a "Coming soon" card. "← All games" goes back.
- **Red Light, Green Light:** Green and Red lights last a random time (green 3 to 7 s, red 2.5 to 5 s). The **webcam alone** decides "moved" (`app/game/pose-moved.ts`: drift of shoulders, hips, knees and ankles as a share of shoulder width; one point past the wiggle room in one frame is a catch; points within 5 % of the picture edge are ignored). The **distance sensor** only detects the win (under 12 cm during Red) and checks someone is there at Start.
- A catch ends the game ("You moved!!"). **12 Red lights with no catch and no win** end it as "Bean stopped" (nobody is playing).
- While a round runs, the grown-up column slides away and the stage fills the screen (CSS keyed to `body[data-phase]`).
- Bean's lines in Play use the **ElevenLabs** voice (`scripts/voice.ts`, `POST /voice`), cached in `.voice-cache/`, browser voice as fallback.
- Progress: Games played (caught or won), Wins.

### Talk with Bean (`app/talk-play.ts`)

- **Voice conversation with Gemini Live** (`gemini-3.1-flash-live-preview`). Start fetches a one-use **ephemeral token** from the laptop (`POST /live-token`, `scripts/live.ts`, about 0.1 to 0.2 s) and the page opens the Live WebSocket **straight to Google**: the key never reaches the browser, the audio never passes through the server.
- Mic in at 16 kHz (echo cancellation, noise suppression), Bean's voice back at 24 kHz. Gemini ends the kid's turn after 1 s of quiet, with **low start-of-speech sensitivity**, and stops Bean when the kid talks over it. Bean speaks first.
- Screen: Bean is a **voice orb** that swells and glows with its voice (still with reduced motion). Under it, the kid's avatar and name beside **only their latest words** (Live API input transcript). Bean's words are not shown.
- **Start needs** a first name and an age (red message under each missing field). The age is not used otherwise yet.
- **Play time limit** 1 to 10 min (default 5): then the mic closes, Bean says goodbye in its live voice, "Time's up!".
- **Mini games** (checkbox "Allow mini games", read at Start): the kid starts one by asking. Gemini runs it from Bean's instructions:
  - **Mad Libs:** exactly 5 kid-friendly prompts, then one short silly story.
  - **Guess the Animal:** up to 4 clues, then swap; Bean asks up to 5 yes/no questions.
  - Bean calls a **`set_game` tool** at a game's start and end; the orb and card take the game's colour (yellow / red), the face and the status line change. 3.1 Flash Live only supports **blocking** tools (checked in Google's docs), so each call costs one round trip.
- **Quiet nudge:** 7 s after Bean finishes speaking with no kid speech, Bean is nudged to help (model an answer, easier clue), at most twice in a row.
- **Push to mute** (dev tool for demos): hold **M** or the small pill in the card's top-left corner to cut the mic; it shows "Mic muted".
- Not used yet: **Speaking style** (Natural, Witty, Boring), **Age**.
- No ElevenLabs and no Chrome speech recognition in Talk: both add delay.

## Code map

| Path | What |
| --- | --- |
| `app/main.ts` | Shell: tabs, stage, Start / Stop / Restart, robot link, screen lock |
| `app/mode.ts` | Contract between the shell and a mode |
| `app/play.ts` | Play with Bean: settings, cameras, progress, games list, game loop |
| `app/talk-play.ts` | Talk with Bean: Live session, mic, orb, mini games, mute |
| `app/game/freeze-watcher.ts`, `pose-moved.ts` | Pure game logic, with tests |
| `app/camera.ts`, `app/watch.html` | Webcam and pose model; the webcam tuning page |
| `app/robot*.ts` | Robot commands, USB serial link, pretend robot |
| `app/signals.ts` | Play's sounds and voice lines |
| `scripts/serve.ts` | Static server, `.env`, `/live-token`, `/voice` (laptop-only routes) |
| `scripts/live.ts`, `scripts/voice.ts` | Gemini ephemeral tokens, ElevenLabs voice |
| `docs/spec.md` | The spec; section 15 is Talk, 16 the webcam |
| `docs/quips.json` | Bean's spoken lines (out of date: see below) |

## Known issues and risks

- **Bean sometimes did not greet** at the start of a Talk session in the browser. A Node test with the app's exact setup greets every time, so the likely cause is room sound cutting the greeting off (barge-in). Low start sensitivity was added for this; not yet re-checked in the browser. If it persists: open the mic only after the greeting has played (small change in `connect()`), or check the browser console.
- **Webcam sensitivity** after the shoulder-width rewrite has not been retuned with a real kid. Ideas, best first, are in a `shortcut:` comment above `poseDrift` (`app/game/pose-moved.ts`). Default wiggle room is 20 %.
- **Quiet nudge** treats "the kid spoke" as "Google transcribed something": a mumble that is not transcribed can get a nudge mid-speech.
- **Holding M while switching windows** leaves the mic muted until M is pressed again or the session ends.
- **The ephemeral token is not locked** to Bean's model and settings (`shortcut:` comment in `scripts/live.ts`); fine while served on localhost only.
- **`docs/quips.json`** is out of date (Play's lines changed: "You moved!!", teases, "You're almost here!") and nothing reads it.
- **Tests were not run after the later changes** in this session (only `npm run typecheck`). Run `npm test` before relying on them.
- **The dev server, when started from Claude Code, gets killed when memory runs low.** Start it in your own terminal for long sessions.

## Gotchas learned the hard way

- **Duplicate ids:** Play's progress uses `t-<name>` ids (`t-games`, `t-wins`); Talk's settings also use `t-`. A clash (`t-games`) once made Bean think mini games were off. Check with:
  `grep -oE 'id="[^"]+"' app/index.html | sort | uniq -d`
- **Gemini models:** `gemini-3.8-flash` was overloaded (503, no reply in 45 s) on 2026-11-15. Listing a model with the key does not mean it is usable: test a real call.
- **Port busy:** if the servo test cannot open the port, a Bean tab is connected by cable. Reload it.
- **Commits:** everyone works on `main` (AGENTS.md); requests to other areas go through the `comms` branch in `.comms/`.

## Open on comms

- `2026-11-14-parent-app-tabs-renamed.md` is still `open` (to all); the speech area has answered it. Nothing else is open for this area.

## Next steps (proposed)

1. Re-check the greeting in the browser; if needed, open the mic after the greeting.
2. Tune the webcam wiggle room on `app/watch.html` with a real kid from the real camera spot.
3. Wire **Age** and **Speaking style** into Bean's instructions (one line each in `talk-play.ts`).
4. Run `npm test`; add `.gitattributes` for `*.sh`; update or delete `docs/quips.json`.
