document.addEventListener("DOMContentLoaded", () => {

  const listEl = document.getElementById("projects-list");
  if (!listEl) return;

  const manifest = window.__MANIFEST__?.projects || [];

  manifest.forEach((project, index) => {

    const section = document.createElement("section");
    section.className = "project-item";

    const grid = document.createElement("div");
    grid.className = "project-grid";

    const link = document.createElement("a");
    link.href = `projects/${project.slug}/`;

    const img = document.createElement("img");
    img.className = "project-media";
    img.loading = "lazy";

    if (project.images.length) {
      img.src = `images/projects/${project.slug}/${project.images[0]}`;
    }

    link.appendChild(img);
    grid.appendChild(link);
    section.appendChild(grid);
    listEl.appendChild(section);

  });

});
