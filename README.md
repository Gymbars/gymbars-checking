# Escáner de asistencia (tablet)

Página estática que lee el QR del carnet con la cámara y registra la asistencia en el sistema.
Es una carpeta aparte porque **la cámara no funciona dentro de páginas de Apps Script ni de Google Sites**.

## Cómo publicarla (GitHub Pages, gratis)

1. Crea un repositorio **público** nuevo (por ejemplo `gymbars-checkin`) y copia ahí el contenido de esta
   carpeta: `index.html`, `scanner-core.js`, `config.js`. No tiene secretos: sin un tablet emparejado nadie
   puede registrar nada. (GitHub Pages gratis requiere repositorio público.)
2. Edita `config.js` y pon en `apiUrl` la dirección del Web App de Apps Script (termina en `/exec`).
3. En el repositorio: **Settings → Pages → Deploy from a branch → main / (root)**. La dirección queda como
   `https://<usuario>.github.io/gymbars-checkin/`.
4. En el panel: **Ajustes → Configuración → Dirección de la página del escáner** y pega esa dirección.

> Desde Google Sites solo puedes poner un **enlace o botón** a la página. No la incrustes: dentro de otra
> página la cámara se bloquea (el escáner lo detecta y te avisa).

## Conectar el tablet

1. En el panel: **Ajustes → Tablets de asistencia → Conectar un tablet** (genera un código de 8 caracteres, vale 15 min).
2. En el tablet abre la página, escribe el código y toca **Conectar**. Después **Iniciar** (el navegador pide un
   toque para dar permiso a la cámara, al sonido y mantener la pantalla encendida).
3. Deja el tablet en la entrada, en pantalla completa. Recomendado: modo «Acceso guiado» (iPad) o
   «Fijar pantalla» (Android) para que nadie salga de la página.

Solo los tablets conectados desde el panel pueden registrar asistencia. Si se pierde uno, **Revocar** en
Ajustes lo deja sin acceso al instante.

## ¿Por qué no en Google Sites ni en Apps Script?

Las páginas de Apps Script y de Sites se muestran dentro de un marco aislado que bloquea la cámara. El escáner necesita la cámara, así que va como página independiente (esta carpeta). Sites solo puede tener un botón que la abra.

Para comprobarlo en tu tablet abre `<URL del Web App>?page=camera` y pulsa el botón: si dice «La cámara funciona aquí», el escáner también podría servirse desde Apps Script.

Otras opciones de alojamiento gratuito: Netlify Drop, Firebase Hosting.

## Enlaces con dominio propio

`link-core.js` y `v/index.html` permiten que los enlaces de carnet, comprobante y reporte usen tu dominio. Configuración en `DEPLOY.md`.

## Qué muestra

* Verde: «¡Bienvenido, Ana!» (con aviso en ámbar si su mensualidad está vencida; nunca se le niega la entrada).
* Azul: ya registró hoy (un segundo QR dentro de la ventana no duplica la visita).
* Rojo: código desconocido, membresía inactiva (consultar en recepción) o tablet no autorizado.

La pantalla solo muestra el **nombre de pila** y el estado. No muestra apellidos, teléfono ni DPI.

## Probar sin tablet

```bash
node tools/ui-check.mjs      # incluye una prueba completa de emparejar y escanear con la página real
```
