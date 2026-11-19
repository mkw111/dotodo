const { withAndroidManifest } = require("expo/config-plugins");

// HTTP is for the local development server only. Distribution builds require HTTPS.
module.exports = function withLocalWebView(config) {
  return withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:usesCleartextTraffic"] =
        process.env.DOTODO_HTTPS_ONLY === "1" ? "false" : "true";
    }
    return result;
  });
};
