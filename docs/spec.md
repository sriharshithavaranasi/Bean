# Bean: Red Light, Green Light robot (spec)

Hackathon project, Entertainment track. A robot car plays Red Light, Green Light with a kid. The robot is the watcher and the kid sneaks up. It is a play and practice tool that supports therapy. It is not a treatment, and no copy in the app or pitch may claim otherwise.

## 1. Who it is for

Kids who cannot easily join running games, mainly kids with limited mobility. They sneak by walking, crawling or rolling. A parent or therapist sets the pace.

## 2. Scope

Priorities are used on every ticket.

| Priority | Meaning | What is in it |
| --- | --- | --- |
| P0 | Needed for the demo | Red Light, Green Light on the real car, with music, lights and win detection, run from the parent app (section 13) |
| P1 | Makes the pitch true | Parent app, speech practice, grown-up settings, progress, multi-sensory signals |
| P2 | Stretch | Gyro spin, custom firmware |

Out of scope: the camera, accounts, a server, a database, a native phone app.

Group play needs no extra work. The sensor sees the nearest person in the lane, so siblings and parents sneak together and anyone caught moving ends the game for the group.

## 3. Simplifications (decided here)

1. **The robot turns its head, not its body.** The servo head is faster and the car stays in the lane. Spinning the car with the gyroscope is P2.
2. **The car runs Elegoo's stock firmware.** It already accepts every command the core game needs over serial, so P0 needs no Arduino code. Custom firmware is only for the P2 add-ons.
3. **The laptop talks to the car over a USB cable** with the Web Serial API (Chrome or Edge on a laptop). The head turns and the car does not drive, so a cable is fine.
4. **The app is one static web page** in plain JavaScript modules with no build step. Game logic is pure functions tested with `node --test`.
5. **All sound and speech come from the laptop.** The kit has no speaker.
6. **Every screen works against a mock robot** (a distance slider), so app work never waits for the car.
7. **Progress and settings live in `localStorage`.** Nothing leaves the device.

## 4. Hardware facts (from the ELEGOO kit files)

The Elegoo Smart Robot Car V4.0 kit files come from [ELEGOO's download page](https://www.elegoo.com/pages/download). They include the main UNO program for each shield and the ESP32 sketch.

Serial: 9600 baud, one JSON object per command. `H` is an id that the reply echoes.

| Need | Command | Reply |
| --- | --- | --- |
| Turn head | `{"H":"1","N":5,"D1":1,"D2":<angle 0-180>}` | `{1_ok}` |
| Read distance (cm) | `{"H":"1","N":21,"D1":2}` | `{1_<cm>}` |
| Set RGB LED | `{"H":"1","N":8,"D1":<which LEDs>,"D2":<R>,"D3":<G>,"D4":<B>}` | `{1_ok}` |
| Stop everything | `{"N":100}` | none |
| Drive or turn (P2) | `{"H":"1","N":3,"D1":<1 left, 2 right, 3 forward, 4 back>,"D2":<speed 0-255>}` | `{1_ok}` |

Source: `04 Related chip information/Communication protocol for Smart Robot Car.pdf` and `ApplicationFunctionSet_xxx0.cpp` in the kit's main program.

Pins on the TB6612 shield: ultrasonic trigger 13 and echo 12, head servo 10, RGB LED 4, mode button 2, IR receiver 9, line sensors A0 to A2.

Checked on the real car (2026-11-14):

- The car has the TB6612 shield with the MPU6050 gyro: it prints `MPU6050_chip_id: 52` at boot, and only the `TB6612 & MPU6050` firmware prints that line.
- The shield's upload switch must be in the upload position for USB serial to reach the UNO.
- Opening the serial port resets the UNO. The app waits 2 seconds before the first command, and that is enough.

Not yet verified on the real car (ticket "Flash stock firmware"):

- The firmware switches the LED off when any other mode command arrives (read from the source, not yet seen on the car). The app sets the head first and the light second, so it works either way.

## 5. Red Light, Green Light (core game)

Set-up: tape a straight lane about 1 m long in front of the car (the sensor reads a person reliably to about 1 m, #3) with a start line at the far end. The kid waits at the start line. Pressing Start records the start distance.

| State | Robot | App | Leaves when |
| --- | --- | --- | --- |
| Countdown | Head at 90 (facing the kid) | Bean says a hello line while the webcam loads, then the screen and Bean count "3, 2, 1" | 3 seconds after the hello line ends; Bean says a go line on the first Green |
| Green | Head at 180 (looking away), LED green | Music plays, screen shows GO | A random time between the min and max look-away settings |
| Red | Head at 90 (facing the kid), LED red | Music stops, screen shows FREEZE | A random time between the shortest and longest red light ends |
| Caught | LED orange | "Caught" sound, voice "I saw you move! Game over." | Never: it ends the game, like a win. Play again starts a new one |
| Win | LED rainbow or white | Win sound | Play again is pressed |
| Ended | LED off, head faces the kid | "Is anybody there? I'll stop for now. Bye!" Screen: "Bean stopped" | Play again is pressed. Reached after 12 Red lights with no catch and no win: nobody is playing, the game was started by accident |

Catching movement, during Red:

1. Ignore the "time to freeze" setting (1 s by default). The servo is settling and the kid is still stopping.
2. The webcam decides, as in section 16, after every frame: the catch lands when the kid moves, not when the Red light ends. The distance sensor no longer catches anyone: on the car it was inconsistent and gave many false catches.
3. When the kid's head is out of the picture (too close, or nobody found), the pose is not trusted: a change in the picture itself is the catch, as in section 16.

Win: a reading under the win distance during Red.

Limits to say out loud in the demo: the webcam must see the kid's head, shoulders and hips to forgive hands and heads; closer than that, any change in the picture counts as moving.

## 6. Games

The parent picks a game. In both, the kid moves toward the robot and the distance sensor checks them.

- **Red Light, Green Light (P0).** Section 5.

## 7. Speech

Web Speech API in Chrome. Recognition is weak on kids' voices, so the Good try button is always on screen whenever the app is listening. Only Talk with Bean listens; Red Light, Green Light never asks the kid to speak.

## 8. Signals

Each state change is sent on every channel at once, so no single sense is required.

| Channel | Green | Red |
| --- | --- | --- |
| Screen | Full green, GO text and icon | Full red, FREEZE text and icon |
| Sound | Music plays | Music stops, short stop sound |
| Vibration (phones that support it) | One short pulse | One long pulse |
| Robot | Head away, LED green | Head facing, LED red |

Colour is never the only cue. All controls work from the keyboard and have large targets.

## 9. Grown-up settings

Labels are in plain words, as shown. Settings are saved on the device.

| Setting | Choices or default |
| --- | --- |
| Robot looks away by | Turning its head. Spinning the whole car is listed only when the P2 firmware is present |
| Shortest green light | 3 s |
| Longest green light | 7 s |
| Time to freeze before the robot checks | 1 s |
| Shortest red light | 2.5 s |
| Longest red light | 5 s |
| Win when closer than | 12 cm |

Lane length stays at 150 cm, the sensor's limit, and is not shown to parents.

## 10. Progress (P1)

Two totals on the main screen: Games played (games that ended in a catch or a win; a Stop or "Bean stopped" does not count) and Wins. Times caught is counted but not shown, so the screen stays encouraging. One Reset button that asks first. Totals are saved on the device.

## 11. Code layout

TypeScript, with no build step: `scripts/serve.ts` strips the types when it serves a `.ts` file, so only erasable syntax is used. `npm run typecheck` runs `tsc`.

```
app/
  index.html        play screen, settings, dashboard
  app.css           the one stylesheet: design tokens in :root, then layout and controls
  fonts/            Fredoka and Nunito (OFL), served locally so the demo works offline
  main.ts           the shell: tabs, stage, Start / Stop / Restart, robot link, screen lock
  mode.ts           the contract between the shell and each activity (screen, start, stop)
  play.ts           Play with Bean: its settings, progress, webcam and Red Light, Green Light loop
  talk-play.ts      Talk with Bean: a mode with no game yet (its settings are in index.html)
  camera.ts         opens the webcam and the pose model
  robot.ts          robot interface: connect, lookAway, lookAtKid, distanceCm, setLight
  robot-serial.ts   Web Serial transport
  robot-mock.ts     slider-driven fake robot
  game/             pure logic and tests (freeze-watcher, pose-moved)
  signals.ts        screen, sound, vibration
  store.ts          settings and progress in localStorage
  browser.d.ts      types for Web Serial, which TypeScript's DOM types lack
firmware/           P2 only
```

## 12. Demo checks

- 20 Red lights standing still: 0 false catches.
- 10 Red lights while moving forward: at least 9 catches.
- A full round from Start to Win on the taped lane.
- The same round on the mock robot with the car unplugged.

## 13. Parent app

The reference is the team's single-page example (`message.txt`, shared 2026-11-13). The app runs on the laptop next to the car: the kid watches the robot, and the grown-up uses the laptop.

One page, in this order:

1. **Stage.** A big round light in the state colour, a status line ("Bean is ready", "Green light!", "Red light!", "I saw you!", "You got me!"), a hint line and the live distance.
2. **Start and Stop.** Stop is always available. It ends the round, silences music and speech, stops listening, turns the robot to face the kid and sends the stop command. During a round Start becomes Restart, which asks first: a second press within 4 seconds restarts.
3. **Parent buttons.** Good try, shown only while the game waits for the word.
4. **Progress.** Section 10.
5. **Robot.** Connect, link state, and the pretend-robot distance slider when no car is connected.
6. **Grown-up settings.** Section 9.

On a wide screen the stage and progress sit left and the robot and settings sit right.

Starting palette from the example: cream background `#fff8ef`, ink `#2b2140`, go `#2fbf71`, stop `#e5484d`, wait `#f5a524`, win purple `#8e4ec6`. The design pass may refine it. State is never shown by colour alone.

Behaviour taken from the example:

- Bean's spoken lines (`app/signals.ts`): at Start one of four hello lines ("Ooh, a new game! Sneak up on me... if you can!"), then "Three!", "Two!", "One!" and one of three go lines ("Green light! Go, go, go!"). Red light "Red light! Hmm... I'm watching you", caught "You moved!!", win "You got me! You win!". After a Red light held still it teases ("Heyy... Did you just move?" or "You're sneaky!"), or says "You're almost here!" when that Red light's last good reading was under 30 cm. The screen text is unchanged.
- Caught ends the game: Bean says so, and Play again starts a new one.
- Vibration: one short pulse on Green, two long pulses on Red, a pattern on a win.

Not taken from the example:

- It checks for a win during Green. With the head turned away the sensor cannot see the kid, so the win is checked when the robot looks (section 5).
- It catches movement away from the robot as well as toward it. Section 5 catches movement toward the robot only.

## 14. Custom firmware protocol (P2)

The example talks to the car in short text lines instead of the stock JSON. This is the protocol for the custom firmware, if the team writes it. The app's robot interface hides which one is in use.

| Line | Direction | Meaning |
| --- | --- | --- |
| `H <angle>` | to car | Turn the head |
| `S <degrees>` | to car | Spin the car in place |
| `L <r> <g> <b>` | to car | Set the LED |
| `X` | to car | Stop |
| `D <cm>` | from car | Distance, streamed without being asked |
| `B` or `T` | from car | Button pressed or robot tapped: the kid wins |
| `READY` | from car | Boot finished |

## 15. Talk with Bean (P1, not built)

The Talk tab holds Talk with Bean. Its game was removed on 2026-11-15; only its grown-up settings are on the page, and nothing uses them yet:

| Setting | Choices or default |
| --- | --- |
| First name | empty (Start needs it) |
| Age | a number, empty by default. Start needs it (red message under the field otherwise), but nothing else uses it yet |
| Speaking style | Natural (default), Witty, Boring |
| Play time limit | 1 to 10 minutes, default 5 (to keep sessions short) |
| Allow mini games | A checkbox (off by default), above the list of mini games: 🤪 Mad Libs, 🦁 Guess the Animal |
| AI chat | Fixed text: "Powered by **Gemini**" (not a switch) |

Start on the Talk tab begins a spoken conversation with Bean (Gemini Live, `gemini-3.1-flash-live-preview`). The laptop's server hands the page a one-use ephemeral token (`POST /live-token`, `scripts/live.ts`, about 0.1-0.2 s), and the page opens the Live WebSocket straight to Google with it, so the API key never reaches the browser and the audio never passes through the server. The mic streams in (16 kHz, echo cancellation on), Bean's voice streams back (24 kHz), Gemini decides when the kid has finished (1 s of quiet) and stops Bean when the kid talks over it, Bean is a voice orb on the stage (its face on Talk's blue) that swells and glows with the loudness of its voice. Under it, the kid's smiley and name sit beside only what the kid said last, from the Live API's own transcript; there is no history, and Bean's words are not shown. Bean's voice here is Gemini's, not ElevenLabs, to keep the delay low. Start needs the first name (otherwise a red message shows under the field). The stage shows "Talking with <name>" and the minutes left, and the session ends on its own when the play time limit runs out: the mic closes, Bean says goodbye in its live voice, and the stage shows "Time's up!". Stop ends it early. With Allow mini-games on, the kid can start Mad Libs by asking ("let's play Mad Libs"): Gemini runs it from Bean's instructions, asking exactly five kid-friendly prompts one at a time (an animal, a colour, a food, a silly sound, a way to move, and so on; never grammar words), then telling one short silly story with the answers, voice only. Guess the Animal is the second game: Bean gives up to four easy clues one at a time while the kid guesses, then they swap and Bean asks up to five yes or no questions about the kid's animal. Only one game runs at a time, and the kid can stop it whenever they like. Bean signals a game starting or ending with a `set_game` tool call (`mad_libs`, `guess_the_animal` or `none`, sent only when mini games are allowed); the page answers at once and shows the game: the orb and the talk card take the game's colour (yellow for Mad Libs, red for Guess the Animal; back to Talk's blue when the game ends), the orb's face changes (a silly wink, a curious raised brow), and the status line shows the game's name instead of "Talking with <name>". With mini games off, Bean says games are off today. If the kid is quiet for 7 s after Bean finishes speaking, the app nudges Bean to help (in Mad Libs, by modelling an answer such as "You can say: a dog!"; in Guess the Animal, with an easier clue), at most twice in a row. A small "Hold M to mute" button (a dev tool for demos, for talking to people nearby) cuts the mic while it or the M key is held, and shows "Mic muted" meanwhile. The tabs, their warning on a mid-round switch and the saved tab (`bean-tab`) are unchanged.

**Bean's head follows the kid.** During a Talk session the webcam is on (the camera picked in Play's settings), and it must ride on Bean's head, not stand apart as in section 16. About three times a second the pose model looks for the kid's nose; when it is more than 12 % of the picture's width from the middle, the head turns toward it (`headToward` in `app/robot.ts`, `followKid` in `app/talk-play.ts`). Each turn covers about 0.6 of the way, so the head settles instead of swinging past, and the head stays between 30 and 150 degrees for the webcam's cable. After about 1.5 seconds with no head in the picture, Bean looks for the kid: the head pans slowly from side to side (`headSearch`), starting toward the side the kid left on, one sweep every 12 seconds, easing into each turn, reaching 42 to 52 degrees to each side, until a head is in the picture again. With no webcam, or when it is not allowed, Bean talks without turning. Frames stay on the laptop, as in Play. The turn size, the 12 %, the limits and the turn direction are not measured on the car (a `shortcut:` comment in `app/robot.ts` says how to correct them).

**Bean's voice (ElevenLabs).** Every line Bean says goes through `say` in `app/signals.ts`. It asks `POST /voice` (`scripts/voice.ts`, laptop only) for the line as MP3 in voice `PKtsQbgKDa44YlyHnywy` (override with `ELEVENLABS_VOICE_ID`) on `eleven_flash_v2_5` (override with `ELEVENLABS_MODEL`), with the key from `ELEVENLABS_API_KEY`. Each line is fetched once per page load and kept; the game's fixed cues are fetched when Start unlocks sound, so "Red light!" is on time. With no key, no internet or no answer in 1.5 s, the browser's voice says the line and `/voice` rests for a minute. The lines sent include the kid's first name and AI chat replies. The webcam practice page (`app/watch.ts`) keeps the browser's voice.

## 16. Webcam watcher (P1, proposed)

Proposed by the speech area. It changes section 2 ("Out of scope: the camera"), so the team agrees before it reaches the game.

**Why.** The distance sensor only sees movement toward the robot, straight ahead, in a narrow cone (section 5). A webcam sees a kid step sideways, shuffle a foot or sneak at the edge of the lane, so Red Light, Green Light catches what a kid actually sees as cheating.

**How it decides.** A USB webcam (the team's Logitech) stands about 1 to 1.5 m behind the car, raised (on the laptop or a stand) and angled down the lane, so the kid's shoulders and hips stay in the picture from the start line to the car. Feet may be out of the picture: knees and ankles count only when they are seen. Not on the car: as the kid comes close, a camera on the car sees only their legs and loses them (on the first tuning run, a body filling 120 to 260% of the picture height was lost in about half the rounds). MediaPipe Pose Landmarker (full model; the lite model kept a made-up, jumping skeleton when the kid's head left the picture, and caught a still kid every Red light) finds 33 body points in each frame on the laptop. During Red, after the time to freeze, about 10 frames a second are kept. `poseDrift` in `app/game/pose-moved.ts` compares the shoulders, hips, knees and ankles with where they were in the first frame that saw both shoulders, as a share of the kid's shoulder width, so the same setting works near and far. Any point seen in both frames counts, so the shoulders alone are enough. The kid is caught when any one point, in any one frame, drifted more than the wiggle room. Hands and head never count: they move without meaning to, and some kids cannot hold them still. With no frame that sees both shoulders, the pose catches nobody.

**When the head is out of the picture.** Close to the camera the kid's head leaves the picture, and the pose model then finds nobody or guesses, so the pose is trusted only in frames where the nose is in the picture (`headSeen`). In every other frame the picture itself is watched (`app/game/picture-moved.ts`): each frame is shrunk to a 64 by 48 grey picture and compared with the Red light's first picture, with the middle change taken out so the camera adjusting its exposure does not count. The kid is caught when more than 10 % of the picture changed (`pictureChangePct`; a pixel counts when its grey level moved more than 25 of 255). Both numbers are arbitrary: see the table below. In this mode hands and heads count, and so does anyone else moving in the picture. The distance sensor is never used for this. A round does not start without the webcam.

**What stays the same.** The distance sensor still detects the win (under 12 cm during Red) and still records the start distance. Green, Red, Caught and Win, their timing and their signals are unchanged.

**Settings (added to section 9).**

| Setting | Choices or default |
| --- | --- |
| Camera | Default camera, or a named one |
| Webcam detection wiggle room | 20% of shoulder width, from 5 to 60%. Retune on `app/watch.html`: the earlier tuning was in torso lengths. Tuned on `app/watch.html` with the Logitech: standing still drifted 0.00 to 0.11, real moves 0.20 to 1.49 |

**Arbitrary numbers (not settings).** Chosen by reasoning on 2026-11-15, never measured. They behaved well on the first try on the lane, so they stay until they cause a wrong catch or a missed one.

| Number | Value | Where | Too low | Too high |
| --- | --- | --- | --- | --- |
| Share of the picture that may change (head out of the picture) | 10 % | `pictureChangePct` in `app/game/freeze-watcher.ts` | A still kid is caught (flickering lights, a busy background, someone walking behind) | A small, slow shuffle is missed (plain clothes against a plain wall) |
| How far a pixel's grey level must move to count as changed | 25 of 255 | `LEVEL` in `app/game/picture-moved.ts` | Camera noise and light flicker count as change | Low-contrast movement does not count |

To set them from data: on `app/watch.html`, run a practice up close with a few still Red lights and a few with a move, and compare the picture change the log lists for the two groups (Copy results copies the log).

**Privacy.** Frames are processed in the browser on the laptop and are never recorded, stored or sent. The model and its files are in `app/vendor/mediapipe/`, so it needs no internet. The camera turns off when the round stops. The pitch says so.

**Tuning.** `app/watch.html` opens the camera, draws the watched points and runs hands-free practice: a spoken 5 second countdown, then Green and Red lights until Stop, saying each result and listing the drift and the picture change it measured, with a wiggle room slider. Use it on the real lane, with the real light, before the demo.

**Code.** `app/camera.ts` (opens the camera, loads the model), `app/game/pose-moved.ts` and its tests, `app/watch.html`. In Red Light, Green Light: `createGame` takes `poseWigglePct`, and `tick(now, cm, body)` keeps the webcam frames of each Red; after each frame `poseMoved` decides, so a move is caught on the tick that sees it. `main.ts` opens the camera into a hidden `<video>` when a round starts (a camera that will not open stops the Start, and says so), reads a frame each tick during Red, and closes it on Stop or the end of the game. Settings are saved in `bean-settings` as `cameraId` and `poseWigglePct`.
