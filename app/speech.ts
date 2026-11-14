// Practice-word listener (spec, section 7). Recognition is weak on kids' voices,
// so the Good try button always ends the wait too.
const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canHear = !!Recognition;

const tidy = (text: string) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim()} `;
// True when one of the words was said as a whole word: "a red robot" has "red", "running" has no "run".
export const matches = (heard: string, words: string[]) => words.some((word) => tidy(heard).includes(tidy(word)));

let end = () => {};
export const stopListening = () => end();

// Resolves 'heard' when the microphone hears one of the words, 'accepted' when the Good try button is pressed,
// or null when stopListening() is called. The microphone opens after `ready`, so it does not hear Bean say the word.
export function listenFor(words: string[], button: HTMLElement, ready: Promise<unknown> = Promise.resolve()) {
  end();
  return new Promise<'heard' | 'accepted' | null>((resolve) => {
    let rec: Recognizer | undefined;
    const done = (how: 'heard' | 'accepted' | null) => {
      end = () => {};
      button.removeEventListener('click', accept);
      if (rec) {
        rec.onend = null;
        rec.abort();
      }
      resolve(how);
    };
    const accept = () => done('accepted');
    const mine = (end = () => done(null));
    button.addEventListener('click', accept);
    if (!Recognition) return;
    ready.then(() => {
      if (end !== mine) return; // already over
      const r = (rec = new Recognition());
      Object.assign(r, { lang: 'en-US', continuous: true, interimResults: true, maxAlternatives: 3 });
      r.onresult = (e) => {
        for (const result of e.results) for (const said of result) if (matches(said.transcript, words)) return done('heard');
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
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') r.onend = null; // no microphone: the button still works
      };
      listen();
    });
  });
}
