/* Tiny canvas confetti — used on correct answers and the results screen. */
window.Confetti = (function () {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let pieces = [];
  let raf = null;
  const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#52d1dc', '#ff7ab6'];

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  function burst(count, originY) {
    const cx = window.innerWidth / 2;
    const cy = originY != null ? originY : window.innerHeight * 0.35;
    for (let i = 0; i < count; i++) {
      pieces.push({
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
    if (!raf) loop();
  }

  function rain(count) {
    for (let i = 0; i < count; i++) {
      pieces.push({
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
    if (!raf) loop();
  }

  // a shower of emoji (🔥⭐✨...) — for streaks and rare prizes
  function emojiBurst(emojis, count, originY) {
    const cx = window.innerWidth / 2;
    const cy = originY != null ? originY : window.innerHeight * 0.35;
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: cx + (Math.random() - 0.5) * 240,
        y: cy + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * -10 - 4,
        size: Math.random() * 12 + 18,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 0.2,
        life: 1
      });
    }
    if (!raf) loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.vy += 0.25;          // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > window.innerHeight + 30) p.life = 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.emoji) {
        ctx.font = p.size + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    });
    pieces = pieces.filter(p => p.life > 0);
    if (pieces.length) { raf = requestAnimationFrame(loop); }
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); raf = null; }
  }

  return { burst, rain, emojiBurst };
})();
