document.addEventListener("DOMContentLoaded", () => {
  const bg = document.getElementById("landingBg");
  if (!bg) return;

  const images = window.__MANIFEST__?.landing || [];
  if (!images.length) return;

  const index = Math.floor(Math.random() * images.length);
  bg.style.backgroundImage = `url(${images[index]})`;
});
