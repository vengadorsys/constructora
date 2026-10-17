<?php
// lead.php — guarda las solicitudes (cotizador y contacto) en archivos privados
// FUERA de public_html: cn_solicitudes.jsonl (completo) y cn_solicitudes.csv (Excel).
// Aviso por email opcional: crea, fuera de public_html, cn_aviso_email.php con <?php return 'ventas@dominio.com';
define('CN_APP', 1);
require __DIR__ . '/inc/comun.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') cn_json(['ok' => false, 'reason' => 'method'], 405);
if (!cn_mismo_origen()) cn_json(['ok' => false, 'reason' => 'origin'], 403);

function s($v, $max = 120) { return mb_substr(is_scalar($v) ? trim((string) $v) : '', 0, $max); }
function nn($v, $dec = 2) { return (isset($v) && is_numeric($v)) ? round((float) $v, $dec) : null; }

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
if (s($in['empresa_web'] ?? '') !== '') cn_json(['ok' => true]); // honeypot

$lim = cn_limite('lead', 6, 60, 0);
if ($lim !== '') cn_json(['ok' => false, 'reason' => $lim]);

$tipo = in_array(($in['tipo'] ?? ''), ['cotizacion', 'contacto'], true) ? $in['tipo'] : 'contacto';
$email = s($in['email'] ?? '', 160);
$tel = mb_substr(preg_replace('/[^0-9+\s]/', '', s($in['telefono'] ?? '', 30)), 0, 24);
$emailOk = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);
$telOk = strlen(preg_replace('/\D/', '', $tel)) >= 10;
if (!$emailOk && !$telOk) cn_json(['ok' => false, 'reason' => 'contacto']);
if (!$emailOk) $email = '';
if (empty($in['consent'])) cn_json(['ok' => false, 'reason' => 'consent']);

$c = is_array($in['calc'] ?? null) ? $in['calc'] : [];
$u = is_array($in['ubicacion'] ?? null) ? $in['ubicacion'] : [];
$poly = [];
foreach ((is_array($c['poligono'] ?? null) ? array_slice($c['poligono'], 0, 40) : []) as $p) {
  if (is_array($p) && count($p) === 2 && is_numeric($p[0]) && is_numeric($p[1])) $poly[] = [round((float) $p[0], 6), round((float) $p[1], 6)];
}

$row = [
  'id' => date('ymd-His') . '-' . substr(bin2hex(random_bytes(3)), 0, 5),
  'fecha' => date('c'),
  'tipo' => $tipo,
  'nombre' => s($in['nombre'] ?? '', 120),
  'telefono' => $tel,
  'email' => $email,
  'ciudad' => s($in['ciudad'] ?? '', 60),
  'direccion' => s($u['label'] ?? '', 200),
  'lat' => isset($u['lat']) && is_numeric($u['lat']) ? round((float) $u['lat'], 6) : null,
  'lon' => isset($u['lon']) && is_numeric($u['lon']) ? round((float) $u['lon'], 6) : null,
  'tipo_proyecto' => s($c['tipoProyecto'] ?? '', 40),
  'acabado' => s($c['acabado'] ?? '', 20),
  'm2_construccion' => nn($c['m2'] ?? null, 1),
  'm2_terreno' => nn($c['m2Terreno'] ?? null, 1),
  'area_dibujada_m2' => nn($c['areaDibujadaM2'] ?? null, 1),
  'niveles' => nn($c['niveles'] ?? null, 0),
  'recamaras' => nn($c['recamaras'] ?? null, 0),
  'banos' => nn($c['banos'] ?? null, 1),
  'tiene_planos' => s($c['tienePlanos'] ?? '', 4),
  'financiamiento' => s($c['financiamiento'] ?? '', 20),
  'estimado_min' => nn($c['estimadoMin'] ?? null, 0),
  'estimado_max' => nn($c['estimadoMax'] ?? null, 0),
  'obra_negra' => nn($c['obraNegra'] ?? null, 0),
  'acabados' => nn($c['acabados'] ?? null, 0),
  'proyecto_ejecutivo' => nn($c['proyecto'] ?? null, 0),
  'semanas_obra' => nn($c['semanas'] ?? null, 0),
  'semanas_permisos' => s($c['semanasPermisos'] ?? '', 10),
  'mensualidad' => nn($c['mensualidad'] ?? null, 0),
  'supuestos_credito' => s($c['creditoSupuestos'] ?? '', 80),
  'origen_datos' => s($c['origenDatos'] ?? '', 20),
  'poligono' => $poly ? json_encode($poly) : '',
  'mensaje' => s($in['mensaje'] ?? '', 1500),
  'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
];

$dir = cn_privado();
if (!is_dir($dir)) @mkdir($dir, 0750, true);
$ok = @file_put_contents($dir . '/cn_solicitudes.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false;
$csv = $dir . '/cn_solicitudes.csv';
$nuevo = !is_file($csv);
if ($fh = @fopen($csv, 'a')) {
  if (flock($fh, LOCK_EX)) {
    if ($nuevo) { fwrite($fh, "\xEF\xBB\xBF"); fputcsv($fh, array_keys($row)); }
    fputcsv($fh, array_values($row));
    flock($fh, LOCK_UN);
  }
  fclose($fh);
}

$aviso = $dir . '/cn_aviso_email.php';
if ($ok && is_file($aviso) && function_exists('mail')) {
  $to = @include $aviso;
  if (is_string($to) && filter_var($to, FILTER_VALIDATE_EMAIL)) {
    $txt = "Nueva solicitud desde la web:\n\n";
    foreach ($row as $k => $v) { if ($v !== '' && $v !== null) $txt .= str_pad($k, 20) . ': ' . $v . "\n"; }
    @mail($to, ($tipo === 'cotizacion' ? 'Nueva cotización' : 'Nuevo contacto') . ' — ' . ($row['nombre'] ?: $tel ?: $email), $txt,
      'From: no-reply@' . preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost') . "\r\nContent-Type: text/plain; charset=utf-8");
  }
}
cn_json(['ok' => $ok, 'id' => $ok ? $row['id'] : null]);
