const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (process.env.DOTODO_EMBED_WEB !== undefined) {
  config.resolver.useWatchman = false;
}

if (process.env.DOTODO_EMBED_WEB === "1") {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const target = moduleName === "./embeddedWeb" && platform === "android"
      ? path.join(__dirname, ".local/embeddedWeb.js")
      : moduleName;
    return context.resolveRequest(context, target, platform);
  };
}

module.exports = config;
