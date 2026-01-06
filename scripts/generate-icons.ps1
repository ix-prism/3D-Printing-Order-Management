$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root "build"
$iconsDir = Join-Path $buildDir "icons"
$electronDir = Join-Path $root "electron"
$publicDir = Join-Path $root "public"
$headPath = Join-Path $root "docs\\source\\Generated Image January 06, 2026 - 9_18AM.jpeg"

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
New-Item -ItemType Directory -Force -Path $electronDir | Out-Null
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

Add-Type -AssemblyName System.Drawing

$headImage = $null
if (Test-Path $headPath) {
  $headImage = [System.Drawing.Bitmap]::FromFile($headPath)
}

function New-RoundedRectPath([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90) | Out-Null
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90) | Out-Null
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90) | Out-Null
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90) | Out-Null
  $path.CloseFigure() | Out-Null
  return $path
}

function New-LineArtOverlay([System.Drawing.Bitmap]$source, [int]$width, [int]$height) {
  if (-not $source) {
    return $null
  }
  $scaled = New-Object System.Drawing.Bitmap $width, $height
  $gfx = [System.Drawing.Graphics]::FromImage($scaled)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.Clear([System.Drawing.Color]::Transparent)
  $scale = [Math]::Max($width / $source.Width, $height / $source.Height)
  $drawW = [int][Math]::Ceiling($source.Width * $scale)
  $drawH = [int][Math]::Ceiling($source.Height * $scale)
  $offsetX = [int][Math]::Round(($width - $drawW) / 2)
  $offsetY = [int][Math]::Round(($height - $drawH) / 2)
  $gfx.DrawImage($source, $offsetX, $offsetY, $drawW, $drawH)
  $gfx.Dispose()

  $overlay = New-Object System.Drawing.Bitmap -ArgumentList @(
    $width,
    $height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
      $pixel = $scaled.GetPixel($x, $y)
      $brightness = $pixel.GetBrightness()
      $alpha = [Math]::Round([Math]::Min(255, $brightness * 255 * 0.55))
      if ($alpha -lt 8) {
        $alpha = 0
      }
      if ($alpha -eq 0) {
        $overlay.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        continue
      }
      $overlay.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
    }
  }
  $scaled.Dispose()
  return $overlay
}

function Write-IconPng([int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList @(
    $size,
    $size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.Clear([System.Drawing.Color]::Transparent)

  if ($headImage) {
    $r = [Math]::Max(2, [Math]::Floor($size * 0.18))
    $path = New-RoundedRectPath 0 0 $size $size $r
    $pad = [Math]::Max(2, [Math]::Floor($size * 0.02))
    $targetSize = $size + ($pad * 2)
    $scale = [Math]::Max($targetSize / $headImage.Width, $targetSize / $headImage.Height)
    $drawW = [int][Math]::Ceiling($headImage.Width * $scale)
    $drawH = [int][Math]::Ceiling($headImage.Height * $scale)
    $offsetX = [int][Math]::Round(($size - $drawW) / 2)
    $offsetY = [int][Math]::Round(($size - $drawH) / 2)
    $state = $gfx.Save()
    $gfx.SetClip($path)
    $gfx.DrawImage($headImage, $offsetX, $offsetY, $drawW, $drawH)
    $gfx.Restore($state)
    $path.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $gfx.Dispose()
    $bmp.Dispose()
    return
  }

  $pad = [Math]::Max(2, [Math]::Floor($size * 0.12))
  $r = [Math]::Max(2, [Math]::Floor($size * 0.18))
  $card = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
  $path = New-RoundedRectPath $card.X $card.Y $card.Width $card.Height $r

  $c1 = [System.Drawing.Color]::FromArgb(18, 28, 44)
  $c2 = [System.Drawing.Color]::FromArgb(38, 66, 108)
  $cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($card, $c1, $c2, 135)
  $gfx.FillPath($cardBrush, $path)

  if ($headImage) {
    $artPad = [Math]::Max(1, [Math]::Floor($size * 0.02))
    $artRect = New-Object System.Drawing.Rectangle ($card.X + $artPad), ($card.Y + $artPad), ($card.Width - 2 * $artPad), ($card.Height - 2 * $artPad)
    $overlay = New-LineArtOverlay -source $headImage -width $artRect.Width -height $artRect.Height
    if ($overlay) {
      $state = $gfx.Save()
      $gfx.SetClip($path)
      $gfx.DrawImage($overlay, $artRect)
      $gfx.Restore($state)
      $overlay.Dispose()
    }
  }

  $fontSize = [Math]::Max(12, [Math]::Floor($size * 0.36))
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $text = "PO"
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
  $textShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 0, 0, 0))
  $textPad = [Math]::Max(4, [Math]::Floor($size * 0.06))
  $textRect = New-Object System.Drawing.RectangleF ($card.X + $textPad), ($card.Y + $textPad), ($card.Width - 2 * $textPad), ($card.Height - 2 * $textPad)
  $shadowOffset = [Math]::Max(1, [Math]::Floor($size * 0.02))
  $shadowRect = New-Object System.Drawing.RectangleF ($textRect.X + $shadowOffset), ($textRect.Y + $shadowOffset), $textRect.Width, $textRect.Height
  $gfx.DrawString($text, $font, $textShadow, $shadowRect, $format)
  $gfx.DrawString($text, $font, $textBrush, $textRect, $format)

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $textBrush.Dispose()
  $textShadow.Dispose()
  $font.Dispose()
  $format.Dispose()
  $cardBrush.Dispose()
  $path.Dispose()
  $gfx.Dispose()
  $bmp.Dispose()
}

$sizes = @(16, 24, 32, 48, 64, 128, 256, 512)
foreach ($s in $sizes) {
  $out = Join-Path $iconsDir ("icon-{0}.png" -f $s)
  Write-IconPng -size $s -outPath $out
}

Copy-Item -Force (Join-Path $iconsDir "icon-512.png") (Join-Path $buildDir "icon.png")
Copy-Item -Force (Join-Path $iconsDir "icon-64.png") (Join-Path $electronDir "app-icon.png")
Copy-Item -Force (Join-Path $iconsDir "icon-64.png") (Join-Path $electronDir "drag-icon.png")
Copy-Item -Force (Join-Path $iconsDir "icon-256.png") (Join-Path $publicDir "app-icon.png")

if ($headImage) {
  $headImage.Dispose()
}
