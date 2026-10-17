<?php
// geocode.php — sugerencias de direcciones (OpenStreetMap Nominatim, respaldo Photon).
// Se hace en el servidor para respetar la política de uso (User-Agent propio + límite).
define('CN_APP', 1);
require __DIR__ . '/inc/comun.php';

if (!cn_mismo_origen()) cn_json(['results' => []], 403);
$q = trim((string) ($_GET['q'] ?? ''));
if (mb_strlen($q) < 3) cn_json(['results' => []]);
$q = mb_substr($q, 0, 140);
if (cn_limite('geo', 30, 400, 3000) !== '') cn_json(['results' => []]);

$UA = 'CimbraNorteDemo/1.0 (sitio de demostración de constructora)';
function get_url($url, $ua) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_USERAGENT => $ua,
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'Accept-Language: es-MX,es']]);
  $r = curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return ($r !== false && $c === 200) ? json_decode($r, true) : null;
}

$res = [];
$arr = get_url('https://nominatim.openstreetmap.org/search?' . http_build_query([
  'q' => $q, 'format' => 'jsonv2', 'limit' => 6, 'countrycodes' => 'mx', 'accept-language' => 'es',
  'viewbox' => '-103.75,25.75,-103.05,25.35', 'bounded' => 0,
]), $UA);
if (is_array($arr)) foreach ($arr as $it) {
  if (!isset($it['lat'], $it['lon'], $it['display_name'])) continue;
  $res[] = ['label' => (string) $it['display_name'], 'lat' => (float) $it['lat'], 'lon' => (float) $it['lon']];
}
if (!$res) {
  $p = get_url('https://photon.komoot.io/api?' . http_build_query(['q' => $q, 'limit' => 6, 'lat' => 25.54, 'lon' => -103.41]), $UA);
  foreach ((is_array($p['features'] ?? null) ? $p['features'] : []) as $ft) {
    $co = $ft['geometry']['coordinates'] ?? null; $pr = $ft['properties'] ?? [];
    if (!is_array($co) || count($co) < 2) continue;
    $label = implode(', ', array_unique(array_filter([$pr['name'] ?? null, $pr['street'] ?? null, $pr['housenumber'] ?? null, $pr['district'] ?? null, $pr['city'] ?? null, $pr['state'] ?? null])));
    if ($label !== '') $res[] = ['label' => $label, 'lat' => (float) $co[1], 'lon' => (float) $co[0]];
  }
}
cn_json(['results' => array_slice($res, 0, 6)]);
