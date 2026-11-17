import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { readReminders, reminderPermission, subscribeToReminderOpens, syncReminders } from "./reminders";

const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:5173"
    : "http://localhost:5173");
const origin = new URL(WEB_URL).origin;
export default function App() {
  const web = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [appCanGoBack, setAppCanGoBack] = useState(false);
  const [dark, setDark] = useState(false);
  const [failed, setFailed] = useState(false);
  const latestReminders = useRef<ReturnType<typeof readReminders>>(null);
  const reminderQueue = useRef(Promise.resolve());
  const pendingTask = useRef<string | null>(null);
  function emit(name: string, detail: unknown) {
    web.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent(${JSON.stringify(name)}, {detail: ${JSON.stringify(detail)}})); true;`
    );
  }
  function reconcile(requestPermission = false) {
    reminderQueue.current = reminderQueue.current.then(async () => {
      const permission = await reminderPermission(requestPermission);
      emit("dotodo:reminder-status", permission);
      if (latestReminders.current) {
        await syncReminders(latestReminders.current, permission === "granted");
      }
    }).catch(() => {
      emit("dotodo:reminder-status", "error");
    });
  }
  useEffect(() => {
    const unsubscribe = subscribeToReminderOpens((id) => {
      pendingTask.current = id;
      emit("dotodo:open-reminder", id);
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        reconcile();
        emit("dotodo:refresh-reminders", null);
      }
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (appCanGoBack) {
          web.current?.injectJavaScript(
            "window.dispatchEvent(new Event('dotodo:back')); true;"
          );
          return true;
        }
        if (canGoBack) {
          web.current?.goBack();
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [canGoBack, appCanGoBack]);
  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.root, { backgroundColor: dark ? "#202733" : "#ffffff" }]}
        edges={["top", "bottom"]}
      >
        <StatusBar style={dark ? "light" : "dark"} />
        {failed ? (
          <View style={styles.center}>
            <Text style={styles.brand}>dotodo.</Text>
            <Text style={styles.title}>화면을 불러오지 못했어요</Text>
            <Text style={styles.description}>
              웹 서버와 네트워크 연결을 확인해 주세요.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.retry}
              onPress={() => setFailed(false)}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={web}
            source={{ uri: WEB_URL }}
            style={styles.web}
            originWhitelist={[origin]}
            onShouldStartLoadWithRequest={(request) =>
              request.url === "about:blank" ||
              request.url === origin ||
              request.url.startsWith(`${origin}/`)
            }
            onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
            onMessage={(event) => {
              try {
                if (new URL(event.nativeEvent.url).origin !== origin) return;
                const message = JSON.parse(event.nativeEvent.data);
                if (message.type === "DOTODO_STATE") {
                  setAppCanGoBack(message.canGoBack === true);
                  setDark(message.dark === true);
                } else if (message.type === "DOTODO_REMINDERS") {
                  const reminders = readReminders(message.reminders);
                  if (!reminders) return;
                  latestReminders.current = reminders;
                  reconcile();
                  if (pendingTask.current) emit("dotodo:open-reminder", pendingTask.current);
                } else if (message.type === "DOTODO_REMINDER_OPENED" &&
                    pendingTask.current === message.taskId) {
                  pendingTask.current = null;
                } else if (message.type === "DOTODO_REMINDER_STATUS") {
                  reconcile();
                } else if (message.type === "DOTODO_REMINDER_PERMISSION") {
                  reconcile(true);
                } else if (message.type === "DOTODO_REMINDER_SETTINGS") {
                  void Linking.openSettings().catch(() => emit("dotodo:reminder-status", "error"));
                }
              } catch {
                /* Ignore malformed messages from the web view. */
              }
            }}
            onError={() => setFailed(true)}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode >= 400) setFailed(true);
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={[StyleSheet.absoluteFillObject, styles.center]}>
                <Text style={styles.brand}>dotodo.</Text>
                <ActivityIndicator color="#4776e6" />
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  web: { flex: 1, backgroundColor: "#ffffff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    gap: 18,
    padding: 24,
  },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: "#4776e6",
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  title: { fontSize: 17, color: "#34405a", fontWeight: "600" },
  description: { fontSize: 12, color: "#929bad", textAlign: "center" },
  retry: {
    backgroundColor: "#4776e6",
    borderRadius: 8,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontSize: 13 },
});
