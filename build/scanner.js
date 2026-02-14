// build/scanner.js
const fs = require('fs');
const path = require('path');

class Scanner {
  constructor(logger) {
    this.logger = logger;
    this.excludeDirs = [
      '.git',
      '__pycache__',
      'node_modules',
      'docs',
      '.build-temp',
      '.docs-backup'
    ];

    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    this.fontExtensions = ['.woff2', '.woff', '.ttf', '.otf', '.eot'];
  }

  // --------------------------------------------------
  // Generic recursive scanner
  // --------------------------------------------------
  scanDirectory(dir, extensions = [], additionalExcludes = [], rootDir = dir) {
    const results = [];

    if (!fs.existsSync(dir)) return results;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (this.shouldExclude(entry.name, additionalExcludes)) continue;

        results.push(
          ...this.scanDirectory(fullPath, extensions, additionalExcludes, rootDir)
        );
      } else {
        if (
          extensions.length === 0 ||
          extensions.includes(path.extname(entry.name).toLowerCase())
        ) {
          const relative = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          results.push(relative);
        }
      }
    }

    return results.sort();
  }

  shouldExclude(name, additionalExcludes = []) {
    if (name.startsWith('.')) return true;
    if (this.excludeDirs.includes(name)) return true;
    if (additionalExcludes.includes(name)) return true;
    return false;
  }

  // --------------------------------------------------
  // Root-level HTML pages only (not fragments)
  // --------------------------------------------------
  findHtmlFiles(rootDir) {
    if (!fs.existsSync(rootDir)) return [];

    const files = fs.readdirSync(rootDir);
    const htmlFiles = [];

    for (const file of files) {
      if (!file.endsWith('.html')) continue;

      const fullPath = path.join(rootDir, file);

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (/<head[^>]*>/i.test(content)) {
          htmlFiles.push(file);
        } else {
          this.logger.debug?.(`Skipping fragment HTML: ${file}`);
        }
      } catch {
        continue;
      }
    }

    return htmlFiles.sort();
  }

  // --------------------------------------------------
  // Font discovery (preload candidate)
  // --------------------------------------------------
  findFonts(dir, limit = 2) {
    const allFonts = this.scanDirectory(
      dir,
      this.fontExtensions,
      [],
      dir
    );

    const sorted = allFonts.sort((a, b) => {
      const extA = path.extname(a);
      const extB = path.extname(b);

      if (extA === '.woff2' && extB !== '.woff2') return -1;
      if (extA !== '.woff2' && extB === '.woff2') return 1;
      if (extA === '.woff' && extB !== '.woff' && extB !== '.woff2') return -1;
      if (extA !== '.woff' && extB === '.woff') return 1;

      return a.localeCompare(b);
    });

    return sorted.slice(0, limit);
  }

  // --------------------------------------------------
  // Image manifest scan
  // --------------------------------------------------
  scanImagesForManifest(imagesDir) {
    const manifest = {
      landing: [],
      main: [],
      projects: []
    };

    if (!fs.existsSync(imagesDir)) {
      this.logger.warn?.(`Images directory not found: ${imagesDir}`);
      return manifest;
    }

    const landingDir = path.join(imagesDir, 'landing');
    const mainDir = path.join(imagesDir, 'main');
    const projectsDir = path.join(imagesDir, 'projects');

    if (fs.existsSync(landingDir)) {
      manifest.landing = this.getImageFiles(landingDir, imagesDir);
    }

    if (fs.existsSync(mainDir)) {
      manifest.main = this.getImageFiles(mainDir, imagesDir);
    }

    if (fs.existsSync(projectsDir)) {
      manifest.projects = this.scanProjects(projectsDir);
    }

    return manifest;
  }

  getImageFiles(dir, imagesRoot) {
    if (!fs.existsSync(dir)) return [];

    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      return [];
    }

    return files
      .filter(f =>
        this.imageExtensions.includes(path.extname(f).toLowerCase())
      )
      .sort()
      .map(f =>
        path
          .relative(imagesRoot, path.join(dir, f))
          .replace(/\\/g, '/')
      );
  }

  // --------------------------------------------------
  // Projects scan
  // --------------------------------------------------
  scanProjects(projectsDir) {
    const projects = [];

    let entries;
    try {
      entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    } catch {
      return projects;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;

      const projectPath = path.join(projectsDir, entry.name);
      const project = this.parseProject(projectPath, entry.name);
      projects.push(project);
    }

    return projects;
  }

  parseProject(projectPath, slug) {
    const projectJsonPath = path.join(projectPath, 'project.json');

    let metadata = {
      title: slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()),
      description: ''
    };

    if (fs.existsSync(projectJsonPath)) {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(projectJsonPath, 'utf8')
        );
        metadata = { ...metadata, ...parsed };
      } catch (err) {
        this.logger.warn?.(
          `Invalid project.json in ${slug}: ${err.message}`
        );
      }
    }

    let images = [];

    if (fs.existsSync(projectPath)) {
      try {
        const files = fs.readdirSync(projectPath);

        images = files
          .filter(f =>
            this.imageExtensions.includes(path.extname(f).toLowerCase())
          )
          .sort()
          .map(f => `images/projects/${slug}/${f}`);
      } catch {
        images = [];
      }
    }

    return {
      slug,
      title: metadata.title,
      description: metadata.description,
      images
    };
  }
}

module.exports = Scanner;
