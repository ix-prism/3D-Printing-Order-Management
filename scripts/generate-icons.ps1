$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root "build"
$iconsDir = Join-Path $buildDir "icons"
$electronDir = Join-Path $root "electron"

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
New-Item -ItemType Directory -Force -Path $electronDir | Out-Null

Add-Type -AssemblyName System.Drawing

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

function Write-IconPng([int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bgRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $c1 = [System.Drawing.Color]::FromArgb(28, 88, 255)
  $c2 = [System.Drawing.Color]::FromArgb(0, 196, 255)
  $brushBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, $c1, $c2, 45)
  $gfx.FillRectangle($brushBg, $bgRect)

  $pad = [Math]::Max(2, [Math]::Floor($size * 0.12))
  $r = [Math]::Max(2, [Math]::Floor($size * 0.18))
  $card = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
  $path = New-RoundedRectPath $card.X $card.Y $card.Width $card.Height $r

  $shadowOffset = [Math]::Max(1, [Math]::Floor($size * 0.03))
  $shadowRect = New-Object System.Drawing.Rectangle ($card.X + $shadowOffset), ($card.Y + $shadowOffset), $card.Width, $card.Height
  $shadowPath = New-RoundedRectPath $shadowRect.X $shadowRect.Y $shadowRect.Width $shadowRect.Height $r
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
  $gfx.FillPath($shadowBrush, $shadowPath)

  $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 28, 32))
  $gfx.FillPath($cardBrush, $path)

  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 255, 255, 255), ([Math]::Max(1, [Math]::Floor($size * 0.02))))
  $gfx.DrawPath($borderPen, $path)

  $fontSize = [Math]::Max(9, [Math]::Floor($size * 0.42))
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $text = "PO"
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $textShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(110, 0, 0, 0))
  $cx = $size / 2
  $cy = $size / 2
  $gfx.DrawString($text, $font, $textShadow, ($cx + $shadowOffset), ($cy + $shadowOffset), $format)
  $gfx.DrawString($text, $font, $textBrush, $cx, $cy, $format)

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $textBrush.Dispose()
  $textShadow.Dispose()
  $font.Dispose()
  $format.Dispose()
  $borderPen.Dispose()
  $cardBrush.Dispose()
  $shadowBrush.Dispose()
  $shadowPath.Dispose()
  $path.Dispose()
  $brushBg.Dispose()
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
