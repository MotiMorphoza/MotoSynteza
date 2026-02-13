// build/head-optimizer.js
const fs = require('fs');
const path = require('path');

class HeadOptimizer {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Optimize head tags in all HTML files
   */
  optimizeAll(htmlFiles, buildDir, manifest) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      this.optimizeFile(filePath, buildDir, manifest);
    }
  }

  optimizeFile(filePath, buildDir, manifest) {
    let html = fs.readFileSync(filePath, 'utf8');
    
    html = this.injectMetaTags(html, buildDir, manifest, filePath);
    
    fs.writeFileSync(filePath, html, 'utf8');
  }

  injectMetaTags(html, buildDir, manifest, filePath) {
    const headMatch = html.match(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i);
    if (!headMatch) {
      throw new Error(`No <head> found in ${path.relative(buildDir, filePath)}`);
    }

    const [fullHead, openTag, headContent, closeTag] = headMatch;
    let newContent = headContent;

    // Inject meta tags (only if missing)
    newContent = this.injectIfMissing(newContent, 'charset', '<meta charset="UTF-8">');
    newContent = this.injectIfMissing(newContent, 'theme-color', '<meta name="theme-color" content="#111111">');
    
    // Favicon (only if file exists)
    const faviconPath = path.join(buildDir, 'images', 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
      newContent = this.injectIfMissing(newContent, 'rel="icon"', '<link rel="icon" href="/images/favicon.ico">');
    }

    // Apple touch icon (only if file exists)
    const appleTouchPath = path.join(buildDir, 'images', 'apple-touch-icon.png');
    if (fs.existsSync(appleTouchPath)) {
      newContent = this.injectIfMissing(newContent, 'apple-touch-icon', '<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">');
    }

    // OpenGraph (do not overwrite existing)
    newContent = this.injectIfMissing(newContent, 'og:title', '<meta property="og:title" content="MotoSynteza">');
    newContent = this.injectIfMissing(newContent, 'og:type', '<meta property="og:type" content="website">');
    
    // OG Image (only if manifest has landing image)
    if (manifest && manifest.landing && manifest.landing[0]) {
      const ogImageTag = `<meta property="og:image" content="/${manifest.landing[0]}">`;
      newContent = this.injectIfMissing(newContent, 'og:image', ogImageTag);
    }

    // Twitter Card (do not overwrite existing)
    newContent = this.injectIfMissing(newContent, 'twitter:card', '<meta name="twitter:card" content="summary_large_image">');
    newContent = this.injectIfMissing(newContent, 'twitter:title', '<meta name="twitter:title" content="MotoSynteza">');

    return html.replace(fullHead, `${openTag}${newContent}${closeTag}`);
  }

  injectIfMissing(headContent, identifier, tag) {
    // Case-insensitive check for existing tag
    const regex = new RegExp(identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (regex.test(headContent)) {
      return headContent;
    }

    // Inject at the beginning of head
    return `\n  ${tag}${headContent}`;
  }
}

module.exports = HeadOptimizer;
