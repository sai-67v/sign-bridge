#Requires -Version 5.1
<#
.SYNOPSIS
  One-shot: edge setup (venv, optional llama + HF models) then run_edge.

.EXAMPLE
  .\setup-and-run.ps1
  .\setup-and-run.ps1 -InstallLlamaVia winget -SkipModels
#>
param(
  [ValidateSet("github", "winget", "auto")]
  [string]$InstallLlamaVia = "auto",
  [switch]$SkipModels,
  [switch]$SkipLlama
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$setupArgs = @()
if (-not $SkipLlama) { $setupArgs += "-InstallLlama" }
if (-not $SkipModels) { $setupArgs += "-DownloadModels" }

& "$Root\setup-canis-edge.ps1" @setupArgs -InstallLlamaVia $InstallLlamaVia
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& "$Root\run_edge.bat"
