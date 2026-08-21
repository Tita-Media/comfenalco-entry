# Tiquetera QR — Piloto Comfenalco

Piloto funcional del sistema de boletería con check-in por códigos QR de un solo uso.

| Parte | Carpeta | Qué es | Dónde corre |
|---|---|---|---|
| Back (Servicios) | `web/src/app/api` | API routes: generación batch de boletas, envío de correos, validación/redención atómica | Vercel |
| Dash (Backoffice) | `web/src/app` | Eventos, carga de reservas, generación, envíos, grilla de estados | Vercel (mismo deploy) |
| App (Lectura) | `mobile/` | App Expo: login de operador + escaneo QR + resultado | APK Android (EAS) |
| Datos | `supabase/` | Esquema + función `redeem_ticket` (redención atómica) | Supabase |

## Flujo del piloto

1. **Backoffice**: crear evento → cargar reservas (CSV pegado; en producción lo alimenta la integración con el servicio de reportería) → *Generar boletas* (batch: token HMAC por reserva) → *Enviar correos del lote*.
2. **App**: el operador inicia sesión, escanea el QR; el servicio valida firma + estado y redime de forma atómica.
3. **Estados**: `pending → issued → redeemed`, visibles en la grilla del backoffice al instante. QR ya usado muestra fecha, hora y operador de la redención previa.

## Puesta en marcha

### 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com).
2. Ejecutar `supabase/migrations/0001_init.sql` en el SQL Editor (o `supabase db push`).
3. En **Authentication → Users**, crear los usuarios operadores (email + contraseña). No hay registro público.
4. Copiar de **Project Settings → API**: URL, `anon key` y `service_role key`.

### 2. Web (backoffice + servicios)

```bash
cd web
cp .env.example .env.local   # completar credenciales
npm install
npm run dev
```

Deploy: `vercel` desde `web/` (o conectar el repo en Vercel con root directory `web/`). Configurar las mismas variables de entorno en Vercel. `QR_TOKEN_SECRET` se genera con `openssl rand -base64 32`.

### 3. Mobile (app de lectura)

```bash
cd mobile
cp .env.example .env         # URL del deploy de Vercel + credenciales públicas de Supabase
npm install
npx expo start               # desarrollo con Expo Go
npm run build:apk            # APK instalable (EAS, instalación directa)
```

## Seguridad

- El QR contiene solo `<uuid>.<firma HMAC>` — nada de datos personales; un token inventado se descarta sin tocar la base de datos.
- La redención es una sola sentencia `UPDATE ... WHERE status='issued'`: dos escaneos simultáneos del mismo código → solo uno gana.
- Todas las API exigen JWT de Supabase Auth; RLS activo sin políticas: la `anon key` no puede leer ni escribir tablas.
- Credenciales solo en variables de entorno; la `service_role key` jamás sale del servidor.

## Fuera del piloto (backlog)

Contingencia offline con cola local en la app, integración con el microservicio de reportería, dashboard/analítica, multi-día/multi-ingreso, compras grupales. Ver plan v2.
