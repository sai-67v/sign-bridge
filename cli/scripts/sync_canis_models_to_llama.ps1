# Link Canis.teach GEMMA assets into llama.cpp dir (relative paths for --lora-scaled on Windows).
# Uses hardlink (base GGUF) + directory junctions (LoRA folders); no admin on same volume.

$ErrorActionPreference = "Stop"

$LlamaDir = if ($env:LLAMA_DIR) { $env:LLAMA_DIR } else { Join-Path $env:USERPROFILE "llama.cpp-gemma4" }
$TeachGemma = if ($env:CANIS_TEACH_GEMMA) { $env:CANIS_TEACH_GEMMA } else { Join-Path $env:USERPROFILE "canis.teach\GEMMA" }
$Dest = Join-Path $LlamaDir "canis-models"
$LoraDest = Join-Path $Dest "lora"

New-Item -ItemType Directory -Force -Path $LoraDest | Out-Null

function Link-FileHard($src, $dst) {
    if (-not (Test-Path $src)) {
        Write-Warning "Missing: $src"
        return $false
    }
    if (Test-Path $dst) { return $true }
    $parent = Split-Path $dst -Parent
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    cmd /c mklink /H "`"$dst`"" "`"$src`"" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Hardlink failed, copying instead: $dst"
        Copy-Item -LiteralPath $src -Destination $dst
    } else {
        Write-Host "  hardlink $dst"
    }
    return $true
}

function Link-DirJunction($src, $dst) {
    if (-not (Test-Path $src)) {
        Write-Warning "Missing: $src"
        return $false
    }
    if (Test-Path $dst) { return $true }
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) -ErrorAction SilentlyContinue | Out-Null
    cmd /c mklink /J "`"$dst`"" "`"$src`"" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Junction failed for $dst - copy folder manually or run as admin"
        return $false
    }
    Write-Host "  junction $dst"
    return $true
}

Write-Host "Syncing into $Dest (from $TeachGemma)"

Link-FileHard (Join-Path $TeachGemma "gemma-4-E2B-it-Q4_K_M.gguf") (Join-Path $Dest "gemma-4-E2B-it-Q4_K_M.gguf") | Out-Null

# Published R3 LoRA GGUF at repo root or under lora/teach-multilingual-gemma-4-e2b-r3/
$r3Name = "teach-multilingual-gemma-4-e2b-r3-Q4_K_M.gguf"
$r3Dir = Join-Path $LoraDest "teach-multilingual-gemma-4-e2b-r3"
New-Item -ItemType Directory -Force -Path $r3Dir | Out-Null
$r3Src = $null
foreach ($src in @(
    (Join-Path $TeachGemma $r3Name),
    (Join-Path $TeachGemma "lora\teach-multilingual-gemma-4-e2b-r3\$r3Name")
)) {
    if (Test-Path $src) {
        $r3Src = $src
        Link-FileHard $src (Join-Path $r3Dir $r3Name) | Out-Null
        break
    }
}

# Canonical folder/name for TEACH.json (`adapter: "teach"`)
$teachDir = Join-Path $LoraDest "teach"
New-Item -ItemType Directory -Force -Path $teachDir | Out-Null
$teachGguf = Join-Path $teachDir "teach.gguf"
if ($r3Src) {
    Link-FileHard $r3Src $teachGguf | Out-Null
} elseif (Test-Path (Join-Path $r3Dir $r3Name)) {
    Link-FileHard (Join-Path $r3Dir $r3Name) $teachGguf | Out-Null
}

$srcLora = Join-Path $TeachGemma "lora"
if (Test-Path $srcLora) {
    Get-ChildItem $srcLora -Directory | ForEach-Object {
        $gguf = Get-ChildItem $_.FullName -Filter "*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($gguf) {
            Link-DirJunction $_.FullName (Join-Path $LoraDest $_.Name) | Out-Null
        }
    }
    $manifest = Join-Path $srcLora "adapters.manifest.json"
    if (Test-Path $manifest) {
        Copy-Item -LiteralPath $manifest -Destination (Join-Path $LoraDest "adapters.manifest.json") -Force
        Write-Host "  manifest -> $LoraDest\adapters.manifest.json"
    }
}

Write-Host "Done. Start llama-server from $LlamaDir with relative canis-models/ paths."
