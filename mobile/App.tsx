import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { createClient, type Session } from "@supabase/supabase-js";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

type ScanResult = {
  result: "ok" | "already_used" | "invalid" | "not_issued";
  attendee_name?: string;
  attendee_doc?: string;
  redeemed_at?: string;
  redeemed_by?: string;
};

const COLORS = {
  ok: "#2f7d4f",
  already_used: "#9a6b12",
  invalid: "#b3402f",
  not_issued: "#b3402f",
};

const TITLES = {
  ok: "INGRESO VÁLIDO",
  already_used: "QR YA UTILIZADO",
  invalid: "CÓDIGO INVÁLIDO",
  not_issued: "BOLETA NO EMITIDA",
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleScan(token: string) {
    // Evita disparar el mismo QR muchas veces mientras sigue frente a la cámara
    if (busy || scan || token === lastToken.current) return;
    lastToken.current = token;
    setBusy(true);
    setNetError(null);
    try {
      const res = await fetch(`${API_URL}/api/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ token }),
      });
      if (!res.ok && res.status !== 200) throw new Error(`HTTP ${res.status}`);
      setScan((await res.json()) as ScanResult);
    } catch {
      // TODO contingencia: encolar localmente y reintentar (Etapa 3 del plan)
      setNetError("Sin respuesta del sistema. Verifica la conexión y reintenta.");
      lastToken.current = null;
    }
    setBusy(false);
  }

  function nextScan() {
    setScan(null);
    setNetError(null);
    lastToken.current = null;
  }

  if (!session) return <Login />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>Tiquetera</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.link}>Salir</Text>
        </Pressable>
      </View>

      {scan ? (
        <View style={[styles.result, { backgroundColor: COLORS[scan.result] }]}>
          <Text style={styles.resultTitle}>{TITLES[scan.result]}</Text>
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
          <Pressable style={styles.nextBtn} onPress={nextScan}>
            <Text style={styles.nextBtnText}>Escanear siguiente</Text>
          </Pressable>
        </View>
      ) : (
        <Scanner onScan={handleScan} busy={busy} netError={netError} onRetry={nextScan} />
      )}
    </SafeAreaView>
  );
}

function Scanner({
  onScan,
  busy,
  netError,
  onRetry,
}: {
  onScan: (token: string) => void;
  busy: boolean;
  netError: string | null;
  onRetry: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Se necesita acceso a la cámara para escanear.</Text>
        <Pressable style={styles.nextBtn} onPress={requestPermission}>
          <Text style={styles.nextBtnText}>Permitir cámara</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <View style={styles.overlay}>
        {busy ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : netError ? (
          <>
            <Text style={styles.overlayError}>{netError}</Text>
            <Pressable style={styles.nextBtn} onPress={onRetry}>
              <Text style={styles.nextBtnText}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.overlayText}>Apunta al código QR de la boleta</Text>
        )}
      </View>
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
      <Text style={styles.brand}>Tiquetera</Text>
      <Text style={styles.msg}>Acceso de operadores</Text>
      <TextInput
        style={styles.input}
        placeholder="Correo"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.nextBtn, { marginTop: 12 }]} onPress={login} disabled={busy}>
        <Text style={styles.nextBtnText}>{busy ? "Ingresando…" : "Ingresar"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brand: { fontSize: 20, fontWeight: "700", color: "#1f2a2e" },
  link: { color: "#0e6b60", fontWeight: "600" },
  msg: { color: "#5f6e72", marginVertical: 8, textAlign: "center" },
  error: { color: "#b3402f", marginTop: 8 },
  input: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e7e6",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
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
  overlayText: { color: "#fff", fontSize: 16 },
  overlayError: { color: "#ffb4a4", fontSize: 15, textAlign: "center", marginBottom: 12 },
  result: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  resultTitle: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: 1 },
  resultName: { color: "#fff", fontSize: 20, marginTop: 12, fontWeight: "600" },
  resultDetail: { color: "rgba(255,255,255,0.85)", marginTop: 8, textAlign: "center" },
  nextBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 28,
  },
  nextBtnText: { color: "#1f2a2e", fontWeight: "700", fontSize: 15 },
});
