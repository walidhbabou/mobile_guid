param(
  [switch]$Install,
  [string]$BackendHost
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidRoot = Join-Path $projectRoot 'android'
$apkPath = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
$environmentPath = Join-Path $projectRoot 'src\environments\environment.ts'
$gatewayPort = 8081

function Test-Java21Home {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $javaExe = Join-Path $Path 'bin\java.exe'

  if (-not (Test-Path $javaExe)) {
    return $false
  }

  try {
    $versionOutput = cmd /c """$javaExe"" -version 2>&1" | Out-String
    return $versionOutput -match 'version "21\.'
  } catch {
    return $false
  }
}

function Resolve-Java21Home {
  $candidates = @(
    $env:JAVA_HOME,
    'C:\Program Files\Java\jdk-21',
    'C:\Program Files\Android\Android Studio\jbr'
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Java21Home -Path $candidate) {
      return $candidate
    }
  }

  throw 'Java 21 est requis pour builder Android. Installe JDK 21 ou configure JAVA_HOME vers un Java 21.'
}

function Resolve-LanIpv4Address {
  $candidates = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPv4Address -and
      $_.IPv4Address.IPAddress -and
      $_.IPv4Address.IPAddress -notlike '127.*' -and
      $_.IPv4Address.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|Bluetooth|Virtual'
    } |
    Sort-Object `
      @{ Expression = { if ($_.IPv4DefaultGateway) { 0 } else { 1 } } }, `
      @{ Expression = {
        if ($_.InterfaceAlias -match 'Wi-?Fi|WLAN|Wireless') { 0 }
        elseif ($_.InterfaceAlias -match 'Ethernet') { 1 }
        else { 2 }
      } }, `
      InterfaceAlias

  if (-not $candidates) {
    throw 'Impossible de detecter une adresse IPv4 locale. Connecte ce PC au meme Wi-Fi que le telephone ou passe -BackendHost.'
  }

  $selectedCandidate = $candidates[0]
  $selectedAddress = $selectedCandidate.IPv4Address[0].IPAddress

  Write-Host "[network] Interface detectee: $($selectedCandidate.InterfaceAlias) -> $selectedAddress"

  return $selectedAddress
}

function Sync-NativeBackendUrls {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentFile,
    [Parameter(Mandatory = $true)]
    [string]$BackendAddress,
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  if (-not (Test-Path $EnvironmentFile)) {
    throw "Fichier d'environnement introuvable: $EnvironmentFile"
  }

  $targetUrl = "http://$BackendAddress`:$Port"
  $content = Get-Content -LiteralPath $EnvironmentFile -Raw
  $gatewayPattern = "nativeApiGatewayUrl:\s*'http://[^']+'"
  $authPattern = "nativeAuthServiceUrl:\s*'http://[^']+'"

  if ($content -notmatch $gatewayPattern -or $content -notmatch $authPattern) {
    throw "Impossible de trouver nativeApiGatewayUrl/nativeAuthServiceUrl dans $EnvironmentFile"
  }

  $updatedContent = $content `
    -replace $gatewayPattern, "nativeApiGatewayUrl: '$targetUrl'" `
    -replace $authPattern, "nativeAuthServiceUrl: '$targetUrl'"

  [System.IO.File]::WriteAllText($EnvironmentFile, $updatedContent, [System.Text.Encoding]::UTF8)
  Write-Host "[network] Backend Android cible: $targetUrl"
}

$resolvedJavaHome = Resolve-Java21Home
$env:JAVA_HOME = $resolvedJavaHome
$env:Path = "$resolvedJavaHome\bin;$env:Path"

Write-Host "[java] JAVA_HOME=$resolvedJavaHome"

$resolvedBackendHost = if ($BackendHost) { $BackendHost } else { Resolve-LanIpv4Address }
Sync-NativeBackendUrls -EnvironmentFile $environmentPath -BackendAddress $resolvedBackendHost -Port $gatewayPort

Push-Location $projectRoot
try {
  Write-Host '[step] npx ng build --configuration development'
  & npx.cmd ng build --configuration development
  if ($LASTEXITCODE -ne 0) {
    throw 'La compilation Angular a echoue.'
  }

  Write-Host '[step] npx cap sync android'
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) {
    throw 'La synchronisation Capacitor a echoue.'
  }

  Push-Location $androidRoot
  try {
    Write-Host '[step] gradlew assembleDebug'
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
      throw 'La generation Gradle a echoue.'
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

if (-not (Test-Path $apkPath)) {
  throw "APK introuvable: $apkPath"
}

$apk = Get-Item $apkPath
Write-Host "[ok] APK genere: $($apk.FullName)"
Write-Host "[ok] Taille: $([Math]::Round($apk.Length / 1MB, 2)) MB"

if (-not $Install) {
  return
}

$adb = Get-Command adb -ErrorAction SilentlyContinue

if (-not $adb) {
  Write-Warning "adb est introuvable. Installe Android Platform Tools ou ouvre l'APK manuellement: $($apk.FullName)"
  return
}

Write-Host '[step] adb install -r'
& $adb.Source install -r $apk.FullName
