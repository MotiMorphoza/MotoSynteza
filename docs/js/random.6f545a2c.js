document.addEventListener("DOMContentLoaded", () => {

  const bg = document.getElementById("landingBg");
  if (!bg) return;

  const manifest = window.__MANIFEST__?.landing || [];
  if (!manifest.length) return;

  const pick = manifest[Math.floor(Math.random() * manifest.length)];

  bg.style.backgroundImage = `url("images/landing/${pick}")`;

});
