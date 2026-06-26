param(
	[switch]$RefreshMath,
	[switch]$BuildFrontend,
	[switch]$SkipFrontendStalenessCheck,
	[switch]$CheckMathStaleness,
	[switch]$SkipMathStalenessCheck
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PublishRoot = Join-Path $Root "publish\golden-goal-rush"
$FrontendSource = Join-Path $Root "apps\lines\build"
$FrontendDest = Join-Path $PublishRoot "frontend"
$MathRoot = Join-Path $Root "math\games\golden_goal_rush"
$MathPublish = Join-Path $MathRoot "library\publish_files"
$MathDest = Join-Path $PublishRoot "math"
$MathZip = Join-Path $MathDest "golden-goal-rush-math-upload.zip"

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

	$publishFiles = @(
		Join-Path $MathPublish "index.json"
		Join-Path $MathRoot "library\configs\game_config.json"
		Join-Path $MathRoot "library\lookup_tables\base_lookup.csv"
		Join-Path $MathRoot "library\lookup_tables\bonus_lookup.csv"
		Join-Path $MathRoot "library\books_compressed\base_books.jsonl.zst"
		Join-Path $MathRoot "library\books_compressed\bonus_books.jsonl.zst"
		Join-Path $MathPublish "README_UPLOAD.txt"
	) | ForEach-Object { Get-Item -LiteralPath $_ }

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

function Test-FrontendBuildFresh {
	$buildIndex = Join-Path $FrontendSource "index.html"
	if (-not (Test-Path -LiteralPath $buildIndex)) {
		throw "Frontend build index is missing: $buildIndex"
	}

	$sourceRoots = @(
		Join-Path $Root "apps\lines\src"
		Join-Path $Root "apps\lines\static"
		Join-Path $Root "packages"
	)

	$sourceFiles = foreach ($sourceRoot in $sourceRoots) {
		if (Test-Path -LiteralPath $sourceRoot) {
			Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
				Where-Object { $_.FullName -notlike "*\node_modules\*" }
		}
	}

	foreach ($file in @("package.json", "vite.config.js", "svelte.config.js", "tsconfig.json")) {
		$path = Join-Path $Root "apps\lines\$file"
		if (Test-Path -LiteralPath $path) {
			$sourceFiles += Get-Item -LiteralPath $path
		}
	}

	$newestSource = Get-NewestFile -Files $sourceFiles
	$buildFile = Get-Item -LiteralPath $buildIndex
	if ($newestSource -and $newestSource.LastWriteTimeUtc -gt $buildFile.LastWriteTimeUtc) {
		throw @"
Frontend build looks stale.
Newest frontend/package source: $($newestSource.FullName)
Build index: $($buildFile.FullName)

Rebuild apps/lines before pushing, then rerun:
  npm run stake:publish

The optional auto-build path exists but is disabled for pre-push because Vite currently hangs after writing apps/lines/build in this workspace:
  npm run stake:publish:build-frontend
"@
	}
}

function New-MathZip {
	New-Item -ItemType Directory -Force -Path $MathDest | Out-Null
	if (Test-Path -LiteralPath $MathZip) {
		Remove-Item -LiteralPath $MathZip -Force
	}

	$entries = @(
		@{ Source = Join-Path $MathPublish "index.json"; Entry = "index.json" }
		@{ Source = Join-Path $MathRoot "library\configs\game_config.json"; Entry = "game_config.json" }
		@{ Source = Join-Path $MathRoot "library\lookup_tables\base_lookup.csv"; Entry = "base_lookup.csv" }
		@{ Source = Join-Path $MathRoot "library\lookup_tables\bonus_lookup.csv"; Entry = "bonus_lookup.csv" }
		@{ Source = Join-Path $MathRoot "library\books_compressed\base_books.jsonl.zst"; Entry = "base_books.jsonl.zst" }
		@{ Source = Join-Path $MathRoot "library\books_compressed\bonus_books.jsonl.zst"; Entry = "bonus_books.jsonl.zst" }
		@{ Source = Join-Path $MathPublish "README_UPLOAD.txt"; Entry = "README_UPLOAD.txt" }
	)

	foreach ($entry in $entries) {
		if (-not (Test-Path -LiteralPath $entry.Source)) {
			throw "Missing math publish file: $($entry.Source)"
		}
	}

	Add-Type -AssemblyName System.IO.Compression
	Add-Type -AssemblyName System.IO.Compression.FileSystem
	$zip = [System.IO.Compression.ZipFile]::Open($MathZip, [System.IO.Compression.ZipArchiveMode]::Create)
	try {
		foreach ($entry in $entries) {
			[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
				$zip,
				$entry.Source,
				$entry.Entry,
				[System.IO.Compression.CompressionLevel]::Optimal
			) | Out-Null
		}
	}
	finally {
		$zip.Dispose()
	}
}

Write-Host "Syncing Stake publish snapshot..."

if ($BuildFrontend) {
	$vite = Join-Path $Root "apps\lines\node_modules\vite\bin\vite.js"
	if (-not (Test-Path -LiteralPath $vite)) {
		throw "Missing local Vite entrypoint: $vite"
	}
	Write-Host "Building frontend: apps/lines"
	Invoke-CommandChecked -WorkingDirectory (Join-Path $Root "apps\lines") -FilePath "node" -Arguments @($vite, "build")
}

if (-not (Test-Path -LiteralPath $FrontendSource)) {
	throw "Frontend build folder is missing: $FrontendSource"
}

if (-not $SkipFrontendStalenessCheck) {
	Test-FrontendBuildFresh
}

if ($RefreshMath) {
	Write-Host "Refreshing math publish files"
	Invoke-CommandChecked -WorkingDirectory $MathRoot -FilePath "python" -Arguments @("run.py", "publish", "--spins", "80000", "--bonus-spins", "40000", "--seed", "1")
}
elseif (-not $SkipMathStalenessCheck) {
	if ($CheckMathStaleness) {
		Test-MathPublishFresh
	}
}

New-Item -ItemType Directory -Force -Path $PublishRoot | Out-Null
Reset-Directory -Path $FrontendDest
Reset-Directory -Path $MathDest

Write-Host "Copying frontend build"
Copy-Item -Path (Join-Path $FrontendSource "*") -Destination $FrontendDest -Recurse -Force

Write-Host "Packing math upload ZIP"
New-MathZip

foreach ($file in @("README_UPLOAD.txt", "UPLOAD_GUIDE.txt", "RTP_AUDIT.json", "RTP_AUDIT.txt", "index.json")) {
	$source = Join-Path $MathPublish $file
	if (Test-Path -LiteralPath $source) {
		Copy-Item -LiteralPath $source -Destination (Join-Path $MathDest $file) -Force
	}
}

$readme = @"
Golden Goal Rush Stake publish snapshot
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss K")

Frontend upload:
  $FrontendDest

Math upload:
  $MathZip

Stake Engine notes:
- Upload the complete frontend folder, not source files.
- Upload the math ZIP as the math package.
- This publish/ folder is generated locally and ignored by Git.
"@

Set-Content -LiteralPath (Join-Path $PublishRoot "UPLOAD_README.txt") -Value $readme -Encoding UTF8

Write-Host "Stake publish snapshot ready:"
Write-Host "  Frontend: $FrontendDest"
Write-Host "  Math:     $MathZip"
