const { notarize } = require('@electron/notarize');
const path = require('path');

/**
 * Notarize script for macOS
 * Required for distributing macOS apps outside the App Store
 */

async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization - not a macOS build');
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !appleTeamId) {
    console.log('⚠️  Skipping notarization - missing Apple credentials');
    console.log('   Set APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID environment variables');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`🔐 Notarizing ${appName}...`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId: appleTeamId,
    });
    
    console.log(`✅ Successfully notarized ${appName}`);
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    throw error;
  }
}

module.exports = notarizeApp;
