// build/preload-injector.js
const fs = require('fs');
const path = require('path');

class PreloadInjector {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Inject preload tags into HTML files
   */
  injectPreloads(htmlFiles, buildDir, renameMap, manifest, scanner) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      this.injectFile(filePath, htmlFile, buildDir, renameMap, manifest, scanner);
    }
  }

  injectFile(filePath, htmlFile, buildDir, renameMap, manifest, scanner) {
    let html = fs.readFileSync(filePath, 'utf8');
    
    const preloads = this.generatePreloads(htmlFile, buildDir, renameMap, manifest, scanner);
    
    if (preloads.length === 0) {
      return;
    }

    // Find insertion point (case-insensitive)
    const headCloseMatch = html.match(/<\/head>/i);
    if (!headCloseMatch) {
      throw new Error(`No </head> found in ${htmlFile}`);
    }

    const headCloseIndex = headCloseMatch.index;

    // Check for existing preloads to avoid duplicates
    const preloadSection = preloads
      .filter(preload => {
        // Extract href from preload tag for comparison
        const hrefMatch = preload.match(/href=["']([^"']+)["']/);
        if (!hrefMatch) return true;
        const href = hrefMatch[1];
        return !html.includes(`href="${href}"`);
      })
      .map(preload => `  ${preload}`)
      .join('\n');

    if (preloadSection) {
      html = html.slice(0, headCloseIndex) + 
             `\n${preloadSection}\n` + 
             html.slice(headCloseIndex);
      
      fs.writeFileSync(filePath, html, 'utf8');
    }
  }

  generatePreloads(htmlFile, buildDir, renameMap, manifest, scanner) {
    const preloads = [];

    // CSS preload (max 1)
    const cssPreload = this.getCssPreload(renameMap);
    if (cssPreload) {
      preloads.push(cssPreload);
    }

    // Image preloads (max 1)
    const imagePreload = this.getImagePreload(htmlFile, manifest);
    if (imagePreload) {
      preloads.push(imagePreload);
    }

    // Font preloads (max 2)
    const fontPreloads = this.getFontPreloads(buildDir, scanner);
    preloads.push(...fontPreloads);

    return preloads;
  }

  getCssPreload(renameMap) {
    // Find the hashed CSS file
    for (const [oldPath, newPath] of renameMap.entries()) {
      if (oldPath.startsWith('css/') && oldPath.endsWith('.css')) {
        return `<link rel="preload" href="${newPath}" as="style">`;

      }
    }
    return null;
  }

  getImagePreload(htmlFile, manifest) {
    if (!manifest) return null;

    if (htmlFile === 'index.html' && manifest.landing && manifest.landing[0]) {
      return `<link rel="preload" href="${manifest.landing[0]}" as="image">`;
    }

    if (htmlFile === 'main.html' && manifest.main && manifest.main[0]) {
      return `<link rel="preload" href="${manifest.main[0]}" as="image">`;
    }

    return null;
  }

  getFontPreloads(buildDir, scanner) {
    const preloads = [];
    
    // Use scanner's findFonts with limit of 2
    const fontFiles = scanner.findFonts(buildDir, 2);

    for (const fontPath of fontFiles) {
      const ext = path.extname(fontPath).substring(1);
      const relativePath = path.relative(buildDir, fontPath).replace(/\\/g, '/');
      preloads.push(`<link rel="preload" href="${relativePath}" as="font" type="font/${ext}" crossorigin>`);
    }

    return preloads;
  }
}

module.exports = PreloadInjector;
