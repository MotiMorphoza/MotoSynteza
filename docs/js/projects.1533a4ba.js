document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("projects-list");
  const rightContainer = document.getElementById("right-container");

  if (!listEl || !rightContainer) return;

  const manifest = window.__MANIFEST__?.projects;

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.warn("Projects manifest is missing or empty.");
    return;
  }

  manifest.forEach((project, index) => {
    if (!project?.slug || !project?.title) return;

    const section = document.createElement("section");
    section.className =
      "project-item " +
      (index % 2 === 0 ? "bg-1" : "bg-2") +
      (index % 2 === 1 ? " reverse" : "");

    const grid = document.createElement("div");
    grid.className = "project-grid";

    // לינק אמיתי כמו בתפריט
    const link = document.createElement("a");
link.href = "projects/demon_stration/content.html";
link.className = "project-link";


    const media = document.createElement("img");
    media.className = "project-media";
    media.alt = project.title;
    media.setAttribute("aria-label", project.title);
    media.loading = index === 0 ? "eager" : "lazy";

    if (Array.isArray(project.images) && project.images.length > 0) {
      media.src = project.images[0];
    } else {
      media.classList.add("placeholder");
    }

    media.onerror = () => {
      media.classList.add("placeholder");
      media.removeAttribute("src");
    };

    link.appendChild(media);

    const text = document.createElement("div");
    text.className = "project-text";

    const h2 = document.createElement("h2");
    h2.textContent = project.title;

    const p = document.createElement("p");
    p.textContent = project.description || "";

    text.appendChild(h2);
    text.appendChild(p);

    if (index % 2 === 0) {
      grid.appendChild(link);
      grid.appendChild(text);
    } else {
      grid.appendChild(text);
      grid.appendChild(link);
    }

    section.appendChild(grid);
    listEl.appendChild(section);

    if (index < manifest.length - 1) {
      const sep = document.createElement("div");
      sep.className = "separator";
      listEl.appendChild(sep);
    }
  });
});
