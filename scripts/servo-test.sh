#!/bin/sh
# Turns the car's head away and back twice over the USB cable, without the app: a quick check of the cable,
# the firmware and the head servo. Each "{n_ok}" reply means the car accepted that command.
# Close or reload any Bean tab that is connected by cable first: only one program can hold the port.
# Usage (Git Bash on Windows, where COM3 is /dev/ttyS2; Linux or macOS: the car's /dev/tty... device):
#   sh scripts/servo-test.sh [/dev/ttyS2]
port=${1:-/dev/ttyS2}

exec 3<>"$port" 2>/dev/null || {
  echo "COULD NOT OPEN $port (if Bean is connected by cable in Chrome, it holds the port: reload that tab first)"
  exit 1
}
# One open for the whole test (each open resets the board), and the settings go on that open:
# raw bytes at 9600 baud, and a read gives up after 0.1 s of quiet instead of waiting for a whole line.
stty 9600 cs8 -cstopb -parenb -echo -icanon -icrnl -onlcr -ixon min 0 time 1 <&3 2>/dev/null
read_port() { timeout 0.5 cat <&3; } # the timeout guards against a port that ignores the settings
sleep 2.5 # the board needs about 2 s to boot after the reset
read_port >/dev/null # drop the boot noise

i=1
for deg in 180 90 180 90; do # 180 = away, 90 = facing the kid (app/robot.ts)
  printf '{"H":"%s","N":5,"D1":1,"D2":%s}' "$i" "$deg" >&3
  sleep 1.5
  echo "head to $deg -> reply: [$(read_port | tr -d '\r\n')]"
  i=$((i + 1))
done
exec 3<&-
echo "port closed"
