$ErrorActionPreference = 'Stop'
$repo = if ($env:ARIADNE_GITHUB_REPO) { $env:ARIADNE_GITHUB_REPO } else { 'cyclopt-pc/ariadne-cli' }
$version = if ($env:ARIADNE_VERSION) { $env:ARIADNE_VERSION } else { 'latest' }
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [System.Runtime.InteropServices.Architecture]::X64) { throw 'Windows installer supports x64 only.' }
$base = if ($version -eq 'latest') { "https://github.com/$repo/releases/latest/download" } else { "https://github.com/$repo/releases/download/$version" }
$dir = if ($env:ARIADNE_INSTALL_DIR) { $env:ARIADNE_INSTALL_DIR } else { Join-Path $HOME '.local\bin' }
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$tmp = Join-Path $env:TEMP ("ariadne-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $exe = Join-Path $tmp 'ariadne-windows-x64.exe'
  Invoke-WebRequest -Uri "$base/ariadne-windows-x64.exe" -OutFile $exe
  Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile (Join-Path $tmp 'SHA256SUMS')
  $expectedLine = Get-Content (Join-Path $tmp 'SHA256SUMS') | Where-Object { $_ -match '\s+ariadne-windows-x64\.exe$' } | Select-Object -First 1
  if (-not $expectedLine) { throw 'No checksum for Windows executable.' }
  $expected = ($expectedLine -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 $exe).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw 'SHA256 mismatch.' }
  Copy-Item $exe (Join-Path $dir 'ariadne.exe') -Force
  Write-Host "Installed Ariadne in $dir. Add this directory to PATH."
} finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
