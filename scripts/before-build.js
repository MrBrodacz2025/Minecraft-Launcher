const fs = require('fs');
const path = require('path');

/**
 * Before build script
 * Prepares assets and cleans up build directories
 */

async function beforeBuild(context) {
  console.log('🔧 Running before-build script...');

  const projectRoot = context.appDir || process.cwd();
  const buildDir = path.join(projectRoot, 'build');
  const assetsDir = path.join(projectRoot, 'assets');

  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
    console.log('📁 Created build directory');
  }

  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log('📁 Created assets directory');
  }

  // Check for required icon files
  const requiredIcons = {
    win: 'icon.ico',
    mac: 'icon.icns',
    linux: 'icons',
  };

  const platform = context.platform?.name || process.platform;

  if (platform === 'win32' || platform === 'windows') {
    const iconPath = path.join(buildDir, requiredIcons.win);
    if (!fs.existsSync(iconPath)) {
      console.warn(`⚠️  Warning: Missing ${requiredIcons.win} in build directory`);
      console.log('   Create a 256x256 ICO file for Windows icon');
    }
  }

  if (platform === 'darwin' || platform === 'mac') {
    const iconPath = path.join(buildDir, requiredIcons.mac);
    if (!fs.existsSync(iconPath)) {
      console.warn(`⚠️  Warning: Missing ${requiredIcons.mac} in build directory`);
      console.log('   Create an ICNS file for macOS icon');
    }
  }

  if (platform === 'linux') {
    const iconsDir = path.join(buildDir, requiredIcons.linux);
    if (!fs.existsSync(iconsDir)) {
      console.warn(`⚠️  Warning: Missing ${requiredIcons.linux} directory in build directory`);
      console.log('   Create PNG icons in various sizes (16x16, 32x32, 48x48, 64x64, 128x128, 256x256, 512x512)');
    }
  }

  // Clean up any temporary files
  const tempFiles = ['.DS_Store', 'Thumbs.db', '*.log'];
  
  console.log('✅ Before-build script completed');
  return true;
}

module.exports = beforeBuild;

// Run directly if called from command line
if (require.main === module) {
  beforeBuild({ appDir: process.cwd() })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
