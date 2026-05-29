/* Speech recognition (Web Speech API). Lets a child answer out loud.
   Safari (iPadOS 14.5+) and Chrome expose this as webkitSpeechRecognition.
   It needs the microphone permission and an internet connection; when it
   isn't available the game just hides the mic button and stays tap-only. */
window.Voice = (function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let listening = false;

  function supported() { return !!SR; }

  // Begin listening for one short answer.
  // handlers: { onStart, onResult(alts[]), onError(code), onEnd(gotResult) }
  function start(handlers) {
    handlers = handlers || {};
    if (!SR) { handlers.onError && handlers.onError('unsupported'); return; }
    stop();
    let got = false;
    try {
      rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 5;   // several guesses to match against the options
      rec.onstart = () => { listening = true; handlers.onStart && handlers.onStart(); };
      rec.onresult = (e) => {
        got = true;
        const alts = [];
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          for (let j = 0; j < r.length; j++) alts.push(r[j].transcript);
        }
        handlers.onResult && handlers.onResult(alts);
      };
      rec.onerror = (e) => { handlers.onError && handlers.onError((e && e.error) || 'error'); };
      rec.onend = () => { listening = false; rec = null; handlers.onEnd && handlers.onEnd(got); };
      rec.start();
    } catch (err) {
      listening = false; rec = null;
      handlers.onError && handlers.onError('start-failed');
    }
  }

  function stop() {
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    listening = false;
  }

  function isListening() { return listening; }

  return { supported, start, stop, isListening };
})();
