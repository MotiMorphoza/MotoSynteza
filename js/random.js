document.addEventListener("DOMContentLoaded", () => {
  const bg = document.getElementById("landingBg");
  if (!bg) return;

  const VERSION = Date.now();
  const maxImages = 50;
  const images = [];
  let checked = 0;

  function tryImage(i) {
    const img = new Image();
    const path = `images/landing/hero${i}.jpg?${VERSION}`;

    img.onload = () => {
      images.push(path);
      checked++;
      if (checked === maxImages) setRandom();
    };

    img.onerror = () => {
      checked++;
      if (checked === maxImages) setRandom();
    };

    img.src = path;
  }

  function setRandom() {
    if (images.length === 0) return;
    const pick = images[Math.floor(Math.random() * images.length)];
    bg.style.backgroundImage = `url(${pick})`;
  }

  for (let i = 0; i < maxImages; i++) {
    tryImage(i);
  }
});
