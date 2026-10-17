<?php
// setup.php — activar la clave de Gemini y la contraseña del panel de solicitudes, UNA vez,
// desde el navegador. Todo se guarda fuera de public_html y nunca se muestra.
// Cuando ambas estén configuradas, esta página ya no acepta cambios.
define('CN_APP', 1);
require __DIR__ . '/inc/comun.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

// Enlace secreto: setup.php?t=XXXX (el token solo se entrega al dueño).
$tok = (string) ($_GET['t'] ?? '');
$hashTok = @include __DIR__ . '/inc/setup-token.php';
if (!is_string($hashTok) || $tok === '' || !hash_equals($hashTok, hash('sha256', $tok))) { http_response_code(404); echo 'No encontrado'; exit; }

$dir = cn_privado();
$fClave = $dir . '/gemini_api_key.php';
$fPass  = $dir . '/cn_panel_pass.php';
$hayClave = cn_clave_gemini() !== '';
$hayPass  = is_file($fPass);
$msg = ''; $tono = 'info';

function validar_gemini($k) {
  $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $k]]);
  $r = curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return $r !== false && $c === 200;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && cn_mismo_origen()) {
  if (cn_limite('setup', 5, 30, 0) !== '') { $msg = 'Demasiados intentos. Espera un minuto.'; $tono = 'warn'; }
  elseif (isset($_POST['clave']) && !$hayClave) {
    $k = trim((string) $_POST['clave']);
    if (strpos($k, 'AIza') !== 0 || !preg_match('/^[A-Za-z0-9_\-]{30,60}$/', $k)) { $msg = 'La clave debe empezar por «AIza». Revísala.'; $tono = 'warn'; }
    elseif (!validar_gemini($k)) { $msg = 'Google no aceptó esa clave. Copia de nuevo la clave completa.'; $tono = 'warn'; }
    elseif (@file_put_contents($fClave, "<?php return '" . $k . "';\n", LOCK_EX) !== false) { @chmod($fClave, 0600); $hayClave = true; $msg = '✅ Clave de la IA activada.'; $tono = 'ok'; }
    else { $msg = 'La clave es válida, pero no se pudo guardar (permisos del servidor).'; $tono = 'warn'; }
  } elseif (isset($_POST['pass']) && !$hayPass) {
    $p = (string) $_POST['pass'];
    if (mb_strlen($p) < 10) { $msg = 'La contraseña del panel debe tener al menos 10 caracteres.'; $tono = 'warn'; }
    elseif (@file_put_contents($fPass, "<?php return " . var_export(password_hash($p, PASSWORD_DEFAULT), true) . ";\n", LOCK_EX) !== false) { @chmod($fPass, 0600); $hayPass = true; $msg = '✅ Contraseña del panel guardada.'; $tono = 'ok'; }
    else { $msg = 'No se pudo guardar la contraseña (permisos del servidor).'; $tono = 'warn'; }
  }
}
?><!DOCTYPE html>
<html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Configuración · Cimbra Norte</title>
<style>
:root{--bg:#101D27;--card:#162733;--ink:#EEF2F4;--mut:#B9C7D0;--ac:#F2B705;--ln:rgba(233,238,241,.14)}
*{box-sizing:border-box;margin:0}body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:grid;place-items:center;padding:20px;line-height:1.55}
.box{width:100%;max-width:480px;background:var(--card);border:1px solid var(--ln);padding:28px;border-top:4px solid var(--ac)}
h1{font-size:1.4rem;margin-bottom:6px}.sub{color:var(--mut);font-size:.92rem;margin-bottom:18px}
.card{border:1px solid var(--ln);padding:16px;margin-bottom:14px}.card h2{font-size:1rem;display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}
.pill{font-size:.72rem;padding:2px 8px;border:1px solid var(--ln)}.pill.ok{background:rgba(31,175,90,.2);color:#b9f5cf}.pill.no{background:rgba(242,183,5,.15);color:#ffe6a3}
.hint{color:var(--mut);font-size:.85rem;margin-bottom:10px}.hint a{color:var(--ac)}
input{width:100%;padding:12px;border:1px solid var(--ln);background:#0B141B;color:var(--ink);font:inherit}
button{width:100%;margin-top:10px;padding:12px;border:0;background:var(--ac);color:#1B1500;font-weight:700;cursor:pointer;font:inherit;font-weight:700}
.msg{margin-top:12px;padding:10px 12px;font-size:.9rem;border:1px solid var(--ln)}.ok{background:rgba(31,175,90,.15)}.warn{background:rgba(232,89,12,.18)}
.foot{margin-top:14px;font-size:.78rem;color:var(--mut)}
</style></head><body><main class="box">
<h1>Configuración del sitio</h1>
<p class="sub">Activa la inteligencia artificial (asistente Bruno y lector de planos) y la contraseña del panel de solicitudes. Se guardan en el servidor, fuera de la parte pública, y nunca se muestran.</p>
<div class="card"><h2>Clave de Google Gemini <span class="pill <?= $hayClave ? 'ok' : 'no' ?>"><?= $hayClave ? 'Activa ✓' : 'Pendiente' ?></span></h2>
<?php if (!$hayClave): ?><p class="hint">Créala gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (empieza por AIza…).</p>
<form method="post" autocomplete="off"><input name="clave" type="password" placeholder="AIza…" required><button>Activar IA</button></form><?php endif; ?></div>
<div class="card"><h2>Contraseña del panel <span class="pill <?= $hayPass ? 'ok' : 'no' ?>"><?= $hayPass ? 'Guardada ✓' : 'Pendiente' ?></span></h2>
<?php if (!$hayPass): ?><p class="hint">Para ver las solicitudes en <b>panel.php</b>. Mínimo 10 caracteres.</p>
<form method="post" autocomplete="off"><input name="pass" type="password" minlength="10" required><button>Guardar contraseña</button></form><?php endif; ?></div>
<?php if ($msg): ?><div class="msg <?= $tono ?>"><?= htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
<?php if ($hayClave && $hayPass): ?><div class="msg ok">Todo listo. Por seguridad, esta página ya no permite cambios.</div><?php endif; ?>
<p class="foot">Las solicitudes del cotizador se guardan en un archivo privado y se consultan en <a href="panel.php" style="color:var(--ac)">panel.php</a>.</p>
</main></body></html>
