<?php
// panel.php — el dueño consulta aquí las solicitudes del cotizador y del contacto.
// Protegido con la contraseña definida en setup.php (guardada fuera de public_html).
define('CN_APP', 1);
require __DIR__ . '/inc/comun.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('X-Frame-Options: DENY');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS'])]);
session_name('cnpanel');
session_start();

$dir = cn_privado();
$fPass = $dir . '/cn_panel_pass.php';
$hash = is_file($fPass) ? @include $fPass : '';
$error = '';

if (isset($_GET['salir'])) { $_SESSION = []; session_destroy(); header('Location: panel.php'); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['pass'])) {
  if (cn_limite('panel', 5, 40, 0) !== '') $error = 'Demasiados intentos. Espera un minuto.';
  elseif (is_string($hash) && $hash !== '' && password_verify((string) $_POST['pass'], $hash)) { session_regenerate_id(true); $_SESSION['ok'] = 1; header('Location: panel.php'); exit; }
  else $error = 'Contraseña incorrecta.';
}
$dentro = !empty($_SESSION['ok']);

if ($dentro && isset($_GET['csv'])) {
  $csv = $dir . '/cn_solicitudes.csv';
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="solicitudes-' . date('Ymd') . '.csv"');
  if (is_file($csv)) readfile($csv);
  exit;
}

$filas = [];
if ($dentro && is_file($dir . '/cn_solicitudes.jsonl')) {
  foreach (array_reverse(file($dir . '/cn_solicitudes.jsonl', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)) as $l) {
    $r = json_decode($l, true); if (is_array($r)) $filas[] = $r;
    if (count($filas) >= 500) break;
  }
}
function h($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); }
function pesos($v) { return $v === null || $v === '' ? '—' : '$' . number_format((float) $v, 0, '.', ','); }
$N = ['casa_habitacion' => 'Casa nueva', 'ampliacion' => 'Ampliación', 'remodelacion' => 'Remodelación', 'local_comercial' => 'Local comercial', 'oficinas' => 'Oficinas'];
?><!DOCTYPE html>
<html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Solicitudes · Cimbra Norte</title>
<style>
:root{--bg:#F2F1EE;--ink:#111A21;--st:#162733;--ac:#F2B705;--ln:rgba(17,26,33,.14)}
*{box-sizing:border-box;margin:0}body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.5}
header{background:var(--st);color:#fff;padding:16px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}header b{flex:1}
header a{color:var(--ac);font-size:.9rem}.wrap{max-width:1200px;margin:auto;padding:20px}
.login{max-width:380px;margin:12vh auto;background:#fff;padding:26px;border-top:4px solid var(--ac)}
input{width:100%;padding:12px;border:1px solid var(--ln);font:inherit;margin:10px 0}button{width:100%;padding:12px;border:0;background:var(--ac);font-weight:700;cursor:pointer}
.err{color:#a33;font-size:.9rem}.card{background:#fff;border:1px solid var(--ln);margin-bottom:12px;padding:16px;display:grid;gap:10px}
.top{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;justify-content:space-between}.top b{font-size:1.05rem}
.tag{font-size:.72rem;padding:2px 8px;background:var(--st);color:#fff}.tag.c{background:var(--ac);color:#1b1500}
dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px 16px}dt{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;opacity:.6}dd{font-weight:600;font-size:.93rem}
.acts a{display:inline-block;margin-right:8px;font-size:.85rem;padding:6px 10px;background:#1FAF5A;color:#fff;text-decoration:none}.acts a.m{background:var(--st)}
.empty{padding:40px;text-align:center;opacity:.7}
</style></head><body>
<?php if (!$dentro): ?>
<form class="login" method="post"><h1 style="font-size:1.3rem">Panel de solicitudes</h1>
<?php if (!$hash): ?><p class="err">Primero define la contraseña en setup.php.</p><?php else: ?>
<input type="password" name="pass" placeholder="Contraseña" required autofocus><button>Entrar</button><?php endif; ?>
<?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?></form>
<?php else: ?>
<header><b>Solicitudes · Cimbra Norte (<?= count($filas) ?>)</b><a href="panel.php?csv=1">Descargar Excel (CSV)</a><a href="panel.php?salir=1">Salir</a></header>
<div class="wrap">
<?php if (!$filas): ?><p class="empty">Aún no hay solicitudes.</p><?php endif; ?>
<?php foreach ($filas as $r): $tel = preg_replace('/\D/', '', (string) ($r['telefono'] ?? '')); if (strlen($tel) === 10) $tel = '52' . $tel; ?>
<article class="card">
  <div class="top"><b><?= h($r['nombre'] ?: 'Sin nombre') ?></b><span class="tag <?= ($r['tipo'] ?? '') === 'cotizacion' ? 'c' : '' ?>"><?= ($r['tipo'] ?? '') === 'cotizacion' ? 'Cotizador' : 'Contacto' ?></span><small><?= h(date('d/m/Y H:i', strtotime($r['fecha'] ?? 'now'))) ?></small></div>
  <dl>
    <div><dt>WhatsApp</dt><dd><?= h($r['telefono'] ?: '—') ?></dd></div>
    <div><dt>Email</dt><dd><?= h($r['email'] ?: '—') ?></dd></div>
    <?php if (($r['tipo'] ?? '') === 'cotizacion'): ?>
    <div><dt>Obra</dt><dd><?= h($N[$r['tipo_proyecto']] ?? $r['tipo_proyecto']) ?> · <?= h($r['acabado']) ?></dd></div>
    <div><dt>Construcción</dt><dd><?= h($r['m2_construccion']) ?> m² · <?= h($r['niveles']) ?> nivel(es)</dd></div>
    <div><dt>Terreno</dt><dd><?= h($r['m2_terreno'] ?? '—') ?> m²<?= $r['area_dibujada_m2'] ? ' (dibujado ' . h($r['area_dibujada_m2']) . ')' : '' ?></dd></div>
    <div><dt>Recámaras / baños</dt><dd><?= h($r['recamaras'] ?? '—') ?> / <?= h($r['banos'] ?? '—') ?></dd></div>
    <div><dt>Estimado (sin IVA)</dt><dd><?= pesos($r['estimado_min']) ?> – <?= pesos($r['estimado_max']) ?></dd></div>
    <div><dt>Obra negra / acabados</dt><dd><?= pesos($r['obra_negra']) ?> / <?= pesos($r['acabados']) ?></dd></div>
    <div><dt>Semanas obra · permisos</dt><dd><?= h($r['semanas_obra']) ?> · <?= h($r['semanas_permisos']) ?></dd></div>
    <div><dt>Pago</dt><dd><?= h($r['financiamiento']) ?><?= $r['mensualidad'] ? ' · ' . pesos($r['mensualidad']) . '/mes' : '' ?></dd></div>
    <div><dt>Planos</dt><dd><?= h($r['tiene_planos']) ?> · datos: <?= h($r['origen_datos']) ?></dd></div>
    <?php endif; ?>
    <?php if (!empty($r['direccion']) || !empty($r['ciudad'])): ?><div><dt>Ubicación</dt><dd><?= h($r['direccion'] ?: $r['ciudad']) ?></dd></div><?php endif; ?>
  </dl>
  <?php if (!empty($r['mensaje'])): ?><p><?= nl2br(h($r['mensaje'])) ?></p><?php endif; ?>
  <div class="acts">
    <?php if (strlen($tel) >= 12): ?><a target="_blank" rel="noopener" href="https://wa.me/<?= h($tel) ?>?text=<?= rawurlencode('Hola ' . ($r['nombre'] ?? '') . ', te escribimos de Cimbra Norte sobre tu cotización. ¿Cuándo te queda bien la visita técnica?') ?>">Responder por WhatsApp</a><?php endif; ?>
    <?php if (!empty($r['lat'])): ?><a class="m" target="_blank" rel="noopener" href="https://www.google.com/maps?q=<?= h($r['lat']) ?>,<?= h($r['lon']) ?>">Ver en mapa</a><?php endif; ?>
  </div>
</article>
<?php endforeach; ?>
</div>
<?php endif; ?>
</body></html>
