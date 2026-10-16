// Scorrimento automatico a loop, fermabile e trascinabile (dito o mouse)
export function autoScroll(track, opts = {}) {
  const speed = opts.speed ?? 35;           // pixel al secondo
  const resumeMs = opts.resumeMs ?? 30000;  // 0 = resta fermo finché non esci e rientri
  const isBlocked = opts.isBlocked ?? (() => false);

  // Il dito può scorrere in orizzontale, la pagina in verticale
  track.style.touchAction = 'pan-x pan-y';
  track.style.overflowX = 'auto';
  track.style.scrollBehavior = 'auto';
  track.style.scrollSnapType = 'none';

  // Triplica gli elementi per il loop continuo
  const originals = Array.from(track.children);
  const n = originals.length;
  for (let i = 0; i < 2; i++) {
    originals.forEach((el) => track.appendChild(el.cloneNode(true)));
  }

  let setWidth = 0;
  let exact = 0;
  let lastSet = 0;
  let paused = false;
  let wasOut = false;
  let resumeTimer = 0;
  let raf = 0;
  let last = performance.now();

  const resume = () => {
    clearTimeout(resumeTimer);
    exact = track.scrollLeft;
    lastSet = track.scrollLeft;
    paused = false;
    last = performance.now();
  };
  const pause = () => {
    paused = true;
    clearTimeout(resumeTimer);
  };
  const scheduleResume = () => {
    clearTimeout(resumeTimer);
    if (resumeMs > 0) resumeTimer = setTimeout(resume, resumeMs);
  };

  // Dito
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', scheduleResume, { passive: true });
  track.addEventListener('touchcancel', scheduleResume, { passive: true });
  track.addEventListener('wheel', () => { pause(); scheduleResume(); }, { passive: true });

  // Mouse: trascinamento
  let down = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  track.addEventListener('mousedown', (e) => {
    down = true;
    moved = false;
    startX = e.pageX;
    startLeft = track.scrollLeft;
    pause();
  });
  window.addEventListener('mousemove', (e) => {
    if (!down) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 5) moved = true;
    track.scrollLeft = startLeft - dx;
  });
  window.addEventListener('mouseup', () => {
    if (!down) return;
    down = false;
    scheduleResume();
  });
  // Dopo un trascinamento, evita il click accidentale (es. avvio video)
  track.addEventListener(
    'click',
    (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    },
    true
  );
  track.addEventListener('dragstart', (e) => e.preventDefault());

  track.addEventListener(
    'scroll',
    () => {
      if (!setWidth) return;
      // Scorrimento fatto dall'utente: ferma e rimanda la ripartenza
      if (Math.abs(track.scrollLeft - lastSet) > 2) {
        pause();
        if (!down) scheduleResume();
      }
      // Rientra nel loop senza salti visibili
      if (paused) {
        if (track.scrollLeft >= setWidth * 2) track.scrollLeft -= setWidth;
        else if (track.scrollLeft <= 0) track.scrollLeft += setWidth;
        lastSet = track.scrollLeft;
      }
    },
    { passive: true }
  );

  // Se esci dalla sezione e ci ritorni, riparte
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) wasOut = true;
    else if (wasOut) {
      wasOut = false;
      if (paused) resume();
    }
  });
  io.observe(track);

  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!paused && !isBlocked() && setWidth) {
      exact += speed * dt;
      if (exact >= setWidth * 2) exact -= setWidth;
      track.scrollLeft = Math.round(exact);
      lastSet = track.scrollLeft;
    }
    raf = requestAnimationFrame(tick);
  };

  const start = setTimeout(() => {
    const kids = track.children;
    if (kids.length > n) {
      setWidth = kids[n].offsetLeft - kids[0].offsetLeft;
      exact = setWidth;
      track.scrollLeft = setWidth;
      lastSet = track.scrollLeft;
    }
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }, 300);

  return () => {
    clearTimeout(start);
    clearTimeout(resumeTimer);
    cancelAnimationFrame(raf);
    io.disconnect();
  };
}