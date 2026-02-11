document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.querySelector("[data-slideshow]");
  if (!viewport) return;

  const path = viewport.dataset.path || "images/main";
  const maxImages = 100;
  const VERSION = Date.now();

  const images = [];
  let index = 0;
  let timer = null;
  let running = false;

  // create slide layers
  const slideA = document.createElement("img");
  const slideB = document.createElement("img");

  slideA.className = "slide active";
  slideB.className = "slide";

  viewport.appendChild(slideA);
  viewport.appendChild(slideB);

  let current = slideA;
  let next = slideB;

  function detect(i) {
    if (i > maxImages) {
      start();
      return;
    }

    const src = `${path}/slide${i}.jpg?${VERSION}`;
    const img = new Image();

    img.onload = () => {
      images.push(src);
      detect(i + 1);
    };

    img.onerror = () => {
      start();
    };

    img.src = src;
  }

  function change() {
    if (!running || images.length === 0) return;

    index = (index + 1) % images.length;
    next.src = images[index];

    next.classList.add("active");
    current.classList.remove("active");

    const temp = current;
    current = next;
    next = temp;
  }

  function loop() {
    if (!running) return;
    change();
    timer = setTimeout(loop, 2500);
  }

  function startAuto() {
    if (running) return;
    running = true;
    loop();
  }

  function stopAuto() {
    running = false;
    clearTimeout(timer);
  }

  function start() {
    if (images.length === 0) return;

    index = Math.floor(Math.random() * images.length);
    current.src = images[index];

    viewport.addEventListener("mouseenter", stopAuto);
    viewport.addEventListener("mouseleave", startAuto);
    viewport.addEventListener("click", change);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    startAuto();
  }

  detect(0);
});
