#!/bin/sh
# Head servo check over the USB cable, without the app: middle, left, middle, right, middle.
# Each "{n_ok}" reply means the car accepted the command. Close or reload any Bean tab connected by cable first.
# Usage (Git Bash; COM3 is /dev/ttyS2): sh scripts/servo-test.sh [/dev/ttyS2]
port=${1:-/dev/ttyS2}

exec 3<>"$port" || { echo "Could not open $port. Is a Bean tab connected by cable? Reload it first."; exit 1; }
stty 9600 cs8 -cstopb -parenb -echo -icanon -icrnl -onlcr -ixon min 0 time 1 <&3
# Opening the port restarts the car's board, and the head twitches while it boots: wait it out.
sleep 3
timeout 0.5 cat <&3 >/dev/null

i=1
for deg in 90 180 90 0 90; do # 90 = middle (facing the kid), 180 = left, 0 = right
  printf '{"H":"%s","N":5,"D1":1,"D2":%s}' "$i" "$deg" >&3
  sleep 1.5
  echo "head to $deg: $(timeout 0.5 cat <&3 | tr -d '\r\n')"
  i=$((i + 1))
done
exec 3<&-
