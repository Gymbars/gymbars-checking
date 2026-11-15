/**
 * scanner-core.js — Lógica del escáner de asistencia (sin DOM, probada con Node).
 *
 * Se usa en el navegador como `GymbarsScanner` y en las pruebas con require().
 *   - parseQr:          valida el contenido del QR (enlace del carnet o "GB1:" + 24 hex)
 *   - describeResult:   convierte la respuesta del servidor en lo que se muestra en pantalla
 *   - createDeduper:    evita enviar el mismo QR varias veces seguidas
 *   - createClient:     habla con el Web App de Apps Script (emparejar y escanear)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GymbarsScanner = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QR_PATTERN = /^GB1:[0-9a-fA-F]{24}$/;
  var LINK_PATTERN = /^(?:https:\/\/[^\s?#]+|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s?#]*)\?carnet=([0-9a-fA-F]{24})$/;
  var STORAGE_KEY = 'gymbars.device';

  /** Devuelve el texto del QR si tiene el formato del carnet; si no, ''. */
  function parseQr(text) {
    var value = String(text == null ? '' : text).trim();
    if (QR_PATTERN.test(value)) return value;
    var link = value.match(LINK_PATTERN);                 // enlace personal del carnet: ...?carnet=<24 hex>
    return link ? 'GB1:' + link[1] : '';
  }

  /**
   * Qué mostrar para cada respuesta del servidor.
   * @return {{tone:'ok'|'warn'|'info'|'bad', title:string, detail:string, unpair?:boolean}}
   */
  function describeResult(res) {
    if (!res) return { tone: 'bad', title: 'Sin respuesta', detail: 'Intenta de nuevo.' };
    var name = res.nombre || '';

    if (res.networkError) {
      return { tone: 'bad', title: 'Sin conexión', detail: 'Revisa el internet del tablet e intenta de nuevo.' };
    }
    switch (res.status) {
      case 'ok': {
        var pago = res.pago && res.pago.code;
        var detail = '';
        var tone = 'ok';
        if (pago === 'vencido' || pago === 'sin_pagos') { detail = 'Tu mensualidad está vencida. Pasa por recepción.'; tone = 'warn'; }
        else if (pago === 'gracia') { detail = 'Recuerda ponerte al día con tu mensualidad.'; tone = 'warn'; }
        else if (pago === 'por_vencer') { detail = 'Tu mensualidad vence pronto.'; }
        return { tone: tone, title: '¡Bienvenido, ' + name + '!', detail: detail };
      }
      case 'duplicado':
        return { tone: 'info', title: 'Hola de nuevo, ' + name, detail: 'Ya registraste tu asistencia hoy' + (res.hora ? ' a las ' + res.hora : '') + '.' };
      case 'sin_membresia':
        return { tone: 'bad', title: name || 'Membresía inactiva', detail: 'Consulta en recepción.' };
      case 'desconocido':
        return { tone: 'bad', title: 'Código no reconocido', detail: 'Pide tu carnet en recepción.' };
      case 'no_autorizado':
        return { tone: 'bad', title: 'Tablet no autorizado', detail: 'Pide al administrador un código para conectarlo de nuevo.', unpair: true };
      case 'limite':
        return { tone: 'bad', title: 'Demasiados intentos', detail: res.error || 'Espera unos minutos.' };
      default:
        return { tone: 'bad', title: 'No se pudo registrar', detail: res.error || 'Intenta de nuevo.' };
    }
  }

  /** Ignora el mismo código si se vuelve a ver antes de `windowMs` milisegundos. */
  function createDeduper(windowMs) {
    var lastCode = '';
    var lastAt = -Infinity;
    return {
      shouldSend: function (code, now) {
        var t = now === undefined ? Date.now() : now;
        if (code === lastCode && t - lastAt < windowMs) return false;
        lastCode = code;
        lastAt = t;
        return true;
      },
      reset: function () { lastCode = ''; lastAt = -Infinity; }
    };
  }

  /**
   * Cliente del Web App.
   * @param {{apiUrl:string, fetch:Function, storage:Storage, sleep?:Function, retries?:number}} opts
   */
  function createClient(opts) {
    var apiUrl = opts.apiUrl;
    var fetchFn = opts.fetch;
    var storage = opts.storage;
    var retries = opts.retries === undefined ? 2 : opts.retries;
    var sleep = opts.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    function readDevice() {
      try {
        var raw = storage.getItem(STORAGE_KEY);
        var d = raw ? JSON.parse(raw) : null;
        return d && /^[0-9a-f]{40}$/.test(d.token) ? d : null;
      } catch (_) { return null; }
    }

    // "text/plain" evita la petición previa (preflight) de CORS, que Apps Script no responde.
    function post(body) {
      return fetchFn(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow'
      }).then(function (r) { return r.json(); });
    }

    function postWithRetry(body, attempt) {
      return post(body).catch(function (err) {
        if (attempt >= retries) return { ok: false, networkError: true, error: String(err && err.message || err) };
        return sleep(800 * (attempt + 1)).then(function () { return postWithRetry(body, attempt + 1); });
      });
    }

    return {
      hasDevice: function () { return !!readDevice(); },
      deviceName: function () { var d = readDevice(); return d ? d.name : ''; },
      clear: function () { try { storage.removeItem(STORAGE_KEY); } catch (_) {} },

      /** Canjea un código de emparejamiento por el token del dispositivo. */
      pair: function (code) {
        return postWithRetry({ action: 'pair', code: String(code || '').trim() }, 0).then(function (res) {
          if (res && res.ok && res.device) {
            storage.setItem(STORAGE_KEY, JSON.stringify({ token: res.device, name: res.nombre || '' }));
          }
          return res;
        });
      },

      /** Envía un QR leído. Si el servidor dice que el tablet no está autorizado, lo desconecta. */
      scan: function (qrText) {
        var device = readDevice();
        var code = parseQr(qrText);
        if (!code) return Promise.resolve({ ok: true, status: 'desconocido' });
        if (!device) return Promise.resolve({ ok: false, status: 'no_autorizado' });
        var self = this;
        return postWithRetry({ action: 'scan', device: device.token, code: code }, 0).then(function (res) {
          if (res && res.status === 'no_autorizado') self.clear();
          return res;
        });
      }
    };
  }

  return { parseQr: parseQr, describeResult: describeResult, createDeduper: createDeduper, createClient: createClient, STORAGE_KEY: STORAGE_KEY };
});
