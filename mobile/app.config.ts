export default {
  expo: {
    name: "dotodo",
    slug: "dotodo",
    version: "0.3.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    backgroundColor: "#ffffff",
    ios: {
      bundleIdentifier: "com.dotodo.app",
      supportsTablet: true,
      infoPlist: { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } },
    },
    android: { package: "com.dotodo.app" },
    plugins: ["./plugins/withLocalWebView"],
    extra: {
      note: "Local development shell. Use an HTTPS web URL and disable Android cleartext before distribution.",
    },
  },
};
