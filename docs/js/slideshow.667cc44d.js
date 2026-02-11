document.addEventListener("DOMContentLoaded", () => {

  const viewport = document.querySelector("[data-slideshow]");
  if (!viewport) return;

  const images = window.__IMAGES__?.main || [];
  if (images.length === 0) return;

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

  // מתחיל תמיד מהראשון (preload תואם)
  current.src = `${path}/${images[0]}`;

  function change() {
    index = (index + 1) % images.length;
    next.src = `${path}/${images[index]}`;

    current.classList.remove("active");
    next.classList.add("active");

    const temp = current;
    current = next;
    next = temp;
  }

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
    if (timer) clearTimeout(timer);
  }

  viewport.addEventListener("click", () => {
    stopAuto();
    change();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAuto();
    else startAuto();
  });

  startAuto();
});
