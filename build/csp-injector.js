// build/csp-injector.js
const fs = require('fs');
const path = require('path');

class CspInjector {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Inject strict CSP meta tag if missing
   */
  injectCsp(htmlFiles, buildDir) {
    for (const htmlFile of htmlFiles) {
      const filePath = path.join(buildDir, htmlFile);
      this.injectFile(filePath);
    }
  }

  injectFile(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Check if CSP already exists (case-insensitive)
    if (/Content-Security-Policy/i.test(html)) {
      return;
    }

    const cspTag = this.generateCspTag();
    
    // Find <head> opening tag (case-insensitive)
    const headMatch = html.match(/(<head[^>]*>)/i);
    if (!headMatch) {
      throw new Error(`No <head> found in ${filePath}`);
    }

    const insertIndex = headMatch.index + headMatch[0].length;
    html = html.slice(0, insertIndex) + 
           `\n  ${cspTag}` + 
           html.slice(insertIndex);

    fs.writeFileSync(filePath, html, 'utf8');
  }

  generateCspTag() {
  // Transitional CSP (allows inline styles/scripts)
  const policy = [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}
}

module.exports = CspInjector;
