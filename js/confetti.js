/* Tiny canvas confetti — used on correct answers and the results screen.
   Perf notes: emoji are pre-rendered to small offscreen bitmaps once and
   drawn with drawImage (fillText with colour emoji is very slow on Windows),
   the piece count is capped, and off-screen pieces are culled early. */
window.Confetti = (function () {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let pieces = [];
  let raf = null;
  const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#52d1dc', '#ff7ab6'];
  const MAX_PIECES = 260;   // bounds the per-frame cost on slower machines
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  // pre-rendered emoji bitmaps, keyed by emoji + quantised size
  const sprites = {};
  function emojiSprite(emoji, size) {
    const k = emoji + '@' + size;
    if (!sprites[k]) {
      const c = document.createElement('canvas');
      c.width = c.height = size * 2;
      const g = c.getContext('2d');
      g.font = size + 'px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, size, size);
      sprites[k] = c;
    }
    return sprites[k];
  }

  function add(piece) {
    if (REDUCED) return;
    if (pieces.length >= MAX_PIECES) pieces.shift();   // drop the oldest
    pieces.push(piece);
  }

  function burst(count, originY) {
    const cx = window.innerWidth / 2;
    const cy = originY != null ? originY : window.innerHeight * 0.35;
    for (let i = 0; i < count; i++) {
      add({
        x: cx + (Math.random() - 0.5) * 200,
        y: cy + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -9 - 3,
        size: Math.random() * 8 + 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1
      });
    }
    if (!raf && pieces.length) loop();
  }

  function rain(count) {
    for (let i = 0; i < count; i++) {
      add({
        x: Math.random() * window.innerWidth,
        y: -20,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 9 + 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1
      });
    }
    if (!raf && pieces.length) loop();
  }

  // a shower of emoji (🔥⭐✨...) — for streaks and rare prizes
  function emojiBurst(emojis, count, originY) {
    const cx = window.innerWidth / 2;
    const cy = originY != null ? originY : window.innerHeight * 0.35;
    for (let i = 0; i < count; i++) {
      const size = 18 + 4 * Math.floor(Math.random() * 4);   // quantised: 18/22/26/30
      add({
        x: cx + (Math.random() - 0.5) * 240,
        y: cy + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * -10 - 4,
        size,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 0.2,
        life: 1
      });
    }
    if (!raf && pieces.length) loop();
  }

  function loop() {
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    pieces.forEach(p => {
      p.vy += 0.25;          // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      // cull anything that has left the stage (sides included)
      if (p.y > h + 40 || p.x < -40 || p.x > w + 40) { p.life = 0; return; }
      ctx.setTransform(1, 0, 0, 1, p.x, p.y);
      ctx.rotate(p.rot);
      if (p.emoji) {
        const img = emojiSprite(p.emoji, p.size);
        ctx.drawImage(img, -p.size, -p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    pieces = pieces.filter(p => p.life > 0);
    if (pieces.length) { raf = requestAnimationFrame(loop); }
    else { ctx.clearRect(0, 0, w, h); raf = null; }
  }

  return { burst, rain, emojiBurst };
})();
