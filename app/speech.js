// Practice-word listener (spec, section 7). Recognition is weak on kids' voices,
// so the Good try button always ends the wait too.
const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canHear = !!Recognition;

const tidy = (text) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim()} `;
// True when one of the words was said as a whole word: "a red robot" has "red", "running" has no "run".
export const matches = (heard, words) => words.some((word) => tidy(heard).includes(tidy(word)));

let end = () => {};
export const stopListening = () => end();

// Resolves 'heard' when the microphone hears one of the words, 'accepted' when the Good try button is pressed,
// or null when stopListening() is called. The microphone opens after `ready`, so it does not hear Bean say the word.
export function listenFor(words, button, ready = Promise.resolve()) {
  end();
  return new Promise((resolve) => {
    let rec;
    const done = (how) => {
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
      rec = new Recognition();
      Object.assign(rec, { lang: 'en-US', continuous: true, interimResults: true, maxAlternatives: 3 });
      rec.onresult = (e) => {
        for (const result of e.results) for (const said of result) if (matches(said.transcript, words)) return done('heard');
      };
      const listen = () => {
        try {
          rec.start();
        } catch {
          // already started
        }
      };
      rec.onend = listen; // Chrome stops after a silence: keep listening
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') rec.onend = null; // no microphone: the button still works
      };
      listen();
    });
  });
}
