param(
	[switch]$RefreshMath,
	[switch]$BuildFrontend,
	[switch]$ReuseBooks,
	[switch]$ArchiveLegacy,
	[switch]$SkipComplianceGate,
	[switch]$SkipFrontendStalenessCheck,
	[switch]$CheckMathStaleness,
	[switch]$SkipMathStalenessCheck
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PublishRoot = Join-Path $Root "publish"
$LegacyPublishRoot = Join-Path $PublishRoot "golden-goal-rush"
$FrontendPreviewHtml = Join-Path $Root "apps\cluster\preview.html"
$FrontendPreviewBuilder = Join-Path $Root "apps\cluster\scripts\build-preview-html.mjs"
$FrontendAssetSource = Join-Path $Root "apps\cluster\src\assets\golden-goal-rush"
$FrontendStaticSource = Join-Path $Root "apps\cluster\static"
$FrontendDest = Join-Path $PublishRoot "frontend"
$MathRoot = Join-Path $Root "math\games\golden_goal_rush"
$MathPublish = Join-Path $MathRoot "library\publish_files"
$MathDest = Join-Path $PublishRoot "math"

function Assert-ChildPath {
	param(
		[string]$Child,
		[string]$Parent
	)

	$parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
	$childFull = [System.IO.Path]::GetFullPath($Child)
	if (-not $childFull.StartsWith($parentFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
		throw "Refusing to modify path outside publish root: $childFull"
	}
}

function Reset-Directory {
	param([string]$Path)

	Assert-ChildPath -Child $Path -Parent $PublishRoot
	if (Test-Path -LiteralPath $Path) {
		Remove-Item -LiteralPath $Path -Recurse -Force
	}
	New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Invoke-CommandChecked {
	param(
		[string]$WorkingDirectory,
		[string]$FilePath,
		[string[]]$Arguments
	)

	Push-Location $WorkingDirectory
	try {
		& $FilePath @Arguments
		if ($LASTEXITCODE -ne 0) {
			throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
		}
	}
	finally {
		Pop-Location
	}
}

function Get-NewestFile {
	param([System.IO.FileInfo[]]$Files)
	$Files | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
}

function Get-OldestFile {
	param([System.IO.FileInfo[]]$Files)
	$Files | Sort-Object LastWriteTimeUtc | Select-Object -First 1
}

function Test-MathPublishFresh {
	$sourceFiles = Get-ChildItem -LiteralPath $MathRoot -Recurse -File |
		Where-Object {
			$_.FullName -notlike "*\library\*" -and
			$_.FullName -notlike "*\stake_math_upload_clean\*" -and
			$_.FullName -notlike "*\__pycache__\*" -and
			($_.Extension -eq ".py" -or $_.Extension -eq ".json")
		}

	$indexPath = Join-Path $MathPublish "index.json"
	$publishFiles = @(
		$indexPath
		Join-Path $MathRoot "library\configs\game_config.json"
		Join-Path $MathPublish "README_UPLOAD.txt"
	)
	if (Test-Path -LiteralPath $indexPath) {
		$index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
		foreach ($mode in @($index.modes)) {
			$publishFiles += Join-Path $MathRoot ("library\lookup_tables\" + $mode.weights)
			$publishFiles += Join-Path $MathRoot ("library\books_compressed\" + $mode.events)
		}
	}
	$publishFiles = $publishFiles | ForEach-Object { Get-Item -LiteralPath $_ }

	$newestSource = Get-NewestFile -Files $sourceFiles
	$oldestPublish = Get-OldestFile -Files $publishFiles

	if ($newestSource -and $oldestPublish -and $newestSource.LastWriteTimeUtc -gt $oldestPublish.LastWriteTimeUtc) {
		throw @"
Math publish files look stale.
Newest math source: $($newestSource.FullName)
Oldest publish file: $($oldestPublish.FullName)

Run this before committing/pushing math changes:
  npm run stake:publish:refresh-math
"@
	}
}

function Test-FrontendSourceReady {
	if (-not (Test-Path -LiteralPath $FrontendPreviewHtml -PathType Leaf)) {
		throw "Frontend preview HTML is missing: $FrontendPreviewHtml"
	}

	if (-not (Test-Path -LiteralPath $FrontendAssetSource -PathType Container)) {
		throw "Frontend Golden Goal Rush asset folder is missing: $FrontendAssetSource"
	}
}

function Test-FrontendUploadContents {
	$requiredFiles = @(
		"index.html",
		"favicon.svg",
		"loader.gif",
		"stake-engine-loader.gif"
	)
	$requiredDirs = @(
		"assets",
		"src\assets\golden-goal-rush",
		"src\assets\golden-goal-rush\hud-extracted",
		"src\assets\golden-goal-rush\special"
	)

	foreach ($file in $requiredFiles) {
		$path = Join-Path $FrontendDest $file
		if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
			throw "Frontend publish folder is missing required file: $file"
		}
	}

	foreach ($dir in $requiredDirs) {
		$path = Join-Path $FrontendDest $dir
		if (-not (Test-Path -LiteralPath $path -PathType Container)) {
			throw "Frontend publish folder is missing required folder: $dir"
		}
	}

	$previewMarkers = @(
		"Golden Goal Rush",
		"const SYMBOLS",
		"COIN_ASSETS",
		"btn-spin",
		"addEventListener('click', () => spin())",
		"startFreeSpins"
	)

	$index = Join-Path $FrontendDest "index.html"
	$indexContent = Get-Content -LiteralPath $index -Raw
	foreach ($marker in $previewMarkers) {
		if (-not $indexContent.Contains($marker)) {
			throw "Frontend publish HTML does not contain interactive Golden Goal Rush marker: $marker"
		}
	}

	$assetChecks = @(
		"src\assets\golden-goal-rush\slot-background.webp",
		"src\assets\golden-goal-rush\hud-extracted\euro-symbol.webp",
		"src\assets\golden-goal-rush\hud-extracted\spin-button-active.webp",
		"src\assets\golden-goal-rush\special\symbol_rainbow.webp"
	)
	foreach ($asset in $assetChecks) {
		$path = Join-Path $FrontendDest $asset
		if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
			throw "Frontend publish folder is missing Golden Goal Rush asset: $asset"
		}
	}
}

function Test-MathUploadContents {
	$expected = @("index.json", "game_config.json")

	foreach ($file in $expected) {
		$path = Join-Path $MathDest $file
		if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
			throw "Math publish folder is missing required file: $file"
		}

		$item = Get-Item -LiteralPath $path
		if ($item.Length -le 0) {
			throw "Math publish file is empty: $file"
		}
	}

	$indexPath = Join-Path $MathDest "index.json"
	$index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
	foreach ($mode in @($index.modes)) {
		foreach ($ref in @($mode.events, $mode.weights)) {
			$path = Join-Path $MathDest $ref
			if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
				throw "Math index references missing file: $ref"
			}
		}
	}
}

function Copy-MathUploadFiles {
	$indexPath = Join-Path $MathPublish "index.json"
	$entries = @(
		@{ Source = $indexPath; Name = "index.json" }
		@{ Source = Join-Path $MathRoot "library\configs\game_config.json"; Name = "game_config.json" }
		@{ Source = Join-Path $MathPublish "README_UPLOAD.txt"; Name = "README_UPLOAD.txt" }
		@{ Source = Join-Path $MathPublish "UPLOAD_GUIDE.txt"; Name = "UPLOAD_GUIDE.txt" }
		@{ Source = Join-Path $MathPublish "RTP_AUDIT.json"; Name = "RTP_AUDIT.json" }
		@{ Source = Join-Path $MathPublish "RTP_AUDIT.txt"; Name = "RTP_AUDIT.txt" }
	)

	if (Test-Path -LiteralPath $indexPath) {
		$index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
		foreach ($mode in @($index.modes)) {
			$entries += @{ Source = Join-Path $MathRoot ("library\lookup_tables\" + $mode.weights); Name = $mode.weights }
			$entries += @{ Source = Join-Path $MathRoot ("library\books_compressed\" + $mode.events); Name = $mode.events }
		}
	}

	foreach ($entry in $entries) {
		if (-not (Test-Path -LiteralPath $entry.Source)) {
			throw "Missing math publish file: $($entry.Source)"
		}
		Copy-Item -LiteralPath $entry.Source -Destination (Join-Path $MathDest $entry.Name) -Force
	}
}

function Copy-FrontendUploadFiles {
	Copy-Item -LiteralPath $FrontendPreviewHtml -Destination (Join-Path $FrontendDest "index.html") -Force

	if (Test-Path -LiteralPath $FrontendStaticSource) {
		Copy-Item -Path (Join-Path $FrontendStaticSource "*") -Destination $FrontendDest -Recurse -Force
	}

	# The standalone preview does not use the SDK bitmap-font bundles. Keeping
	# them in the Stake scratch upload can make the review shell request font
	# atlas files through /api/file and report noisy 403s.
	$unusedFontAssets = Join-Path $FrontendDest "assets\fonts"
	if (Test-Path -LiteralPath $unusedFontAssets) {
		Remove-Item -LiteralPath $unusedFontAssets -Recurse -Force
	}

	$assetDestRoot = Join-Path $FrontendDest "src\assets"
	New-Item -ItemType Directory -Force -Path $assetDestRoot | Out-Null
	Copy-Item -LiteralPath $FrontendAssetSource -Destination (Join-Path $assetDestRoot "golden-goal-rush") -Recurse -Force
}

# ---------------------------------------------------------------------------
# Stake compliance gate: asserts that the packaged frontend/math actually
# satisfy every point Stake raised in the approval thread. Fails the pipeline
# (exit != 0) instead of producing an uploadable but non-compliant snapshot.
# ---------------------------------------------------------------------------
function Test-StakeCompliance {
	$indexPath = Join-Path $FrontendDest "index.html"
	$html = Get-Content -LiteralPath $indexPath -Raw
	$failures = @()

	$feChecks = @(
		# Stake: "page crashes and displays an error when we change the URL"
		@{ Name = "URL-Guard: validateLaunchUrl vorhanden"; Marker = "function validateLaunchUrl" },
		@{ Name = "URL-Guard: replay=true blockiert (kein Demo-Fallback)"; Marker = "The game URL contains unsupported launch parameters" },
		@{ Name = "URL-Guard: URL-Aenderung zur Laufzeit erkannt"; Marker = "function checkLaunchUrlIntegrity" },
		@{ Name = "URL-Guard: currency Pflichtparameter"; Marker = "hasLaunchParam('currency')" },
		@{ Name = "URL-Guard: lang/language Pflichtparameter"; Marker = "hasLaunchParam('lang', 'language')" },
		@{ Name = "URL-Guard: device/deviceType Pflichtparameter"; Marker = "hasLaunchParam('device', 'deviceType')" },
		@{ Name = "Fataler Fehler-Overlay vorhanden"; Marker = "fatal-error-title" },
		# Stake: end-round only when round.active === true
		@{ Name = "End-Round NUR ueber round.active entschieden"; Marker = "const roundNeedsEnd = (round) => !!round && round.active === true;" },
		# Stake: bonus resume, bet + balance preserved
		@{ Name = "Bonus-Resume-Flow vorhanden"; Marker = "async function resumeLaunchRound" },
		@{ Name = "Bet aus aktiver Runde uebernommen"; Marker = "function applyBetFromRound" },
		@{ Name = "Resume-Index aus round.event"; Marker = "function rgsResumeIndex" },
		# Stake: base-mode active round settled immediately + rules text
		@{ Name = "Aktive Base-Runde wird sofort settled"; Marker = "recoverActiveRound" },
		@{ Name = "Game Rules: Auto-Settlement-Text"; Marker = "immediately settled with Stake Engine" },
		@{ Name = "Game Rules: Game-History-Hinweis"; Marker = "game history" },
		# Stake: pop-up when the bonus round starts (base trigger + buy)
		@{ Name = "Bonus-Start-Popup (RGS-Pfad)"; Marker = "bonusIntroRgs" },
		@{ Name = "Bonus-Popup-Element"; Marker = "id=`"bonus-intro`"" },
		# Stake: no local win simulation in production
		@{ Name = "Positiver Wallet-Payout ist Display-Quelle"; Marker = "if (walletPayout !== null && walletPayout > 0) return walletPayout;" },
		@{ Name = "Lokale Free Spins nur ohne RGS"; Marker = "allowLocalFreeSpins = !Rgs.configured()" },
		@{ Name = "Unrenderbare RGS-Runde -> Fehler statt Fallback"; Marker = "No local fallback was used" }
	)
	foreach ($check in $feChecks) {
		if (-not $html.Contains($check.Marker)) {
			$failures += "FRONTEND: $($check.Name) -- Marker fehlt: $($check.Marker)"
		}
	}
	if ($html -match "roundNeedsEnd[^\r\n]*payoutMultiplier") {
		$failures += "FRONTEND: End-Round-Entscheidung darf payout/payoutMultiplier nicht verwenden"
	}

	$auditPath = Join-Path $MathDest "RTP_AUDIT.json"
	$configPath = Join-Path $MathDest "game_config.json"
	$audit = Get-Content -LiteralPath $auditPath -Raw | ConvertFrom-Json
	$gameConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

	foreach ($prop in $audit.PSObject.Properties) {
		$mode = $prop.Name
		$m = $prop.Value
		$rtp = [double]$m.achievedRtp
		if ($rtp -lt 0.9600 -or $rtp -gt 0.9650) {
			$failures += "MATH [$mode]: achievedRtp=$($m.achievedRtp) liegt ausserhalb 96.00%-96.50%"
		}
		if ($rtp -gt 0.9670) {
			$failures += "MATH [$mode]: achievedRtp=$($m.achievedRtp) liegt ueber hartem 96.70%-Maximum"
		}
		if ($null -ne $m.PSObject.Properties["tailMet"] -and -not $m.tailMet) {
			$failures += "MATH [$mode]: Tail-Constraints (CVaR/ETL) NICHT erfuellt"
		}
		if ($null -eq $m.PSObject.Properties["maxWinAchievabilityMet"]) {
			$failures += "MATH [$mode]: maxWinAchievabilityMet/maxWinOdds fehlt im RTP_AUDIT -- Math mit aktueller Pipeline neu erzeugen"
		}
		elseif (-not [bool]$m.maxWinAchievabilityMet -or [double]$m.maxWinOdds -gt 20000000) {
			$failures += "MATH [$mode]: Max-Win-Achievability 1 in $($m.maxWinOdds) ist schlechter als Stake-Limit 1 in 20,000,000"
		}
	}
	$base = $audit.base
	if ($null -ne $base.PSObject.Properties["etl40Share"]) {
		if ([double]$base.etl40Share -gt 0.80) {
			$failures += "MATH [base]: ETL >40x = $($base.etl40Share) ueber Stake-2-Star-Limit 0.800"
		}
		if ([double]$base.cvar01x -gt 700) {
			$failures += "MATH [base]: CVaR 0.1% = $($base.cvar01x) ueber Stake-2-Star-Limit 700"
		}
	} else {
		$failures += "MATH [base]: RTP_AUDIT.json ohne etl40Share/cvar01x -- Math mit aktuellem run.py neu erzeugen (npm run stake:publish)"
	}

	# Frontend bonus-buy prices must equal the math mode costs exactly.
	$inv = [System.Globalization.CultureInfo]::InvariantCulture
	$costMap = @{ "hunt" = "hunt"; "rainbow" = "rainbow"; "tier1" = "bonus_tier1"; "tier2" = "bonus" }
	foreach ($feId in $costMap.Keys) {
		$mode = $costMap[$feId]
		$cost = [double]$gameConfig.betModes.$mode.cost
		$costText = $cost.ToString($inv)
		$rx = '"id":"' + $feId + '"[^}]*"mult":' + [regex]::Escape($costText) + '[,}]'
		if (-not ($html -match $rx)) {
			$failures += "FE/MATH-Abweichung: Bonus-Buy '$feId' muss exakt $costText x kosten (Mode '$mode')"
		}
	}
	$baseRtpText = (([double]$audit.base.achievedRtp) * 100).ToString("0.00", $inv) + "%"
	if (-not $html.Contains("RTP $baseRtpText")) {
		$failures += "FRONTEND: Game Rules muessen 'RTP $baseRtpText' ausweisen (passend zum RTP_AUDIT)"
	}

	if ($failures.Count -gt 0) {
		Write-Host ""
		Write-Host "STAKE COMPLIANCE GATE: FEHLGESCHLAGEN" -ForegroundColor Red
		foreach ($failure in $failures) { Write-Host "  - $failure" -ForegroundColor Red }
		throw "Compliance gate failed ($($failures.Count) Punkt(e)). Dieses Paket NICHT hochladen."
	}
	Write-Host "Stake compliance gate: alle $($feChecks.Count + 8) Checks bestanden." -ForegroundColor Green
}

function Write-UploadReadme {
	$stamp = Get-Date -Format o
	$text = @(
		"GOLDEN GOAL RUSH - STAKE UPLOAD PAKET",
		"=====================================",
		"",
		"Dieser Ordner (publish\) ist die EINZIGE Upload-Quelle und wird bei jedem",
		"Pipeline-Lauf komplett neu erzeugt. Nichts hier manuell aendern.",
		"",
		"  publish\frontend  ->  Stake Engine: Files -> Import Files -> 'Front End'",
		"  publish\math      ->  Stake Engine: Files -> Import Files -> 'Math'",
		"",
		"Danach im Portal 'Publish Game' klicken und im Approval-Tab die neue",
		"Front- und Math-Version im Review-Request auswaehlen.",
		"",
		"Alle anderen Ordner im Repo sind Build-Interna und werden NIE hochgeladen:",
		"  math\games\golden_goal_rush\library\...  (Books/Lookups/Audit-Quelle)",
		"  apps\cluster\...                          (Frontend-Quelle)",
		"  stake-upload\                             (altes Prototyp-Archiv)",
		"",
		"Pipeline-Befehle:",
		"  npm run stake:publish            schnell: FE bauen + Math neu gewichten",
		"                                   (Books wiederverwendet) + Compliance-Gate",
		"  npm run stake:publish:full-math  komplett: Books neu simulieren (~20-30 min)",
		"",
		"Erzeugt: $stamp"
	)
	($text -join [Environment]::NewLine) | Set-Content -LiteralPath (Join-Path $PublishRoot "LIES_MICH_UPLOAD.txt") -Encoding UTF8
}

function Invoke-LegacyArchive {
	$archiveRoot = Join-Path $Root "_archive"
	foreach ($name in @("stake-upload")) {
		$source = Join-Path $Root $name
		if (Test-Path -LiteralPath $source) {
			New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
			$dest = Join-Path $archiveRoot ("$name-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
			Move-Item -LiteralPath $source -Destination $dest
			Write-Host "Legacy-Ordner archiviert (nicht geloescht): $name -> $dest"
		}
	}
}

Write-Host "Syncing Stake publish snapshot..."

if ($BuildFrontend) {
	if (-not (Test-Path -LiteralPath $FrontendPreviewBuilder -PathType Leaf)) {
		throw "Missing preview builder: $FrontendPreviewBuilder"
	}
	Write-Host "Building frontend preview HTML"
	Invoke-CommandChecked -WorkingDirectory $Root -FilePath "node" -Arguments @($FrontendPreviewBuilder)
}

if (-not $SkipFrontendStalenessCheck) {
	Test-FrontendSourceReady
}

if ($RefreshMath) {
	Write-Host "Refreshing math publish files"
	$pythonArgs = @("run.py", "publish", "--spins", "80000", "--bonus-spins", "40000", "--seed", "1")
	if ($ReuseBooks) { $pythonArgs += "--reuse-books" }
	Invoke-CommandChecked -WorkingDirectory $MathRoot -FilePath "python" -Arguments $pythonArgs
}
elseif (-not $SkipMathStalenessCheck) {
	if ($CheckMathStaleness) {
		Test-MathPublishFresh
	}
}

New-Item -ItemType Directory -Force -Path $PublishRoot | Out-Null
if (Test-Path -LiteralPath $LegacyPublishRoot) {
	Assert-ChildPath -Child $LegacyPublishRoot -Parent $PublishRoot
	Remove-Item -LiteralPath $LegacyPublishRoot -Recurse -Force
}
Reset-Directory -Path $FrontendDest
Reset-Directory -Path $MathDest

Write-Host "Copying frontend preview"
Copy-FrontendUploadFiles

Write-Host "Copying math upload files"
Copy-MathUploadFiles

Test-FrontendUploadContents
Test-MathUploadContents

if (-not $SkipComplianceGate) {
	Test-StakeCompliance
}

Write-UploadReadme

if ($ArchiveLegacy) {
	Invoke-LegacyArchive
}

Write-Host ""
Write-Host "UPLOAD-PAKET BEREIT -- einziger Upload-Ordner ist 'publish\':" -ForegroundColor Green
Write-Host "  1) $FrontendDest"
Write-Host "     -> Stake Engine: Files -> Import Files -> 'Front End'"
Write-Host "  2) $MathDest"
Write-Host "     -> Stake Engine: Files -> Import Files -> 'Math'"
Write-Host "  3) Portal: 'Publish Game' klicken, dann im Approval-Tab die neue"
Write-Host "     Front-/Math-Version im Review-Request auswaehlen."
Write-Host "  (Details: publish\LIES_MICH_UPLOAD.txt)"
