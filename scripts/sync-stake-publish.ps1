param(
	[switch]$RefreshMath,
	[switch]$BuildFrontend,
	[switch]$SkipFrontendStalenessCheck,
	[switch]$CheckMathStaleness,
	[switch]$SkipMathStalenessCheck
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PublishRoot = Join-Path $Root "publish"
$LegacyPublishRoot = Join-Path $PublishRoot "golden-goal-rush"
$FrontendSource = Join-Path $Root "apps\lines\build"
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

function Test-FrontendUploadContents {
	$requiredFiles = @(
		"index.html",
		"favicon.svg",
		"loader.gif",
		"stake-engine-loader.gif"
	)
	$requiredDirs = @(
		"_app",
		"assets",
		"assets\golden-goal-rush"
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
}

function Test-MathUploadContents {
	$expected = @(
		"index.json",
		"game_config.json",
		"base_lookup.csv",
		"bonus_lookup.csv",
		"base_books.jsonl.zst",
		"bonus_books.jsonl.zst"
	)

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
	$entries = @(
		@{ Source = Join-Path $MathPublish "index.json"; Name = "index.json" }
		@{ Source = Join-Path $MathRoot "library\configs\game_config.json"; Name = "game_config.json" }
		@{ Source = Join-Path $MathRoot "library\lookup_tables\base_lookup.csv"; Name = "base_lookup.csv" }
		@{ Source = Join-Path $MathRoot "library\lookup_tables\bonus_lookup.csv"; Name = "bonus_lookup.csv" }
		@{ Source = Join-Path $MathRoot "library\books_compressed\base_books.jsonl.zst"; Name = "base_books.jsonl.zst" }
		@{ Source = Join-Path $MathRoot "library\books_compressed\bonus_books.jsonl.zst"; Name = "bonus_books.jsonl.zst" }
		@{ Source = Join-Path $MathPublish "README_UPLOAD.txt"; Name = "README_UPLOAD.txt" }
		@{ Source = Join-Path $MathPublish "UPLOAD_GUIDE.txt"; Name = "UPLOAD_GUIDE.txt" }
		@{ Source = Join-Path $MathPublish "RTP_AUDIT.json"; Name = "RTP_AUDIT.json" }
		@{ Source = Join-Path $MathPublish "RTP_AUDIT.txt"; Name = "RTP_AUDIT.txt" }
	)

	foreach ($entry in $entries) {
		if (-not (Test-Path -LiteralPath $entry.Source)) {
			throw "Missing math publish file: $($entry.Source)"
		}
		Copy-Item -LiteralPath $entry.Source -Destination (Join-Path $MathDest $entry.Name) -Force
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
if (Test-Path -LiteralPath $LegacyPublishRoot) {
	Assert-ChildPath -Child $LegacyPublishRoot -Parent $PublishRoot
	Remove-Item -LiteralPath $LegacyPublishRoot -Recurse -Force
}
Reset-Directory -Path $FrontendDest
Reset-Directory -Path $MathDest

Write-Host "Copying frontend build"
Copy-Item -Path (Join-Path $FrontendSource "*") -Destination $FrontendDest -Recurse -Force

Write-Host "Copying math upload files"
Copy-MathUploadFiles

Test-FrontendUploadContents
Test-MathUploadContents

Write-Host "Stake publish snapshot ready:"
Write-Host "  Frontend: $FrontendDest"
Write-Host "  Math:     $MathDest"
