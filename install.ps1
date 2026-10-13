<#
  Installs the VLC Redesign skin for the current Windows user and makes VLC start with it.

    powershell -ExecutionPolicy Bypass -File install.ps1            # install + use as default interface
    powershell -ExecutionPolicy Bypass -File install.ps1 -NoDefault # only copy the skin
    powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall # back to the normal VLC interface

  A backup of vlcrc is written next to it (vlcrc.bak-<timestamp>) before any change.
#>
param([switch]$NoDefault, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$vlcDir   = Join-Path $env:APPDATA 'vlc'
$skinsDir = Join-Path $vlcDir 'skins'
$vlcrc    = Join-Path $vlcDir 'vlcrc'
$target   = Join-Path $skinsDir 'VLC-Redesign.vlt'
$source   = Join-Path $PSScriptRoot 'dist\VLC-Redesign.vlt'

if (Get-Process vlc -ErrorAction SilentlyContinue) {
  Write-Warning 'VLC is running. Close it first, otherwise it will overwrite vlcrc on exit.'
  exit 1
}

function Set-VlcOption([string[]]$lines, [string]$key, $value) {  # $value = $null comments the option out
  $re = "^#?$([regex]::Escape($key))="
  $found = $false
  $out = foreach ($l in $lines) {
    if (-not $found -and $l -match $re) { $found = $true; if ($null -ne $value) { "$key=$value" } else { "#$key=" } }
    else { $l }
  }
  if (-not $found -and $null -ne $value) { $out += "$key=$value" }
  return ,$out
}

function Update-Vlcrc([hashtable]$opts) {
  New-Item -ItemType Directory -Force $vlcDir | Out-Null
  $lines = @()
  if (Test-Path $vlcrc) {
    Copy-Item $vlcrc "$vlcrc.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    $lines = Get-Content $vlcrc -Encoding UTF8
  }
  foreach ($k in $opts.Keys) { $lines = Set-VlcOption $lines $k $opts[$k] }
  # VLC writes vlcrc with LF line endings; keep it that way.
  [IO.File]::WriteAllText($vlcrc, (($lines -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
}

if ($Uninstall) {
  Update-Vlcrc @{ 'intf' = $null }
  Write-Host 'VLC will start with its standard interface again. The skin file was left in' $skinsDir
  exit 0
}

if (-not (Test-Path $source)) { throw "Missing $source - run 'npm run build' and 'npm run package' first." }
New-Item -ItemType Directory -Force $skinsDir | Out-Null
Copy-Item $source $target -Force
Write-Host "Skin installed to $target"

if (-not $NoDefault) {
  Update-Vlcrc @{ 'intf' = 'skins'; 'skins2-last' = $target }
  Write-Host 'VLC will now start with the VLC Redesign skin. Run with -Uninstall to undo.'
} else {
  Write-Host 'Pick it in VLC: Tools > Preferences > Interface > "Use custom skin".'
}
