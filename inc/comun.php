<?php
// inc/comun.php — utilidades compartidas por los archivos del asistente, el lector,
// las solicitudes y el panel. No se sirve directamente (.htaccess lo bloquea).
if (!defined('CN_APP')) { http_response_code(404); exit; }

// Modelos de Gemini a probar en orden (capa gratuita). Si Google retira uno, se usa el siguiente.
$CN_MODELOS_TEXTO  = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
$CN_MODELOS_VISION = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];

// Carpeta privada: un nivel ARRIBA de public_html (nunca accesible desde el navegador).
function cn_privado() {
  $arriba = dirname(__DIR__, 2);
  if (is_dir($arriba) && is_writable($arriba)) return $arriba;
  return dirname(__DIR__) . '/datos'; // respaldo protegido por .htaccess
}

function cn_json($arr, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

// Solo peticiones del propio sitio (evita que otra web gaste la cuota del cliente).
function cn_mismo_origen() {
  $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
  $src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
  if ($src === '') return true;
  $h = strtolower((string) parse_url($src, PHP_URL_HOST));
  return $h !== '' && $h === preg_replace('/:\d+$/', '', $host);
}

// Límite por IP (minuto y día) + tope global diario. Devuelve '' si pasa, o el motivo.
function cn_limite($pref, $porMin, $porDia, $global, $registrar = true) {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  $tmp = sys_get_temp_dir(); $now = time();
  $f = $tmp . '/cn_' . $pref . '_' . md5($ip) . '.json';
  $st = is_file($f) ? json_decode((string) @file_get_contents($f), true) : [];
  if (!is_array($st)) $st = [];
  $st = array_values(array_filter($st, function ($t) use ($now) { return $t > $now - 86400; }));
  $min = count(array_filter($st, function ($t) use ($now) { return $t > $now - 60; }));
  if ($min >= $porMin) return 'rate_min';
  if (count($st) >= $porDia) return 'rate_day';
  $g = $tmp . '/cn_' . $pref . '_global_' . date('Ymd') . '.txt';
  $gc = is_file($g) ? (int) @file_get_contents($g) : 0;
  if ($global > 0 && $gc >= $global) return 'rate_global';
  if ($registrar) {
    $st[] = $now;
    @file_put_contents($f, json_encode(array_slice($st, -400)), LOCK_EX);
    @file_put_contents($g, (string) ($gc + 1), LOCK_EX);
  }
  return '';
}

// Clave de Gemini: variable de entorno → archivo fuera de public_html.
function cn_clave_gemini() {
  $k = getenv('GEMINI_API_KEY');
  if (!$k) { $p = cn_privado() . '/gemini_api_key.php'; if (is_file($p)) $k = @include $p; }
  $k = is_string($k) ? trim($k) : '';
  return ($k !== '' && strpos($k, 'AIza') === 0) ? $k : '';
}

function cn_gemini($modelo, $clave, $payload, $timeout = 30) {
  $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($modelo) . ':generateContent';
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => $timeout,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $clave],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  ]);
  $r = curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $e = curl_error($ch); curl_close($ch);
  if ($r === false || $c >= 400) return [null, "$modelo http $c $e " . substr((string) $r, 0, 240)];
  $d = json_decode($r, true);
  $txt = '';
  foreach (($d['candidates'][0]['content']['parts'] ?? []) as $p) { if (isset($p['text']) && empty($p['thought'])) $txt .= $p['text']; }
  if ($txt === '') return [null, "$modelo vacío " . ($d['promptFeedback']['blockReason'] ?? ($d['candidates'][0]['finishReason'] ?? ''))];
  return [$txt, ''];
}
