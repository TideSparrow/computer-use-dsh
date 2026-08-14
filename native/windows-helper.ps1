# windows-helper.ps1 — Windows input/screenshot helper for the Computer Use DSH plugin.
# No external dependencies: uses System.Windows.Forms / System.Drawing and user32 P/Invoke.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File windows-helper.ps1 -Action <action> [params]
param(
  [string]$Action = 'size',
  [int]$X = 0,
  [int]$Y = 0,
  [int]$W = 0,
  [int]$H = 0,
  [string]$Button = 'left',
  [switch]$Double,
  [int]$DX = 0,
  [int]$DY = 0,
  [string]$Text = '',
  [string]$Key = '',
  [string]$Modifiers = '',
  [string]$OutFile = '',
  [string]$Format = 'jpeg',
  [string]$Target = '',
  [switch]$App
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

switch ($Action) {
  'size' {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    Write-Output "$($b.Width) $($b.Height)"
    break
  }
  'capture' {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    if ($W -gt 0) {
      $rw = $W; $rh = $H; $rx = $X; $ry = $Y
    } else {
      $rw = $b.Width; $rh = $b.Height; $rx = $b.X; $ry = $b.Y
    }
    $bmp = New-Object System.Drawing.Bitmap($rw, $rh)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($rx, $ry, 0, 0, (New-Object System.Drawing.Size($rw, $rh)))
    if ($Format -eq 'png') {
      $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
      $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "$rw $rh"
    break
  }
  'move' {
    [WinInput]::SetCursorPos($X, $Y) | Out-Null
    break
  }
  'click' {
    [WinInput]::SetCursorPos($X, $Y) | Out-Null
    Start-Sleep -Milliseconds 30
    $down = 0x02; $up = 0x04
    if ($Button -eq 'right') { $down = 0x08; $up = 0x10 }
    if ($Button -eq 'middle') { $down = 0x20; $up = 0x40 }
    $times = 1
    if ($Double) { $times = 2 }
    for ($i = 0; $i -lt $times; $i++) {
      [WinInput]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero) | Out-Null
      [WinInput]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero) | Out-Null
      Start-Sleep -Milliseconds 60
    }
    break
  }
  'scroll' {
    [WinInput]::SetCursorPos($X, $Y) | Out-Null
    if ($DX -ne 0) {
      [WinInput]::mouse_event(0x1000, 0, 0, ($DX * 120), [UIntPtr]::Zero) | Out-Null
    }
    [WinInput]::mouse_event(0x0800, 0, 0, ($DY * 120), [UIntPtr]::Zero) | Out-Null
    break
  }
  'type' {
    $hasNonAscii = $false
    foreach ($ch in $Text.ToCharArray()) {
      if ([int][char]$ch -gt 127) { $hasNonAscii = $true; break }
    }
    if ($hasNonAscii) {
      [System.Windows.Forms.Clipboard]::SetText($Text)
      [System.Windows.Forms.SendKeys]::SendWait('^v')
    } else {
      $s = $Text
      $s = $s.Replace('{', '{{}').Replace('}', '{}}')
      $s = $s.Replace('+', '{+}').Replace('^', '{^}').Replace('%', '{%}').Replace('~', '{~}')
      $s = $s.Replace('(', '{(}').Replace(')', '{)}').Replace('[', '{[}').Replace(']', '{]}')
      [System.Windows.Forms.SendKeys]::SendWait($s)
    }
    break
  }
  'key' {
    $prefix = ''
    foreach ($m in $Modifiers.Split(',')) {
      if ($m -eq 'ctrl' -or $m -eq 'control' -or $m -eq 'cmd' -or $m -eq 'command') { $prefix += '^' }
      elseif ($m -eq 'alt' -or $m -eq 'option') { $prefix += '%' }
      elseif ($m -eq 'shift') { $prefix += '+' }
    }
    $map = @{
      'return' = '{ENTER}'; 'enter' = '{ENTER}'; 'tab' = '{TAB}'; 'space' = ' ';
      'escape' = '{ESC}'; 'esc' = '{ESC}'; 'backspace' = '{BACKSPACE}'; 'delete' = '{DELETE}';
      'up' = '{UP}'; 'down' = '{DOWN}'; 'left' = '{LEFT}'; 'right' = '{RIGHT}';
      'home' = '{HOME}'; 'end' = '{END}'; 'pageup' = '{PGUP}'; 'pagedown' = '{PGDN}'
    }
    $k = $Key.ToLower()
    if ($map.ContainsKey($k)) { $seq = $prefix + $map[$k] }
    elseif ($Key -match '^[fF]([1-9]|1[0-2])$') { $seq = $prefix + '{' + $Key.ToUpper() + '}' }
    elseif ($Key.Length -eq 1) { $seq = $prefix + $Key }
    else { $seq = $prefix + $Key }
    [System.Windows.Forms.SendKeys]::SendWait($seq)
    break
  }
  'trusted' {
    Write-Output '1'
    break
  }
  'open' {
    if ($App) {
      Start-Process -FilePath $Target
    } else {
      Start-Process $Target
    }
    break
  }
  default {
    Write-Error "unknown action: $Action"
    exit 2
  }
}
