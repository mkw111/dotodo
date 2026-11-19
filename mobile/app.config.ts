export default {
  expo: {
    name: "dotodo",
    slug: "dotodo",
    scheme: "dotodo",
    version: "0.3.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    backgroundColor: "#ffffff",
    ios: {
      bundleIdentifier: "com.dotodo.app",
      supportsTablet: true,
      infoPlist: { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } },
    },
    android: {
      package: "com.dotodo.app",
      versionCode: 4,
      permissions: ["android.permission.SCHEDULE_EXACT_ALARM"],
    },
    plugins: ["expo-notifications", "expo-secure-store", "./plugins/withLocalWebView"],
    extra: {
      note: "Local development shell. Use an HTTPS web URL and disable Android cleartext before distribution.",
    },
  },
};
