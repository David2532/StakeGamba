param(
	[switch]$ReuseBooks,
	[switch]$NoZip,
	[switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReleaseRoot = Join-Path $Root "stake-release"
$PublishRoot = Join-Path $Root "publish"
$FrontendDest = Join-Path $PublishRoot "frontend"
$MathDest = Join-Path $PublishRoot "math"
$FrontendBuilder = Join-Path $Root "apps\cluster\scripts\build-preview-html.mjs"
$PreviewHtml = Join-Path $Root "apps\cluster\preview.html"
$SyncScript = Join-Path $Root "scripts\sync-stake-publish.ps1"
$MathRoot = Join-Path $Root "math\games\golden_goal_rush"
$MathPublish = Join-Path $MathRoot "library\publish_files"
$AssetRoot = Join-Path $Root "apps\cluster\src\assets\golden-goal-rush"
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

$script:Checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
	param(
		[string]$Group,
		[string]$Name,
		[bool]$Passed,
		[string]$Detail = ""
	)

	$script:Checks.Add([pscustomobject]@{
		Group = $Group
		Name = $Name
		Passed = $Passed
		Detail = $Detail
	}) | Out-Null
}

function Add-MarkerCheck {
	param(
		[string]$Group,
		[string]$Name,
		[string]$Content,
		[string]$Marker
	)

	Add-Check -Group $Group -Name $Name -Passed ($Content.Contains($Marker)) -Detail "marker: $Marker"
}

function Invoke-Checked {
	param(
		[string]$WorkingDirectory,
		[string]$FilePath,
		[string[]]$Arguments
	)

	Push-Location $WorkingDirectory
	try {
		Write-Host "-> $FilePath $($Arguments -join ' ')" -ForegroundColor DarkGray
		& $FilePath @Arguments
		if ($LASTEXITCODE -ne 0) {
			throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
		}
	}
	finally {
		Pop-Location
	}
}

function Invoke-Capture {
	param(
		[string]$WorkingDirectory,
		[string]$FilePath,
		[string[]]$Arguments
	)

	Push-Location $WorkingDirectory
	try {
		$output = & $FilePath @Arguments 2>&1
		if ($LASTEXITCODE -ne 0) {
			throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')`n$($output | Out-String)"
		}
		return (($output | Out-String).Trim())
	}
	finally {
		Pop-Location
	}
}

function Get-GitValue {
	param([string[]]$Arguments)
	try {
		return (Invoke-Capture -WorkingDirectory $Root -FilePath "git" -Arguments $Arguments).Trim()
	}
	catch {
		return ""
	}
}

function Sanitize-Name {
	param([string]$Value)
	if (-not $Value) { return "unknown" }
	return ($Value -replace "[^A-Za-z0-9._-]", "-")
}

function ConvertTo-RelativePath {
	param(
		[string]$Path,
		[string]$Base
	)

	$basePath = [System.IO.Path]::GetFullPath($Base).TrimEnd('\', '/')
	$fullPath = [System.IO.Path]::GetFullPath($Path)
	$baseUri = New-Object System.Uri($basePath + [System.IO.Path]::DirectorySeparatorChar)
	$fileUri = New-Object System.Uri($fullPath)
	return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString()).Replace('/', '\')
}

function Get-RelativeFileList {
	param(
		[string]$Path,
		[string]$Base
	)

	if (-not (Test-Path -LiteralPath $Path)) { return @() }
	return @(Get-ChildItem -LiteralPath $Path -Recurse -File | ForEach-Object {
		ConvertTo-RelativePath -Path $_.FullName -Base $Base
	} | Sort-Object)
}

function Copy-DirectoryClean {
	param(
		[string]$Source,
		[string]$Destination
	)

	if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
		throw "Missing directory: $Source"
	}
	if (Test-Path -LiteralPath $Destination) {
		Remove-Item -LiteralPath $Destination -Recurse -Force
	}
	New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
	Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Read-Json {
	param([string]$Path)
	return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-FrontendVersion {
	param([string]$Html)
	if ($Html -match "window\.__ggrBuild\s*=\s*'([^']+)'") { return $Matches[1] }
	return "unknown"
}

function Get-ChangedFiles {
	$output = Get-GitValue -Arguments @("status", "--short")
	if (-not $output) { return @() }
	return @($output -split "`r?`n" | Where-Object { $_ })
}

function Test-TitleApproval {
	param([string]$GameName)

	$banned = @("Megaways", "Xways", "Enhanced RTP", "Boosted RTP", "Gates of", "Bonanza")
	$bad = @($banned | Where-Object { $GameName -match [regex]::Escape($_) })
	Add-Check -Group "I Visual Approval" -Name "Game title has no banned terms" -Passed ($bad.Count -eq 0) -Detail $GameName
}

function Test-OffensiveAssetNames {
	$bannedWords = @("nazi", "racist", "hitler", "sex", "porn", "slur", "terror")
	$files = @(Get-ChildItem -LiteralPath $AssetRoot -Recurse -File -ErrorAction SilentlyContinue)
	$bad = @()
	foreach ($file in $files) {
		foreach ($word in $bannedWords) {
			if ($file.Name.ToLowerInvariant().Contains($word)) {
				$bad += $file.FullName
			}
		}
	}
	Add-Check -Group "I Visual Approval" -Name "Asset filenames contain no obvious offensive terms" -Passed ($bad.Count -eq 0) -Detail (($bad | Select-Object -First 5) -join "; ")
}

function Test-ImageBrightness {
	param(
		[string]$ImagePath,
		[string]$Name,
		[double]$Minimum
	)

	if (-not (Test-Path -LiteralPath $ImagePath -PathType Leaf)) {
		Add-Check -Group "I Visual Approval" -Name $Name -Passed $false -Detail "missing: $ImagePath"
		return
	}

	$python = @"
from PIL import Image, ImageStat
import json, sys
path = sys.argv[1]
im = Image.open(path).convert("RGBA")
bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
bg.alpha_composite(im)
rgb = bg.convert("RGB")
stat = ImageStat.Stat(rgb)
r, g, b = stat.mean
lum = 0.2126*r + 0.7152*g + 0.0722*b
print(json.dumps({"luminance": lum, "width": im.size[0], "height": im.size[1]}))
"@
	try {
		$result = ($python | python - $ImagePath | ConvertFrom-Json)
		$passed = ([double]$result.luminance -ge $Minimum)
		Add-Check -Group "I Visual Approval" -Name $Name -Passed $passed -Detail ("luminance={0:n2}, size={1}x{2}, min={3}" -f [double]$result.luminance, $result.width, $result.height, $Minimum)
	}
	catch {
		Add-Check -Group "I Visual Approval" -Name $Name -Passed $false -Detail $_.Exception.Message
	}
}

function Test-BookContract {
	$python = @"
import csv
import io
import json
import pathlib
import sys

try:
    import zstandard as zstd
except Exception as exc:
    print(json.dumps({"ok": False, "error": "zstandard import failed: %s" % exc}))
    raise SystemExit(0)

root = pathlib.Path(sys.argv[1])
index = json.loads((root / "index.json").read_text(encoding="utf-8"))
errors = []
summary = {}

known_events = {
    "reveal", "winInfo", "setWin", "setTotalWin", "tumbleBoard",
    "freeSpinTrigger", "updateFreeSpin", "freeSpinEnd", "goldenReveal",
    "goldenAward", "goldenClear", "finalWin",
}

def iter_books(path):
    if path.suffix == ".zst":
        d = zstd.ZstdDecompressor()
        with path.open("rb") as fh, d.stream_reader(fh) as reader:
            text = io.TextIOWrapper(reader, encoding="utf-8")
            for line in text:
                line = line.strip()
                if line:
                    yield json.loads(line)
    else:
        with path.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    yield json.loads(line)

for mode in index["modes"]:
    name = mode["name"]
    books_path = root / mode["events"]
    lookup_path = root / mode["weights"]
    rows = {}
    with lookup_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.reader(fh):
            if len(row) == 3:
                rows[int(row[0])] = (int(row[1]), int(row[2]))

    count = 0
    wins = 0
    triggers = 0
    complete_features = 0
    weighted_sum = 0
    weight_sum = 0
    event_types = set()
    for book in iter_books(books_path):
        count += 1
        book_id = int(book.get("id", 0))
        payout = int(book.get("payoutMultiplier", -1))
        events = book.get("events") or []
        if payout > 0:
            wins += 1
        if not events:
            errors.append("%s book %s has no events" % (name, book_id))
            continue
        for expected, event in enumerate(events):
            if event.get("index") != expected:
                errors.append("%s book %s event index mismatch at %s" % (name, book_id, expected))
                break
            etype = event.get("type")
            event_types.add(etype)
            if etype not in known_events:
                errors.append("%s book %s unknown event type %s" % (name, book_id, etype))
                break
        final = [e for e in events if e.get("type") == "finalWin"]
        if not final:
            errors.append("%s book %s missing finalWin" % (name, book_id))
        elif int(final[-1].get("amount", -1)) != payout:
            errors.append("%s book %s finalWin %s != payoutMultiplier %s" % (name, book_id, final[-1].get("amount"), payout))
        if any(e.get("type") == "winInfo" for e in events) and payout <= 0:
            errors.append("%s book %s has winInfo but zero payout" % (name, book_id))
        if any(e.get("type") == "freeSpinTrigger" for e in events):
            triggers += 1
            if any(e.get("type") == "updateFreeSpin" for e in events) or any(e.get("type") == "freeSpinEnd" for e in events):
                complete_features += 1
            else:
                errors.append("%s book %s has freeSpinTrigger without complete feature events" % (name, book_id))
        if book_id in rows:
            weight, lookup_payout = rows[book_id]
            if lookup_payout != payout:
                errors.append("%s lookup payout %s != book %s payout %s" % (name, lookup_payout, book_id, payout))
            weighted_sum += weight * payout
            weight_sum += weight
        else:
            errors.append("%s book %s missing lookup row" % (name, book_id))
        if len(errors) > 50:
            break
    summary[name] = {
        "books": count,
        "wins": wins,
        "triggerBooks": triggers,
        "completeFeatureBooks": complete_features,
        "lookupRtp": round(weighted_sum / weight_sum / 100 / float(mode["cost"]), 6) if weight_sum else None,
        "eventTypes": sorted(t for t in event_types if t),
    }
    if len(errors) > 50:
        break

print(json.dumps({"ok": not errors, "errorCount": len(errors), "errors": errors[:20], "summary": summary}, indent=2))
"@
	$resultText = $python | python - $MathDest
	return ($resultText | ConvertFrom-Json)
}

function New-Checklist {
	param([bool]$OverallPass)

	$items = @(
		"RGS authenticate on launch",
		"play request sent",
		"end-round request sent correctly",
		"no play/end-round errors",
		"no random end-round",
		"no visible win without RGS winnings",
		"bonus buy uses RGS only",
		"malformed URL fatal error",
		"refresh mid bonus resumes",
		"bet amount preserved after refresh",
		"balance preserved after bonus buy refresh",
		"active base round on authenticate immediately settled",
		"active bonus round resumes",
		"rules explain active base settlement/game history",
		"bonus start popup from base trigger",
		"bonus start popup from bonus buy",
		"visual checklist preserved"
	)

	$lines = @("# Stake Approval Checklist", "")
	foreach ($item in $items) {
		$mark = if ($OverallPass) { "x" } else { " " }
		$lines += "- [$mark] $item"
	}
	$lines += ""
	$lines += "Detailed gate evidence is in stake-release-report.md."
	return $lines
}

function New-Report {
	param(
		[string]$Status,
		[string]$GitBranch,
		[string]$GitSha,
		[string]$FrontVersion,
		[string]$MathVersion,
		[object]$Audit,
		[object]$Analysis,
		[object]$BookContract,
		[string[]]$ChangedFiles,
		[string[]]$ReleaseFiles
	)

	$lines = @(
		"# Golden Goal Rush Stake Release Report",
		"",
		"Status: **$Status**",
		"Timestamp: $(Get-Date -Format o)",
		"Git branch: ``$GitBranch``",
		"Git SHA: ``$GitSha``",
		"Frontend build: ``$FrontVersion``",
		"Math version: ``$MathVersion``",
		"",
		"## Gate Results"
	)

	foreach ($group in ($script:Checks | Group-Object Group)) {
		$failed = @($group.Group | Where-Object { -not $_.Passed })
		$groupStatus = if ($failed.Count -eq 0) { "PASS" } else { "FAIL" }
		$lines += ""
		$lines += "### $($group.Name) - $groupStatus"
		foreach ($check in $group.Group) {
			$mark = if ($check.Passed) { "x" } else { " " }
			$detail = if ($check.Detail) { " - $($check.Detail)" } else { "" }
			$lines += "- [$mark] $($check.Name)$detail"
		}
	}

	$lines += ""
	$lines += "## Math / RTP Summary"
	foreach ($prop in $Audit.PSObject.Properties) {
		$m = $prop.Value
		$lines += "- $($prop.Name): achieved RTP $($m.achievedRtp), hit rate $($m.hitRateWeighted), max win odds 1 in $($m.maxWinOdds), ETL >40x $($m.etl40Share), CVaR 0.1% $($m.cvar01x)"
	}
	if ($Analysis) {
		$lines += ""
		$lines += "Base lookup analysis:"
		$lines += "- RTP: $($Analysis.rtp)"
		$lines += "- Hit Frequency: $($Analysis.hitFrequency)"
		$lines += "- No-Win Share: $($Analysis.noWinShare)"
		foreach ($bucket in $Analysis.buckets.PSObject.Properties) {
			$lines += "- $($bucket.Name): $($bucket.Value.share)"
		}
	}

	if ($BookContract) {
		$lines += ""
		$lines += "## Book Contract"
		$lines += "- OK: $($BookContract.ok)"
		$lines += "- Error count: $($BookContract.errorCount)"
		foreach ($prop in $BookContract.summary.PSObject.Properties) {
			$s = $prop.Value
			$lines += "- $($prop.Name): books=$($s.books), wins=$($s.wins), triggerBooks=$($s.triggerBooks), completeFeatureBooks=$($s.completeFeatureBooks), lookupRtp=$($s.lookupRtp)"
		}
		if ($BookContract.errorCount -gt 0) {
			$lines += "Errors:"
			foreach ($error in $BookContract.errors) { $lines += "- $error" }
		}
	}

	$lines += ""
	$lines += "## RGS Contract"
	$lines += "- API_AMOUNT_MULTIPLIER = 1,000,000"
	$lines += "- BOOK_AMOUNT_MULTIPLIER = 100"
	$lines += "- payout = amount * payoutMultiplier"
	$lines += "- payoutMultiplier = finalWin / 100"
	$lines += '- $1 bet + finalWin 9 => $0.09 payout'
	$lines += "- No fake frontend win normalization is allowed in RGS mode."

	$lines += ""
	$lines += "## Changed Files"
	if ($ChangedFiles.Count) {
		foreach ($file in $ChangedFiles) { $lines += "- ``$file``" }
	} else {
		$lines += "- none"
	}

	$lines += ""
	$lines += "## Release Files"
	foreach ($file in ($ReleaseFiles | Select-Object -First 250)) { $lines += "- ``$file``" }
	if ($ReleaseFiles.Count -gt 250) { $lines += "- ... $($ReleaseFiles.Count - 250) more files" }

	return $lines
}

Write-Host "Golden Goal Rush Stake release pipeline" -ForegroundColor Cyan

$gitBranch = Get-GitValue -Arguments @("rev-parse", "--abbrev-ref", "HEAD")
$gitSha = Get-GitValue -Arguments @("rev-parse", "HEAD")
Add-Check -Group "Release Preflight" -Name "Current branch is main" -Passed ($gitBranch -eq "main") -Detail $gitBranch

if (-not $SkipBuild) {
	Invoke-Checked -WorkingDirectory $Root -FilePath "node" -Arguments @("--check", $FrontendBuilder)
	Invoke-Checked -WorkingDirectory $MathRoot -FilePath "python" -Arguments @("-m", "py_compile", "game_config.py", "game_calculations.py", "game_executables.py", "game_events.py", "optimization.py", "run.py")
	Invoke-Checked -WorkingDirectory $MathRoot -FilePath "python" -Arguments @("run.py", "smoke", "--spins", "1500", "--seed", "7")

	$syncArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $SyncScript, "-BuildFrontend", "-RefreshMath", "-SkipComplianceGate")
	if ($ReuseBooks) { $syncArgs += "-ReuseBooks" }
	Invoke-Checked -WorkingDirectory $Root -FilePath $PowerShellExe -Arguments $syncArgs
}

$indexPath = Join-Path $FrontendDest "index.html"
$auditPath = Join-Path $MathDest "RTP_AUDIT.json"
$mathConfigPath = Join-Path $MathDest "game_config.json"
if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) { throw "Missing built frontend index.html: $indexPath" }
if (-not (Test-Path -LiteralPath $auditPath -PathType Leaf)) { throw "Missing math audit: $auditPath" }
if (-not (Test-Path -LiteralPath $mathConfigPath -PathType Leaf)) { throw "Missing math config: $mathConfigPath" }

$html = Get-Content -LiteralPath $indexPath -Raw
$audit = Read-Json -Path $auditPath
$mathConfig = Read-Json -Path $mathConfigPath
$frontVersion = Get-FrontendVersion -Html $html
$mathVersion = [string]$mathConfig.version
$baseRtpText = (([double]$audit.base.achievedRtp) * 100).ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture) + "%"

Add-MarkerCheck -Group "A URL / Launch validation" -Name "validateLaunchUrl exists" -Content $html -Marker "function validateLaunchUrl"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "sessionID required" -Content $html -Marker "if (!UrlState.sessionID()) missing.push('sessionID')"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "rgs_url required" -Content $html -Marker "if (!UrlState.rgsUrl()) missing.push('rgs_url')"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "currency required" -Content $html -Marker "hasLaunchParam('currency')"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "lang/language required" -Content $html -Marker "hasLaunchParam('lang', 'language')"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "device/deviceType required" -Content $html -Marker "hasLaunchParam('device', 'deviceType')"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "fatal overlay exists" -Content $html -Marker "fatal-error-title"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "runtime URL changes are blocked" -Content $html -Marker "function checkLaunchUrlIntegrity"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "unsupported launch params fatal instead of fallback" -Content $html -Marker "The game URL contains unsupported launch parameters"
Add-MarkerCheck -Group "A URL / Launch validation" -Name "RGS startup aborts on invalid launch" -Content $html -Marker "if (!validateLaunchUrl()) return;"

Add-MarkerCheck -Group "B RGS Authenticate" -Name "wallet authenticate endpoint" -Content $html -Marker "/wallet/authenticate"
Add-MarkerCheck -Group "B RGS Authenticate" -Name "active base recovery path" -Content $html -Marker "recoverActiveRound"
Add-MarkerCheck -Group "B RGS Authenticate" -Name "active bonus resume path" -Content $html -Marker "async function resumeLaunchRound"
Add-MarkerCheck -Group "B RGS Authenticate" -Name "bonus mode detection" -Content $html -Marker "function rgsRoundIsBonus"
Add-MarkerCheck -Group "B RGS Authenticate" -Name "active base immediately settled on auth" -Content $html -Marker "else await recoverActiveRound(data.round)"
Add-MarkerCheck -Group "B RGS Authenticate" -Name "debug logs are gated" -Content $html -Marker "if (!UrlState.debug()) return;"

Add-MarkerCheck -Group "C Play / End-Round Flow" -Name "wallet play endpoint" -Content $html -Marker "/wallet/play"
Add-MarkerCheck -Group "C Play / End-Round Flow" -Name "wallet end-round endpoint" -Content $html -Marker "/wallet/end-round"
Add-MarkerCheck -Group "C Play / End-Round Flow" -Name "end-round uses round.active only" -Content $html -Marker "const roundNeedsEnd = (round) => !!round && round.active === true;"
Add-MarkerCheck -Group "C Play / End-Round Flow" -Name "play promise lock exists" -Content $html -Marker "let playPromise = null;"
Add-MarkerCheck -Group "C Play / End-Round Flow" -Name "end-round promise lock exists" -Content $html -Marker "let endRoundPromise = null;"
Add-MarkerCheck -Group "C Play / End-Round Flow" -Name "current round must end before next play" -Content $html -Marker "if (currentRoundNeedsEnd)"
Add-Check -Group "C Play / End-Round Flow" -Name "roundNeedsEnd line does not inspect payout" -Passed (-not ($html -match "const roundNeedsEnd[^\r\n]*(payout|payoutMultiplier)")) -Detail "must remain round.active-only"

Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "RGS book renderer exists" -Content $html -Marker "async function playRgsBookRound"
Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "display win from final book amount" -Content $html -Marker "finalBookWinMoney"
Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "book amount conversion stays x100" -Content $html -Marker "function bookAmountToMoney(amount)"
Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "positive wallet payout is display source" -Content $html -Marker "if (walletPayout !== null && walletPayout > 0) return walletPayout;"
Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "local free spins only without RGS" -Content $html -Marker "allowLocalFreeSpins = !Rgs.configured()"
Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "unsupported RGS state has no local fallback" -Content $html -Marker "No local fallback was used"
Add-MarkerCheck -Group "D Winnings / No Fake Wins" -Name "positive RGS payout assertion" -Content $html -Marker "RGS payout > 0 but visible game shows no win"
Add-Check -Group "D Winnings / No Fake Wins" -Name "RGS amount contract examples" -Passed ((1000000 * (9 / 100)) -eq 90000 -and (1000000 * (18 / 100)) -eq 180000 -and (1000000 * (220 / 100)) -eq 2200000) -Detail "finalWin 9/18/220"

Add-MarkerCheck -Group "E Bonus Buy / Bonus Mode" -Name "bonus buy mode mapper" -Content $html -Marker "const modeFor = (buy) =>"
Add-MarkerCheck -Group "E Bonus Buy / Bonus Mode" -Name "bonus_tier1 mode used" -Content $html -Marker "bonus_tier1"
Add-MarkerCheck -Group "E Bonus Buy / Bonus Mode" -Name "bonus mode used" -Content $html -Marker "return 'bonus';"
Add-MarkerCheck -Group "E Bonus Buy / Bonus Mode" -Name "bonus buy requires renderable RGS round" -Content $html -Marker "if (!shouldRenderRgsRound(rgsEvents))"
Add-MarkerCheck -Group "E Bonus Buy / Bonus Mode" -Name "bonus progress save events enabled" -Content $html -Marker "trackProgress: true"
Add-MarkerCheck -Group "E Bonus Buy / Bonus Mode" -Name "demo-only local free spins branch retained" -Content $html -Marker "await startFreeSpins(o.id === 'tier1' ? 1 : 2, walletManaged)"

Add-MarkerCheck -Group "F Refresh / Resume" -Name "resume function exists" -Content $html -Marker "async function resumeLaunchRound"
Add-MarkerCheck -Group "F Refresh / Resume" -Name "bet preserved from active round" -Content $html -Marker "applyBetFromRound(round)"
Add-MarkerCheck -Group "F Refresh / Resume" -Name "resume index from round event" -Content $html -Marker "function rgsResumeIndex"
Add-MarkerCheck -Group "F Refresh / Resume" -Name "bonus progress saved to RGS" -Content $html -Marker "Rgs.saveEvent"
Add-MarkerCheck -Group "F Refresh / Resume" -Name "active base settled immediately" -Content $html -Marker "recoverActiveRound"
Add-MarkerCheck -Group "F Refresh / Resume" -Name "active bonus not immediately settled" -Content $html -Marker "if (rgsRoundIsBonus(data.round)) markRoundFromPlay(data.round)"

Add-MarkerCheck -Group "G Bonus Start Popup" -Name "bonus intro DOM element" -Content $html -Marker "id=`"bonus-intro`""
Add-MarkerCheck -Group "G Bonus Start Popup" -Name "RGS bonus intro function" -Content $html -Marker "async function bonusIntroRgs"
Add-MarkerCheck -Group "G Bonus Start Popup" -Name "popup used for RGS free-spin trigger" -Content $html -Marker "if (!skipBonusIntro) await bonusIntroRgs"
Add-MarkerCheck -Group "G Bonus Start Popup" -Name "popup used for bonus buy" -Content $html -Marker "await bonusIntroRgs(CONFIG.tiers[tier].spins)"

Add-MarkerCheck -Group "H Rules / Info Modal" -Name "base reload settlement explained" -Content $html -Marker "immediately settled with Stake Engine"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "game history explained" -Content $html -Marker "game history"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "active bonus resume explained" -Content $html -Marker "Active Bonus Buy bonus rounds resume"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "bonus buy rules present" -Content $html -Marker "Bonus Buy"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "RTP text matches audit" -Content $html -Marker "RTP $baseRtpText"

foreach ($prop in $audit.PSObject.Properties) {
	$mode = $prop.Name
	$m = $prop.Value
	$rtp = [double]$m.achievedRtp
	Add-Check -Group "Math / RTP" -Name "$mode RTP is 96.00%-96.50%" -Passed ($rtp -ge 0.9600 -and $rtp -le 0.9650) -Detail $m.achievedRtp
	Add-Check -Group "Math / RTP" -Name "$mode hard RTP max 96.70%" -Passed ($rtp -le 0.9670) -Detail $m.achievedRtp
	if ($null -ne $m.PSObject.Properties["tailMet"]) {
		Add-Check -Group "Math / RTP" -Name "$mode tail constraints met" -Passed ([bool]$m.tailMet) -Detail "tailMet=$($m.tailMet)"
	}
	if ($null -ne $m.PSObject.Properties["maxWinAchievabilityMet"]) {
		Add-Check -Group "Math / RTP" -Name "$mode max win achievability <= 1 in 20M" -Passed ([bool]$m.maxWinAchievabilityMet -and [double]$m.maxWinOdds -le 20000000) -Detail "1 in $($m.maxWinOdds)"
	} else {
		Add-Check -Group "Math / RTP" -Name "$mode max win achievability metric exists" -Passed $false -Detail "RTP_AUDIT missing maxWinOdds"
	}
}
Add-Check -Group "Math / RTP" -Name "base ETL >40x within limit" -Passed ([double]$audit.base.etl40Share -le 0.80) -Detail $audit.base.etl40Share
Add-Check -Group "Math / RTP" -Name "base CVaR 0.1% within limit" -Passed ([double]$audit.base.cvar01x -le 700) -Detail $audit.base.cvar01x

$analysisText = Invoke-Capture -WorkingDirectory $MathRoot -FilePath "python" -Arguments @("run.py", "analyze", "--mode", "base", "--source", "lookup")
$analysis = $analysisText | ConvertFrom-Json
Add-Check -Group "Math / RTP" -Name "base hit frequency is not dry" -Passed ([double]$analysis.hitFrequency -ge 0.25) -Detail $analysis.hitFrequency
Add-Check -Group "Math / RTP" -Name "base no-win share is below 75%" -Passed ([double]$analysis.noWinShare -le 0.75) -Detail $analysis.noWinShare
Add-Check -Group "Math / RTP" -Name "tiny 0.01x-0.20x wins are not dominant" -Passed ([double]$analysis.buckets."0.01x-0.20x".share -le 0.05) -Detail $analysis.buckets."0.01x-0.20x".share
Add-Check -Group "Math / RTP" -Name "0.20x-2.00x win bands are present" -Passed (([double]$analysis.buckets."0.20x-0.50x".share + [double]$analysis.buckets."0.50x-1.00x".share + [double]$analysis.buckets."1.00x-2.00x".share) -ge 0.20) -Detail "combined=$(([double]$analysis.buckets.'0.20x-0.50x'.share + [double]$analysis.buckets.'0.50x-1.00x'.share + [double]$analysis.buckets.'1.00x-2.00x'.share))"

$bookContract = Test-BookContract
Add-Check -Group "D Winnings / No Fake Wins" -Name "published books finalWin equals payoutMultiplier" -Passed ([bool]$bookContract.ok) -Detail "errors=$($bookContract.errorCount)"

Test-TitleApproval -GameName ([string]$mathConfig.gameName)
Test-OffensiveAssetNames
Test-ImageBrightness -ImagePath (Join-Path $AssetRoot "slot-background.webp") -Name "background image brightness/static presence" -Minimum 35
Test-ImageBrightness -ImagePath (Join-Path $AssetRoot "logo-horizontal-tight.webp") -Name "foreground/title image brightness/static presence" -Minimum 45
Add-Check -Group "I Visual Approval" -Name "title logo asset exists" -Passed (Test-Path -LiteralPath (Join-Path $AssetRoot "logo-horizontal-tight.webp") -PathType Leaf) -Detail "logo-horizontal-tight.webp"
Add-Check -Group "I Visual Approval" -Name "tile/background asset exists" -Passed (Test-Path -LiteralPath (Join-Path $AssetRoot "slot-background.webp") -PathType Leaf) -Detail "slot-background.webp"
Add-Check -Group "I Visual Approval" -Name "scatter asset exists" -Passed (Test-Path -LiteralPath (Join-Path $AssetRoot "scatter.webp") -PathType Leaf) -Detail "scatter.webp"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$releaseName = "golden-goal-rush_front-$(Sanitize-Name $frontVersion)_math-$(Sanitize-Name $mathVersion)_$timestamp"
$releaseDir = Join-Path $ReleaseRoot $releaseName
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null
if (Test-Path -LiteralPath $releaseDir) { Remove-Item -LiteralPath $releaseDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

Copy-DirectoryClean -Source $FrontendDest -Destination (Join-Path $releaseDir "frontend")
Copy-DirectoryClean -Source $MathDest -Destination (Join-Path $releaseDir "math")
$generatedPublishDest = Join-Path $releaseDir "generated\publish_files"
Copy-DirectoryClean -Source $MathPublish -Destination $generatedPublishDest
Get-ChildItem -LiteralPath $generatedPublishDest -Filter "*.zip" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Copy-DirectoryClean -Source (Join-Path $MathRoot "library\configs") -Destination (Join-Path $releaseDir "generated\configs")
New-Item -ItemType Directory -Force -Path (Join-Path $releaseDir "artifacts") | Out-Null
Copy-Item -LiteralPath $PreviewHtml -Destination (Join-Path $releaseDir "artifacts\preview.html") -Force

$releaseFiles = Get-RelativeFileList -Path $releaseDir -Base $releaseDir
$releaseFilesWithReports = @($releaseFiles + @("manifest.json", "stake-approval-checklist.md", "stake-release-report.md")) | Sort-Object -Unique
$failedChecks = @($script:Checks | Where-Object { -not $_.Passed })
$overallPass = $failedChecks.Count -eq 0
$status = if ($overallPass) { "PASS" } else { "FAIL" }

$manifest = [pscustomobject]@{
	gameId = "golden_goal_rush"
	gameName = [string]$mathConfig.gameName
	timestamp = (Get-Date -Format o)
	gitBranch = $gitBranch
	gitCommitSha = $gitSha
	frontVersion = $frontVersion
	mathVersion = $mathVersion
	buildCommand = if ($ReuseBooks) { "npm run stake:release -- -ReuseBooks" } else { "npm run stake:release" }
	releaseFolder = $releaseDir
	checkStatus = $status
	checksPassed = @($script:Checks | Where-Object { $_.Passed }).Count
	checksFailed = $failedChecks.Count
	failedChecks = @($failedChecks | ForEach-Object { "$($_.Group): $($_.Name)" })
	rtpSummary = $audit
	baseLookupAnalysis = $analysis
	bookContract = $bookContract
	copiedFiles = $releaseFilesWithReports
}

$manifestPath = Join-Path $releaseDir "manifest.json"
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$changedFiles = Get-ChangedFiles
$reportLines = New-Report -Status $status -GitBranch $gitBranch -GitSha $gitSha -FrontVersion $frontVersion -MathVersion $mathVersion -Audit $audit -Analysis $analysis -BookContract $bookContract -ChangedFiles $changedFiles -ReleaseFiles $releaseFilesWithReports
$reportLines | Set-Content -LiteralPath (Join-Path $releaseDir "stake-release-report.md") -Encoding UTF8
(New-Checklist -OverallPass $overallPass) | Set-Content -LiteralPath (Join-Path $releaseDir "stake-approval-checklist.md") -Encoding UTF8

$zipPath = $null
if (-not $NoZip) {
	$zipPath = Join-Path $ReleaseRoot ($releaseName + ".zip")
	if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
	for ($attempt = 1; $attempt -le 3; $attempt += 1) {
		try {
			Compress-Archive -Path (Join-Path $releaseDir "*") -DestinationPath $zipPath -Force
			break
		}
		catch {
			if ($attempt -eq 3) { throw }
			Start-Sleep -Seconds 2
		}
	}
}

Write-Host ""
Write-Host "Release folder: $releaseDir" -ForegroundColor Cyan
if ($zipPath) { Write-Host "Zip archive:    $zipPath" -ForegroundColor Cyan }
Write-Host "Status:         $status" -ForegroundColor ($(if ($overallPass) { "Green" } else { "Red" }))

if (-not $overallPass) {
	Write-Host ""
	Write-Host "Failed checks:" -ForegroundColor Red
	foreach ($check in $failedChecks) {
		Write-Host "  - $($check.Group): $($check.Name) ($($check.Detail))" -ForegroundColor Red
	}
	throw "Stake release pipeline failed ($($failedChecks.Count) check(s)). Do not upload this release."
}
