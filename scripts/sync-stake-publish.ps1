param(
	[switch]$RefreshMath,
	[switch]$BuildFrontend,
	[switch]$ReuseBooks,
	[switch]$ArchiveLegacy,
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
$StakeQaScript = Join-Path $Root "scripts\stake-qa.mjs"
$PaytableVerifier = Join-Path $Root "scripts\verify-stake-paytable.mjs"
$PaytableGateTest = Join-Path $Root "scripts\test-stake-paytable-gate.mjs"
$ImplementationEvidenceRoot = Join-Path $Root "artifacts\stake-final-implementation-20260712-164933"
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

function Get-BalancedObjectText {
	param(
		[string]$Content,
		[string]$Marker
	)

	$start = $Content.IndexOf($Marker)
	if ($start -lt 0) { return "" }
	$brace = $Content.IndexOf("{", $start)
	if ($brace -lt 0) { return "" }
	$depth = 0
	for ($i = $brace; $i -lt $Content.Length; $i++) {
		$ch = $Content[$i]
		if ($ch -eq "{") { $depth++ }
		elseif ($ch -eq "}") {
			$depth--
			if ($depth -eq 0) { return $Content.Substring($brace, $i - $brace + 1) }
		}
	}
	return ""
}

function Convert-ToContractDecimal {
	param(
		[object]$Value,
		[string]$Context
	)

	if ($null -eq $Value) {
		throw "Missing numerical value: $Context"
	}
	$invariant = [System.Globalization.CultureInfo]::InvariantCulture
	$text = [System.Convert]::ToString($Value, $invariant)
	$number = [decimal]0
	if (-not [decimal]::TryParse(
		$text,
		[System.Globalization.NumberStyles]::Float,
		$invariant,
		[ref]$number
	)) {
		throw "Invalid numerical value for ${Context}: '$text'"
	}
	return $number
}

function Test-FrontendMathContract {
	$publishedFrontend = Join-Path $FrontendDest "index.html"
	$publishedMathConfig = Join-Path $MathDest "game_config.json"
	$generatedMathConfig = Join-Path $MathRoot "library\configs\game_config.json"

	$previewHash = (Get-FileHash -LiteralPath $FrontendPreviewHtml -Algorithm SHA256).Hash
	$publishedFrontendHash = (Get-FileHash -LiteralPath $publishedFrontend -Algorithm SHA256).Hash
	if ($previewHash -ne $publishedFrontendHash) {
		throw "FRONTEND DRIFT: publish/frontend/index.html is not byte-identical to apps/cluster/preview.html"
	}

	$generatedMathHash = (Get-FileHash -LiteralPath $generatedMathConfig -Algorithm SHA256).Hash
	$publishedMathHash = (Get-FileHash -LiteralPath $publishedMathConfig -Algorithm SHA256).Hash
	if ($generatedMathHash -ne $publishedMathHash) {
		throw "MATH DRIFT: publish/math/game_config.json is not byte-identical to the generated production math config"
	}

	$html = Get-Content -LiteralPath $publishedFrontend -Raw
	$embeddedJson = Get-BalancedObjectText -Content $html -Marker "const PRODUCTION_PAYTABLE ="
	if ([string]::IsNullOrWhiteSpace($embeddedJson)) {
		throw "FRONTEND/MATH CONTRACT: generated frontend does not embed PRODUCTION_PAYTABLE"
	}

	try {
		$embeddedPaytable = $embeddedJson | ConvertFrom-Json
	}
	catch {
		throw "FRONTEND/MATH CONTRACT: embedded PRODUCTION_PAYTABLE is not valid JSON: $($_.Exception.Message)"
	}
	$mathConfig = Get-Content -LiteralPath $publishedMathConfig -Raw | ConvertFrom-Json
	if ($null -eq $mathConfig.paytable) {
		throw "FRONTEND/MATH CONTRACT: publish/math/game_config.json has no paytable"
	}

	$failures = New-Object System.Collections.Generic.List[string]
	$mathSymbols = @($mathConfig.paytable.PSObject.Properties.Name | Sort-Object)
	$frontendSymbols = @($embeddedPaytable.PSObject.Properties.Name | Sort-Object)
	foreach ($difference in @(Compare-Object -ReferenceObject $mathSymbols -DifferenceObject $frontendSymbols)) {
		if ($difference.SideIndicator -eq "<=") {
			$failures.Add("paying symbol '$($difference.InputObject)' is missing from the frontend Paytable") | Out-Null
		}
		else {
			$failures.Add("frontend Paytable contains symbol '$($difference.InputObject)' that is absent from production math") | Out-Null
		}
	}

	foreach ($symbol in $mathSymbols) {
		$mathProperty = $mathConfig.paytable.PSObject.Properties[$symbol]
		$frontendProperty = $embeddedPaytable.PSObject.Properties[$symbol]
		if ($null -eq $mathProperty -or $null -eq $frontendProperty) { continue }

		$mathEntry = $mathProperty.Value
		$frontendEntry = $frontendProperty.Value
		try {
			$cluster5 = Convert-ToContractDecimal -Value $mathEntry.cluster5 -Context "production $symbol.cluster5"
			$cluster7Boost = Convert-ToContractDecimal -Value $mathEntry.cluster7Boost -Context "production $symbol.cluster7Boost"
			$cluster9Boost = Convert-ToContractDecimal -Value $mathEntry.cluster9Boost -Context "production $symbol.cluster9Boost"
			$cluster12Boost = Convert-ToContractDecimal -Value $mathEntry.cluster12Boost -Context "production $symbol.cluster12Boost"
			$expected = [ordered]@{
				cluster5 = $cluster5
				cluster7Boost = $cluster7Boost
				cluster9Boost = $cluster9Boost
				cluster12Boost = $cluster12Boost
				cluster7 = $cluster5 * $cluster7Boost
				cluster9 = $cluster5 * $cluster9Boost
				cluster12 = $cluster5 * $cluster12Boost
			}
			foreach ($field in $expected.Keys) {
				$actualProperty = $frontendEntry.PSObject.Properties[$field]
				if ($null -eq $actualProperty) {
					$failures.Add("frontend Paytable is missing $symbol.$field") | Out-Null
					continue
				}
				$actual = Convert-ToContractDecimal -Value $actualProperty.Value -Context "frontend $symbol.$field"
				if ($actual -ne $expected[$field]) {
					$failures.Add("frontend $symbol.$field=$actual differs from production $($expected[$field])") | Out-Null
				}
			}
		}
		catch {
			$failures.Add($_.Exception.Message) | Out-Null
		}
	}

	if ($failures.Count -gt 0) {
		throw "FRONTEND/MATH CONTRACT FAILED:`n - $($failures -join "`n - ")"
	}

	if (-not (Test-Path -LiteralPath $PaytableVerifier -PathType Leaf)) {
		throw "Missing semantic Paytable verifier: $PaytableVerifier"
	}
	if (-not (Test-Path -LiteralPath $PaytableGateTest -PathType Leaf)) {
		throw "Missing stale-fixture Paytable gate test: $PaytableGateTest"
	}
	New-Item -ItemType Directory -Force -Path $ImplementationEvidenceRoot | Out-Null
	$contractReport = Join-Path $ImplementationEvidenceRoot "paytable-contract-publish.json"
	Invoke-CommandChecked -WorkingDirectory $Root -FilePath "node" -Arguments @(
		$PaytableVerifier,
		"--html", $publishedFrontend,
		"--math", $publishedMathConfig,
		"--report", $contractReport
	)
	Invoke-CommandChecked -WorkingDirectory $Root -FilePath "node" -Arguments @($PaytableGateTest)

	Write-Host "Frontend publish snapshot and production Paytable are numerically identical." -ForegroundColor Green
}

function Get-JsStringValues {
	param([string]$Content)
	$values = New-Object System.Collections.Generic.List[string]
	foreach ($match in [regex]::Matches($Content, ":\s*'([^']*)'")) {
		$values.Add($match.Groups[1].Value) | Out-Null
	}
	return ($values -join " ")
}

function Test-TextContainsWordOrPhrase {
	param(
		[string]$Text,
		[string]$Phrase
	)
	$pattern = "\b" + [regex]::Escape($Phrase) + "\b"
	return [regex]::IsMatch($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
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
		@{ Name = "Replay: replay=true wird unterstuetzt"; Marker = "id=`"replay-overlay`"" },
		@{ Name = "Replay: language Parameter im Replay-Request"; Marker = "language: UrlState.lang()" },
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
		# Stake: interrupted bonus rounds must explicitly tell the player they can continue.
		@{ Name = "Interrupted-Round-Hinweis vorhanden"; Marker = "Your previous round was interrupted. You can continue where you left off." },
		@{ Name = "Interrupted-Round-Hinweis vor Resume-Playback"; Marker = "await showInterruptedRoundMessage();" },
		# Stake: all major actions need confirmation and insufficient-balance feedback.
		@{ Name = "Auto-Bet-Confirm-Modal vorhanden"; Marker = "id=`"modal-autospin`"" },
		@{ Name = "Auto-Bet-Optionen auf Stake-Liste begrenzt"; Marker = "const AUTO_SPIN_OPTIONS = [10, 25, 50, 100, 200, Infinity]" },
		@{ Name = "Auto-Bet startet erst nach Confirm"; Marker = "function confirmAutoSpin(count)" },
		@{ Name = "Insufficient Balance/Funds Dialog vorhanden"; Marker = "function showInsufficientFunds" },
		@{ Name = "Social Casino Balance Wording vorhanden"; Marker = "Insufficient Balance" },
		@{ Name = "Fiat Funds Wording vorhanden"; Marker = "Insufficient Funds" },
		# Stake: mobile/fullscreen and rules controls.
		@{ Name = "Mobile Fullscreen nutzt dvh"; Marker = "height: 100dvh" },
		@{ Name = "Mobile Stage Fit Variable vorhanden"; Marker = "--stage-fit-transform" },
		@{ Name = "Rules: Buttons & Controls vorhanden"; Marker = "Buttons &amp; Controls" },
		# Stake 2026-07-08: authenticate-driven bet configuration.
		@{ Name = "Authenticate-BetConfig: Normalizer vorhanden"; Marker = "function normalizeBetConfig" },
		@{ Name = "Authenticate-BetConfig: Applier vorhanden"; Marker = "function applyBetConfig" },
		@{ Name = "Authenticate-BetConfig: Bet Levels aus Config"; Marker = "firstArrayConfig(config, ['betLevels', 'availableBetLevels', 'betAmounts', 'bets', 'levels', 'denominations'])" },
		@{ Name = "Authenticate-BetConfig: Default Bet aus Config"; Marker = "firstMoneyConfig(config, ['defaultBetLevel', 'defaultBet', 'defaultBetAmount', 'betLevel', 'betAmount', 'minBet'])" },
		@{ Name = "Authenticate-BetConfig: Wallet Response synchronisiert Levels"; Marker = "syncBetLevels(data.config, data)" },
		@{ Name = "Authenticate-BetConfig: Play nutzt API-Level"; Marker = "activeBetConfig.apiLevels" },
		@{ Name = "Authenticate-BetConfig: Demo-Fallback nicht in RGS/Replay"; Marker = "if (!UrlState.requiresRgs() && !Replay.configured()) applyBetConfig" },
		# Stake 2026-07-08: expanded Game Info modes/retriggers.
		@{ Name = "Game Info: Mode-Metadaten vorhanden"; Marker = "const PLAYER_MODE_META = {" },
		@{ Name = "Game Info: Base Game erklaert"; Marker = "Base Game" },
		@{ Name = "Game Info: Feature Spins erklaert"; Marker = "Feature Spins" },
		@{ Name = "Game Info: Rainbow Spin erklaert"; Marker = "Rainbow Spin" },
		@{ Name = "Game Info: Golden Chance erklaert"; Marker = "Golden Chance" },
		@{ Name = "Game Info: All That Glitters erklaert"; Marker = "All That Glitters" },
		@{ Name = "Game Info: End of the Rainbow erklaert"; Marker = "End of the Rainbow" },
		@{ Name = "Game Info: Main Spin Trigger erklaert"; Marker = "Main Spin button" },
		@{ Name = "Game Info: Bonus Buy/Feature Trigger erklaert"; Marker = "Bonus Buy panel" },
		@{ Name = "Game Info: Scatter Trigger erklaert"; Marker = "3 Scatter tickets" },
		@{ Name = "Game Info: Cost Multiplier erklaert"; Marker = "Cost multiplier:" },
		@{ Name = "Game Info: Social Feature Multiplier erklaert"; Marker = "Feature Multiplier:" },
		@{ Name = "Game Info: Retrigger Abschnitt vorhanden"; Marker = "<div class=`"pt-head`">Retriggers</div>" },
		@{ Name = "Game Info: Normal Retrigger Bedingungen"; Marker = "Base Game and Rainbow Spin can trigger Free Spins" },
		@{ Name = "Game Info: Social Retrigger Bedingungen"; Marker = "Base Play and Rainbow Spin can trigger Free Spins" },
		@{ Name = "Game Info: Feature-Free-Spins ohne Retrigger"; Marker = "Feature-panel Free Spins do not add additional Free Spins" },
		# Stake 2026-07-08: replay support.
		@{ Name = "Replay: explizite Lifecycle-States vorhanden"; Marker = "stage.dataset.replayState = status" },
		@{ Name = "Replay: dedizierter Replay/Play-Again Button vorhanden"; Marker = "id=`"replay-action`"" },
		@{ Name = "Replay: lang Alias im Replay-Request"; Marker = "lang: UrlState.lang()" },
		@{ Name = "Replay: Mode-Name aus Game-Metadaten"; Marker = "playerModeName(rgsRoundMode(round))" },
		@{ Name = "Replay: display-only Replay Bet vorhanden"; Marker = "'REPLAY BET'" },
		@{ Name = "Replay: Win Amount bleibt sichtbar"; Marker = "data-meter=`"win`"" },
		@{ Name = "Replay: Currency Anzeige vorhanden"; Marker = "id=`"replay-currency`"" },
		@{ Name = "Replay: kein Progress/Walet-Mutate"; Marker = "trackProgress: false" },
		@{ Name = "Replay: Play Again startet gecachte Wiedergabe"; Marker = "action.onclick = () => play();" },
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
	$sweepsBlock = Get-BalancedObjectText -Content $html -Marker "sweeps_en:"
	$socialText = Get-JsStringValues -Content $sweepsBlock
	if ($socialText.Length -eq 0) {
		$failures += "FRONTEND: sweeps_en Sprachressource fuer Social Mode konnte nicht geprueft werden"
	}
	foreach ($term in @(
		"Bet Replay", "Base Bet", "Cost Multiplier", "Total Bet Cost", "Payout Multiplier", "Total Win",
		"Bonus Buy", "Buy Bonus", "Auto-Bet", "Auto Bet", "Bet", "Wager", "Gamble", "Purchase",
		"Paid", "Pay out", "Payout", "Rebet", "Cash", "Credit", "Currency"
	)) {
		if (Test-TextContainsWordOrPhrase -Text $socialText -Phrase $term) {
			$failures += "FRONTEND: Social Mode/sweeps_en enthaelt eingeschraenkten Begriff '$term'"
		}
	}
	foreach ($term in @(
		"Play Replay", "Base Play", "Feature Multiplier", "Play Cost", "Final Multiplier",
		"Final Play Amount", "Replay Play", "BONUS / FEATURE", "AUTO-PLAY", "PLAY"
	)) {
		if (-not $socialText.Contains($term)) {
			$failures += "FRONTEND: Social Mode/sweeps_en Ersatzbegriff fehlt: '$term'"
		}
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
	Write-Host "Stake compliance gate: alle Frontend-/Math-Checks bestanden." -ForegroundColor Green
}

function Invoke-StakeQa {
	if (-not (Test-Path -LiteralPath $StakeQaScript -PathType Leaf)) {
		throw "Missing Stake QA script: $StakeQaScript"
	}
	Write-Host "Running mandatory Stake QA checks against publish\frontend"
	$previousRequireE2e = $env:STAKE_QA_REQUIRE_E2E
	$previousFrontendRoot = $env:STAKE_QA_FRONTEND_ROOT
	$previousFrontendEntry = $env:STAKE_QA_FRONTEND_ENTRY
	try {
		$env:STAKE_QA_REQUIRE_E2E = "1"
		$env:STAKE_QA_FRONTEND_ROOT = $FrontendDest
		$env:STAKE_QA_FRONTEND_ENTRY = "index.html"
		Invoke-CommandChecked -WorkingDirectory $Root -FilePath "node" -Arguments @($StakeQaScript, "all")
	}
	finally {
		$env:STAKE_QA_REQUIRE_E2E = $previousRequireE2e
		$env:STAKE_QA_FRONTEND_ROOT = $previousFrontendRoot
		$env:STAKE_QA_FRONTEND_ENTRY = $previousFrontendEntry
	}
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

# Production math must be refreshed and copied first. The frontend builder
# imports this exact generated/published contract, so reversing this order can
# package a fresh math config with a stale Paytable.
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
Reset-Directory -Path $MathDest

Write-Host "Copying authoritative math upload files"
Copy-MathUploadFiles
Test-MathUploadContents

if (-not (Test-Path -LiteralPath $FrontendPreviewBuilder -PathType Leaf)) {
	throw "Missing preview builder: $FrontendPreviewBuilder"
}
if ($BuildFrontend) {
	Write-Host "Building frontend preview HTML from published production math"
	Invoke-CommandChecked -WorkingDirectory $Root -FilePath "node" -Arguments @($FrontendPreviewBuilder)
}
Test-FrontendSourceReady
if (-not $SkipFrontendStalenessCheck) {
	Write-Host "Checking deterministic frontend build freshness"
	Invoke-CommandChecked -WorkingDirectory $Root -FilePath "node" -Arguments @($FrontendPreviewBuilder, "--check")
}

Reset-Directory -Path $FrontendDest
Write-Host "Copying frontend preview"
Copy-FrontendUploadFiles

Test-FrontendUploadContents
Test-FrontendMathContract
Invoke-StakeQa

Test-StakeCompliance

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
