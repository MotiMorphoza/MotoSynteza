const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUT = "docs";

// ניקוי
if (fs.existsSync(OUT)) {
  fs.rmSync(OUT, { recursive: true, force: true });
}
fs.mkdirSync(OUT);

// HASH
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
}

function copyWithHash(filePath) {
  const hash = hashFile(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  const newName = `${name}.${hash}${ext}`;

  const destDir = path.join(OUT, path.dirname(filePath));
  fs.mkdirSync(destDir, { recursive: true });

  fs.copyFileSync(filePath, path.join(destDir, newName));
  return path.join(path.dirname(filePath), newName).replace(/\\/g, "/");
}

// העתקת תיקיות
function copyFolder(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  fs.readdirSync(src).forEach((item) => {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyFolder(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  });
}

// HASH ל CSS ו JS
const assetFolders = ["css", "js"];
const hashedMap = {};

assetFolders.forEach((folder) => {
  if (!fs.existsSync(folder)) return;

  fs.readdirSync(folder)
    .filter((f) => f.endsWith(".css") || f.endsWith(".js"))
    .forEach((file) => {
      const fullPath = path.join(folder, file);
      hashedMap[fullPath] = copyWithHash(fullPath);
    });
});

// העתקת images
copyFolder("images", path.join(OUT, "images"));

// ---------- IMAGE MANIFEST ----------
function getImages(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs
    .readdirSync(folderPath)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort();
}

// פונקציה לנרמול שם תיקייה ל-slug נקי
function normalizeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// כאן אתה מגדיר כותרות ותיאורים
const projectMeta = {
  "unusuall-usual": {
    order: 1,
    title: "uNuSuAll usual",
    description:
      "A study of ordinary places made strange through angle, rhythm, and timing.",
  },
  "window-to-redemption": {
    order: 2,
    title: "Window to Redemption",
    description:
      "A stark, cinematic glimpse into moments where darkness breaks and a new path appears.",
  },
  "ohhhhh-your-god": {
    order: 3,
    title: "OHHHHH YOUR GOD",
    description: "A loud visual collision of fear, irony, and reverence.",
  },
  "demon-stration": {
    order: 4,
    title: "Demon Stration",
    description:
      "An expressive visual narrative balancing provocation with theatrical composition.",
  },
  "windows-eyes-of-the-modern-soul": {
    order: 5,
    title: "Windows – Eyes of the Modern Soul",
    description: "Reflections of contemporary life framed through glass.",
  },
};

const manifest = {
  landing: getImages("images/landing"),
  main: getImages("images/main"),
  projects: fs.existsSync("images/projects")
    ? fs
        .readdirSync("images/projects")
        .filter((f) =>
          fs.statSync(path.join("images/projects", f)).isDirectory(),
        )
        .map((folder) => {
          const slug = normalizeSlug(folder);
          return {
            slug: folder,
            key: slug,
            order: projectMeta[slug]?.order ?? 999,
            title: projectMeta[slug]?.title || folder,
            description: projectMeta[slug]?.description || "",
            images: getImages(path.join("images/projects", folder)),
          };
        })
        .sort((a, b) => a.order - b.order)
    : [],
};

// כתיבת manifest
fs.mkdirSync(path.join(OUT, "js"), { recursive: true });
fs.writeFileSync(
  path.join(OUT, "js/image-manifest.js"),
  `window.__MANIFEST__ = ${JSON.stringify(manifest, null, 2)};`,
);

// ---------- HTML ----------
fs.readdirSync(".")
  .filter((f) => f.endsWith(".html"))
  .forEach((file) => {
    let html = fs.readFileSync(file, "utf8");

    Object.entries(hashedMap).forEach(([original, hashed]) => {
      const originalFile = path.basename(original);
      const hashedFile = path.basename(hashed);
      html = html.replaceAll(originalFile, hashedFile);
    });

    fs.writeFileSync(path.join(OUT, file), html);
  });

console.log("Super Build v2 complete.");
