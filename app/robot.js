// Robot interface used by the game. A transport supplies send(command, wantReply),
// which resolves to the reply text, or null when no reply came.
// Commands are Elegoo's stock firmware protocol (docs/spec.md, section 4).

export const HEAD_AWAY = 180;
export const HEAD_KID = 90;

export function makeRobot(send) {
  return {
    lookAway: () => send({ N: 5, D1: 1, D2: HEAD_AWAY }, true),
    lookAtKid: () => send({ N: 5, D1: 1, D2: HEAD_KID }, true),
    // The firmware switches the LED off when any other mode command arrives,
    // so set the light after the head, never before.
    setLight: (r, g, b) => send({ N: 8, D1: 0, D2: r, D3: g, D4: b }, true),
    stop: () => send({ N: 100 }, false),
    async distanceCm() {
      const cm = parseInt(await send({ N: 21, D1: 2 }, true), 10);
      return Number.isNaN(cm) ? null : cm;
    },
  };
}

// Pulls complete "{id_value}" replies out of a serial buffer.
// Returns the replies and whatever partial text is left over.
export function parseReplies(buffer) {
  const replies = [];
  let end = 0;
  for (const m of buffer.matchAll(/\{([^_{}]+)_([^{}]*)\}/g)) {
    replies.push({ id: m[1], value: m[2] });
    end = m.index + m[0].length;
  }
  const rest = buffer.slice(end);
  // Keep only an unfinished reply; drop noise such as "error:deserializeJson".
  const open = rest.lastIndexOf('{');
  return { replies, rest: open < 0 ? '' : rest.slice(open) };
}
