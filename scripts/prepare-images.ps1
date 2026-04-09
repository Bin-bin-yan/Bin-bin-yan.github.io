param(
    [string]$SourceDir = ".\图片",
    [string]$OutputDir = ".\assets\images\gallery",
    [string]$ManifestPath = ".\src\data\gallery.generated.js",
    [string]$CdnRepoOwner = "Bin-bin-yan",
    [string]$CdnRepoName = "Bin-bin-yan.github.io",
    [string]$CdnRef = "",
    [int]$HeroMaxWidth = 1600,
    [int]$GalleryMaxWidth = 960,
    [int]$HeroJpegQuality = 80,
    [int]$GalleryJpegQuality = 74,
    [string[]]$ExcludedSourceFiles = @(
        "3b33c4ef81a55cfc0a2f657e098e97b4.jpg"
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Get-JpegEncoder {
    return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" } |
        Select-Object -First 1
}

function Normalize-Orientation {
    param(
        [System.Drawing.Image]$Image
    )

    $orientationPropertyId = 0x0112

    if (-not ($Image.PropertyIdList -contains $orientationPropertyId)) {
        return
    }

    $orientation = $Image.GetPropertyItem($orientationPropertyId).Value[0]

    switch ($orientation) {
        3 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
        6 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
        8 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
        Default { }
    }

    try {
        $Image.RemovePropertyItem($orientationPropertyId)
    }
    catch {
        # Some files expose orientation metadata as read-only; the transform above is still enough.
    }
}

function Save-OptimizedJpeg {
    param(
        [string]$SourcePath,
        [string]$DestinationPath,
        [int]$MaxWidth,
        [int]$Quality
    )

    $image = [System.Drawing.Image]::FromFile($SourcePath)

    try {
        Normalize-Orientation -Image $image

        $scale = [Math]::Min($MaxWidth / $image.Width, 1)
        $targetWidth = [int][Math]::Max([Math]::Round($image.Width * $scale), 1)
        $targetHeight = [int][Math]::Max([Math]::Round($image.Height * $scale), 1)

        $bitmap = [System.Drawing.Bitmap]::new(
            $targetWidth,
            $targetHeight,
            [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
        )

        try {
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

            try {
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.DrawImage($image, 0, 0, $targetWidth, $targetHeight)
            }
            finally {
                $graphics.Dispose()
            }

            $encoder = Get-JpegEncoder
            $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
            $encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
                [System.Drawing.Imaging.Encoder]::Quality,
                [long]$Quality
            )

            try {
                $bitmap.Save($DestinationPath, $encoder, $encoderParameters)
            }
            finally {
                $encoderParameters.Dispose()
            }

            return [PSCustomObject]@{
                Width  = $targetWidth
                Height = $targetHeight
            }
        }
        finally {
            $bitmap.Dispose()
        }
    }
    finally {
        $image.Dispose()
    }
}

$resolvedSource = Resolve-Path -Path $SourceDir
$resolvedOutput = Join-Path -Path (Get-Location) -ChildPath $OutputDir
$resolvedManifest = Join-Path -Path (Get-Location) -ChildPath $ManifestPath

if ([string]::IsNullOrWhiteSpace($CdnRef)) {
    try {
        $CdnRef = (git rev-parse HEAD).Trim()
    }
    catch {
        $CdnRef = "main"
    }
}

$cdnBaseUrl = "https://cdn.jsdelivr.net/gh/$CdnRepoOwner/$CdnRepoName@$CdnRef/assets/images/gallery"

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($resolvedManifest)) | Out-Null

Get-ChildItem -Path $resolvedOutput -File -ErrorAction SilentlyContinue | Remove-Item -Force

$manifestItems = @()
$files = Get-ChildItem -Path $resolvedSource -File |
    Where-Object {
        $ExcludedSourceFiles -notcontains $_.Name -and
        $_.Extension -match '^\.(jpg|jpeg)$' -and
        $_.BaseName -match '^\d{2}$'
    } |
    Sort-Object Name

if (-not $files) {
    throw "在 '$SourceDir' 没找到可处理的图片文件。"
}

$index = 0

foreach ($file in $files) {
    $targetName = "wedding-{0:d2}.jpg" -f $index
    $targetPath = Join-Path -Path $resolvedOutput -ChildPath $targetName
    $isCover = ($index -eq 1)
    $maxWidth = if ($isCover) { $HeroMaxWidth } else { $GalleryMaxWidth }
    $quality = if ($isCover) { $HeroJpegQuality } else { $GalleryJpegQuality }

    # Without the old lightbox preview we can generate much smaller gallery files,
    # because every non-cover image now only needs to read well as a grid thumbnail.
    $imageMeta = Save-OptimizedJpeg `
        -SourcePath $file.FullName `
        -DestinationPath $targetPath `
        -MaxWidth $maxWidth `
        -Quality $quality

    $manifestItems += [PSCustomObject]@{
        src     = "$cdnBaseUrl/$targetName"
        assetName = $targetName
        isCover = $isCover
        width   = $imageMeta.Width
        height  = $imageMeta.Height
    }

    $index++
}

$manifestContent = @(
    "// Auto-generated by scripts/prepare-images.ps1. Keep edits in the source photo folder instead."
    "export const galleryManifest = " + ($manifestItems | ConvertTo-Json -Depth 4)
) -join "`n"

Set-Content -Path $resolvedManifest -Value $manifestContent -Encoding utf8

$outputSummary = [PSCustomObject]@{
    SourceFiles = $files.Count
    OutputDir   = $resolvedOutput
    Manifest    = $resolvedManifest
}

$outputSummary | ConvertTo-Json -Depth 3
