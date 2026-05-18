const { withAndroidManifest } = require("expo/config-plugins");

function addPermissions(manifest) {
  if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
  const perms = manifest["uses-permission"];
  const needed = [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.VIBRATE",
  ];
  for (const name of needed) {
    if (!perms.some((p) => p.$?.["android:name"] === name)) {
      perms.push({ $: { "android:name": name } });
    }
  }
  return manifest;
}

function addService(manifest) {
  const app = manifest.application?.[0];
  if (!app) return manifest;
  if (!app.service) app.service = [];
  const serviceName = "expo.modules.kickdropsservice.KickDropsService";
  if (!app.service.some((s) => s.$?.["android:name"] === serviceName)) {
    app.service.push({
      $: {
        "android:name": serviceName,
        "android:foregroundServiceType": "dataSync",
        "android:exported": "false",
        "android:stopWithTask": "false",
      },
    });
  }
  return manifest;
}

module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults.manifest = addPermissions(config.modResults.manifest);
    config.modResults.manifest = addService(config.modResults.manifest);
    return config;
  });
