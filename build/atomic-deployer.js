// build/atomic-deployer.js
const fs = require('fs');
const path = require('path');

class AtomicDeployer {
  constructor(logger) {
    this.logger = logger;
    this.tempDir = '.build-temp';
    this.backupDir = '.docs-backup';
    this.targetDir = 'docs';
  }

  /**
   * Initialize temp directory
   */
  initTempDir(rootDir) {
    const tempPath = path.join(rootDir, this.tempDir);
    
    // Remove if exists
    if (fs.existsSync(tempPath)) {
      this.logger.info('Removing existing temp directory');
      this.rmRecursive(tempPath);
    }

    // Create fresh
    fs.mkdirSync(tempPath, { recursive: true });
    this.logger.info('Created temp build directory');
    
    return tempPath;
  }

  /**
   * Copy source to temp directory (scan-based, not hardcoded)
   */
  copyToTemp(rootDir, tempDir) {
    this.logger.info('Copying source files to temp directory');

    // Scan for HTML files in root
    const rootFiles = fs.readdirSync(rootDir);
    const htmlFiles = rootFiles.filter(f => f.endsWith('.html') && fs.statSync(path.join(rootDir, f)).isFile());
    
    // Copy HTML files
    for (const htmlFile of htmlFiles) {
      const srcPath = path.join(rootDir, htmlFile);
      const destPath = path.join(tempDir, htmlFile);
      fs.copyFileSync(srcPath, destPath);
    }

    // Copy directories
    const directoriesToCopy = ['css', 'js', 'images'];
    
    for (const dir of directoriesToCopy) {
      const srcPath = path.join(rootDir, dir);
      const destPath = path.join(tempDir, dir);

      if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
        this.copyRecursive(srcPath, destPath);
      } else {
        this.logger.warn(`Source directory not found: ${dir}`);
      }
    }
  }

  /**
   * Atomic deployment with rollback protection
   */
deploy(rootDir) {
  const tempPath = path.join(rootDir, this.tempDir);
  const targetPath = path.join(rootDir, this.targetDir);
  const backupPath = path.join(rootDir, this.backupDir);

  try {
    // Remove old backup if exists
    if (fs.existsSync(backupPath)) {
      this.rmRecursive(backupPath);
    }

    // Backup current docs if exists
    if (fs.existsSync(targetPath)) {
      this.logger.info('Backing up current docs directory');
      this.copyRecursive(targetPath, backupPath);
      this.rmRecursive(targetPath);
    }

    // Promote temp to docs
    this.logger.info('Deploying build to docs directory');
    fs.renameSync(tempPath, targetPath);

    // Remove backup on success
    if (fs.existsSync(backupPath)) {
      this.rmRecursive(backupPath);
    }

    this.logger.success('Atomic deployment completed');

  } catch (error) {
    this.logger.error(`Deployment failed: ${error.message}`);

    // Rollback: restore backup if it exists
    if (fs.existsSync(backupPath)) {
      this.logger.info('Rolling back to previous version');

      if (fs.existsSync(targetPath)) {
        this.rmRecursive(targetPath);
      }

      this.copyRecursive(backupPath, targetPath);
      this.rmRecursive(backupPath);

      this.logger.info('Rollback completed');
    }

    throw error;
  }
}


  /**
   * Cleanup on error
   */
  cleanup(rootDir) {
    const tempPath = path.join(rootDir, this.tempDir);
    
    if (fs.existsSync(tempPath)) {
      this.logger.info('Cleaning up temp directory');
      this.rmRecursive(tempPath);
    }
  }

  /**
   * Recursive copy
   */
  copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      const files = fs.readdirSync(src);
      for (const file of files) {
        this.copyRecursive(path.join(src, file), path.join(dest, file));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  /**
   * Recursive delete
   */
  rmRecursive(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.rmRecursive(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
    
    fs.rmdirSync(dir);
  }
}

module.exports = AtomicDeployer;
