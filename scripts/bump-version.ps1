# 升版：同步 version.json、sw.js、sw-register.js 與 index.html 裡的版本號
# 用法：powershell -ExecutionPolicy Bypass -File scripts/bump-version.ps1 -Notes "這次改了什麼"
param([string]$Notes = "內容更新")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)
$utf8 = [System.Text.Encoding]::UTF8

$today = Get-Date -Format "yyyy.MM.dd"
$vp = Join-Path $root "version.json"
$seq = 1
if (Test-Path $vp) {
  $old = ([System.IO.File]::ReadAllText($vp, $utf8) | ConvertFrom-Json).version
  if ($old -match "^$([regex]::Escape($today))-(\d+)$") { $seq = [int]$Matches[1] + 1 }
}
$ver = "$today-$seq"

$json = "{`n  `"version`": `"$ver`",`n  `"notes`": `"$($Notes -replace '"', '\"')`"`n}`n"
[System.IO.File]::WriteAllText($vp, $json, $enc)

$rules = @(
  @("sw.js",          "const BUILD_VERSION = '[^']*';", "const BUILD_VERSION = '$ver';"),
  @("sw-register.js", "var APP_VERSION = '[^']*';",     "var APP_VERSION = '$ver';"),
  @("index.html",     "\?v=[0-9][0-9.\-]*",             "?v=$ver")
)
foreach ($r in $rules) {
  $p = Join-Path $root $r[0]
  $t = [System.IO.File]::ReadAllText($p, $utf8)
  $n = [regex]::Replace($t, $r[1], $r[2])
  if ($n -eq $t) { throw "版本號沒有被替換：$($r[0])" }
  [System.IO.File]::WriteAllText($p, $n, $enc)
}
Write-Host "已升版為 $ver（接著 git add -A、commit、push）"
