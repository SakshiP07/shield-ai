/**
 * Expo config plugin — keep MainActivity.onNewIntent for OAuth deep links across prebuild.
 */
const { withMainActivity } = require('@expo/config-plugins');

function withAndroidOAuthIntent(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(
        'import android.os.Build',
        'import android.content.Intent\nimport android.os.Build',
      );
    }

    if (!contents.includes('override fun onNewIntent')) {
      const hook = `
  /**
   * Required for OAuth / deep-link redirects on modern Android.
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;
      contents = contents.replace(
        'override fun getMainComponentName()',
        `${hook}\n  override fun getMainComponentName()`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAndroidOAuthIntent;
