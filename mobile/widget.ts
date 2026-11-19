import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

type WidgetModule = {
  setSession(url: string, username: string, password: string): Promise<void>;
  clearSession(): Promise<void>;
  updateSnapshot(snapshot: string): Promise<void>;
};
const widget = Platform.OS === "android"
  ? requireOptionalNativeModule<WidgetModule>("DotodoWidget") : null;
let queue = Promise.resolve();
export function updateWidgetSession(url: string, credentials?: { username: string; password: string }) {
  queue = queue.catch(() => {}).then(async () => {
    if (!widget) return;
    if (credentials) await widget.setSession(url, credentials.username, credentials.password);
    else await widget.clearSession();
  });
  return queue;
}
export function updateWidgetSnapshot(snapshot: unknown) {
  queue = queue.catch(() => {}).then(async () => {
    if (widget) await widget.updateSnapshot(JSON.stringify(snapshot));
  });
  return queue;
}
