import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import {
  ActivityIndicator,
  AppState,
  Linking,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import embeddedWeb from "./embeddedWeb";
import { readReminders, reminderPermission, subscribeToReminderOpens, syncReminders, testReminder } from "./reminders";
import { updateWidgetSession, updateWidgetSnapshot } from "./widget";

const embedded = Platform.OS === "android" && Boolean(embeddedWeb);
const WEB_URL = embedded ? "https://dotodo.invalid/" :
  process.env.EXPO_PUBLIC_WEB_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:5173"
    : "http://localhost:5173");
const origin = new URL(WEB_URL).origin;
const deployed = process.env.EXPO_PUBLIC_DOTODO_DEPLOYED === "1";
const webSource = embedded ? { html: embeddedWeb, baseUrl: WEB_URL } : { uri: WEB_URL };
type Credentials = { username: string; password: string };
const credentialKey = "dotodo.credentials.v1";
const secureOptions = { keychainService: origin, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
function isAppUrl(url: string) {
  return url === origin || url.startsWith(`${origin}/`);
}
export default function App() {
  const web = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [appCanGoBack, setAppCanGoBack] = useState(false);
  const [dark, setDark] = useState(false);
  const [failed, setFailed] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>();
  const [restoring, setRestoring] = useState(deployed);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");
  const latestReminders = useRef<ReturnType<typeof readReminders>>(null);
  const reminderQueue = useRef(Promise.resolve());
  const pendingTask = useRef<string | null>(null);
  const pendingWidget = useRef<{ action: string; taskId: string; category: string } | null>(null);
  const permissionAsked = useRef(false);
  useEffect(() => {
    if (!deployed || restoring) return;
    void updateWidgetSession(WEB_URL, rememberLogin ? credentials : undefined)
      .catch(() => emit("dotodo:session-error", "위젯 로그인 연결에 실패했어요. 다시 로그인해 주세요."));
  }, [credentials, restoring, rememberLogin]);
  useEffect(() => {
    function receive(url: string | null) {
      if (!url) return;
      try {
        const link = new URL(url);
        if (link.protocol !== "dotodo:" || link.hostname !== "widget") return;
        const action = link.pathname.slice(1);
        if (!["today", "add", "task"].includes(action)) return;
        pendingWidget.current = { action, taskId: link.searchParams.get("task") || "", category: link.searchParams.get("category") || "all" };
        emit("dotodo:widget-open", pendingWidget.current);
      } catch { /* Ignore unrelated links. */ }
    }
    void Linking.getInitialURL().then(receive);
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!deployed) return;
    let active = true;
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync(credentialKey, secureOptions);
        if (!active || !saved) return;
        const account = JSON.parse(saved) as Credentials;
        if (typeof account.username === "string" && typeof account.password === "string" &&
            account.username && account.password) {
          setUsername(account.username);
          setCredentials(account);
        } else {
          await SecureStore.deleteItemAsync(credentialKey, secureOptions);
        }
      } catch {
        if (active) setSignInError("저장된 로그인을 불러오지 못했어요. 다시 로그인해 주세요.");
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => { active = false; };
  }, []);
  async function signOut() {
    try {
      await updateWidgetSession(WEB_URL);
      await SecureStore.deleteItemAsync(credentialKey, secureOptions);
    } catch {
      emit("dotodo:session-error", "기기의 로그인 정보를 지우지 못했어요. 다시 시도해 주세요.");
      return;
    }
    latestReminders.current = null;
    pendingTask.current = null;
    reminderQueue.current = reminderQueue.current.then(() => syncReminders([], false)).catch(() => {});
    setCredentials(undefined);
    setPassword("");
    setCanGoBack(false);
    setAppCanGoBack(false);
    setFailed(false);
  }
  async function signIn() {
    if (!username || !password || signingIn) return;
    setSigningIn(true);
    setSignInError("");
    const account = { username, password };
    try {
      const token = Buffer.from(`${account.username}:${account.password}`, "utf8").toString("base64");
      const response = await fetch(WEB_URL, { headers: { Authorization: `Basic ${token}` } });
      if (response.ok) {
        if (rememberLogin) {
          await SecureStore.setItemAsync(credentialKey, JSON.stringify(account), secureOptions);
        } else {
          await SecureStore.deleteItemAsync(credentialKey, secureOptions);
        }
        setCredentials(account);
        setPassword("");
        setFailed(false);
      } else {
        setSignInError(response.status === 401
          ? "아이디와 비밀번호를 확인해 주세요."
          : "서버에 접속하지 못했어요. 다시 시도해 주세요.");
      }
    } catch {
      setSignInError("연결 또는 로그인 저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSigningIn(false);
    }
  }
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
        emit("dotodo:widget-refresh", null);
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
        {restoring ? (
          <View style={styles.center}><ActivityIndicator color="#4776e6" /><Text>로그인을 불러오는 중…</Text></View>
        ) : deployed && !credentials ? (
          <View style={styles.center}>
            <Text style={styles.brand}>dotodo.</Text>
            <Text style={styles.title}>서버 로그인</Text>
            <TextInput
              accessibilityLabel="아이디"
              placeholder="아이디"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="비밀번호"
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={() => void signIn()}
              style={styles.input}
            />
            <View style={styles.remember}>
              <Text style={styles.title}>로그인 유지</Text>
              <Switch accessibilityLabel="로그인 유지" value={rememberLogin}
                onValueChange={setRememberLogin} disabled={signingIn} />
            </View>
            {signInError ? <Text accessibilityLiveRegion="polite" style={styles.description}>{signInError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={signingIn || !username || !password}
              style={[styles.retry, (signingIn || !username || !password) && styles.disabled]}
              onPress={() => void signIn()}
            >
              <Text style={styles.retryText}>{signingIn ? "로그인 중…" : "로그인"}</Text>
            </Pressable>
          </View>
        ) : failed ? (
          <View style={styles.center}>
            <Text style={styles.brand}>dotodo.</Text>
            <Text style={styles.title}>화면을 불러오지 못했어요</Text>
            <Text style={styles.description}>
              {embedded ? "다시 시도해 주세요." : "웹 서버와 네트워크 연결을 확인해 주세요."}
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
            source={webSource}
            basicAuthCredential={credentials}
            style={styles.web}
            originWhitelist={[origin]}
            onShouldStartLoadWithRequest={(request) =>
              request.url === "about:blank" || isAppUrl(request.url)
            }
            onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
            onMessage={(event) => {
              try {
                if (!isAppUrl(event.nativeEvent.url)) return;
                const message = JSON.parse(event.nativeEvent.data);
                if (message.type === "DOTODO_STATE") {
                  setAppCanGoBack(message.canGoBack === true);
                  setDark(message.dark === true);
                } else if (message.type === "DOTODO_REMINDERS") {
                  const reminders = readReminders(message.reminders);
                  if (!reminders) return;
                  latestReminders.current = reminders;
                  const ask = reminders.length > 0 && !permissionAsked.current;
                  if (ask) permissionAsked.current = true;
                  reconcile(ask);
                  if (pendingTask.current) emit("dotodo:open-reminder", pendingTask.current);
                } else if (message.type === "DOTODO_REMINDER_OPENED" &&
                    pendingTask.current === message.taskId) {
                  pendingTask.current = null;
                } else if (message.type === "DOTODO_REMINDER_STATUS") {
                  reconcile();
                } else if (message.type === "DOTODO_REMINDER_PERMISSION") {
                  reconcile(true);
                } else if (message.type === "DOTODO_REMINDER_TEST") {
                  reminderQueue.current = reminderQueue.current.then(async () => {
                    const permission = await reminderPermission(true);
                    emit("dotodo:reminder-status", permission);
                    if (permission !== "granted") {
                      emit("dotodo:reminder-test", "알림 권한을 허용해 주세요.");
                      return;
                    }
                    await testReminder();
                    emit("dotodo:reminder-test", "5초 뒤 테스트 알림이 도착해요.");
                  }).catch(() => emit("dotodo:reminder-test", "알림 예약에 실패했어요. 기기 알림 설정을 확인해 주세요."));
                } else if (message.type === "DOTODO_SIGN_OUT" && deployed) {
                  void signOut();
                } else if (message.type === "DOTODO_SESSION_STATUS" && deployed) {
                  emit("dotodo:session-status", { username: credentials?.username, remembered: rememberLogin });
                } else if (message.type === "DOTODO_WIDGET_SYNC" && deployed && credentials && rememberLogin) {
                  void updateWidgetSnapshot(message.workspace)
                    .catch(() => emit("dotodo:session-error", "위젯 갱신에 실패했어요. 앱을 다시 열어 주세요."));
                } else if (message.type === "DOTODO_WIDGET_READY") {
                  if (pendingWidget.current) emit("dotodo:widget-open", pendingWidget.current);
                } else if (message.type === "DOTODO_WIDGET_OPENED") {
                  pendingWidget.current = null;
                } else if (message.type === "DOTODO_REMINDER_SETTINGS") {
                  void Linking.openSettings().catch(() => emit("dotodo:reminder-status", "error"));
                }
              } catch {
                /* Ignore malformed messages from the web view. */
              }
            }}
            onError={() => setFailed(true)}
            onHttpError={(event) => {
              const { statusCode, url } = event.nativeEvent;
              if (deployed && statusCode === 401 && url === WEB_URL) {
                void signOut().then(() => setSignInError("다시 로그인해 주세요."));
              } else if (statusCode >= 400 && (!deployed || url === WEB_URL)) {
                setFailed(true);
              }
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
  disabled: { opacity: 0.6 },
  remember: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 360 },
  input: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#c9d2e7",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#202733",
  },
});
