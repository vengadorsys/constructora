<?php
// lector-documento.php — lee un plano, croquis a mano o PDF con Gemini (visión) y
// devuelve SOLO las medidas que vienen escritas. Lo que no aparece regresa null.
// El archivo se procesa en memoria y no se guarda en el servidor.
define('CN_APP', 1);
require __DIR__ . '/inc/comun.php';

function fallo($r) { cn_json(['ok' => false, 'reason' => $r]); }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') cn_json(['ok' => false, 'reason' => 'method'], 405);
if (!cn_mismo_origen()) cn_json(['ok' => false, 'reason' => 'origin'], 403);

$MAX = 10 * 1024 * 1024;
if (empty($_FILES['documento']) || !is_uploaded_file($_FILES['documento']['tmp_name'] ?? '')) fallo('sin_archivo');
$f = $_FILES['documento'];
if (($f['error'] ?? 1) !== 0) fallo(($f['error'] ?? 0) == UPLOAD_ERR_INI_SIZE ? 'tamano' : 'subida');
if (($f['size'] ?? 0) <= 0 || $f['size'] > $MAX) fallo('tamano');

$mime = '';
if (function_exists('finfo_open')) { $fi = finfo_open(FILEINFO_MIME_TYPE); $mime = (string) finfo_file($fi, $f['tmp_name']); finfo_close($fi); }
$mime = strtolower(trim($mime ?: (string) ($f['type'] ?? '')));
if ($mime === 'image/jpg') $mime = 'image/jpeg';
$ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
if (!in_array($mime, $ok, true)) fallo('tipo');

$clave = cn_clave_gemini();
if ($clave === '') fallo('sin_clave');
$lim = cn_limite('doc', 6, 40, 400);
if ($lim !== '') fallo($lim);

$bytes = @file_get_contents($f['tmp_name']);
if ($bytes === false || $bytes === '') fallo('subida');

$INSTR = <<<'TXT'
Eres un extractor de datos de documentos de construcción en México. Recibes la imagen o el PDF de un plano arquitectónico, un croquis dibujado a mano o la foto de un terreno. Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional, con EXACTAMENTE estas claves:
{
  "tipo_documento": "plano" | "croquis" | "foto_terreno" | "otro",
  "es_documento_de_obra": true | false,
  "tipo_proyecto": "casa_habitacion" | "ampliacion" | "remodelacion" | "local_comercial" | "oficinas" | null,
  "superficie_terreno_m2": número o null,
  "superficie_construccion_m2": número o null,
  "frente_m": número o null,
  "fondo_m": número o null,
  "niveles": número o null,
  "recamaras": número o null,
  "banos": número o null,
  "espacios_detectados": [texto],
  "observaciones": texto o null
}
Reglas estrictas:
- Lee SOLO cotas, áreas y cantidades que aparezcan ESCRITAS en el documento (números o texto). Si un dato no está escrito o no lo puedes leer con seguridad, pon null. NO estimes medidas a partir del dibujo, la escala o las proporciones. NO cuentes por intuición.
- "recamaras": solo si los espacios están rotulados (p. ej. «Recámara 1», «Rec. principal», «Dormitorio») o el número está escrito; cuenta los rótulos de recámara. Si no hay rótulos, null.
- "banos": cuenta solo espacios rotulados como baño/WC/sanitario; un medio baño (solo WC y lavabo, rotulado «medio baño» o «1/2 baño») vale 0.5. Si no hay rótulos, null.
- "niveles": solo si aparecen rótulos como «Planta baja», «Planta alta», «Nivel 1/2», o está escrito. Si solo hay una planta sin rótulo de nivel, null.
- "superficie_construccion_m2": usa el total escrito; si solo aparece por nivel y todos los niveles son legibles, súmalos; si no, null.
- "superficie_terreno_m2": el área de terreno escrita. Si no está escrita pero sí frente y fondo del terreno, deja superficie_terreno_m2 en null y llena frente_m y fondo_m.
- Números con PUNTO decimal y sin unidades. Convierte cm a m si la cota lo indica.
- "espacios_detectados": nombres de espacios rotulados (máx. 15).
- "observaciones": una frase corta y neutra (máx. 160 caracteres) sobre qué datos no venían escritos o no se leyeron.
TXT;

$payload = [
  'contents' => [[ 'role' => 'user', 'parts' => [
    ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
    ['text' => $INSTR],
  ]]],
  'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 1200, 'responseMimeType' => 'application/json', 'thinkingConfig' => ['thinkingBudget' => 0]],
];
unset($bytes);

function extraer_json($s) {
  $s = trim(preg_replace(['/^```(?:json)?/i', '/```$/'], '', trim((string) $s)));
  $a = strpos($s, '{'); $b = strrpos($s, '}');
  if ($a === false || $b === false || $b < $a) return null;
  $d = json_decode(substr($s, $a, $b - $a + 1), true);
  return is_array($d) ? $d : null;
}

$parsed = null; $errores = '';
foreach ($CN_MODELOS_VISION as $m) {
  list($txt, $err) = cn_gemini($m, $clave, $payload, 50);
  if ($txt && ($parsed = extraer_json($txt))) break;
  $errores .= ' | ' . ($err ?: "$m json inválido");
}
if (!$parsed) { @error_log('[cn-lector]' . $errores); fallo('ia'); }

function n($v) {
  if ($v === null || $v === '' || is_bool($v)) return null;
  if (is_int($v) || is_float($v)) return $v >= 0 ? (float) $v : null;
  $s = str_replace([' ', "\xc2\xa0", 'm2', 'm²', 'mts', 'm'], '', (string) $v);
  if (strpos($s, ',') !== false && strpos($s, '.') === false) $s = str_replace(',', '.', $s); else $s = str_replace(',', '', $s);
  return (is_numeric($s) && (float) $s >= 0) ? (float) $s : null;
}
function rango($v, $min, $max) { return ($v !== null && $v >= $min && $v <= $max) ? $v : null; }
function en($v, $ok) { return (is_string($v) && in_array($v, $ok, true)) ? $v : null; }

$d = [
  'tipo_documento' => en($parsed['tipo_documento'] ?? null, ['plano', 'croquis', 'foto_terreno', 'otro']) ?? 'otro',
  'es_documento_de_obra' => (bool) ($parsed['es_documento_de_obra'] ?? false),
  'tipo_proyecto' => en($parsed['tipo_proyecto'] ?? null, ['casa_habitacion', 'ampliacion', 'remodelacion', 'local_comercial', 'oficinas']),
  'superficie_terreno_m2' => rango(n($parsed['superficie_terreno_m2'] ?? null), 10, 50000),
  'superficie_construccion_m2' => rango(n($parsed['superficie_construccion_m2'] ?? null), 5, 20000),
  'frente_m' => rango(n($parsed['frente_m'] ?? null), 2, 500),
  'fondo_m' => rango(n($parsed['fondo_m'] ?? null), 2, 500),
  'niveles' => rango(n($parsed['niveles'] ?? null), 1, 6),
  'recamaras' => rango(n($parsed['recamaras'] ?? null), 0, 15),
  'banos' => rango(n($parsed['banos'] ?? null), 0, 12),
  'espacios_detectados' => [],
  'observaciones' => (is_string($parsed['observaciones'] ?? null) && trim($parsed['observaciones']) !== '') ? mb_substr(trim($parsed['observaciones']), 0, 200) : null,
];
foreach ((is_array($parsed['espacios_detectados'] ?? null) ? $parsed['espacios_detectados'] : []) as $e) {
  if (is_string($e) && trim($e) !== '') $d['espacios_detectados'][] = mb_substr(trim($e), 0, 50);
  if (count($d['espacios_detectados']) >= 15) break;
}
// Terreno = frente × fondo solo si ambas cotas se leyeron (es aritmética, no estimación).
if ($d['superficie_terreno_m2'] === null && $d['frente_m'] !== null && $d['fondo_m'] !== null) {
  $d['superficie_terreno_m2'] = round($d['frente_m'] * $d['fondo_m'], 2);
}
cn_json(['ok' => true, 'data' => $d]);
