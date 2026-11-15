// Microphone listener for Talk with Bean (spec, section 15). Recognition is weak on kids' voices,
// so the Good try button always ends the wait too.
const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

const tidy = (text: string) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim()} `;
// True when one of the words was said as a whole word: "a red robot" has "red", "running" has no "run".
export const matches = (heard: string, words: string[]) => words.some((word) => tidy(heard).includes(tidy(word)));

let end = () => {};
export const stopListening = () => end();

// Talk with Bean (spec, section 15): listens for any answer, not for set words.
// Resolves the words heard, '' when Good try is pressed, or null when nothing was said within `ms`
// (counted from `ready`, so Bean's own line is not timed) or stopListening() was called.
export function listenAny(button: EventTarget, ready: Promise<unknown> = Promise.resolve(), ms = 6000) {
  end();
  return new Promise<string | null>((resolve) => {
    let rec: Recognizer | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (said: string | null) => {
      end = () => {};
      clearTimeout(timer);
      button.removeEventListener('click', accept);
      if (rec) {
        rec.onend = null;
        rec.abort();
      }
      resolve(said);
    };
    const accept = () => done('');
    const mine = (end = () => done(null));
    const wait = () => {
      clearTimeout(timer);
      timer = setTimeout(() => done(null), ms);
    };
    button.addEventListener('click', accept);
    ready.then(() => {
      if (end !== mine) return; // already over
      wait();
      if (!Recognition) return; // no microphone: Good try or the wait still ends the turn
      const r = (rec = new Recognition());
      Object.assign(r, { lang: 'en-US', continuous: true, interimResults: false, maxAlternatives: 1 });
      r.onspeechstart = wait; // the kid started talking: give them the full wait to finish
      r.onresult = (e) => {
        const said = [...e.results].filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ').trim();
        if (said) done(said);
      };
      const listen = () => {
        try {
          r.start();
        } catch {
          // already started
        }
      };
      r.onend = listen; // Chrome stops after a silence: keep listening
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') r.onend = null;
      };
      listen();
    });
  });
}
