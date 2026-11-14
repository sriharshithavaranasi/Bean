# Bean: Red Light, Green Light robot (spec)

Hackathon project, Entertainment track. A robot car plays Red Light, Green Light with a kid. The robot is the watcher and the kid sneaks up. It is a play and practice tool that supports therapy. It is not a treatment, and no copy in the app or pitch may claim otherwise.

## 1. Who it is for

Kids who cannot easily join running games, mainly kids with limited mobility. They sneak by walking, crawling or rolling, or they play from an adaptive switch. A parent or therapist sets the pace and the practice words.

## 2. Scope

Priorities are used on every ticket.

| Priority | Meaning | What is in it |
| --- | --- | --- |
| P0 | Needed for the demo | Freeze Watcher on the real car, with music, lights and win detection, run from the parent app (section 13) |
| P1 | Makes the pitch true | Parent app on a phone, switch input, speech practice, Say It to Sneak, Robot Says, grown-up settings, progress, multi-sensory signals |
| P2 | Stretch | Gyro spin, push button, buzzer, custom firmware |

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

## 5. Freeze Watcher (core game)

Set-up: tape a straight lane about 2 m long in front of the car with a start line at the far end. The kid waits at the start line. Pressing Start records the start distance.

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
3. Drop readings of 0 or beyond the lane length.
4. Compare the median of the first three readings with the median of the last three. The kid is caught if the distance shrank by more than the leeway.
5. With fewer than four good readings, the kid is not caught. Standing still must never be caught.

Win: a reading under the win distance during Red.

Limits to say out loud in the demo: the sensor sees a narrow cone straight ahead, and it sees movement toward the robot, not side to side.

## 6. Games and input

The parent picks a **game** and, separately, **how the kid moves**. Any game works with either input.

How the kid moves:

- **Body.** The kid moves toward the robot and the distance sensor checks them.
- **Switch.** For kids who play from an adaptive switch. The switch is Space, Enter or a big on-screen button. Each press during Green moves the kid's piece one step along a track on the screen. A press while the robot is checking is caught and sends the piece back to the start. Reaching the last step wins. Holding the key counts as one press.

Games:

- **Freeze Watcher (P0).** Section 5.
- **Say It to Sneak (P1).** Freeze Watcher with the word gate always on and a fixed 3 second Green light. Every Green light is earned with a practice word.
- **Robot Says (P1).** Eight commands, with a score out of 8. The robot faces the kid the whole time. Each command is spoken with or without "Robot says" (about 7 in 10 are real; "freeze" is always real).

| Command | Checked by |
| --- | --- |
| Take one step closer | Distance shrank by more than the leeway (switch: a press) |
| Take one step back | Distance grew by more than the leeway (switch: a press) |
| Freeze like a statue | Distance held still (switch: no press) |
| Wave hello | Parent presses They did it or Not yet |

A real command done scores a point. A fake command ignored scores a point. A fake command obeyed is "Gotcha!".

## 7. Speech

Web Speech API in Chrome. Recognition is weak on kids' voices, so the Good try button is always on screen whenever the app is listening. The word gate in Freeze Watcher can be switched off in settings.

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
| Game | Freeze Watcher, Say It to Sneak, Robot Says |
| How the kid moves | Moves their body toward the robot, or presses a switch |
| Robot looks away by | Turning its head. Spinning the whole car is listed only when the P2 firmware is present |
| Shortest green light | 3 s |
| Longest green light | 7 s |
| Time to freeze before the robot checks | 1 s |
| How long the robot stares | 2.5 s |
| Wiggle room before caught | 6 cm (replace with the measured value from the calibration ticket) |
| Win when closer than | 12 cm |
| Switch presses to win | 10 |
| Time to do each command (Robot Says only) | 3 s, from 1 to 15 s |
| Say a practice word before each green light | off |
| Practice words | rabbit, red, robot, run |

Lane length stays at 200 cm and is not shown to parents.

## 10. Progress (P1)

Four totals on the main screen: Rounds, Wins, Good freezes, Word tries. Times caught is counted but not shown, so the screen stays encouraging. One Reset button that asks first. Totals are saved on the device.

## 11. Code layout

```
app/
  index.html        play screen, settings, dashboard
  app.css           the one stylesheet: design tokens in :root, then layout and controls
  fonts/            Fredoka and Nunito (OFL), served locally so the demo works offline
  main.js           wires the page to the game, the robot and saved settings
  robot.js          robot interface: connect, lookAway, lookAtKid, distanceCm, setLight
  robot-serial.js   Web Serial transport
  robot-mock.js     slider-driven fake robot
  game/             pure logic and tests (movement, freeze-watcher, steps)
  speech.js         practice-word listener
  signals.js        screen, sound, vibration
  store.js          settings and progress in localStorage
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

1. **Stage.** A big round light in the state colour, a status line ("Bean is ready", "Green light!", "Red light!", "I saw you!", "You got me!"), a hint line, the switch track when switch input is on, and the live distance.
2. **Start and Stop.** Stop is always available. It ends the round, silences music and speech, stops listening, turns the robot to face the kid and sends the stop command.
3. **Parent buttons.** Good try (word), Kid is back at start, They did it, Not yet. Each is shown only while the game is waiting for it.
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

This route is built. Start the server with `node scripts/serve.mjs --lan` (or set `HOST`); without it the server stays on localhost and the phone remote is off. The laptop tab shows the phone address with a 6-digit code that changes on every server start. A phone with the right code copies the laptop's stage (status, light, track, buttons, progress and settings) within half a second and sends Start, Stop, Step, the grown-up buttons, Reset and settings back. The laptop does a press only while that button is on its own screen. A wrong code gets nothing, and after 20 wrong codes no phone may connect until the server restarts. Click once on the laptop tab before playing (Connect robot does this), so the browser lets it play sound, and keep that tab in front, because a background tab runs its timers slowly. Venue WiFi often blocks device-to-device traffic: use a phone hotspot.

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
