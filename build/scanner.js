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
  }

  /**
   * Recursively scan directory for files matching extensions
   */
  scanDirectory(dir, extensions = [], additionalExcludes = []) {
    const results = [];
    
    if (!fs.existsSync(dir)) {
      return results;
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      const relativePath = path.relative(process.cwd(), fullPath);
      
      if (file.isDirectory()) {
        // Skip excluded directories
        if (this.shouldExclude(file.name, additionalExcludes)) {
          continue;
        }
        results.push(...this.scanDirectory(fullPath, extensions, additionalExcludes));
      } else {
        // Check extension
        if (extensions.length === 0 || extensions.includes(path.extname(file.name))) {
          results.push(relativePath);
        }
      }
    }
    
    return results.sort(); // Deterministic ordering
  }

  shouldExclude(name, additionalExcludes = []) {
    // Hidden folders
    if (name.startsWith('.')) return true;
    
    // Standard excludes
    if (this.excludeDirs.includes(name)) return true;
    
    // Additional excludes
    if (additionalExcludes.includes(name)) return true;
    
    return false;
  }

  /**
   * Find all HTML files in root
   */
  findHtmlFiles(rootDir) {
    const files = fs.readdirSync(rootDir);
    return files
      .filter(f => f.endsWith('.html'))
      .sort();
  }

  /**
   * Find all fonts in directory tree (limit to 2 for preload)
   */
  findFonts(dir, limit = 2) {
    const fontExtensions = ['.woff2', '.woff', '.ttf', '.otf', '.eot'];
    const allFonts = this.scanDirectory(dir, fontExtensions, []);
    
    // Prioritize woff2, then woff
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

  /**
   * Scan images directory structure for manifest
   */
  scanImagesForManifest(imagesDir) {
    const manifest = {
      landing: [],
      main: [],
      projects: []
    };

    if (!fs.existsSync(imagesDir)) {
      this.logger.warn(`Images directory not found: ${imagesDir}`);
      return manifest;
    }

    // Scan landing
    const landingDir = path.join(imagesDir, 'landing');
    if (fs.existsSync(landingDir)) {
      manifest.landing = this.getImageFiles(landingDir);
    }

    // Scan main
    const mainDir = path.join(imagesDir, 'main');
    if (fs.existsSync(mainDir)) {
      manifest.main = this.getImageFiles(mainDir);
    }

    // Scan projects
    const projectsDir = path.join(imagesDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      manifest.projects = this.scanProjects(projectsDir);
    }

    return manifest;
  }

  getImageFiles(dir) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    
    return files
      .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
      .sort()
      .map(f => `images/${path.relative(path.join(process.cwd(), 'images'), path.join(dir, f)).replace(/\\/g, '/')}`);
  }

  scanProjects(projectsDir) {
    const projects = [];
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

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
      title: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: ''
    };

    // Try to load project.json
    if (fs.existsSync(projectJsonPath)) {
      try {
        const content = fs.readFileSync(projectJsonPath, 'utf8');
        const parsed = JSON.parse(content);
        metadata = { ...metadata, ...parsed };
      } catch (err) {
        this.logger.warn(`Invalid project.json in ${slug}: ${err.message}`);
      }
    } else {
      this.logger.warn(`Missing project.json in ${slug}, using defaults`);
    }

    // Get images
    const images = this.getImageFiles(projectPath);

    return {
      slug,
      title: metadata.title,
      description: metadata.description,
      images
    };
  }
}

module.exports = Scanner;
