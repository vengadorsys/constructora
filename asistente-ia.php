<?php
// asistente-ia.php — el navegador habla con este archivo; este habla con Gemini.
// La clave vive en el servidor (fuera de public_html) y nunca llega al navegador.
define('CN_APP', 1);
require __DIR__ . '/inc/comun.php';

function responder($t) { cn_json(['reply' => $t]); }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') cn_json(['error' => 'method'], 405);
if (!cn_mismo_origen()) cn_json(['error' => 'origin'], 403);

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$msg = trim((string) ($in['message'] ?? ''));
$hist = is_array($in['history'] ?? null) ? array_slice($in['history'], -8) : [];
if ($msg === '' || mb_strlen($msg) > 500) cn_json(['error' => 'input'], 400);

$clave = cn_clave_gemini();
if ($clave === '') responder('Estoy terminando de configurarme 🙂 Mientras tanto, usa el cotizador o escríbenos por WhatsApp y un arquitecto te atiende.');

$lim = cn_limite('chat', 8, 100, 1200);
if ($lim === 'rate_min') responder('Vas muy rápido 🙂 Espera unos segundos y vuelve a preguntarme.');
if ($lim === 'rate_day') responder('Ya me hiciste muchas preguntas hoy. Para seguir, deja tus datos en el formulario o escríbenos por WhatsApp.');
if ($lim === 'rate_global') responder('Hoy estoy muy solicitado. Escríbenos por WhatsApp o deja tus datos y te respondemos enseguida.');

$sistema = @include __DIR__ . '/inc/knowledge.php';
if (!is_string($sistema) || $sistema === '') $sistema = 'Eres Bruno, asistente de una constructora en Torreón. Responde breve y en español de México.';

$contents = [];
foreach ($hist as $h) {
  $t = mb_substr((string) ($h['text'] ?? ''), 0, 1200);
  if ($t === '') continue;
  $contents[] = ['role' => (($h['role'] ?? '') === 'model') ? 'model' : 'user', 'parts' => [['text' => $t]]];
}
$contents[] = ['role' => 'user', 'parts' => [['text' => $msg]]];

$payload = [
  'system_instruction' => ['parts' => [['text' => $sistema]]],
  'contents' => $contents,
  'generationConfig' => ['temperature' => 0.4, 'topP' => 0.9, 'maxOutputTokens' => 700, 'thinkingConfig' => ['thinkingBudget' => 0]],
  'safetySettings' => [
    ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
  ],
];

$errores = '';
foreach ($CN_MODELOS_TEXTO as $m) {
  list($txt, $err) = cn_gemini($m, $clave, $payload, 25);
  if ($txt) {
    $txt = trim(preg_replace(['/\*\*(.+?)\*\*/s', '/^#+\s*/m'], ['$1', ''], $txt));
    responder($txt);
  }
  $errores .= ' | ' . $err;
}
@error_log('[cn-chat]' . $errores);
responder('Ahora mismo no puedo responder. Escríbenos por WhatsApp o deja tus datos en el formulario y te ayudamos enseguida.');
