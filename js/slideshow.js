document.addEventListener("DOMContentLoaded", () => {

  const viewport = document.querySelector("[data-slideshow]");
  if (!viewport) return;

  const manifest = window.__MANIFEST__?.main || [];
  if (!manifest.length) return;

  const path = "images/main";

  const slideA = document.createElement("img");
  const slideB = document.createElement("img");

  slideA.className = "slide active";
  slideB.className = "slide";

  viewport.appendChild(slideA);
  viewport.appendChild(slideB);

  let current = slideA;
  let next = slideB;
  let index = 0;
  let timer = null;
  let running = false;

  current.src = `${path}/${manifest[0]}`;

  function change() {
    index = (index + 1) % manifest.length;
    next.src = `${path}/${manifest[index]}`;

    current.classList.remove("active");
    next.classList.add("active");

    [current, next] = [next, current];

    prefetchNext();
  }

  function prefetchNext() {
    const nextIndex = (index + 1) % manifest.length;
    const img = new Image();
    img.src = `${path}/${manifest[nextIndex]}`;
  }

  function loop() {
    timer = setTimeout(() => {
      change();
      if (running) loop();
    }, 2500);
  }

  viewport.addEventListener("mouseenter", stop);
  viewport.addEventListener("mouseleave", start);

  function start() {
  if (running) return;
  running = true;
  loop();
}

function stop() {
  running = false;
  if (timer) clearTimeout(timer);
}

  viewport.addEventListener("click", () => {
    stop();
    change();
  });

  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  start();
});
