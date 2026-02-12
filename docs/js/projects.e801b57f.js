document.addEventListener("DOMContentLoaded", () => {

  const listEl = document.getElementById("projects-list");
  if (!listEl) return;

  const manifest = window.__MANIFEST__?.projects || [];

  manifest.forEach((project, index) => {

    const section = document.createElement("section");
    section.className =
      "project-item " +
      (index % 2 === 0 ? "bg-1" : "bg-2") +
      (index % 2 === 1 ? " reverse" : "");

    const grid = document.createElement("div");
    grid.className = "project-grid";

    const media = document.createElement("img");
    media.className = "project-media";
    media.loading = "lazy";

    if (project.images.length) {
      media.src =
        "images/projects/" +
        project.slug +
        "/" +
        project.images[0];
    }

    const text = document.createElement("div");
    text.className = "project-text";
    text.innerHTML =
      "<h2>" +
      project.slug.replace(/-/g, " ") +
      "</h2>";

    const link = document.createElement("a");
    link.href = "projects/" + project.slug + "/";
    link.appendChild(media);

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
