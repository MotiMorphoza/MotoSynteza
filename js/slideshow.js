/* =========================
   MotoSynteza Slideshow
   Stable Version
========================= */

if (window.__motoSlideInit) {
  console.warn("Slideshow already initialized.");
} else {
  window.__motoSlideInit = true;

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

    /* -------------------------
       Create 2 slide layers
    -------------------------- */

    const slideA = document.createElement("img");
    const slideB = document.createElement("img");

    slideA.className = "slide active";
    slideB.className = "slide";

    viewport.appendChild(slideA);
    viewport.appendChild(slideB);

    let current = slideA;
    let next = slideB;

    /* -------------------------
       Detect images
    -------------------------- */

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

    /* -------------------------
       Change slide
    -------------------------- */

    function change() {
      if (images.length === 0) return;

      index = (index + 1) % images.length;
      next.src = images[index];

      // ensure only one active at any time
      current.classList.remove("active");
      next.classList.add("active");

      const temp = current;
      current = next;
      next = temp;
    }

    /* -------------------------
       Loop
    -------------------------- */

    function loop() {
      timer = setTimeout(() => {
        change();
        if (running) loop();
      }, 2500);
    }

    function startAuto() {
      if (running) return;
      running = true;
      loop();
    }

    function stopAuto() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    /* -------------------------
       Init
    -------------------------- */

    function start() {
      if (images.length === 0) return;

      index = Math.floor(Math.random() * images.length);
      current.src = images[index];

      // Hover stop
      slideA.addEventListener("mouseenter", stopAuto);
      slideA.addEventListener("mouseleave", startAuto);

      slideB.addEventListener("mouseenter", stopAuto);
      slideB.addEventListener("mouseleave", startAuto);

      // Manual click
      viewport.addEventListener("click", () => {
        stopAuto();
        change();
      });

      // Page visibility
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopAuto();
        } else {
          startAuto();
        }
      });

      startAuto();
    }

    detect(0);

  });
}
