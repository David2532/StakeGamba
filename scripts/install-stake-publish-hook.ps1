$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$HookPath = Join-Path $Root ".git\hooks\pre-push"
$HookDir = Split-Path -Parent $HookPath
$PowerShellExe = Join-Path $PSHOME "powershell.exe"
$PowerShellHookPath = $PowerShellExe -replace "\\", "/"

if (-not (Test-Path -LiteralPath (Join-Path $Root ".git"))) {
	throw "This script must be run from a Git worktree."
}

New-Item -ItemType Directory -Force -Path $HookDir | Out-Null

$marker = "StakeGamba stake publish sync"
if (Test-Path -LiteralPath $HookPath) {
	$current = Get-Content -Raw -LiteralPath $HookPath
	if ($current -notmatch [regex]::Escape($marker)) {
		$backup = "$HookPath.backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
		Copy-Item -LiteralPath $HookPath -Destination $backup -Force
		Write-Host "Backed up existing pre-push hook to $backup"
	}
}

$hook = @"
#!/bin/sh
# $marker
repo_root=`$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "`$repo_root" ]; then
  echo "Could not resolve repository root; skipping Stake publish sync." >&2
  exit 1
fi

cd "`$repo_root" || exit 1
"$PowerShellHookPath" -NoProfile -ExecutionPolicy Bypass -File "`$repo_root/scripts/sync-stake-publish.ps1"
status=`$?
if [ `$status -ne 0 ]; then
  echo "Stake publish sync failed; push aborted." >&2
  exit `$status
fi
"@

Set-Content -LiteralPath $HookPath -Value $hook -Encoding ASCII

try {
	& git update-index --chmod=+x -- $HookPath 2>$null | Out-Null
}
catch {
	# Hooks are not tracked; executable mode is best-effort on Windows.
}

Write-Host "Installed pre-push hook: $HookPath"
