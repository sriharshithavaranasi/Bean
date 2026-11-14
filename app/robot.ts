// Robot interface used by the game. A transport supplies send(command, wantReply),
// which resolves to the reply text, or null when no reply came.
// Commands are Elegoo's stock firmware protocol (docs/spec.md, section 4).

export const HEAD_AWAY = 180;
export const HEAD_KID = 90;

export type Command = Record<string, number>;
export type Send = (command: Command, wantReply: boolean) => Promise<string | null>;
export type Robot = ReturnType<typeof makeRobot>;

export function makeRobot(send: Send) {
  return {
    lookAway: () => send({ N: 5, D1: 1, D2: HEAD_AWAY }, true),
    lookAtKid: () => send({ N: 5, D1: 1, D2: HEAD_KID }, true),
    // The firmware switches the LED off when any other mode command arrives,
    // so set the light after the head, never before.
    setLight: (r: number, g: number, b: number) => send({ N: 8, D1: 0, D2: r, D3: g, D4: b }, true),
    stop: () => send({ N: 100 }, false),
    async distanceCm() {
      const cm = parseInt((await send({ N: 21, D1: 2 }, true)) ?? '', 10);
      return Number.isNaN(cm) ? null : cm;
    },
  };
}

// Matches replies to commands for any wire (USB cable or WiFi). write(text) sends one command;
// receive(text) takes whatever arrived. A missing reply resolves to null after replyMs; send never throws or stalls the game.
export function makeLink(write: (text: string) => unknown, replyMs = 500) {
  const waiting = new Map<string, (value: string | null) => void>(); // id -> resolve
  let nextId = 1;
  let buffer = '';
  async function send(command: Command, wantReply: boolean) {
    const id = String(nextId++);
    const reply = wantReply
      ? new Promise<string | null>((resolve) => {
          waiting.set(id, resolve);
          setTimeout(() => {
            waiting.delete(id);
            resolve(null);
          }, replyMs);
        })
      : null;
    try {
      await write(JSON.stringify({ H: id, ...command }));
    } catch {
      return null;
    }
    return reply;
  }
  function receive(text: string) {
    const parsed = parseReplies(buffer + text);
    buffer = parsed.rest;
    for (const { id, value } of parsed.replies) {
      waiting.get(id)?.(value);
      waiting.delete(id);
    }
  }
  return { robot: makeRobot(send), receive };
}

// Pulls complete "{id_value}" replies out of a serial buffer.
// Returns the replies and whatever partial text is left over.
export function parseReplies(buffer: string) {
  const replies: { id: string; value: string }[] = [];
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
