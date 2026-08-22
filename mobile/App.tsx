import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { createClient, type Session } from "@supabase/supabase-js";

const LOGO = require("./assets/logo.png");
const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

// Paleta del design system Comfenalco (kit-ui-library) replicada para RN.
const C = {
  brand: "#005744",
  brandDark: "#004f3e",
  mantis: "#3c7f37",
  paper: "#f3f6f5",
  card: "#ffffff",
  ink: "#16211d",
  muted: "#5c6b66",
  line: "#e4eae8",
  ok: "#3c7f37",
  warn: "#9a6b12",
  error: "#b3402f",
  white: "#ffffff",
};

const TOP_INSET = Platform.OS === "android" ? RNStatusBar.currentHeight ?? 24 : 0;

type ScanResult = {
  result: "ok" | "already_used" | "invalid" | "not_issued";
  attendee_name?: string;
  attendee_doc?: string;
  redeemed_at?: string;
  redeemed_by?: string;
};

const RESULT_COLOR: Record<ScanResult["result"], string> = {
  ok: C.ok,
  already_used: C.warn,
  invalid: C.error,
  not_issued: C.error,
};

const RESULT_TITLE: Record<ScanResult["result"], string> = {
  ok: "INGRESO VÁLIDO",
  already_used: "QR YA UTILIZADO",
  invalid: "CÓDIGO INVÁLIDO",
  not_issued: "BOLETA NO EMITIDA",
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<"scan" | "history">("scan");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!session) return <Login />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
        <Pressable hitSlop={10} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.headerLink}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.content}>{tab === "scan" ? <Scanner /> : <History />}</View>

      <View style={styles.tabbar}>
        <TabButton label="Lector" glyph="⛶" active={tab === "scan"} onPress={() => setTab("scan")} />
        <TabButton label="Ingresos" glyph="≣" active={tab === "history"} onPress={() => setTab("history")} />
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  glyph,
  active,
  onPress,
}: {
  label: string;
  glyph: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
      <Text style={[styles.tabGlyph, { color: active ? C.brand : C.muted }]}>{glyph}</Text>
      <Text style={[styles.tabLabel, { color: active ? C.brand : C.muted }]}>{label}</Text>
    </Pressable>
  );
}

function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const lastToken = useRef<string | null>(null);

  async function handleScan(token: string) {
    if (busy || scan || token === lastToken.current) return;
    lastToken.current = token;
    setBusy(true);
    setNetError(null);
    try {
      const res = await fetch(`${API_URL}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ token }),
      });
      setScan((await res.json()) as ScanResult);
    } catch {
      // TODO contingencia: encolar localmente y reintentar (Etapa 3 del plan)
      setNetError("Sin respuesta del sistema. Verifica la conexión y reintenta.");
      lastToken.current = null;
    }
    setBusy(false);
  }

  function next() {
    setScan(null);
    setNetError(null);
    lastToken.current = null;
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.brand} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Se necesita acceso a la cámara para escanear.</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Permitir cámara</Text>
        </Pressable>
      </View>
    );
  }

  if (scan) {
    return (
      <View style={[styles.result, { backgroundColor: RESULT_COLOR[scan.result] }]}>
        <Text style={styles.resultTitle}>{RESULT_TITLE[scan.result]}</Text>
        {scan.attendee_name && <Text style={styles.resultName}>{scan.attendee_name}</Text>}
        {scan.result === "ok" && scan.attendee_doc && (
          <Text style={styles.resultDetail}>Documento: {scan.attendee_doc}</Text>
        )}
        {scan.result === "already_used" && scan.redeemed_at && (
          <Text style={styles.resultDetail}>
            Redimido: {new Date(scan.redeemed_at).toLocaleString()}
            {scan.redeemed_by ? `\npor ${scan.redeemed_by}` : ""}
          </Text>
        )}
        <Pressable style={styles.lightBtn} onPress={next}>
          <Text style={styles.lightBtnText}>Escanear siguiente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={styles.scannerRoot}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ w: width, h: height });
      }}
    >
      {size && (
        <CameraView
          style={{ width: size.w, height: size.h }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => handleScan(data)}
        />
      )}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
      </View>
      <View style={styles.overlay}>
        {busy ? (
          <ActivityIndicator color={C.white} size="large" />
        ) : netError ? (
          <>
            <Text style={styles.overlayError}>{netError}</Text>
            <Pressable style={styles.lightBtn} onPress={next}>
              <Text style={styles.lightBtnText}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.overlayText}>Apunta al código QR de la boleta</Text>
        )}
      </View>
    </View>
  );
}

type Ingreso = {
  id: string;
  attendee_name: string;
  attendee_doc: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  events: { name: string } | null;
};

function History() {
  const [items, setItems] = useState<Ingreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/scan/history`, { headers: await authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((await res.json()) as Ingreso[]);
    } catch {
      setError("No se pudo cargar el listado. Desliza para reintentar.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Ingresos realizados</Text>
        <Text style={styles.listCount}>{items.length}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brand} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.brand} />}
          contentContainerStyle={items.length === 0 ? styles.center : { padding: 12 }}
          ListEmptyComponent={
            <Text style={[styles.msg, error ? { color: C.error } : null]}>
              {error ?? "Aún no hay ingresos registrados."}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.attendee_name}</Text>
                <Text style={styles.rowMeta}>
                  {item.events?.name ?? "Evento"}
                  {item.attendee_doc ? ` · CC ${item.attendee_doc}` : ""}
                </Text>
              </View>
              <Text style={styles.rowTime}>
                {item.redeemed_at
                  ? new Date(item.redeemed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : ""}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Credenciales inválidas");
    setBusy(false);
  }

  return (
    <SafeAreaView style={[styles.container, styles.center]}>
      <StatusBar style="dark" />
      <Image source={LOGO} style={styles.loginLogo} resizeMode="contain" />
      <Text style={styles.msg}>Acceso de operadores</Text>
      <TextInput
        style={styles.input}
        placeholder="Correo"
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={C.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={[styles.msg, { color: C.error }]}>{error}</Text>}
      <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={login} disabled={busy}>
        <Text style={styles.primaryBtnText}>{busy ? "Ingresando…" : "Ingresar"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  content: { flex: 1 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  header: {
    paddingTop: TOP_INSET + 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerLogo: { width: 150, height: 34 },
  headerLink: { color: C.brand, fontWeight: "700", fontSize: 15 },

  tabbar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingBottom: Platform.OS === "ios" ? 18 : 8,
  },
  tab: { flex: 1, alignItems: "center", paddingTop: 8, paddingBottom: 6 },
  tabIndicator: { height: 3, width: 34, borderRadius: 2, backgroundColor: "transparent", marginBottom: 6 },
  tabIndicatorActive: { backgroundColor: C.brand },
  tabGlyph: { fontSize: 20, lineHeight: 22 },
  tabLabel: { fontSize: 12, fontWeight: "700", marginTop: 2 },

  msg: { color: C.muted, marginVertical: 8, textAlign: "center" },

  primaryBtn: { backgroundColor: C.brand, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28 },
  primaryBtnText: { color: C.white, fontWeight: "700", fontSize: 15 },
  lightBtn: { backgroundColor: C.white, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: 28 },
  lightBtnText: { color: C.ink, fontWeight: "700", fontSize: 15 },

  input: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    color: C.ink,
  },
  loginLogo: { width: 220, height: 80, marginBottom: 4 },

  scannerRoot: { flex: 1, backgroundColor: "#000000", position: "relative" },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayText: { color: C.white, fontSize: 16 },
  overlayError: { color: "#ffb4a4", fontSize: 15, textAlign: "center", marginBottom: 12 },

  result: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  resultTitle: { color: C.white, fontSize: 26, fontWeight: "800", letterSpacing: 1, textAlign: "center" },
  resultName: { color: C.white, fontSize: 20, marginTop: 12, fontWeight: "700", textAlign: "center" },
  resultDetail: { color: "rgba(255,255,255,0.9)", marginTop: 8, textAlign: "center" },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  listTitle: { fontSize: 16, fontWeight: "800", color: C.ink },
  listCount: { fontSize: 14, fontWeight: "700", color: C.brand },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok, marginRight: 12 },
  rowName: { fontSize: 15, fontWeight: "700", color: C.ink },
  rowMeta: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  rowTime: { fontSize: 13, fontWeight: "700", color: C.muted, marginLeft: 8 },
});
