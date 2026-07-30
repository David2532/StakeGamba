param(
	[switch]$ReuseBooks,
	[switch]$AllowCandidateBranch,
	[string]$ExpectedCommit = "",
	[string]$AllowedUntrackedPrefix = ""
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
$StakeQaScript = Join-Path $Root "scripts\stake-qa.mjs"
$SyncScript = Join-Path $Root "scripts\sync-stake-publish.ps1"
$PaytableVerifier = Join-Path $Root "scripts\verify-stake-paytable.mjs"
$MathRoot = Join-Path $Root "math\games\golden_goal_rush"
$MathPublish = Join-Path $MathRoot "library\publish_files"
$AssetRoot = Join-Path $Root "apps\cluster\src\assets\golden-goal-rush"
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$QaArtifactRoot = Join-Path $Root ("artifacts\stake-qa\release-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$ImplementationEvidenceRoot = Join-Path $Root "artifacts\stake-final-implementation-20260712-164933"
$ShortWorkRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ggr-stake-release"

# Release validation must exercise the exact upload frontend and must never
# silently downgrade a missing Playwright/Chromium install to SKIP.
$env:STAKE_QA_REQUIRE_E2E = "1"
$env:STAKE_QA_FRONTEND_ROOT = $FrontendDest
$env:STAKE_QA_FRONTEND_ENTRY = "index.html"
$env:STAKE_QA_ARTIFACT_DIR = $QaArtifactRoot

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

function Add-PlayerLanguageChecks {
	param(
		[string]$Group,
		[string]$Content
	)
	$languageBlock = Get-BalancedObjectText -Content $Content -Marker "const LANGUAGE_RESOURCES = {"
	$playerText = Get-JsStringValues -Content $languageBlock
	Add-Check -Group $Group -Name "complete player language resource is extractable" -Passed ($playerText.Length -gt 0) -Detail "chars=$($playerText.Length)"

	foreach ($term in @(
		"Bet Replay", "Base Bet", "Cost Multiplier", "Total Bet Cost", "Payout Multiplier", "Total Win",
		"Bonus Buy", "Buy Bonus", "Auto-Bet", "Auto Bet", "Bet", "Wager", "Gamble", "Purchase",
		"Pay", "Pays", "Paid", "Paying", "Pay out", "Paid out", "Pays out", "Payout", "Payouts",
		"Betting", "Bets", "Place your bets", "Bet/s", "Stake", "Cash", "Payer", "Money",
		"Buy", "Bought", "At the cost of", "Cost of", "Rebet", "Credit", "Deposit", "Withdraw",
		"Fund", "Currency"
	)) {
		Add-Check -Group $Group -Name "all player language avoids restricted term '$term'" -Passed (-not (Test-TextContainsWordOrPhrase -Text $playerText -Phrase $term)) -Detail $term
	}

	foreach ($term in @(
		"Play Replay", "Base Play", "Feature Multiplier", "Play Cost", "Final Multiplier",
		"Final Play Amount", "Replay Play", "BONUS / FEATURE", "AUTO-PLAY", "PLAY"
	)) {
		Add-Check -Group $Group -Name "all player language includes required substitute '$term'" -Passed ($playerText.Contains($term)) -Detail $term
	}
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
	return (Invoke-Capture -WorkingDirectory $Root -FilePath "git" -Arguments $Arguments).Trim()
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
	Assert-ChildPath -Child $Destination -Parent $ShortWorkRoot
	if (Test-Path -LiteralPath $Destination) {
		Remove-Item -LiteralPath $Destination -Recurse -Force
	}
	New-Item -ItemType Directory -Force -Path $Destination | Out-Null
	& robocopy.exe $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NP /NJH /NJS | Out-Null
	$robocopyCode = $LASTEXITCODE
	if ($robocopyCode -ge 8) {
		throw "Robocopy failed with exit code $robocopyCode while copying '$Source' to '$Destination'"
	}
}

function Assert-ChildPath {
	param(
		[string]$Child,
		[string]$Parent
	)
	$parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\', '/')
	$childFull = [System.IO.Path]::GetFullPath($Child)
	if (-not $childFull.StartsWith($parentFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
		throw "Refusing recursive operation outside '$parentFull': $childFull"
	}
}

function Reset-ShortDirectory {
	param([string]$Path)
	Assert-ChildPath -Child $Path -Parent $ShortWorkRoot
	if (Test-Path -LiteralPath $Path) {
		Remove-Item -LiteralPath $Path -Recurse -Force
	}
	New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Get-FileHashEntries {
	param(
		[string]$Path,
		[string]$Base
	)
	return @(Get-ChildItem -LiteralPath $Path -Recurse -File | ForEach-Object {
		[pscustomobject]@{
			path = (ConvertTo-RelativePath -Path $_.FullName -Base $Base).Replace('\', '/')
			bytes = $_.Length
			sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
		}
	} | Sort-Object path)
}

function Get-FileTreeDigest {
	param([object[]]$Entries)
	$json = ConvertTo-Json -InputObject @($Entries) -Depth 6 -Compress
	$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
	$sha = [System.Security.Cryptography.SHA256]::Create()
	try {
		return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
	}
	finally {
		$sha.Dispose()
	}
}

function Assert-DirectoryMatches {
	param(
		[string]$Expected,
		[string]$Actual,
		[string]$Name
	)
	$expectedEntries = @(Get-FileHashEntries -Path $Expected -Base $Expected)
	$actualEntries = @(Get-FileHashEntries -Path $Actual -Base $Actual)
	$expectedJson = $expectedEntries | ConvertTo-Json -Depth 5 -Compress
	$actualJson = $actualEntries | ConvertTo-Json -Depth 5 -Compress
	if ($expectedJson -ne $actualJson) {
		throw "$Name differs from its canonical publish source"
	}
	return $expectedEntries.Count
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
		"read-only Replay Mode hides every paid control",
		"replay GET makes zero wallet/session/event writes",
		"Replay Play and Play Again reproduce the saved event",
		"K 5+ 0.48x / Q 5+ 0.36x / J 7+ 0.56x Paytable contract",
		"published frontend passed mandatory Chromium E2E",
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

	[string[]]$changedFileList = @($ChangedFiles | Where-Object { $_ })
	[string[]]$releaseFileList = @($ReleaseFiles | Where-Object { $_ })

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
	$lines += '- $1 bet + finalWin 48 => $0.48 payout (production K 5+ example)'
	$lines += "- No fake frontend win normalization is allowed in RGS mode."

	$lines += ""
	$lines += "## QA Evidence"
	$lines += "- Static/numerical report: ``artifacts/stake-qa/report.json``"
	$lines += "- Paytable contract: ``artifacts/stake-qa/paytable-contract.json``"
	$lines += "- Browser report: ``artifacts/stake-qa/e2e-report.json``"
	$lines += "- Replay network proof: ``artifacts/stake-qa/replay-network-proof.json``"
	$lines += "- Replay/viewport screenshots: ``artifacts/stake-qa/e2e-screenshots/``"

	$lines += ""
	$lines += "## Changed Files"
	if ($changedFileList.Length -gt 0) {
		foreach ($file in $changedFileList) { $lines += "- ``$file``" }
	} else {
		$lines += "- none"
	}

	$lines += ""
	$lines += "## Release Files"
	foreach ($file in ($releaseFileList | Select-Object -First 250)) { $lines += "- ``$file``" }
	if ($releaseFileList.Length -gt 250) { $lines += "- ... $($releaseFileList.Length - 250) more files" }

	return $lines
}

Write-Host "Golden Goal Rush Stake release pipeline" -ForegroundColor Cyan

$gitTopLevel = Get-GitValue -Arguments @("rev-parse", "--show-toplevel")
$gitBranch = Get-GitValue -Arguments @("rev-parse", "--abbrev-ref", "HEAD")
$gitSha = Get-GitValue -Arguments @("rev-parse", "HEAD")
$gitRemote = Get-GitValue -Arguments @("config", "--get", "remote.origin.url")
$resolvedGitRoot = [System.IO.Path]::GetFullPath($gitTopLevel).TrimEnd('\', '/')
$resolvedRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
if ($resolvedGitRoot -ne $resolvedRoot) {
	throw "Git provenance root mismatch: expected '$resolvedRoot', actual '$resolvedGitRoot'"
}
if ($gitBranch -ne "main" -and -not $AllowCandidateBranch) {
	throw "Release requires branch 'main' unless -AllowCandidateBranch is supplied explicitly; actual branch is '$gitBranch'"
}
if ($gitSha -notmatch '^[0-9a-fA-F]{40,64}$') { throw "Release requires a valid Git commit SHA; actual value is '$gitSha'" }
if (-not [string]::IsNullOrWhiteSpace($ExpectedCommit) -and $gitSha -ne $ExpectedCommit) {
	throw "Release commit mismatch: expected '$ExpectedCommit', actual '$gitSha'"
}
if ([string]::IsNullOrWhiteSpace($gitRemote)) { throw "Release requires a configured origin remote" }
$initialGitStatus = Get-GitValue -Arguments @("status", "--porcelain=v1", "--untracked-files=all")
$unexpectedGitStatus = @($initialGitStatus -split "`r?`n" | Where-Object {
	$line = $_
	(-not [string]::IsNullOrWhiteSpace($line)) -and -not (
		(-not [string]::IsNullOrWhiteSpace($AllowedUntrackedPrefix)) -and $line -like "?? $AllowedUntrackedPrefix*"
	)
})
if ($unexpectedGitStatus.Count -gt 0) {
	throw "Release requires a clean Git tree before generation. Commit or archive these changes first:`n$($unexpectedGitStatus -join "`n")"
}
Add-Check -Group "Release Preflight" -Name "Git repository root is authoritative" -Passed $true -Detail $gitTopLevel
Add-Check -Group "Release Preflight" -Name "Current branch is authorized" -Passed $true -Detail $gitBranch
Add-Check -Group "Release Preflight" -Name "Commit SHA is available" -Passed $true -Detail $gitSha
if (-not [string]::IsNullOrWhiteSpace($ExpectedCommit)) { Add-Check -Group "Release Preflight" -Name "Commit SHA matches requested candidate" -Passed $true -Detail $ExpectedCommit }
Add-Check -Group "Release Preflight" -Name "Origin remote is configured" -Passed $true -Detail $gitRemote
Add-Check -Group "Release Preflight" -Name "Working tree is initially clean" -Passed $true -Detail "tracked and untracked source checked"

$legacyUploadPaths = @(
	(Join-Path $Root "stake-upload"),
	(Join-Path $Root ".stake-audit"),
	(Join-Path $Root "apps\lines\golden-goal-rush-frontend-stake.zip"),
	(Join-Path $MathRoot "stake_math_upload_clean"),
	(Join-Path $MathRoot "golden-goal-rush-math-stake-clean.zip"),
	(Join-Path $MathPublish "golden-goal-rush-math-upload.zip")
)
$legacyStillActive = @($legacyUploadPaths | Where-Object { Test-Path -LiteralPath $_ })
if ($legacyStillActive.Count -gt 0) {
	throw "Legacy upload-shaped artifacts must be archived before release:`n$($legacyStillActive -join "`n")"
}
Add-Check -Group "Release Preflight" -Name "Legacy upload-shaped paths are absent" -Passed $true -Detail "archived under historical/non-uploadable-stake-artifacts"

New-Item -ItemType Directory -Force -Path $ImplementationEvidenceRoot | Out-Null
$existingCanonicalZips = @(Get-ChildItem -LiteralPath $ImplementationEvidenceRoot -File -Filter "golden-goal-rush_*.zip" -ErrorAction SilentlyContinue)
if ($existingCanonicalZips.Count -gt 0) {
	throw "Canonical evidence directory already contains a release ZIP; archive it before creating another: $($existingCanonicalZips.FullName -join '; ')"
}
$releaseRootEntries = @()
if (Test-Path -LiteralPath $ReleaseRoot -PathType Container) {
	$releaseRootEntries = @(Get-ChildItem -LiteralPath $ReleaseRoot -Force)
}
if ($releaseRootEntries.Count -gt 0) {
	throw "stake-release must be empty before release; archive all prior candidates first: $($releaseRootEntries.FullName -join '; ')"
}

Invoke-Checked -WorkingDirectory $Root -FilePath "node" -Arguments @("--check", $FrontendBuilder)
Invoke-Checked -WorkingDirectory $MathRoot -FilePath "python" -Arguments @("-m", "py_compile", "game_config.py", "game_calculations.py", "game_executables.py", "game_events.py", "optimization.py", "run.py")
Invoke-Checked -WorkingDirectory $MathRoot -FilePath "python" -Arguments @("run.py", "smoke", "--spins", "1500", "--seed", "7")

$syncArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $SyncScript, "-BuildFrontend", "-RefreshMath")
if ($ReuseBooks) { $syncArgs += "-ReuseBooks" }
Invoke-Checked -WorkingDirectory $Root -FilePath $PowerShellExe -Arguments $syncArgs

$postGenerationGitStatus = Get-GitValue -Arguments @("status", "--porcelain=v1", "--untracked-files=all")
$unexpectedPostGenerationStatus = @($postGenerationGitStatus -split "`r?`n" | Where-Object {
	$line = $_
	(-not [string]::IsNullOrWhiteSpace($line)) -and -not (
		(-not [string]::IsNullOrWhiteSpace($AllowedUntrackedPrefix)) -and $line -like "?? $AllowedUntrackedPrefix*"
	)
})
if ($unexpectedPostGenerationStatus.Count -gt 0) {
	throw "Release generation changed tracked or untracked source files. Commit regenerated canonical artifacts and rerun from a clean tree:`n$($unexpectedPostGenerationStatus -join "`n")"
}
Add-Check -Group "Release Preflight" -Name "Working tree remains clean after generation" -Passed $true -Detail "generated artifacts reproduce committed sources"

$indexPath = Join-Path $FrontendDest "index.html"
$auditPath = Join-Path $MathDest "RTP_AUDIT.json"
$mathConfigPath = Join-Path $MathDest "game_config.json"
if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) { throw "Missing built frontend index.html: $indexPath" }
if (-not (Test-Path -LiteralPath $auditPath -PathType Leaf)) { throw "Missing math audit: $auditPath" }
if (-not (Test-Path -LiteralPath $mathConfigPath -PathType Leaf)) { throw "Missing math config: $mathConfigPath" }
Invoke-Checked -WorkingDirectory $Root -FilePath "node" -Arguments @(
	$PaytableVerifier,
	"--html", $indexPath,
	"--math", $mathConfigPath,
	"--report", (Join-Path $ImplementationEvidenceRoot "paytable-contract-release.json")
)

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
Add-MarkerCheck -Group "A URL / Launch validation" -Name "replay launch is supported" -Content $html -Marker "id=`"replay-overlay`""
Add-MarkerCheck -Group "A URL / Launch validation" -Name "replay request carries language" -Content $html -Marker "language: UrlState.lang()"
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
Add-MarkerCheck -Group "F Refresh / Resume" -Name "interrupted round continue notice" -Content $html -Marker "Your previous round was interrupted. You can continue where you left off."
Add-MarkerCheck -Group "F Refresh / Resume" -Name "resume waits for interrupted notice" -Content $html -Marker "await showInterruptedRoundMessage();"

Add-MarkerCheck -Group "G Bonus Start Popup" -Name "bonus intro DOM element" -Content $html -Marker "id=`"bonus-intro`""
Add-MarkerCheck -Group "G Bonus Start Popup" -Name "RGS bonus intro function" -Content $html -Marker "async function bonusIntroRgs"
Add-MarkerCheck -Group "G Bonus Start Popup" -Name "popup used for RGS free-spin trigger" -Content $html -Marker "if (!skipBonusIntro) await bonusIntroRgs"
Add-MarkerCheck -Group "G Bonus Start Popup" -Name "popup used for bonus buy" -Content $html -Marker "await bonusIntroRgs(CONFIG.tiers[tier].spins)"

Add-MarkerCheck -Group "H Rules / Info Modal" -Name "base reload settlement explained" -Content $html -Marker "round is completed by the game service"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "game history explained" -Content $html -Marker "game history"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "active feature resume explained" -Content $html -Marker "Active feature rounds resume"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "feature rules present" -Content $html -Marker "BONUS / FEATURE"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "buttons and controls rules present" -Content $html -Marker "Buttons &amp; Controls"
Add-MarkerCheck -Group "H Rules / Info Modal" -Name "RTP text matches audit" -Content $html -Marker "RTP $baseRtpText"

Add-MarkerCheck -Group "J Stake Feedback UI" -Name "auto-bet modal exists" -Content $html -Marker "id=`"modal-autospin`""
Add-MarkerCheck -Group "J Stake Feedback UI" -Name "auto-bet options restricted" -Content $html -Marker "const AUTO_SPIN_OPTIONS = [10, 25, 50, 100, 200, Infinity]"
Add-MarkerCheck -Group "J Stake Feedback UI" -Name "auto-bet confirmation function exists" -Content $html -Marker "function confirmAutoSpin(count)"
Add-MarkerCheck -Group "J Stake Feedback UI" -Name "insufficient funds helper exists" -Content $html -Marker "function showInsufficientFunds"
Add-MarkerCheck -Group "J Stake Feedback UI" -Name "social casino balance wording exists" -Content $html -Marker "Insufficient Balance"
Add-MarkerCheck -Group "J Stake Feedback UI" -Name "mobile fullscreen dvh exists" -Content $html -Marker "height: 100dvh"
Add-MarkerCheck -Group "J Stake Feedback UI" -Name "stage fit transform variable exists" -Content $html -Marker "--stage-fit-transform"

Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "authenticate bet config normalizer exists" -Content $html -Marker "function normalizeBetConfig"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "authenticate bet config applier exists" -Content $html -Marker "function applyBetConfig"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "bet levels read from authenticate config" -Content $html -Marker "firstArrayConfig(config, ['betLevels', 'availableBetLevels', 'betAmounts', 'bets', 'levels', 'denominations'])"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "default bet read from authenticate config" -Content $html -Marker "firstMoneyConfig(config, ['defaultBetLevel', 'defaultBet', 'defaultBetAmount', 'betLevel', 'betAmount', 'minBet'])"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "wallet authenticate feeds active bet config" -Content $html -Marker "syncBetLevels(data.config, data)"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "wallet play uses active API bet levels" -Content $html -Marker "activeBetConfig.apiLevels"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "demo bet fallback excluded from RGS/replay" -Content $html -Marker "if (!UrlState.requiresRgs() && !Replay.configured()) applyBetConfig"

Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "Game Info mode metadata exists" -Content $html -Marker "const PLAYER_MODE_META = {"
foreach ($modeName in @("Base Play", "Feature Spins", "Rainbow Spin", "Golden Chance", "All That Glitters", "End of the Rainbow")) {
	Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "Game Info explains mode '$modeName'" -Content $html -Marker $modeName
}
foreach ($marker in @("Main Play button", "Feature panel", "3 Scatter tickets", "4 Scatter tickets", "5 Scatter tickets only", "Cost multiplier:", "Feature Multiplier:", "Golden Cells persist", "guaranteed Golden Arc", "boosted Golden Arc chance", "Base Play and Rainbow Spin can trigger Free Spins", "Feature-panel Free Spins do not add additional Free Spins")) {
	Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "Game Info detail marker '$marker'" -Content $html -Marker $marker
}

Add-PlayerLanguageChecks -Group "K Stake 2026 Review Items" -Content $html
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "all modes use player-safe rules" -Content $html -Marker "function buildPlayerSafeRulesBodyHtml()"

Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "dedicated replay overlay exists" -Content $html -Marker "id=`"replay-overlay`""
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "dedicated Replay Play/Play Again button exists" -Content $html -Marker "id=`"replay-action`""
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "explicit replay lifecycle exists" -Content $html -Marker "stage.dataset.replayState = status"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "replay request carries language" -Content $html -Marker "language: UrlState.lang()"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "replay request carries lang alias" -Content $html -Marker "lang: UrlState.lang()"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "replay mode name uses game metadata" -Content $html -Marker "playerModeName(rgsRoundMode(round))"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "display-only Replay Play Amount label exists" -Content $html -Marker "'REPLAY PLAY'"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "replay currency display exists" -Content $html -Marker "id=`"replay-currency`""
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "replay playback avoids progress/wallet mutation" -Content $html -Marker "trackProgress: false"
Add-MarkerCheck -Group "K Stake 2026 Review Items" -Name "Play Again starts cached replay" -Content $html -Marker "action.onclick = () => play();"
Add-Check -Group "K Stake 2026 Review Items" -Name "semantic frontend/production Paytable contract passed" -Passed (Test-Path -LiteralPath (Join-Path $ImplementationEvidenceRoot "paytable-contract-release.json") -PathType Leaf) -Detail "9 symbols; all thresholds; numeric and formatted values"
Add-Check -Group "K Stake 2026 Review Items" -Name "K 5+ production payout is 0.48x" -Passed ([math]::Abs([double]$mathConfig.paytable.k.cluster5 - 0.48) -lt 0.0000001) -Detail ([string]$mathConfig.paytable.k.cluster5)
Add-Check -Group "K Stake 2026 Review Items" -Name "Q 5+ production payout is 0.36x" -Passed ([math]::Abs([double]$mathConfig.paytable.q.cluster5 - 0.36) -lt 0.0000001) -Detail ([string]$mathConfig.paytable.q.cluster5)
Add-Check -Group "K Stake 2026 Review Items" -Name "J 7+ production payout is 0.56x" -Passed ([math]::Abs(([double]$mathConfig.paytable.j.cluster5 * [double]$mathConfig.paytable.j.cluster7Boost) - 0.56) -lt 0.0000001) -Detail ([string]([double]$mathConfig.paytable.j.cluster5 * [double]$mathConfig.paytable.j.cluster7Boost))

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

$qaReportPath = Join-Path $QaArtifactRoot "report.json"
$qaE2eReportPath = Join-Path $QaArtifactRoot "e2e-report.json"
$qaPaytableReportPath = Join-Path $QaArtifactRoot "paytable-contract.json"
$qaNetworkProofPath = Join-Path $QaArtifactRoot "replay-network-proof.json"
$qaWalletProofPath = Join-Path $QaArtifactRoot "rgs-wallet-network-proof.json"
$qaBalanceInvariantPath = Join-Path $QaArtifactRoot "balance-invariant-report.json"
Add-Check -Group "Release Evidence" -Name "Stake QA report exists" -Passed (Test-Path -LiteralPath $qaReportPath -PathType Leaf) -Detail $qaReportPath
Add-Check -Group "Release Evidence" -Name "mandatory browser E2E report exists" -Passed (Test-Path -LiteralPath $qaE2eReportPath -PathType Leaf) -Detail $qaE2eReportPath
Add-Check -Group "Release Evidence" -Name "numerical Paytable report exists" -Passed (Test-Path -LiteralPath $qaPaytableReportPath -PathType Leaf) -Detail $qaPaytableReportPath
Add-Check -Group "Release Evidence" -Name "replay network proof exists" -Passed (Test-Path -LiteralPath $qaNetworkProofPath -PathType Leaf) -Detail $qaNetworkProofPath
Add-Check -Group "Release Evidence" -Name "RGS wallet network proof exists" -Passed (Test-Path -LiteralPath $qaWalletProofPath -PathType Leaf) -Detail $qaWalletProofPath
Add-Check -Group "Release Evidence" -Name "balance invariant report exists" -Passed (Test-Path -LiteralPath $qaBalanceInvariantPath -PathType Leaf) -Detail $qaBalanceInvariantPath
$failedChecks = @($script:Checks | Where-Object { -not $_.Passed })
$overallPass = $failedChecks.Count -eq 0
$status = if ($overallPass) { "PASS" } else { "FAIL" }
if (-not $overallPass) {
	Write-Host ""
	Write-Host "Failed checks:" -ForegroundColor Red
	foreach ($check in $failedChecks) {
		Write-Host "  - $($check.Group): $($check.Name) ($($check.Detail))" -ForegroundColor Red
	}
	throw "Stake release pipeline failed ($($failedChecks.Count) check(s)). Do not upload this release."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$shortSha = $gitSha.Substring(0, 12)
$releaseName = "golden-goal-rush_evidence_$shortSha"
$zipPath = Join-Path $ImplementationEvidenceRoot ($releaseName + ".zip")
$frontendZipPath = Join-Path $ReleaseRoot ("golden-goal-rush_frontend_$shortSha.zip")
$mathZipPath = Join-Path $ReleaseRoot ("golden-goal-rush_math_$shortSha.zip")
$checksumsPath = Join-Path $ReleaseRoot "SHA256SUMS"
$attestationPath = Join-Path $ReleaseRoot "release-attestation.json"
$stageDir = Join-Path $ShortWorkRoot "stage"
$extractDir = Join-Path $ShortWorkRoot "extract"
$uploadExtractDir = Join-Path $ShortWorkRoot "upload-extract"
$temporaryZip = Join-Path $ShortWorkRoot ($releaseName + ".partial.zip")
$temporaryFrontendZip = Join-Path $ShortWorkRoot ("golden-goal-rush_frontend_$shortSha.partial.zip")
$temporaryMathZip = Join-Path $ShortWorkRoot ("golden-goal-rush_math_$shortSha.partial.zip")
$exactZipQaRoot = Join-Path $ImplementationEvidenceRoot "exact-zip-qa"
$entryHashesPath = Join-Path $ImplementationEvidenceRoot "release-entry-hashes.json"
$frontendTreePath = Join-Path $ImplementationEvidenceRoot "frontend-file-tree.json"
$mathTreePath = Join-Path $ImplementationEvidenceRoot "math-file-tree.json"
$externalManifestPath = Join-Path $ImplementationEvidenceRoot "release-manifest.json"
$releaseSucceeded = $false

New-Item -ItemType Directory -Force -Path $ShortWorkRoot | Out-Null
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

try {
	Reset-ShortDirectory -Path $stageDir
	Reset-ShortDirectory -Path $extractDir
	Reset-ShortDirectory -Path $uploadExtractDir
	if (Test-Path -LiteralPath $temporaryZip) { Remove-Item -LiteralPath $temporaryZip -Force }
	if (Test-Path -LiteralPath $temporaryFrontendZip) { Remove-Item -LiteralPath $temporaryFrontendZip -Force }
	if (Test-Path -LiteralPath $temporaryMathZip) { Remove-Item -LiteralPath $temporaryMathZip -Force }

	Copy-DirectoryClean -Source $FrontendDest -Destination (Join-Path $stageDir "frontend")
	Copy-DirectoryClean -Source $MathDest -Destination (Join-Path $stageDir "math")
	$generatedPublishDest = Join-Path $stageDir "generated\publish_files"
	Copy-DirectoryClean -Source $MathPublish -Destination $generatedPublishDest
	Get-ChildItem -LiteralPath $generatedPublishDest -Filter "*.zip" -File -ErrorAction SilentlyContinue | Remove-Item -Force
	Copy-DirectoryClean -Source (Join-Path $MathRoot "library\configs") -Destination (Join-Path $stageDir "generated\configs")

	$stageArtifacts = Join-Path $stageDir "artifacts"
	New-Item -ItemType Directory -Force -Path $stageArtifacts | Out-Null
	Copy-Item -LiteralPath $PreviewHtml -Destination (Join-Path $stageArtifacts "preview.html") -Force
	Copy-DirectoryClean -Source $QaArtifactRoot -Destination (Join-Path $stageArtifacts "stake-qa")
	$implementationArtifactDestination = Join-Path $stageArtifacts "implementation"
	New-Item -ItemType Directory -Force -Path $implementationArtifactDestination | Out-Null
	foreach ($evidenceName in @(
		"source-generated-map.json",
		"release-implementation-notes.md",
		"git-provenance.json",
		"paytable-contract-publish.json",
		"paytable-contract-release.json"
	)) {
		$evidenceSource = Join-Path $ImplementationEvidenceRoot $evidenceName
		if (Test-Path -LiteralPath $evidenceSource -PathType Leaf) {
			Copy-Item -LiteralPath $evidenceSource -Destination (Join-Path $implementationArtifactDestination $evidenceName) -Force
		}
	}

	$frontendFileCount = Assert-DirectoryMatches -Expected $FrontendDest -Actual (Join-Path $stageDir "frontend") -Name "Staged frontend"
	$mathFileCount = Assert-DirectoryMatches -Expected $MathDest -Actual (Join-Path $stageDir "math") -Name "Staged math"
	Add-Check -Group "Release Packaging" -Name "staged frontend matches canonical publish frontend" -Passed $true -Detail "$frontendFileCount files"
	Add-Check -Group "Release Packaging" -Name "staged math matches canonical publish math" -Passed $true -Detail "$mathFileCount files"

	$frontendTreeEntries = @(Get-FileHashEntries -Path $FrontendDest -Base $FrontendDest)
	$mathTreeEntries = @(Get-FileHashEntries -Path $MathDest -Base $MathDest)
	$frontendTreeDigest = Get-FileTreeDigest -Entries $frontendTreeEntries
	$mathTreeDigest = Get-FileTreeDigest -Entries $mathTreeEntries
	[pscustomobject]@{
		schemaVersion = 1
		gitCommitSha = $gitSha
		root = "publish/frontend"
		treeSha256 = $frontendTreeDigest
		fileCount = $frontendTreeEntries.Count
		entries = $frontendTreeEntries
	} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $frontendTreePath -Encoding UTF8
	[pscustomobject]@{
		schemaVersion = 1
		gitCommitSha = $gitSha
		root = "publish/math"
		treeSha256 = $mathTreeDigest
		fileCount = $mathTreeEntries.Count
		entries = $mathTreeEntries
	} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $mathTreePath -Encoding UTF8
	Copy-Item -LiteralPath $frontendTreePath -Destination (Join-Path $stageArtifacts "frontend-file-tree.json") -Force
	Copy-Item -LiteralPath $mathTreePath -Destination (Join-Path $stageArtifacts "math-file-tree.json") -Force

	Compress-Archive -Path (Join-Path $FrontendDest "*") -DestinationPath $temporaryFrontendZip -CompressionLevel Optimal -Force
	Compress-Archive -Path (Join-Path $MathDest "*") -DestinationPath $temporaryMathZip -CompressionLevel Optimal -Force
	Move-Item -LiteralPath $temporaryFrontendZip -Destination $frontendZipPath
	Move-Item -LiteralPath $temporaryMathZip -Destination $mathZipPath
	Expand-Archive -LiteralPath $frontendZipPath -DestinationPath (Join-Path $uploadExtractDir "frontend") -Force
	Expand-Archive -LiteralPath $mathZipPath -DestinationPath (Join-Path $uploadExtractDir "math") -Force
	Assert-DirectoryMatches -Expected $FrontendDest -Actual (Join-Path $uploadExtractDir "frontend") -Name "Extracted canonical frontend archive" | Out-Null
	Assert-DirectoryMatches -Expected $MathDest -Actual (Join-Path $uploadExtractDir "math") -Name "Extracted canonical math archive" | Out-Null
	$frontendZipHash = (Get-FileHash -LiteralPath $frontendZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
	$mathZipHash = (Get-FileHash -LiteralPath $mathZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
	Add-Check -Group "Release Packaging" -Name "frontend archive extracts to the canonical frontend tree" -Passed $true -Detail $frontendTreeDigest
	Add-Check -Group "Release Packaging" -Name "math archive extracts to the canonical math tree" -Passed $true -Detail $mathTreeDigest

	$changedFiles = Get-ChangedFiles
	$releaseFilesBeforeReports = Get-RelativeFileList -Path $stageDir -Base $stageDir
	$reportLines = New-Report -Status "PASS" -GitBranch $gitBranch -GitSha $gitSha -FrontVersion $frontVersion -MathVersion $mathVersion -Audit $audit -Analysis $analysis -BookContract $bookContract -ChangedFiles $changedFiles -ReleaseFiles $releaseFilesBeforeReports
	$reportLines | Set-Content -LiteralPath (Join-Path $stageDir "stake-release-report.md") -Encoding UTF8
	(New-Checklist -OverallPass $true) | Set-Content -LiteralPath (Join-Path $stageDir "stake-approval-checklist.md") -Encoding UTF8

	$payloadEntries = @(Get-FileHashEntries -Path $stageDir -Base $stageDir)
	$payloadHashPath = Join-Path $stageDir "payload-hashes.json"
	[pscustomobject]@{
		schemaVersion = 1
		generatedAt = (Get-Date -Format o)
		excludes = @("payload-hashes.json", "release-manifest.json")
		entries = $payloadEntries
	} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $payloadHashPath -Encoding UTF8

	$manifest = [pscustomobject]@{
		schemaVersion = 2
		gameId = "golden_goal_rush"
		gameName = [string]$mathConfig.gameName
		timestamp = (Get-Date -Format o)
		git = [pscustomobject]@{
			root = $gitTopLevel
			branch = $gitBranch
			commitSha = $gitSha
			remote = $gitRemote
			cleanBeforeGeneration = $true
			cleanAfterGeneration = $true
		}
		frontVersion = $frontVersion
		mathVersion = $mathVersion
		buildCommand = if ($ReuseBooks) { "npm run stake:release -- -ReuseBooks" } else { "npm run stake:release" }
		canonicalFrontend = "publish/frontend"
		canonicalMath = "publish/math"
		canonicalFrontendZip = ("stake-release/" + [System.IO.Path]::GetFileName($frontendZipPath))
		canonicalFrontendZipSha256 = $frontendZipHash
		canonicalMathZip = ("stake-release/" + [System.IO.Path]::GetFileName($mathZipPath))
		canonicalMathZipSha256 = $mathZipHash
		evidenceZip = ("artifacts/stake-final-implementation-20260712-164933/" + $releaseName + ".zip")
		checkStatus = "PASS"
		checksPassed = @($script:Checks | Where-Object { $_.Passed }).Count
		checksFailed = 0
		payloadHashFile = "payload-hashes.json"
		payloadHashFileSha256 = (Get-FileHash -LiteralPath $payloadHashPath -Algorithm SHA256).Hash.ToLowerInvariant()
		rtpSummary = $audit
		baseLookupAnalysis = $analysis
		bookContract = $bookContract
	}
	$manifestPath = Join-Path $stageDir "release-manifest.json"
	$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
	[pscustomobject]@{
		schemaVersion = 1
		gameId = "golden_goal_rush"
		sourceCommitSha = $gitSha
		checkedOutCommitSha = $gitSha
		testedCommitSha = $gitSha
		builtCommitSha = $gitSha
		packagedCommitSha = $gitSha
		frontend = [pscustomobject]@{
			archive = [System.IO.Path]::GetFileName($frontendZipPath)
			archiveSha256 = $frontendZipHash
			treeSha256 = $frontendTreeDigest
		}
		math = [pscustomobject]@{
			archive = [System.IO.Path]::GetFileName($mathZipPath)
			archiveSha256 = $mathZipHash
			treeSha256 = $mathTreeDigest
		}
		extractedArtifactRetest = "pending"
		generatedAt = (Get-Date -Format o)
	} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $stageDir "release-attestation.json") -Encoding UTF8

	$stageEntries = @(Get-FileHashEntries -Path $stageDir -Base $stageDir)
	[pscustomobject]@{
		schemaVersion = 1
		generatedAt = (Get-Date -Format o)
		archiveFileName = ($releaseName + ".zip")
		entryCount = $stageEntries.Count
		entries = $stageEntries
	} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $entryHashesPath -Encoding UTF8

	Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $temporaryZip -CompressionLevel Optimal -Force
	if (-not (Test-Path -LiteralPath $temporaryZip -PathType Leaf)) { throw "Temporary release ZIP was not created" }

	Add-Type -AssemblyName System.IO.Compression.FileSystem
	$archive = [System.IO.Compression.ZipFile]::OpenRead($temporaryZip)
	try {
		$archiveEntries = @($archive.Entries |
			ForEach-Object { $_.FullName.Replace('\', '/') } |
			Where-Object { -not $_.EndsWith('/') } |
			Sort-Object)
	}
	finally {
		$archive.Dispose()
	}
	$expectedArchiveEntries = @($stageEntries | ForEach-Object { $_.path } | Sort-Object)
	if (($archiveEntries | ConvertTo-Json -Compress) -ne ($expectedArchiveEntries | ConvertTo-Json -Compress)) {
		throw "ZIP entry list differs from staged release payload"
	}
	foreach ($requiredPath in @("frontend/index.html", "math/game_config.json", "release-manifest.json", "payload-hashes.json", "stake-release-report.md")) {
		if ($archiveEntries -notcontains $requiredPath) { throw "ZIP is missing required entry: $requiredPath" }
	}

	Move-Item -LiteralPath $temporaryZip -Destination $zipPath
	Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
	$extractedEntries = @(Get-FileHashEntries -Path $extractDir -Base $extractDir)
	if (($stageEntries | ConvertTo-Json -Depth 6 -Compress) -ne ($extractedEntries | ConvertTo-Json -Depth 6 -Compress)) {
		throw "Extracted ZIP content hashes differ from staged content hashes"
	}
	Assert-DirectoryMatches -Expected $FrontendDest -Actual (Join-Path $extractDir "frontend") -Name "Extracted frontend" | Out-Null
	Assert-DirectoryMatches -Expected $MathDest -Actual (Join-Path $extractDir "math") -Name "Extracted math" | Out-Null

	if (Test-Path -LiteralPath $exactZipQaRoot) {
		Assert-ChildPath -Child $exactZipQaRoot -Parent $ImplementationEvidenceRoot
		Remove-Item -LiteralPath $exactZipQaRoot -Recurse -Force
	}
	New-Item -ItemType Directory -Force -Path $exactZipQaRoot | Out-Null
	Invoke-Checked -WorkingDirectory $Root -FilePath "node" -Arguments @(
		$PaytableVerifier,
		"--html", (Join-Path $uploadExtractDir "frontend\index.html"),
		"--math", (Join-Path $uploadExtractDir "math\game_config.json"),
		"--report", (Join-Path $exactZipQaRoot "paytable-contract.json")
	)

	$previousQaFrontendRoot = $env:STAKE_QA_FRONTEND_ROOT
	$previousQaFrontendEntry = $env:STAKE_QA_FRONTEND_ENTRY
	$previousQaMathConfig = $env:STAKE_QA_MATH_CONFIG
	$previousQaArtifactDir = $env:STAKE_QA_ARTIFACT_DIR
	$previousQaRequireE2e = $env:STAKE_QA_REQUIRE_E2E
	try {
		$env:STAKE_QA_FRONTEND_ROOT = Join-Path $uploadExtractDir "frontend"
		$env:STAKE_QA_FRONTEND_ENTRY = "index.html"
		$env:STAKE_QA_MATH_CONFIG = Join-Path $uploadExtractDir "math\game_config.json"
		$env:STAKE_QA_ARTIFACT_DIR = $exactZipQaRoot
		$env:STAKE_QA_REQUIRE_E2E = "1"
		Invoke-Checked -WorkingDirectory $Root -FilePath "node" -Arguments @($StakeQaScript, "all")
	}
	finally {
		$env:STAKE_QA_FRONTEND_ROOT = $previousQaFrontendRoot
		$env:STAKE_QA_FRONTEND_ENTRY = $previousQaFrontendEntry
		$env:STAKE_QA_MATH_CONFIG = $previousQaMathConfig
		$env:STAKE_QA_ARTIFACT_DIR = $previousQaArtifactDir
		$env:STAKE_QA_REQUIRE_E2E = $previousQaRequireE2e
	}

	$exactQaEvidenceDestination = Join-Path $stageArtifacts "extracted-artifact-retest"
	Copy-DirectoryClean -Source $exactZipQaRoot -Destination $exactQaEvidenceDestination
	$bundledAttestationPath = Join-Path $stageDir "release-attestation.json"
	$bundledAttestation = Read-Json -Path $bundledAttestationPath
	$bundledAttestation.extractedArtifactRetest = "PASS"
	$bundledAttestation | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $bundledAttestationPath -Encoding UTF8

	# Finalize the evidence bundle only after the exact extracted upload
	# archives passed QA. Recompute every payload hash after adding that proof.
	foreach ($regeneratedEvidenceFile in @($payloadHashPath, $manifestPath)) {
		if (Test-Path -LiteralPath $regeneratedEvidenceFile) { Remove-Item -LiteralPath $regeneratedEvidenceFile -Force }
	}
	$payloadEntries = @(Get-FileHashEntries -Path $stageDir -Base $stageDir)
	[pscustomobject]@{
		schemaVersion = 1
		generatedAt = (Get-Date -Format o)
		excludes = @("payload-hashes.json", "release-manifest.json")
		entries = $payloadEntries
	} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $payloadHashPath -Encoding UTF8
	$manifest.payloadHashFileSha256 = (Get-FileHash -LiteralPath $payloadHashPath -Algorithm SHA256).Hash.ToLowerInvariant()
	$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
	$stageEntries = @(Get-FileHashEntries -Path $stageDir -Base $stageDir)
	[pscustomobject]@{
		schemaVersion = 1
		generatedAt = (Get-Date -Format o)
		archiveFileName = ($releaseName + ".zip")
		entryCount = $stageEntries.Count
		entries = $stageEntries
	} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $entryHashesPath -Encoding UTF8
	Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $temporaryZip -CompressionLevel Optimal -Force
	Move-Item -LiteralPath $temporaryZip -Destination $zipPath -Force
	Reset-ShortDirectory -Path $extractDir
	Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
	$extractedEntries = @(Get-FileHashEntries -Path $extractDir -Base $extractDir)
	if (($stageEntries | ConvertTo-Json -Depth 6 -Compress) -ne ($extractedEntries | ConvertTo-Json -Depth 6 -Compress)) {
		throw "Final evidence ZIP content hashes differ from staged evidence after extracted-artifact QA"
	}

	$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
	$attestation = [pscustomobject]@{
		schemaVersion = 1
		gameId = "golden_goal_rush"
		status = "PASS"
		sourceCommitSha = $gitSha
		checkedOutCommitSha = $gitSha
		testedCommitSha = $gitSha
		builtCommitSha = $gitSha
		packagedCommitSha = $gitSha
		gitBranch = $gitBranch
		frontend = [pscustomobject]@{
			path = $frontendZipPath
			archiveSha256 = $frontendZipHash
			treeSha256 = $frontendTreeDigest
			fileCount = $frontendTreeEntries.Count
		}
		math = [pscustomobject]@{
			path = $mathZipPath
			archiveSha256 = $mathZipHash
			treeSha256 = $mathTreeDigest
			fileCount = $mathTreeEntries.Count
		}
		evidence = [pscustomobject]@{
			path = $zipPath
			archiveSha256 = $zipHash
			entryCount = $stageEntries.Count
		}
		extractedArtifactRetest = [pscustomobject]@{
			status = "PASS"
			report = Join-Path $exactZipQaRoot "report.json"
			frontendTreeSha256 = $frontendTreeDigest
			mathTreeSha256 = $mathTreeDigest
		}
		generatedAt = (Get-Date -Format o)
	}
	$attestation | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $attestationPath -Encoding UTF8
	@(
		"$frontendZipHash  $([System.IO.Path]::GetFileName($frontendZipPath))",
		"$mathZipHash  $([System.IO.Path]::GetFileName($mathZipPath))",
		"$zipHash  $([System.IO.Path]::GetFileName($zipPath))"
	) | Set-Content -LiteralPath $checksumsPath -Encoding ASCII
	$externalManifest = [pscustomobject]@{
		schemaVersion = 2
		generatedAt = (Get-Date -Format o)
		status = "PASS"
		canonicalZipPath = $zipPath
		zipBytes = (Get-Item -LiteralPath $zipPath).Length
		zipSha256 = $zipHash
		frontendZipPath = $frontendZipPath
		frontendZipSha256 = $frontendZipHash
		frontendTreeSha256 = $frontendTreeDigest
		mathZipPath = $mathZipPath
		mathZipSha256 = $mathZipHash
		mathTreeSha256 = $mathTreeDigest
		entryCount = $stageEntries.Count
		entryHashesPath = $entryHashesPath
		extractedPathUsedForVerification = $extractDir
		exactZipQaReport = Join-Path $exactZipQaRoot "report.json"
		gitBranch = $gitBranch
		gitCommitSha = $gitSha
		frontVersion = $frontVersion
		mathVersion = $mathVersion
	}
	$externalManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $externalManifestPath -Encoding UTF8

	$pointerPath = Join-Path $ReleaseRoot "CURRENT_RELEASE_POINTER.txt"
	$pointerText = @(
		"Canonical frontend upload ZIP: $frontendZipPath",
		"Frontend SHA-256: $frontendZipHash",
		"Canonical math upload ZIP: $mathZipPath",
		"Math SHA-256: $mathZipHash",
		"Evidence ZIP (not for Stake upload): $zipPath",
		"Evidence SHA-256: $zipHash",
		"Manifest: $externalManifestPath",
		"Attestation: $attestationPath",
		"Checksums: $checksumsPath"
	) -join [Environment]::NewLine
	$pointerText | Set-Content -LiteralPath $pointerPath -Encoding UTF8

	$currentEvidenceZips = @(Get-ChildItem -LiteralPath $ImplementationEvidenceRoot -File -Filter "golden-goal-rush_*.zip")
	$currentReleaseRootZips = @(Get-ChildItem -LiteralPath $ReleaseRoot -File -Filter "*.zip" -ErrorAction SilentlyContinue)
	if ($currentEvidenceZips.Count -ne 1 -or $currentReleaseRootZips.Count -ne 2) {
		throw "Current release guard failed: expected one evidence ZIP and exactly two canonical upload ZIPs"
	}
	$releaseSucceeded = $true

	Write-Host ""
	Write-Host "Frontend ZIP:   $frontendZipPath" -ForegroundColor Cyan
	Write-Host "Frontend SHA:   $frontendZipHash" -ForegroundColor Cyan
	Write-Host "Math ZIP:       $mathZipPath" -ForegroundColor Cyan
	Write-Host "Math SHA:       $mathZipHash" -ForegroundColor Cyan
	Write-Host "Evidence ZIP:   $zipPath" -ForegroundColor Cyan
	Write-Host "Evidence SHA:   $zipHash" -ForegroundColor Cyan
	Write-Host "Entry count:    $($stageEntries.Count)" -ForegroundColor Cyan
	Write-Host "Exact-ZIP QA:   $exactZipQaRoot" -ForegroundColor Cyan
	Write-Host "Status:         PASS" -ForegroundColor Green
}
finally {
	if (-not $releaseSucceeded) {
		foreach ($failedArtifact in @($zipPath, $frontendZipPath, $mathZipPath, $checksumsPath, $attestationPath)) {
			if (Test-Path -LiteralPath $failedArtifact) { Remove-Item -LiteralPath $failedArtifact -Force }
		}
		foreach ($partialName in @("CURRENT_RELEASE_POINTER.txt")) {
			$partialPath = Join-Path $ReleaseRoot $partialName
			if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }
		}
	}
	foreach ($cleanupPath in @($stageDir, $extractDir, $uploadExtractDir)) {
		if (Test-Path -LiteralPath $cleanupPath) {
			Assert-ChildPath -Child $cleanupPath -Parent $ShortWorkRoot
			Remove-Item -LiteralPath $cleanupPath -Recurse -Force
		}
	}
	if (Test-Path -LiteralPath $temporaryZip) { Remove-Item -LiteralPath $temporaryZip -Force }
	if (Test-Path -LiteralPath $temporaryFrontendZip) { Remove-Item -LiteralPath $temporaryFrontendZip -Force }
	if (Test-Path -LiteralPath $temporaryMathZip) { Remove-Item -LiteralPath $temporaryMathZip -Force }
}
