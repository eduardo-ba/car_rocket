# Servidor local para Car Rocket (sin instalar nada: usa PowerShell de Windows).
# Lo abre JUGAR.bat. Sirve los archivos de la carpeta del juego en http://localhost:8123/
param([int]$Port = 8123, [switch]$NoBrowser)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
  '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'; '.m4a' = 'audio/mp4'; '.webm' = 'audio/webm'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

# busca un puerto libre
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start()
    $listener = $l; $Port = $p
    break
  } catch { }
}
if (-not $listener) {
  Write-Host 'No se pudo abrir el servidor local.' -ForegroundColor Red
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  CAR ROCKET' -ForegroundColor Yellow
Write-Host "  Jugando en: $url"
Write-Host '  Deja esta ventana abierta mientras juegas. Cierrala para terminar.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

function Send-Bytes($res, [byte[]]$bytes, [int64]$start, [int64]$count) {
  $res.ContentLength64 = $count
  $res.OutputStream.Write($bytes, [int]$start, [int]$count)
}

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path))
    if ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Container)) {
      # folder listing (the game reads assets/voices/ to find your voice recordings)
      $links = Get-ChildItem -LiteralPath $full -File | ForEach-Object { '<a href="' + [Uri]::EscapeDataString($_.Name) + '">' + $_.Name + '</a>' }
      $res.ContentType = 'text/html; charset=utf-8'
      $res.Headers.Add('Cache-Control', 'no-cache')
      $html = [Text.Encoding]::UTF8.GetBytes('<!doctype html><meta charset="utf-8">' + ($links -join '<br>'))
      Send-Bytes $res $html 0 $html.Length
    } elseif (-not $full.StartsWith($root) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      Send-Bytes $res ([Text.Encoding]::UTF8.GetBytes('Not found')) 0 9
    } else {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.Headers.Add('Accept-Ranges', 'bytes')
      $bytes = [IO.File]::ReadAllBytes($full)
      $len = [int64]$bytes.Length
      $range = $req.Headers['Range']
      if ($range -and $range -match 'bytes=(\d*)-(\d*)') {
        # partial content, so songs can loop and seek
        $start = 0; $end = $len - 1
        if ($Matches[1]) { $start = [int64]$Matches[1] }
        if ($Matches[2]) { $end = [Math]::Min([int64]$Matches[2], $len - 1) }
        $res.StatusCode = 206
        $res.Headers.Add('Content-Range', "bytes $start-$end/$len")
        Send-Bytes $res $bytes $start ($end - $start + 1)
      } else {
        Send-Bytes $res $bytes 0 $len
      }
    }
  } catch {
    try { $res.StatusCode = 500 } catch { }
  } finally {
    try { $res.OutputStream.Close() } catch { }
  }
}
