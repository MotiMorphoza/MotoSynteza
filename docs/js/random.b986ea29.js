document.addEventListener("DOMContentLoaded", () => {

  const bg = document.getElementById("landingBg");
  if (!bg) return;

  const images = window.__IMAGES__?.landing || [];
  if (images.length === 0) return;

  const pick = images[Math.floor(Math.random() * images.length)];

  bg.style.backgroundImage = `url("images/landing/${pick}")`;

});
