const { withAndroidManifest } = require("expo/config-plugins");

// HTTP is for the local development server only. Distribution builds require HTTPS.
module.exports = function withLocalWebView(config) {
  return withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (application) application.$["android:usesCleartextTraffic"] = "true";
    return result;
  });
};
