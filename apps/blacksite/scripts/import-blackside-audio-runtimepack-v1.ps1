param(
	[Parameter(Mandatory = $true)]
	[string] $ZipPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.IO.Compression.FileSystem

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = [IO.Path]::GetFullPath((Join-Path $scriptRoot '..'))
$selectionPath = Join-Path $appRoot 'art/audio/runtimepack-v1/selection.json'
$selection = Get-Content -Raw -LiteralPath $selectionPath | ConvertFrom-Json
$zipAbsolute = [IO.Path]::GetFullPath($ZipPath)

if (-not (Test-Path -LiteralPath $zipAbsolute -PathType Leaf)) {
	throw "RuntimePack ZIP not found: $zipAbsolute"
}

$archiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipAbsolute).Hash.ToLowerInvariant()
if ($archiveHash -ne $selection.sourceArchive.sha256) {
	throw "RuntimePack ZIP hash mismatch: expected $($selection.sourceArchive.sha256), got $archiveHash"
}

$artRoot = Join-Path $appRoot 'art/audio/runtimepack-v1'
$selectedSourceRoot = Join-Path $artRoot 'selected-originals'
$runtimePhysicalRoot = Join-Path $appRoot 'static/assets/blacksite/v29/audio'
$expectedTargets = @{
	$selectedSourceRoot = 'art/audio/runtimepack-v1/selected-originals'
	$runtimePhysicalRoot = 'static/assets/blacksite/v29/audio'
}

function Assert-ExactWorkspaceTarget([string] $Target, [string] $ExpectedRelative) {
	$resolved = [IO.Path]::GetFullPath($Target)
	$relative = [IO.Path]::GetRelativePath($appRoot, $resolved).Replace('\', '/')
	if ($relative -ne $ExpectedRelative) {
		throw "Refusing unexpected output target: $resolved ($relative)"
	}
	if (-not $resolved.StartsWith($appRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
		throw "Refusing output outside app root: $resolved"
	}
	if (Test-Path -LiteralPath $resolved) {
		$item = Get-Item -LiteralPath $resolved -Force
		if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
			throw "Refusing linked output target: $resolved"
		}
	}
}

foreach ($target in $expectedTargets.Keys) {
	Assert-ExactWorkspaceTarget $target $expectedTargets[$target]
	if (Test-Path -LiteralPath $target) {
		Remove-Item -LiteralPath $target -Recurse -Force
	}
	New-Item -ItemType Directory -Path $target -Force | Out-Null
}

function Write-Utf8NoBom([string] $Path, [string] $Text) {
	$parent = Split-Path -Parent $Path
	New-Item -ItemType Directory -Path $parent -Force | Out-Null
	[IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}

function Read-ZipText($Entry) {
	$stream = $Entry.Open()
	$reader = [IO.StreamReader]::new($stream)
	try { return $reader.ReadToEnd() } finally { $reader.Dispose(); $stream.Dispose() }
}

function Copy-ZipEntry($Entry, [string] $Destination) {
	$parent = Split-Path -Parent $Destination
	New-Item -ItemType Directory -Path $parent -Force | Out-Null
	$input = $Entry.Open()
	$output = [IO.File]::Open($Destination, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
	try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
}

$archive = [IO.Compression.ZipFile]::OpenRead($zipAbsolute)
try {
	$archiveRoot = "$($selection.sourceArchive.expectedRoot)/"
	$entries = @{}
	foreach ($entry in $archive.Entries) {
		if ([string]::IsNullOrWhiteSpace($entry.Name)) { continue }
		if (-not $entry.FullName.StartsWith($archiveRoot, [StringComparison]::Ordinal)) {
			throw "Unexpected archive root: $($entry.FullName)"
		}
		$relative = $entry.FullName.Substring($archiveRoot.Length)
		if ($relative.Contains('\') -or $relative.StartsWith('/') -or $relative.Contains('../') -or $relative.Contains(':')) {
			throw "Unsafe archive path: $relative"
		}
		$entries[$relative] = $entry
	}

	$sourceManifestEntry = $entries[$selection.sourceManifestPath]
	if ($null -eq $sourceManifestEntry) { throw "Source manifest missing from ZIP" }
	$sourceManifestText = Read-ZipText $sourceManifestEntry
	$sourceManifest = $sourceManifestText | ConvertFrom-Json
	$sourceManifestHash = [Convert]::ToHexString(
		[Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($sourceManifestText))
	).ToLowerInvariant()

	$fileRecords = @{}
	$cueRecords = @()
	foreach ($cue in $selection.cues) {
		$eventProperty = $sourceManifest.events.PSObject.Properties[$cue.sourceEvent]
		if ($null -eq $eventProperty) { throw "Missing direct source event: $($cue.sourceEvent)" }
		$sourceEvent = $eventProperty.Value
		$runtimeFiles = @()
		foreach ($variantIndex in $cue.variantIndexes) {
			$index = [int] $variantIndex
			$variants = @($sourceEvent.variants)
			if ($index -lt 0 -or $index -ge $variants.Count) {
				throw "Invalid variant index $index for $($cue.sourceEvent)"
			}
			$variant = $variants[$index]
			$sourceFile = [string] $variant.file
			$audioPrefix = '01_RUNTIME_READY/audio/'
			if (-not $sourceFile.StartsWith($audioPrefix, [StringComparison]::Ordinal)) {
				throw "Selected file is outside runtime audio: $sourceFile"
			}
			$audioRelative = $sourceFile.Substring($audioPrefix.Length)
			$runtimePath = "$($selection.runtimeRoot)/$audioRelative"
			$runtimeFiles += $runtimePath

			if (-not $fileRecords.ContainsKey($sourceFile)) {
				$entry = $entries[$sourceFile]
				if ($null -eq $entry) { throw "Selected ZIP entry missing: $sourceFile" }
				$sourceDestination = Join-Path $selectedSourceRoot ($audioRelative.Replace('/', [IO.Path]::DirectorySeparatorChar))
				$runtimeDestination = Join-Path $runtimePhysicalRoot ($audioRelative.Replace('/', [IO.Path]::DirectorySeparatorChar))
				Copy-ZipEntry $entry $sourceDestination
				Copy-ZipEntry $entry $runtimeDestination
				$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $runtimeDestination).Hash.ToLowerInvariant()
				if ($actualHash -ne ([string] $variant.sha256).ToLowerInvariant()) {
					throw "Selected file hash mismatch: $sourceFile"
				}
				if ((Get-Item -LiteralPath $runtimeDestination).Length -ne $entry.Length) {
					throw "Selected file byte mismatch: $sourceFile"
				}
				$fileRecords[$sourceFile] = [ordered]@{
					path = $runtimePath
					sourceFile = $sourceFile
					bytes = [long] $entry.Length
					sha256 = $actualHash
					codec = $variant.codec
					sampleRateHz = [int] $variant.sampleRateHz
					channels = [int] $variant.channels
					durationMs = [double] $variant.durationMs
				}
			}
		}
		$cueRecords += [ordered]@{
			cueId = $cue.cueId
			sourceEvent = $cue.sourceEvent
			bus = $cue.bus
			bank = $cue.bank
			priority = [int] $cue.priority
			pan = [double] $cue.pan
			loop = [bool] $cue.loop
			protected = [bool] $cue.protected
			duck = $cue.duck
			runtimeFiles = $runtimeFiles
		}
	}

	$orderedFiles = @($fileRecords.Values | Sort-Object { $_['path'] })
	$runtimeBytes = [long] (($orderedFiles | ForEach-Object { [long] $_['bytes'] } | Measure-Object -Sum).Sum)
	$criticalPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
	foreach ($cue in $cueRecords | Where-Object { $_.bank -eq 'critical' }) {
		foreach ($path in $cue.runtimeFiles) { [void] $criticalPaths.Add($path) }
	}
	$criticalBytes = [long] (($orderedFiles |
		Where-Object { $criticalPaths.Contains([string] $_['path']) } |
		ForEach-Object { [long] $_['bytes'] } |
		Measure-Object -Sum).Sum)
	$typeCounts = [ordered]@{}
	foreach ($group in $orderedFiles | Group-Object { [IO.Path]::GetExtension([string] $_['path']).ToLowerInvariant() } | Sort-Object Name) {
		$typeCounts[$group.Name] = $group.Count
	}
	$runtimeManifest = [ordered]@{
		schema = 'blacksite-audio-runtime-manifest-v29'
		status = 'TECHNICAL_IMPORT_PASS_AUDIBLE_QA_PENDING'
		sourceArchive = [ordered]@{
			fileName = $selection.sourceArchive.fileName
			bytes = [long] (Get-Item -LiteralPath $zipAbsolute).Length
			sha256 = $archiveHash
			manifestSha256 = $sourceManifestHash
			licensePolicy = $sourceManifest.licensePolicy
		}
		runtimeRoot = $selection.runtimeRoot
		budgets = [ordered]@{
			runtimeBytes = $runtimeBytes
			criticalRuntimeBytes = $criticalBytes
			hardMaxRuntimeBytes = [long] $selection.selectionPolicy.assetBudgetBytes
			pass = $runtimeBytes -le [long] $selection.selectionPolicy.assetBudgetBytes
		}
		typeCounts = $typeCounts
		cues = $cueRecords
		files = $orderedFiles
		audibleQa = 'PENDING_USER_AND_DEVICE_AUDITION'
	}
	if (-not $runtimeManifest.budgets.pass) {
		throw "Selected runtime audio exceeds its budget: $runtimeBytes"
	}
	$runtimeManifestPath = Join-Path $runtimePhysicalRoot 'audio-manifest.json'
	Write-Utf8NoBom $runtimeManifestPath (($runtimeManifest | ConvertTo-Json -Depth 20) + "`n")
	$catalogData = [ordered]@{
		schema = 'blacksite-audio-runtime-catalog-v29'
		runtimeRoot = $selection.runtimeRoot
		cues = $cueRecords
	}
	$catalogModulePath = Join-Path $appRoot 'src/lib/assets/blacksite-audio-runtimepack-v1.generated.js'
	$catalogModuleText = @"
// Generated by scripts/import-blackside-audio-runtimepack-v1.ps1. Do not edit by hand.
export const BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA = Object.freeze($($catalogData | ConvertTo-Json -Depth 20 -Compress));
"@
	Write-Utf8NoBom $catalogModulePath ($catalogModuleText + "`n")

	$provenanceCopies = [ordered]@{
		'source-audio-manifest.json' = '01_RUNTIME_READY/audio-manifest.json'
		'source-audio-buses.json' = '01_RUNTIME_READY/audio-buses.json'
		'CURATED_ASSET_MAP.csv' = '01_RUNTIME_READY/CURATED_ASSET_MAP.csv'
		'EVENT_CATALOG.csv' = '01_RUNTIME_READY/EVENT_CATALOG.csv'
		'SOURCES.csv' = '03_LICENSES_AND_PROVENANCE/SOURCES.csv'
		'LICENSE_SUMMARY.md' = '03_LICENSES_AND_PROVENANCE/LICENSE_SUMMARY.md'
		'EXCLUDED_SOURCES.md' = '03_LICENSES_AND_PROVENANCE/EXCLUDED_SOURCES.md'
		'CC0-1.0-LEGALCODE.txt' = '03_LICENSES_AND_PROVENANCE/CC0-1.0-LEGALCODE.txt'
	}
	foreach ($copy in $provenanceCopies.GetEnumerator()) {
		$entry = $entries[$copy.Value]
		if ($null -eq $entry) { throw "Provenance entry missing: $($copy.Value)" }
		Copy-ZipEntry $entry (Join-Path $artRoot $copy.Key)
	}

	$report = [ordered]@{
		schema = 'blacksite-audio-runtimepack-import-report-v1'
		status = 'PASS'
		sourceArchive = $runtimeManifest.sourceArchive
		selection = 'apps/blacksite/art/audio/runtimepack-v1/selection.json'
		runtimeManifest = 'apps/blacksite/static/assets/blacksite/v29/audio/audio-manifest.json'
		catalogModule = 'apps/blacksite/src/lib/assets/blacksite-audio-runtimepack-v1.generated.js'
		cueCount = $cueRecords.Count
		fileCount = $orderedFiles.Count
		runtimeBytes = $runtimeBytes
		criticalRuntimeBytes = $criticalBytes
		typeCounts = $typeCounts
		bytePreserved = $true
		audibleQa = $runtimeManifest.audibleQa
	}
	Write-Utf8NoBom (Join-Path $artRoot 'IMPORT_REPORT.json') (($report | ConvertTo-Json -Depth 12) + "`n")
	Write-Output ($report | ConvertTo-Json -Depth 12)
} finally {
	$archive.Dispose()
}
