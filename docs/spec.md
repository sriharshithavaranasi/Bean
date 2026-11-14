# Bean: Red Light, Green Light robot (spec)

Hackathon project, Entertainment track. A robot car plays Red Light, Green Light with a kid. The robot is the watcher and the kid sneaks up. It is a play and practice tool that supports therapy. It is not a treatment, and no copy in the app or pitch may claim otherwise.

## 1. Who it is for

Kids who cannot easily join running games, mainly kids with limited mobility. They sneak by walking, crawling or rolling. A parent or therapist sets the pace and the practice words.

## 2. Scope

Priorities are used on every ticket.

| Priority | Meaning | What is in it |
| --- | --- | --- |
| P0 | Needed for the demo | Red Light, Green Light on the real car, with music, lights and win detection, run from the parent app (section 13) |
| P1 | Makes the pitch true | Parent app on a phone, speech practice, Say It to Sneak, grown-up settings, progress, multi-sensory signals |
| P2 | Stretch | Gyro spin, custom firmware |

Out of scope: the camera, accounts, a server, a database, a native phone app.

Group play needs no extra work. The sensor sees the nearest person in the lane, so siblings and parents sneak together and anyone caught moving sends the group back.

## 3. Simplifications (decided here)

1. **The robot turns its head, not its body.** The servo head is faster and the car stays in the lane. Spinning the car with the gyroscope is P2.
2. **The car runs Elegoo's stock firmware.** It already accepts every command the core game needs over serial, so P0 needs no Arduino code. Custom firmware is only for the P2 add-ons.
3. **The laptop talks to the car over a USB cable** with the Web Serial API (Chrome or Edge on a laptop). The head turns and the car does not drive, so a cable is fine. A phone cannot use the USB cable, so the parent's phone reaches the car through the laptop (section 13).
4. **The app is one static web page** in plain JavaScript modules with no build step. Game logic is pure functions tested with `node --test`.
5. **All sound, speech and vibration come from the laptop or phone.** The kit has no speaker.
6. **Every screen works against a mock robot** (a distance slider), so app work never waits for the car.
7. **Progress and settings live in `localStorage`.** Nothing leaves the device.

## 4. Hardware facts (from `tutorial/`)

`tutorial/` holds the Elegoo Smart Robot Car V4.0 kit files, including the main UNO program for each shield and the ESP32 sketch.

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

Not yet verified on the real car (ticket "Flash stock firmware"):

- Which shield and gyro the car has (TB6612 or DRV8835, MPU6050 or QMI8658C). The firmware folder differs for each.
- The firmware switches the LED off when any other mode command arrives (read from the source, not yet seen on the car). The app sets the head first and the light second.
- The shield's upload switch may need to be in the upload position for USB serial to reach the UNO.
- Opening the serial port resets the UNO. Wait about 2 seconds before the first command.

## 5. Red Light, Green Light (core game)

Set-up: tape a straight lane about 1 m long in front of the car (the sensor reads a person reliably to about 1 m, #3) with a start line at the far end. The kid waits at the start line. Pressing Start records the start distance.

| State | Robot | App | Leaves when |
| --- | --- | --- | --- |
| Green | Head at 180 (looking away), LED green | Music plays, screen shows GO | A random time between the min and max look-away settings |
| Red | Head at 90 (facing the kid), LED red | Music stops, screen shows FREEZE | The look time ends |
| Caught | LED orange | "Go back" sound and voice | Distance is back at the start distance, Kid is back at start is pressed, or 8 seconds pass |
| Waiting for word (P1) | Keeps facing the kid | Shows the practice word | The word is heard, or Good try is pressed |
| Win | LED rainbow or white | Win sound | Play again is pressed |

Catching movement, during Red:

1. Ignore the "time to freeze" setting (1 s by default). The servo is settling and the kid is still stopping.
2. Read the distance about every 100 ms for the rest of the look time.
3. Drop readings of 0, and of 150 or more: the stock firmware caps at 150 and sends 150 when it hears no echo.
4. Compare the median of the first three readings with the median of the last three. The kid is caught if the distance shrank by more than the leeway.
5. With fewer than four good readings, the kid is not caught. Standing still must never be caught.

Win: a reading under the win distance during Red.

Limits to say out loud in the demo: the sensor sees a narrow cone straight ahead, and it sees movement toward the robot, not side to side.

## 6. Games

The parent picks a game. In both, the kid moves toward the robot and the distance sensor checks them.

- **Red Light, Green Light (P0).** Section 5.
- **Say It to Sneak (P1).** Red Light, Green Light with a practice word before every Green light and a fixed 3 second Green light. Every Green light is earned with a practice word.

## 7. Speech

Web Speech API in Chrome. Recognition is weak on kids' voices, so the Good try button is always on screen whenever the app is listening. Only Say It to Sneak listens for words; Red Light, Green Light never asks the kid to speak.

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
| Game | Red Light, Green Light, Say It to Sneak |
| Robot looks away by | Turning its head. Spinning the whole car is listed only when the P2 firmware is present |
| Shortest green light | 3 s |
| Longest green light | 7 s |
| Time to freeze before the robot checks | 1 s |
| How long the robot stares | 2.5 s |
| Wiggle room before caught | 15 cm (still readings on the car, 2026-11-14: the old 6 cm with 150s kept falsely caught 9 of 43 Red lights; 15 cm with 150s dropped caught 0; recheck with a person, #3) |
| Win when closer than | 12 cm |
| Practice words (Say It to Sneak only) | rabbit, red, robot, run |

Lane length stays at 150 cm, the sensor's limit, and is not shown to parents.

## 10. Progress (P1)

Three totals on the main screen: Rounds, Wins, Word tries (shown only for Say It to Sneak). Times caught is counted but not shown, so the screen stays encouraging. One Reset button that asks first. Totals are saved on the device.

## 11. Code layout

TypeScript, with no build step: `scripts/serve.ts` strips the types when it serves a `.ts` file, so only erasable syntax is used. `npm run typecheck` runs `tsc`.

```
app/
  index.html        play screen, settings, dashboard
  app.css           the one stylesheet: design tokens in :root, then layout and controls
  fonts/            Fredoka and Nunito (OFL), served locally so the demo works offline
  main.ts           wires the page to the game, the robot and saved settings
  robot.ts          robot interface: connect, lookAway, lookAtKid, distanceCm, setLight
  robot-serial.ts   Web Serial transport
  robot-mock.ts     slider-driven fake robot
  game/             pure logic and tests (movement, freeze-watcher, pose-moved)
  speech.ts         practice-word listener
  signals.ts        screen, sound, vibration
  store.ts          settings and progress in localStorage
  browser.d.ts      types for Web Serial and speech recognition, which TypeScript's DOM types lack
firmware/           P2 only
```

## 12. Demo checks

- 20 Red lights standing still: 0 false catches.
- 10 Red lights while moving forward: at least 9 catches.
- A full round from Start to Win on the taped lane.
- The same round on the mock robot with the car unplugged.

## 13. Parent app (phone)

The reference is the team's single-page example (`message.txt`, shared 2026-11-13). The app is the grown-up's remote: the kid watches the robot, and the parent holds the phone.

One page, phone first, in this order:

1. **Stage.** A big round light in the state colour, a status line ("Bean is ready", "Green light!", "Red light!", "I saw you!", "You got me!"), a hint line and the live distance.
2. **Start and Stop.** Stop is always available. It ends the round, silences music and speech, stops listening, turns the robot to face the kid and sends the stop command. During a round Start becomes Restart, which asks first: a second press within 4 seconds restarts.
3. **Parent buttons.** Good try (word), Kid is back at start. Each is shown only while the game is waiting for it.
4. **Progress.** Section 10.
5. **Robot.** Connect, link state, and the pretend-robot distance slider when no car is connected.
6. **Grown-up settings.** Section 9.

On a wide screen the stage and progress sit left and the robot and settings sit right.

Starting palette from the example: cream background `#fff8ef`, ink `#2b2140`, go `#2fbf71`, stop `#e5484d`, wait `#f5a524`, win purple `#8e4ec6`. The design pass may refine it. State is never shown by colour alone.

Behaviour taken from the example:

- After a Red light held still, the robot praises the kid ("Great freezing!", "So still!", "I did not see a thing!").
- Caught ends when Kid is back at start is pressed, when the distance is back at the start distance, or after 8 seconds.
- Vibration: one short pulse on Green, two long pulses on Red, a pattern on a win.

Not taken from the example:

- It checks for a win during Green. With the head turned away the sensor cannot see the kid, so the win is checked when the robot looks (section 5).
- It catches movement away from the robot as well as toward it. Section 5 catches movement toward the robot only.

**Phone to car.** A phone cannot open the USB serial port. The recommended route (ticket "Control the robot from a phone") keeps the laptop next to the car: the laptop tab holds the USB link, runs the game and plays the sound, and the phone opens the same page from the laptop over the local network as a remote. Speech recognition stays on the laptop, because a phone page loaded over plain HTTP may not use the microphone.

This route is built. Start the server with `node scripts/serve.ts --lan` (or set `HOST`); without it the server stays on localhost and the phone remote is off. The laptop tab shows the phone address with a 6-digit code that changes on every server start. A phone with the right code copies the laptop's stage (status, light, buttons, progress and settings) within half a second and sends Start, Stop, the grown-up buttons, Reset and settings back. The laptop does a press only while that button is on its own screen. A wrong code gets nothing, and after 20 wrong codes no phone may connect until the server restarts. Click once on the laptop tab before playing (Connect by cable does this), so the browser lets it play sound, and keep that tab in front, because a background tab runs its timers slowly. Venue WiFi often blocks device-to-device traffic: use a phone hotspot.

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

## 15. Talk with Bean (P1, proposed)

Proposed by the speech area. It changes the scope in section 2 in two places, so the team agrees before it is built: the local server gains one endpoint, and the kid's words leave the laptop when AI chat is on.

**Goal.** Back-and-forth conversation practice. Bean says something, waits for the kid's turn, answers what they said, and invites the next turn. It practises greetings, answering questions, asking for things and taking turns.

**Two modes, one game.**

- **Scripted (default, offline).** Short scripts written in `app/game/talk.ts`: Hello (greetings and names), Questions (favourite colour, animal, food), Asking (asking Bean for a turn, a song, a dance). Any answer the microphone catches moves the script on. Bean echoes a word it heard when it can ("Blue! I love blue.").
- **AI chat (off by default).** A grown-up turns it on. Bean's replies come from Gemini through the local server (below). If there is no key, no internet, or no reply within 3 s, Bean says the next scripted line, so the game never stalls.

**One turn.**

| Step | Bean | Screen | Car |
| --- | --- | --- | --- |
| Bean talks | Says its line through the speaker | Bean's line as text | Head faces the kid, small wiggle |
| Kid's turn | Listens (microphone opens after Bean stops talking) | "Your turn!" | LED blue |
| No answer after the wait time | Models an answer ("You can say: hi Bean!"), then listens again | "Your turn!" | LED blue |
| Thinking (AI chat only) | Silent, up to 3 s | "Bean is thinking" | LED yellow |

Good try ends the kid's turn at any time, as in section 7. Stop ends the game and silences Bean at once. A game is 6 turns, then Bean says goodbye.

**AI chat, server side.** `POST /talk` on `scripts/serve.ts`, laptop only (same `loopback` and JSON body checks as the relay). The body is the last few turns as text. The server adds the system instruction and the key from the `GEMINI_API_KEY` environment variable and calls a fast Flash-Lite model. The key never reaches the browser and is never written to a file in the repo. Without the variable, `/talk` answers 503 and the game stays scripted.

**Bean's rules (system instruction).** Bean is a friendly robot helping a young child practise talking. One or two short sentences, simple words, always ending with an easy question or invitation to talk. Topics: animals, colours, food, games, feelings, the game they are playing. Never asks for personal information beyond the first name the grown-up typed. Never talks about scary, unsafe or grown-up topics; steers back to the game instead. Never says it is a person.

**Layout: Move and Talk tabs.** Talk with Bean is a different activity from Red Light, Green Light, so the page gets two tabs at the top, labelled "Play with Bean" (Move) and "Talk to Bean" (Talk). Each tab shows only its own games, settings and progress, so no counter is shown that means nothing for the game being played.

| | Move tab | Talk tab |
| --- | --- | --- |
| Games | Red Light, Green Light, Say It to Sneak | Talk with Bean |
| Progress | Rounds, Wins; Word tries only for Say It to Sneak | Turns taken, Turns heard by the microphone |
| Settings | Section 9 rows for movement | Script, kid's first name, wait for an answer, AI chat, practice words |
| Shared | Stage, Start, Stop, Good try, the Robot card | same |

Tabs are a real tab list (`role="tablist"`, arrow keys move between tabs, the chosen tab is remembered on the device). Switching tab during a round asks first, as Restart does: the first press turns the pressed tab amber with "Press again to stop", and a second press within 4 seconds stops the round and switches. The kid's hint on the stage is never replaced by the warning. The phone remote copies the chosen tab.

**Settings (added to section 9).**

| Setting | Choices or default |
| --- | --- |
| Game | adds Talk with Bean |
| Script | Hello, Questions, Asking |
| Kid's first name | empty (Bean says "friend") |
| Wait for an answer | 6 s, from 3 to 20 s |
| AI chat (sends what the kid says to Google) | off |

**Privacy.** Speech-to-text in Chrome already sends audio to Google. With AI chat on, the kid's words also go to Gemini. The setting says so in its label, it is off by default, and the pitch says so. Nothing is stored apart from the turn count in progress.

**Progress (section 10).** Adds turns taken and turns the microphone heard by itself.

**Code.** `app/game/talk.ts` (pure turn logic and the scripts, with tests), `speech.ts` gains a listener that returns what was heard, `/talk` in `scripts/serve.ts` (with a test), and the hookup in `main.ts` (a comms request to its owner).

**Hardware.** Any microphone the laptop sees works: the Logitech webcam's microphone mounted on the car's body, facing the lane, is the plan. Keep the speaker away from the microphone so Bean does not hear itself.

## 16. Webcam watcher (P1, proposed)

Proposed by the speech area. It changes section 2 ("Out of scope: the camera"), so the team agrees before it reaches the game.

**Why.** The distance sensor only sees movement toward the robot, straight ahead, in a narrow cone (section 5). A webcam sees a kid step sideways, shuffle a foot or sneak at the edge of the lane, so Red Light, Green Light catches what a kid actually sees as cheating.

**How it decides.** A USB webcam (the team's Logitech) stands about 1 to 1.5 m behind the car, raised (on the laptop or a stand) and angled down the lane, so the kid's shoulders and hips stay in the picture from the start line to the car. Feet may be out of the picture: knees and ankles count only when they are seen. Not on the car: as the kid comes close, a camera on the car sees only their legs and loses them (on the first tuning run, a body filling 120 to 260% of the picture height was lost in about half the rounds). MediaPipe Pose Landmarker (lite model) finds 33 body points in each frame on the laptop. During Red, after the time to freeze, about 10 frames a second are kept. `poseDrift` in `app/game/pose-moved.ts` compares the shoulders, hips, knees and ankles with where they were in the first three frames, as a share of the kid's torso length, so the same setting works near and far. The kid is caught when, in any three frames in a row, at least two of those points drifted more than the wiggle room. Hands and head never count: they move without meaning to, and some kids cannot hold them still. Fewer than six frames with a body, or no body found, is not caught, as in section 5.

**When the camera loses the kid.** No body found is not "still": that round falls back to the distance sensor (section 5), so stepping out of the picture never escapes being caught. Practice on the tuning page, like a game round, starts only once the kid is in the picture.

**What stays the same.** The distance sensor still detects the win (under 12 cm during Red) and still records the start distance. Green, Red, Caught and Win, their timing and their signals are unchanged.

**Settings (added to section 9).**

| Setting | Choices or default |
| --- | --- |
| Bean watches with | The distance sensor, or the webcam (shown when a camera is found) |
| Camera | Default camera, or a named one |
| Webcam wiggle room | 0.15 of torso length, from 0.05 to 0.6. Tuned on `app/watch.html` with the Logitech: standing still drifted 0.00 to 0.11, real moves 0.20 to 1.49 |

**Privacy.** Frames are processed in the browser on the laptop and are never recorded, stored or sent. The model and its files are in `app/vendor/mediapipe/`, so it needs no internet. The camera turns off when the round stops. The pitch says so.

**Tuning.** `app/watch.html` opens the camera, draws the watched points and runs hands-free practice: a spoken 5 second countdown, then Green and Red lights until Stop, saying each result and listing the drift it measured, with a wiggle room slider. Use it on the real lane, with the real light, before the demo.

**Code.** `app/camera.ts` (opens the camera, loads the model), `app/game/pose-moved.ts` and its tests, `app/watch.html`. Hooking it into Red Light, Green Light (`app/game/freeze-watcher.ts`, `app/main.ts`) is a comms request to their owner.
