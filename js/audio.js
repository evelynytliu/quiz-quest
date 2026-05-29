/* Synthesized sound effects (Web Audio API) + speech (Web Speech API).
   No external audio files needed, so it works offline / from a local file. */
window.Sfx = (function () {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    return ctx;
  }

  function tone(freq, start, dur, type, gain) {
    const c = ac(); if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain || 0.25, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + dur + 0.02);
  }

  function correct() {
    tone(523, 0, 0.12, 'triangle', 0.3);   // C5
    tone(659, 0.10, 0.12, 'triangle', 0.3); // E5
    tone(784, 0.20, 0.20, 'triangle', 0.3); // G5
  }
  function wrong() {
    tone(200, 0, 0.25, 'sawtooth', 0.2);
    tone(150, 0.12, 0.30, 'sawtooth', 0.2);
  }
  function tick() { tone(880, 0, 0.05, 'square', 0.08); }
  function beep() { tone(660, 0, 0.18, 'square', 0.2); }
  function go() { tone(990, 0, 0.35, 'triangle', 0.28); }
  function fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.3));
  }
  function tap() { tone(440, 0, 0.04, 'sine', 0.12); }

  /* ---------- speech ---------- */
  let voice = null;
  let zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    // prefer a clear English voice, ideally a child/female friendly one
    voice = voices.find(v => /en(-|_)?US/i.test(v.lang) && /female|samantha|zira|google us english/i.test(v.name))
         || voices.find(v => /^en/i.test(v.lang))
         || voices[0] || null;
    // a Mandarin voice for reading Chinese characters aloud (zh-TW preferred)
    zhVoice = voices.find(v => /^zh(-|_)?(tw|hant)/i.test(v.lang))
           || voices.find(v => /^zh(-|_)?(cn|hans)/i.test(v.lang))
           || voices.find(v => /^zh/i.test(v.lang))
           || voices.find(v => /^(yue|cmn)/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  // is a Mandarin/Chinese voice available on this device?
  function zhAvailable() {
    if (zhVoice) return true;
    try { return (speechSynthesis.getVoices() || []).some(v => /^(zh|yue|cmn)/i.test(v.lang)); }
    catch (e) { return false; }
  }

  function utter(text, rate) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate || 0.85; u.pitch = 1.12; u.volume = 1;
    if (voice) u.voice = voice;
    return u;
  }
  function utterZh(text, rate) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (zhVoice && zhVoice.lang) || 'zh-TW';
    u.rate = rate || 0.75; u.pitch = 1.05; u.volume = 1;   // a touch slower & clearer
    if (zhVoice) u.voice = zhVoice;
    return u;
  }

  // onState(isSpeaking) fires when this single utterance starts / ends, so the
  // caller can highlight the matching button while it's being read.
  function speak(text, onState) {
    if (!('speechSynthesis' in window) || muted) return;
    speechSynthesis.cancel();
    const u = utter(text);
    if (typeof onState === 'function') {
      u.onstart = () => onState(true);
      u.onend = () => onState(false);
    }
    speechSynthesis.speak(u);
  }

  // Speak a Chinese word/character in Mandarin (say it twice so it's clear).
  function speakZh(text, onState) {
    if (!('speechSynthesis' in window) || muted) return;
    speechSynthesis.cancel();
    const u = utterZh(text);
    if (typeof onState === 'function') {
      u.onstart = () => onState(true);
      u.onend = () => onState(false);
    }
    speechSynthesis.speak(u);
  }

  // Read the question, then each answer option in order (with a tiny lead-in).
  // onOption(index, isSpeaking) fires as each option is read, so the caller can
  // gently enlarge the matching button while the voice is on it.
  function speakList(question, options, onOption) {
    if (!('speechSynthesis' in window) || muted) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter(question, 0.82));
    if (options && options.length) {
      speechSynthesis.speak(utter('Is it ...', 0.85));
      options.forEach((o, i) => {
        const u = utter(String(o), 0.85);
        if (typeof onOption === 'function') {
          u.onstart = () => onOption(i, true);
          u.onend = () => onOption(i, false);
        }
        speechSynthesis.speak(u);
      });
    }
  }

  // For Chinese "meaning" questions: say the character in Mandarin first (so the
  // child hears its real sound), then read the English question + options.
  function speakChineseMeaning(zhChar, question, options, onOption) {
    if (!('speechSynthesis' in window) || muted) return;
    speechSynthesis.cancel();
    if (zhChar && zhAvailable()) {
      speechSynthesis.speak(utterZh(zhChar, 0.7));
      speechSynthesis.speak(utterZh(zhChar, 0.7));   // twice, nice and clear
    }
    speechSynthesis.speak(utter(question, 0.82));
    if (options && options.length) {
      speechSynthesis.speak(utter('Is it ...', 0.85));
      options.forEach((o, i) => {
        const u = utter(String(o), 0.85);
        if (typeof onOption === 'function') {
          u.onstart = () => onOption(i, true);
          u.onend = () => onOption(i, false);
        }
        speechSynthesis.speak(u);
      });
    }
  }

  function stopSpeak() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  function resume() { const c = ac(); if (c && c.state === 'suspended') c.resume(); }
  function setMuted(m) { muted = m; if (m) stopSpeak(); }

  return { correct, wrong, tick, beep, go, fanfare, tap, speak, speakList,
    speakZh, speakChineseMeaning, zhAvailable, stopSpeak, resume, setMuted };
})();
