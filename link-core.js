/**
 * link-core.js — Convierte un enlace de tu dominio en la dirección real de Apps Script.
 *
 *   https://app.tudominio.com/v/?carnet=<token>   →   https://script.google.com/macros/s/…/exec?carnet=<token>
 *
 * Solo acepta la forma EXACTA de los enlaces que crea el sistema (carnet, comprobante, reporte firmado) y
 * descarta cualquier otro parámetro, así la página no puede usarse para abrir otras direcciones.
 * UMD: se usa en el navegador como `GymbarsLinks` y en las pruebas con require().
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GymbarsLinks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HEX24 = /^[0-9a-f]{24}$/i;
  var HEX32 = /^[0-9a-f]{32}$/i;
  var API_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  var LOCAL_URL = /^http:\/\/localhost(:\d+)?\/exec$/;       // solo para la vista previa local

  /**
   * @param {string} search  location.search del enlace
   * @param {string} apiUrl  dirección /exec del Web App (config.js)
   * @param {{allowLocal?:boolean}} [opts]
   * @return {string} La dirección a mostrar, o '' si el enlace o la configuración no son válidos.
   */
  function buildTarget(search, apiUrl, opts) {
    var okUrl = API_URL.test(String(apiUrl || '')) || (opts && opts.allowLocal && LOCAL_URL.test(String(apiUrl || '')));
    if (!okUrl) return '';

    var p = new URLSearchParams(search || '');
    var carnet = p.get('carnet'), voucher = p.get('comprobante'), report = p.get('reporte');
    var query = '';

    if (carnet) {
      if (!HEX24.test(carnet)) return '';
      query = 'carnet=' + carnet;
    } else if (voucher) {
      if (!HEX24.test(voucher)) return '';
      query = 'comprobante=' + voucher;
    } else if (report) {
      var m = p.get('m'), r = p.get('r'), s = p.get('s');
      var prefix = report === 'medidas' ? 'MD' : report === 'evaluacion' ? 'EV' : '';
      if (!prefix || !/^GB-\d{4,}$/.test(m || '') || !new RegExp('^' + prefix + '-\\d{5,}$').test(r || '') || !HEX32.test(s || '')) return '';
      query = 'reporte=' + report + '&m=' + m + '&r=' + r + '&s=' + s;
    } else {
      return '';
    }
    return apiUrl + '?' + query;
  }

  return { buildTarget: buildTarget };
});
