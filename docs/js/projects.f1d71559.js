document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("projects-list");
  if (!listEl) return;

  const manifest = window.__MANIFEST__?.projects;

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.warn("Projects manifest is missing or empty.");
    return;
  }

  const BASE_PATH = "images/projects/";

  manifest.forEach((project, index) => {
    if (!project?.slug || !project?.title) return;

    // --- Section wrapper ---
    const section = document.createElement("section");
    section.className =
      "project-item " +
      (index % 2 === 0 ? "bg-1" : "bg-2") +
      (index % 2 === 1 ? " reverse" : "");

    // --- Grid container ---
    const grid = document.createElement("div");
    grid.className = "project-grid";

    // --- Media ---
    const media = document.createElement("img");
    media.className = "project-media";
    media.alt = project.title;
    media.setAttribute("aria-label", project.title);

    // Prevent layout shift (adjust ratio if needed)
    media.width = 1200;
    media.height = 800;

    // Loading strategy
    media.loading = index === 0 ? "eager" : "lazy";

    // Source
    if (Array.isArray(project.images) && project.images.length > 0) {
      media.src = `${BASE_PATH}${project.slug}/${project.images[0]}`;
    } else {
      media.classList.add("placeholder");
    }

    // Fallback on error
   media.onerror = () => {
  media.classList.add("placeholder");
  media.removeAttribute("src");
};
