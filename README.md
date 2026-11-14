# Bean

Bean is a robot car that plays Red Light, Green Light with a kid. Bean is the watcher: it turns its head away for Green light, looks back for Red light, and catches anyone it sees moving closer. Kids can sneak by walking, crawling or rolling. A parent or therapist runs the game from a laptop or a phone.

Bean is a play and practice tool that can support therapy. It is not a treatment.

The full design is in [docs/spec.md](docs/spec.md).

## Play in ten minutes

### What you need

- The ELEGOO Smart Robot Car Kit V4.0, built, with charged batteries.
- A laptop with Chrome or Edge, and [Node.js](https://nodejs.org) 22.18 or newer.
- The USB cable from the kit.
- Tape, and about 1.5 m of clear floor (the lane is 1 m).
- Optional: a phone on the same WiFi as the laptop, to run the game from across the room.

No car yet? Skip to step 4. The app plays with a pretend robot: a slider stands in for the distance sensor.

### 1. Put the stock firmware on the car

Bean uses ELEGOO's own firmware, so there is no Arduino code to write. A new car usually already has it. Only flash it if the car was reprogrammed.

1. Install the [Arduino IDE](https://www.arduino.cc/en/software).
2. Copy the folders in `tutorial/ELEGOO Smart Robot Car Kit V4.0 2021.04.14/01 ReadMeFirst/CopyMeFirst/` into your Arduino `libraries` folder (`tutorial/05 How to add .zip Library.pdf` shows how).
3. Find the shield on the car: it is printed on the board. Open the matching sketch in `tutorial/ELEGOO Smart Robot Car Kit V4.0 2021.04.14/02 Manual & Main Code & APP/02 Main Program   (Arduino UNO)/`:
   - TB6612 with MPU6050: `TB6612 & MPU6050/SmartRobotCarV4.0_V1_20230201/`
   - TB6612 with QMI8658C: `TB6612 & QMI8658C/SmartRobotCarV4.0_V2_20220322/`
   - DRV8835: `DRV8835/SmartRobotCarV4.0_V0_20210120/`
4. Plug the car in, pick **Arduino Uno** and its port, and press Upload. If the upload fails, move the shield's upload switch to the upload position and try again.

### 2. Plug in and tape the lane

1. Plug the car into the laptop with the USB cable and switch the car on.
2. Put the car at one end of the floor, facing down the lane.
3. Tape a straight lane about 1 m long in front of the car, with a start line at the far end. The sensor reads a person reliably only to about 1 m. Make the lane only about as wide as the kid's shoulders, with the car at the middle: about 40 cm from the car, one shoe width off the middle is already out of sight.

### 3. Learn the limits

Say these out loud before playing, so nobody is surprised:

- The sensor sees a narrow cone straight ahead. Keep the kid inside the lane.
- It sees movement toward the car, not side to side.
- The real car needs Chrome or Edge on a laptop. A phone cannot plug into the car; it works as a remote through the laptop (step 6).

### 4. Start the app

In the repo folder:

```sh
npm start
```

Open http://localhost:8000 in Chrome or Edge on the laptop.

### 5. Connect and play

1. Connect the car by cable: press **Connect by cable**, then pick the car's port (unplug and replug the car to see which one it is). On Windows it shows as `USB-SERIAL CH340`; if no such port appears, install the CH340 driver (`CH341SER.EXE` from wch-ic.com) and replug. The car resets and takes about 2 seconds to wake up. Set the shield's switch (next to the USB port) to **upload** first: on **cam**, the camera board holds the line the cable uses and the car hears nothing.
2. Open **Grown-up settings** to pick the game (Red Light, Green Light or Say It to Sneak).
3. The kid stands on the start line, facing Bean.
4. Press **Start**. Turn the volume up: the music, voice and cues come from the laptop.
5. Green light: Bean looks away and the kid sneaks closer. Red light: Bean looks back and the kid freezes. Moving during Red light sends the kid back to the start. Reaching Bean wins.

If the car is lost (cable out, car off), the app says so and keeps playing with the pretend robot. Fix it and press the connect button again.

### 6. Optional: run it from a phone

The laptop stays next to the car and does the sound and listening. The phone becomes a remote.

1. Start the server with the phone remote on:

   ```sh
   npm start -- --lan
   ```

2. On Windows, allow Node.js through the firewall when asked.
3. Open http://localhost:8000 on the laptop and connect the car (step 5). That click also lets the laptop play sound. Keep that tab in front.
4. The Robot card on the laptop shows an address with a 6-digit code. Open that address on the phone.

The phone shows the same game screen and sends the button presses to the laptop. A phone without the code cannot control the game. Venue WiFi often blocks phones from reaching laptops: if the phone cannot connect, put both on a phone hotspot.

### Not yet checked on the real car

Checked on the car: the head and LED commands, distance readings over the cable, a full round in the app, the fallback when the cable comes out, the 15 cm wiggle room (#3), and the lane's length and width (#4). Still to check: catches over many real rounds (#11). See the open issues.

## Develop

```sh
npm install        # only for the type check
npm test
npm run typecheck
```

The app is plain HTML, CSS and TypeScript modules in `app/`, with no build step and no runtime dependencies. `scripts/serve.ts` strips the types as it serves each `.ts` file, so only erasable TypeScript is allowed (no enums, namespaces or parameter properties), and imports name the `.ts` file. Game logic is pure functions in `app/game/`, tested with `node --test`. `scripts/serve.ts` serves the app and runs the phone relay. `npm run typecheck` runs `tsc`; the `typescript` and `@types/node` dev dependencies are only for that.

## Working here with Claude Code

1. Clone the repo and open it in Claude Code. Node must be on your PATH.
2. Accept the prompt to trust the folder and install its plugins. Ponytail and superpowers are then on in every session here, along with the project skills in `.claude/skills/`.
3. Your agent sets up the communication branch itself on first run (`sh scripts/setup-comms.sh`).

How agents work in this repo, including the communication branch, is in [AGENTS.md](AGENTS.md).
