document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("projects-list");
  const rightContainer = document.getElementById("right-container");

  if (!listEl || !rightContainer) return;

  const manifest = window.__MANIFEST__?.projects;

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.warn("Projects manifest is missing or empty.");
    return;
  }

  function openProject(slug) {
    fetch(`projects/${slug}/content.html`)
      .then((res) => res.text())
      .then((html) => {
        rightContainer.innerHTML = html;

        const gallery = rightContainer.querySelector("#project-gallery");
        if (!gallery) return;

        const basePath = `projects/${slug}/`;
        const totalImages = 25;

        for (let i = 1; i <= totalImages; i++) {
          const num = String(i).padStart(2, "0");
          const img = document.createElement("img");
          img.src = `${basePath}demon${num}.jpg`;
          img.loading = "lazy";
          gallery.appendChild(img);
        }
      });
  }

  manifest.forEach((project, index) => {
    if (!project?.slug || !project?.title) return;

    const section = document.createElement("section");
    section.className = "project-item";

    const img = document.createElement("img");
    img.className = "project-media";
    img.src = project.images?.[0] || "";
    img.alt = project.title;

    img.addEventListener("click", () => openProject(project.slug));

    section.appendChild(img);
    listEl.appendChild(section);
  });
});
