// build/versioning.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Versioning {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Generate deterministic build version
   */
  generateVersion(renameMap, manifestContent) {
    const data = {
      renames: Array.from(renameMap.entries()).sort(),
      manifest: manifestContent
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 12);

    return hash;
  }

  /**
   * Create external version file (js/build-version.js)
   */
  createVersionFile(buildDir, version) {
    const versionContent = `window.__BUILD_VERSION__ = "${version}";\n`;
    const versionPath = path.join(buildDir, 'js', 'build-version.js');
    
    // Ensure js directory exists
    const jsDir = path.dirname(versionPath);
    if (!fs.existsSync(jsDir)) {
      fs.mkdirSync(jsDir, { recursive: true });
    }
    
    fs.writeFileSync(versionPath, versionContent, 'utf8');
    this.logger.info('Generated build version file');
    
    return versionPath;
  }

  /**
   * Inject version script reference into HTML files
   */
  injectVersionScript(htmlFiles, buildDir, versionFilePath) {
    // The version file will be hashed like other JS files
    // This method is called AFTER hashing, so we need to find the hashed version
    
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      this.injectIntoFile(filePath, versionFilePath, buildDir);
    }
  }

  injectIntoFile(filePath, versionFilePath, buildDir) {
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Check if already exists
    if (/build-version\.[a-f0-9]{8}\.js/i.test(html)) {
      return; // Already injected
    }

    // Find the hashed version file name
    const jsDir = path.dirname(versionFilePath);
    const files = fs.readdirSync(jsDir);
    const versionFile = files.find(f => /^build-version\.[a-f0-9]{8}\.js$/.test(f));
    
    if (!versionFile) {
      this.logger.warn('Could not find hashed version file');
      return;
    }

    const scriptTag = `\n  <script src="/js/${versionFile}"></script>`;
    
    // Insert before </head> (case-insensitive)
    const headCloseMatch = html.match(/<\/head>/i);
    if (headCloseMatch) {
      const headCloseIndex = headCloseMatch.index;
      html = html.slice(0, headCloseIndex) + 
             scriptTag + '\n' + 
             html.slice(headCloseIndex);
      
      fs.writeFileSync(filePath, html, 'utf8');
    }
  }
}

module.exports = Versioning;
