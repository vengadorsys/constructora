(function () {
  "use strict";
  // Datos de la marca de DEMO. Todo lo marcado [CONFIRMAR] se sustituye por los datos reales del cliente.
  window.__BRAND__ = {
    name: "Cimbra Norte Construcciones",
    short: "Cimbra Norte",
    ciudad: "Torreón, Coahuila",
    whatsapp: "528710000000",            // [CONFIRMAR] formato wa.me: 52 + 10 dígitos
    telefono: "+52 871 000 0000",         // [CONFIRMAR]
    email: "hola@cimbranorte.example",    // [CONFIRMAR]
    horario: "Lun a Vie 8:00–18:00 · Sáb 9:00–14:00",
    oficina: { lat: 25.5428, lon: -103.4068, label: "Oficina (ubicación de ejemplo), Torreón" },

    // [CONFIRMAR] Tarifas orientativas MXN/m² sin IVA. El cliente fija las suyas.
    tarifas: {
      iva: 0.16,
      porM2: {
        economico:   [8500, 10500],
        medio:       [10500, 14500],
        residencial: [14500, 20000],
        premium:     [20000, 28000]
      },
      factorTipo: {
        casa_habitacion: 1.0,
        ampliacion:      1.06,
        remodelacion:    0.72,
        local_comercial: 0.92,
        oficinas:        0.98
      },
      factorNiveles: { 1: 1.0, 2: 1.04, 3: 1.08 },
      proyectoEjecutivoPct: 0.06,          // si aún no tiene planos
      obraNegraPct: 0.55,                  // parte de obra negra/gris sobre el total
      m2PorSemana: { casa_habitacion: 6, ampliacion: 5, remodelacion: 8, local_comercial: 10, oficinas: 10 },
      semanasPermisos: {
        casa_habitacion: [6, 10],
        ampliacion:      [4, 8],
        remodelacion:    [1, 4],
        local_comercial: [8, 14],
        oficinas:        [6, 12]
      },
      credito: {                            // supuestos del cálculo de mensualidad [CONFIRMAR]
        infonavit:  { tasa: 10.5, plazo: 20, enganche: 10, nombre: "Infonavit" },
        fovissste:  { tasa: 10.5, plazo: 20, enganche: 10, nombre: "Fovissste" },
        bancario:   { tasa: 11.5, plazo: 15, enganche: 20, nombre: "Crédito bancario" }
      }
    }
  };
})();
