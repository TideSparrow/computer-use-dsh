// Computer Use for DSH — Host half (cross-platform: macOS / Linux / Windows).
// Build step replaces the __*_SOURCE__ placeholders with the native helper file contents.
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const subprocess = ctx.get('subprocess')
    const attachments = ctx.get('attachments')

    const MACOS_HELPER_SOURCE = "// macos-helper.swift — macOS input helper for the Computer Use DSH plugin.\n// Compiled once with `swiftc -O` on first use and cached by the Host half.\n// Subcommands: move / click / scroll / type / key / size / screensize / trusted\nimport CoreGraphics\nimport Foundation\nimport ApplicationServices\n\nlet args = CommandLine.arguments\nif args.count < 2 {\n    FileHandle.standardError.write(\"usage: helper <cmd> ...\".data(using: .utf8)!)\n    exit(2)\n}\nlet cmd = args[1]\n\nlet posting = [\"move\", \"click\", \"scroll\", \"type\", \"key\"]\nif posting.contains(cmd) {\n    if !AXIsProcessTrusted() {\n        FileHandle.standardError.write(\"ACCESSIBILITY_NOT_TRUSTED: the host process needs Accessibility permission in System Settings > Privacy & Security > Accessibility.\".data(using: .utf8)!)\n        exit(3)\n    }\n}\n\nfunc num(_ i: Int) -> CGFloat { CGFloat(Double(args[i]) ?? 0) }\nfunc int32(_ i: Int) -> Int32 { Int32(Double(args[i]) ?? 0) }\n\nfunc moveMouse(_ x: CGFloat, _ y: CGFloat) {\n    let p = CGPoint(x: x, y: y)\n    CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)\n}\n\nfunc clickAt(_ x: CGFloat, _ y: CGFloat, button: CGMouseButton, double: Bool) {\n    moveMouse(x, y)\n    usleep(60_000)\n    let down: CGEventType = button == .right ? .rightMouseDown : (button == .center ? .otherMouseDown : .leftMouseDown)\n    let up: CGEventType = button == .right ? .rightMouseUp : (button == .center ? .otherMouseUp : .leftMouseUp)\n    let p = CGPoint(x: x, y: y)\n    for _ in 0..<(double ? 2 : 1) {\n        CGEvent(mouseEventSource: nil, mouseType: down, mouseCursorPosition: p, mouseButton: button)?.post(tap: .cghidEventTap)\n        CGEvent(mouseEventSource: nil, mouseType: up, mouseCursorPosition: p, mouseButton: button)?.post(tap: .cghidEventTap)\n        usleep(80_000)\n    }\n}\n\nfunc scrollAt(_ x: CGFloat, _ y: CGFloat, dx: Int32, dy: Int32) {\n    moveMouse(x, y)\n    usleep(40_000)\n    let s = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0)\n    s?.post(tap: .cghidEventTap)\n}\n\nfunc typeText(_ text: String) {\n    let src = CGEventSource(stateID: .hidSystemState)\n    var chars = Array(text.utf16)\n    let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)\n    down?.keyboardSetUnicodeString(stringLength: chars.count, unicodeString: &chars)\n    down?.post(tap: .cghidEventTap)\n    let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)\n    up?.keyboardSetUnicodeString(stringLength: chars.count, unicodeString: &chars)\n    up?.post(tap: .cghidEventTap)\n}\n\nlet keyCodes: [String: CGKeyCode] = [\n    \"return\": 36, \"enter\": 36, \"tab\": 48, \"space\": 49, \"escape\": 53, \"esc\": 53,\n    \"backspace\": 51, \"delete\": 117, \"up\": 126, \"down\": 125, \"left\": 123, \"right\": 124,\n    \"home\": 115, \"end\": 119, \"pageup\": 116, \"pagedown\": 121,\n    \"a\": 0, \"s\": 1, \"d\": 2, \"f\": 3, \"h\": 4, \"g\": 5, \"z\": 6, \"x\": 7, \"c\": 8, \"v\": 9,\n    \"b\": 11, \"q\": 12, \"w\": 13, \"e\": 14, \"r\": 15, \"y\": 16, \"t\": 17, \"1\": 18, \"2\": 19,\n    \"3\": 20, \"4\": 21, \"6\": 22, \"5\": 23, \"=\": 24, \"9\": 25, \"7\": 26, \"-\": 27, \"8\": 28,\n    \"0\": 29, \"]\": 30, \"o\": 31, \"u\": 32, \"[\": 33, \"i\": 34, \"p\": 35, \"l\": 37, \"j\": 38,\n    \"'\": 39, \"k\": 40, \";\": 41, \",\": 43, \"/\": 44, \"n\": 45, \"m\": 46, \".\": 47,\n    \"`\": 50, \"f1\": 122, \"f2\": 120, \"f3\": 99, \"f4\": 118, \"f5\": 96, \"f6\": 97,\n    \"f7\": 98, \"f8\": 100, \"f9\": 101, \"f10\": 109, \"f11\": 103, \"f12\": 111,\n]\n\nfunc keyPress(_ name: String, modifiers: [String]) {\n    let lower = name.lowercased()\n    var flags: CGEventFlags = []\n    for m in modifiers {\n        switch m.lowercased() {\n        case \"cmd\", \"command\": flags.insert(.maskCommand)\n        case \"shift\": flags.insert(.maskShift)\n        case \"alt\", \"option\": flags.insert(.maskAlternate)\n        case \"ctrl\", \"control\": flags.insert(.maskControl)\n        case \"fn\": flags.insert(.maskSecondaryFn)\n        default: break\n        }\n    }\n    if let code = keyCodes[lower] {\n        let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true)\n        down?.flags = flags\n        down?.post(tap: .cghidEventTap)\n        let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false)\n        up?.flags = flags\n        up?.post(tap: .cghidEventTap)\n    } else {\n        typeText(name)\n    }\n}\n\nswitch cmd {\ncase \"move\":\n    moveMouse(num(2), num(3))\ncase \"click\":\n    let button: CGMouseButton = args.count > 4 && args[4] == \"right\" ? .right : (args.count > 4 && args[4] == \"middle\" ? .center : .left)\n    let double = args.count > 5 && args[5] == \"double\"\n    clickAt(num(2), num(3), button: button, double: double)\ncase \"scroll\":\n    scrollAt(num(2), num(3), dx: int32(4), dy: int32(5))\ncase \"type\":\n    if args.count > 2 { typeText(args[2]) }\ncase \"key\":\n    let modifiers = args.count > 3 ? Array(args[3].split(separator: \",\")).map(String.init) : []\n    keyPress(args[2], modifiers: modifiers)\ncase \"screensize\":\n    fallthrough\ncase \"size\":\n    let b = CGDisplayBounds(CGMainDisplayID())\n    print(String(Int(b.width)) + \" \" + String(Int(b.height)))\ncase \"trusted\":\n    print(AXIsProcessTrusted() ? \"1\" : \"0\")\ndefault:\n    FileHandle.standardError.write((\"unknown command \" + cmd).data(using: .utf8)!)\n    exit(2)\n}\n"
    const LINUX_HELPER_SOURCE = "#!/usr/bin/env bash\n# linux-helper.sh — Linux input/screenshot helper for the Computer Use DSH plugin.\n# Requires: xdotool (mouse/keyboard) and one of: grim / scrot / imagemagick(import) / gnome-screenshot.\n# Usage: linux-helper.sh <action> [args...]\nset -u\n\nACTION=\"${1:-}\"\nshift || true\n\ncase \"$ACTION\" in\n  capture)\n    # args: <outfile> [x y w h]  (region in screen pixels)\n    OUT=\"$1\"\n    X=\"${2:-}\"; Y=\"${3:-}\"; W=\"${4:-}\"; H=\"${5:-}\"\n    if command -v grim >/dev/null 2>&1; then\n      if [ -n \"$W\" ]; then grim -g \"${W}x${H}+${X}+${Y}\" \"$OUT\"; else grim \"$OUT\"; fi\n    elif command -v scrot >/dev/null 2>&1; then\n      if [ -n \"$W\" ]; then scrot -a \"${X},${Y},${W},${H}\" -o \"$OUT\"; else scrot -o \"$OUT\"; fi\n    elif command -v import >/dev/null 2>&1; then\n      if [ -n \"$W\" ]; then import -window root -crop \"${W}x${H}+${X}+${Y}\" \"$OUT\"; else import -window root \"$OUT\"; fi\n    elif command -v gnome-screenshot >/dev/null 2>&1; then\n      if [ -n \"$W\" ]; then\n        echo \"NO_REGION_SUPPORT: gnome-screenshot cannot capture a region; install grim, scrot or imagemagick\" >&2\n        exit 4\n      fi\n      gnome-screenshot -f \"$OUT\"\n    else\n      echo \"NO_SCREENSHOT_TOOL: install one of grim, scrot, imagemagick (import) or gnome-screenshot\" >&2\n      exit 4\n    fi\n    ;;\n  size)\n    # Screen size in pixels: \"W H\"\n    if command -v xdpyinfo >/dev/null 2>&1; then\n      xdpyinfo 2>/dev/null | awk '/dimensions:/{print $2; exit}' | tr 'x' ' '\n    elif command -v xrandr >/dev/null 2>&1; then\n      xrandr --current 2>/dev/null | awk '/primary/{print $4; exit}' | cut -d'+' -f1 | tr 'x' ' '\n    elif command -v wmctrl >/dev/null 2>&1; then\n      wmctrl -d 2>/dev/null | awk '/\\*/{print $4; exit}' | tr 'x' ' '\n    else\n      echo \"2560 1440\"\n    fi\n    ;;\n  move)\n    xdotool mousemove \"$1\" \"$2\" 2>/dev/null || { echo \"NO_XDOTOOL: install xdotool\" >&2; exit 4; }\n    ;;\n  click)\n    # args: x y [button] [double]\n    xdotool mousemove \"$1\" \"$2\" 2>/dev/null || { echo \"NO_XDOTOOL: install xdotool\" >&2; exit 4; }\n    BTN=1\n    case \"${3:-left}\" in\n      right) BTN=3 ;;\n      middle) BTN=2 ;;\n    esac\n    if [ \"${4:-single}\" = \"double\" ]; then\n      xdotool click --repeat 2 --delay 80 \"$BTN\"\n    else\n      xdotool click \"$BTN\"\n    fi\n    ;;\n  scroll)\n    # args: x y dx dy\n    xdotool mousemove \"$1\" \"$2\" 2>/dev/null || { echo \"NO_XDOTOOL: install xdotool\" >&2; exit 4; }\n    DX=\"${3:-0}\"; DY=\"${4:-0}\"\n    if [ \"$DY\" -gt 0 ]; then\n      N=$(( (DY + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 4; done\n    elif [ \"$DY\" -lt 0 ]; then\n      N=$(( (-DY + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 5; done\n    fi\n    if [ \"$DX\" -gt 0 ]; then\n      N=$(( (DX + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 7; done\n    elif [ \"$DX\" -lt 0 ]; then\n      N=$(( (-DX + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 6; done\n    fi\n    ;;\n  type)\n    # args: <text>\n    if command -v xdotool >/dev/null 2>&1; then\n      xdotool type --delay 30 \"$1\"\n    elif command -v wtype >/dev/null 2>&1; then\n      wtype \"$1\"\n    else\n      echo \"NO_TYPE_TOOL: install xdotool or wtype\" >&2\n      exit 4\n    fi\n    ;;\n  key)\n    # args: <key> [modifiers csv]\n    KEY=\"$1\"; MODS=\"${2:-}\"\n    if ! command -v xdotool >/dev/null 2>&1; then\n      echo \"NO_XDOTOOL: install xdotool\" >&2\n      exit 4\n    fi\n    PRE=\"\"\n    if [ -n \"$MODS\" ]; then\n      IFS=',' read -r -a MARR <<< \"$MODS\"\n      for m in \"${MARR[@]}\"; do\n        case \"$m\" in\n          ctrl|control) PRE=\"${PRE}ctrl+\" ;;\n          alt|option) PRE=\"${PRE}alt+\" ;;\n          shift) PRE=\"${PRE}shift+\" ;;\n          cmd|command) PRE=\"${PRE}super+\" ;;\n          fn) PRE=\"${PRE}\" ;;\n        esac\n      done\n    fi\n    case \"$KEY\" in\n      return|enter) KEY=Return ;;\n      tab) KEY=Tab ;;\n      space) KEY=space ;;\n      escape|esc) KEY=Escape ;;\n      backspace) KEY=BackSpace ;;\n      delete) KEY=Delete ;;\n      up) KEY=Up ;;\n      down) KEY=Down ;;\n      left) KEY=Left ;;\n      right) KEY=Right ;;\n      home) KEY=Home ;;\n      end) KEY=End ;;\n      pageup) KEY=Page_Up ;;\n      pagedown) KEY=Page_Down ;;\n    esac\n    xdotool key \"${PRE}${KEY}\"\n    ;;\n  trusted)\n    echo \"1\"\n    ;;\n  open)\n    # args: <target> [app]  — app=true -> gtk-launch, else xdg-open\n    TARGET=\"$1\"; APP=\"${2:-0}\"\n    if [ \"$APP\" = \"1\" ]; then\n      if command -v gtk-launch >/dev/null 2>&1; then\n        gtk-launch \"$TARGET\"\n      else\n        echo \"NO_APP_LAUNCHER: gtk-launch not found\" >&2\n        exit 4\n      fi\n    else\n      if command -v xdg-open >/dev/null 2>&1; then\n        xdg-open \"$TARGET\"\n      elif command -v gio >/dev/null 2>&1; then\n        gio open \"$TARGET\"\n      else\n        echo \"NO_OPENER: install xdg-utils or glib2 (gio)\" >&2\n        exit 4\n      fi\n    fi\n    ;;\n  *)\n    echo \"unknown action: $ACTION\" >&2\n    exit 2\n    ;;\nesac\n"
    const WINDOWS_HELPER_SOURCE = "# windows-helper.ps1 — Windows input/screenshot helper for the Computer Use DSH plugin.\n# No external dependencies: uses System.Windows.Forms / System.Drawing and user32 P/Invoke.\n# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File windows-helper.ps1 -Action <action> [params]\nparam(\n  [string]$Action = 'size',\n  [int]$X = 0,\n  [int]$Y = 0,\n  [int]$W = 0,\n  [int]$H = 0,\n  [string]$Button = 'left',\n  [switch]$Double,\n  [int]$DX = 0,\n  [int]$DY = 0,\n  [string]$Text = '',\n  [string]$Key = '',\n  [string]$Modifiers = '',\n  [string]$OutFile = '',\n  [string]$Format = 'jpeg',\n  [string]$Target = '',\n  [switch]$App\n)\n\nAdd-Type -AssemblyName System.Windows.Forms\nAdd-Type -AssemblyName System.Drawing\n\nAdd-Type @\"\nusing System;\nusing System.Runtime.InteropServices;\npublic class WinInput {\n  [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X, int Y);\n  [DllImport(\"user32.dll\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);\n}\n\"@\n\nswitch ($Action) {\n  'size' {\n    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds\n    Write-Output \"$($b.Width) $($b.Height)\"\n    break\n  }\n  'capture' {\n    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds\n    if ($W -gt 0) {\n      $rw = $W; $rh = $H; $rx = $X; $ry = $Y\n    } else {\n      $rw = $b.Width; $rh = $b.Height; $rx = $b.X; $ry = $b.Y\n    }\n    $bmp = New-Object System.Drawing.Bitmap($rw, $rh)\n    $g = [System.Drawing.Graphics]::FromImage($bmp)\n    $g.CopyFromScreen($rx, $ry, 0, 0, (New-Object System.Drawing.Size($rw, $rh)))\n    if ($Format -eq 'png') {\n      $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)\n    } else {\n      $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Jpeg)\n    }\n    $g.Dispose()\n    $bmp.Dispose()\n    Write-Output \"$rw $rh\"\n    break\n  }\n  'move' {\n    [WinInput]::SetCursorPos($X, $Y) | Out-Null\n    break\n  }\n  'click' {\n    [WinInput]::SetCursorPos($X, $Y) | Out-Null\n    Start-Sleep -Milliseconds 30\n    $down = 0x02; $up = 0x04\n    if ($Button -eq 'right') { $down = 0x08; $up = 0x10 }\n    if ($Button -eq 'middle') { $down = 0x20; $up = 0x40 }\n    $times = 1\n    if ($Double) { $times = 2 }\n    for ($i = 0; $i -lt $times; $i++) {\n      [WinInput]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero) | Out-Null\n      [WinInput]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero) | Out-Null\n      Start-Sleep -Milliseconds 60\n    }\n    break\n  }\n  'scroll' {\n    [WinInput]::SetCursorPos($X, $Y) | Out-Null\n    if ($DX -ne 0) {\n      [WinInput]::mouse_event(0x1000, 0, 0, ($DX * 120), [UIntPtr]::Zero) | Out-Null\n    }\n    [WinInput]::mouse_event(0x0800, 0, 0, ($DY * 120), [UIntPtr]::Zero) | Out-Null\n    break\n  }\n  'type' {\n    $hasNonAscii = $false\n    foreach ($ch in $Text.ToCharArray()) {\n      if ([int][char]$ch -gt 127) { $hasNonAscii = $true; break }\n    }\n    if ($hasNonAscii) {\n      [System.Windows.Forms.Clipboard]::SetText($Text)\n      [System.Windows.Forms.SendKeys]::SendWait('^v')\n    } else {\n      $s = $Text\n      $s = $s.Replace('{', '{{}').Replace('}', '{}}')\n      $s = $s.Replace('+', '{+}').Replace('^', '{^}').Replace('%', '{%}').Replace('~', '{~}')\n      $s = $s.Replace('(', '{(}').Replace(')', '{)}').Replace('[', '{[}').Replace(']', '{]}')\n      [System.Windows.Forms.SendKeys]::SendWait($s)\n    }\n    break\n  }\n  'key' {\n    $prefix = ''\n    foreach ($m in $Modifiers.Split(',')) {\n      if ($m -eq 'ctrl' -or $m -eq 'control' -or $m -eq 'cmd' -or $m -eq 'command') { $prefix += '^' }\n      elseif ($m -eq 'alt' -or $m -eq 'option') { $prefix += '%' }\n      elseif ($m -eq 'shift') { $prefix += '+' }\n    }\n    $map = @{\n      'return' = '{ENTER}'; 'enter' = '{ENTER}'; 'tab' = '{TAB}'; 'space' = ' ';\n      'escape' = '{ESC}'; 'esc' = '{ESC}'; 'backspace' = '{BACKSPACE}'; 'delete' = '{DELETE}';\n      'up' = '{UP}'; 'down' = '{DOWN}'; 'left' = '{LEFT}'; 'right' = '{RIGHT}';\n      'home' = '{HOME}'; 'end' = '{END}'; 'pageup' = '{PGUP}'; 'pagedown' = '{PGDN}'\n    }\n    $k = $Key.ToLower()\n    if ($map.ContainsKey($k)) { $seq = $prefix + $map[$k] }\n    elseif ($Key -match '^[fF]([1-9]|1[0-2])$') { $seq = $prefix + '{' + $Key.ToUpper() + '}' }\n    elseif ($Key.Length -eq 1) { $seq = $prefix + $Key }\n    else { $seq = $prefix + $Key }\n    [System.Windows.Forms.SendKeys]::SendWait($seq)\n    break\n  }\n  'trusted' {\n    Write-Output '1'\n    break\n  }\n  'open' {\n    if ($App) {\n      Start-Process -FilePath $Target\n    } else {\n      Start-Process $Target\n    }\n    break\n  }\n  default {\n    Write-Error \"unknown action: $Action\"\n    exit 2\n  }\n}\n"

    const MAC_DIR = '/tmp/dsh-computer-use'
    const POWERSHELL = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

    let platform = null
    let macBin = null
    let linuxScript = null
    let winScript = null

    const lastShot = (() => {
      let s = null
      return { get: () => s, set: (v) => { s = v } }
    })()

    async function runProc(argv, opts = {}) {
      if (subprocess === undefined) throw new Error('computer-use: subprocess service unavailable')
      const handle = subprocess.spawn({
        argv,
        cwd: opts.cwd || '/tmp',
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 4_000_000 },
          stderr: { maxBytes: 4_000_000 },
        },
        graceMs: 20000,
        signal: opts.signal,
        env: opts.env,
      })
      const outcome = await handle.done
      const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      return { code: outcome.exitCode, out, err }
    }

    async function detectPlatform(signal) {
      if (platform) return platform
      for (const uname of ['/usr/bin/uname', '/bin/uname']) {
        try {
          const r = await runProc([uname, '-s'], { signal })
          if (r.code === 0) {
            const s = (r.out || '').trim().toLowerCase()
            if (s.includes('darwin')) { platform = 'darwin'; return platform }
            if (s.includes('linux')) { platform = 'linux'; return platform }
          }
        } catch (e) { /* try next */ }
      }
      try {
        const r = await runProc(['cmd.exe', '/c', 'ver'], { signal })
        if (r.code === 0) { platform = 'win32'; return platform }
      } catch (e) { /* fall through */ }
      platform = 'darwin'
      return platform
    }

    async function winTempDir(signal) {
      const r = await runProc(['cmd.exe', '/c', 'echo', '%TEMP%'], { signal })
      return (r.out || '').trim().replace(/\\$/, '') || 'C:/Windows/Temp'
    }

    async function helperDir(signal) {
      const plat = await detectPlatform(signal)
      if (plat === 'win32') return (await winTempDir(signal)) + '/dsh-computer-use'
      return MAC_DIR
    }

    async function ensureMacHelper(signal) {
      if (macBin) return macBin
      const binTarget = await fs.resolve(MAC_DIR + '/dsh-cu-helper')
      const info = await fs.stat(binTarget)
      if (info !== undefined) { macBin = fs.processPath(binTarget); return macBin }
      const srcTarget = await fs.resolve(MAC_DIR + '/dsh-cu-helper.swift')
      await fs.writeText(srcTarget, MACOS_HELPER_SOURCE, undefined, signal)
      const res = await runProc(['/usr/bin/swiftc', '-O', '-o', fs.processPath(binTarget), fs.processPath(srcTarget)], {
        signal,
        cwd: MAC_DIR,
        env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: '/tmp' },
      })
      if (res.code !== 0) throw new Error('computer-use: swift helper compile failed: ' + (res.err || res.out).slice(0, 1200))
      macBin = fs.processPath(binTarget)
      return macBin
    }

    async function ensureLinuxHelper(signal) {
      if (linuxScript) return linuxScript
      const dir = MAC_DIR
      const target = await fs.resolve(dir + '/linux-helper.sh')
      await fs.writeText(target, LINUX_HELPER_SOURCE, undefined, signal)
      linuxScript = fs.processPath(target)
      return linuxScript
    }

    async function ensureWinHelper(signal) {
      if (winScript) return winScript
      const dir = await helperDir(signal)
      const target = await fs.resolve(dir + '/windows-helper.ps1')
      await fs.writeText(target, WINDOWS_HELPER_SOURCE, undefined, signal)
      winScript = fs.processPath(target)
      return winScript
    }

    async function nativeRun(args, signal) {
      const plat = await detectPlatform(signal)
      if (plat === 'darwin') {
        if (args[0] === 'open') {
          const argv = ['/usr/bin/open']
          if (args[2] === '1') argv.push('-a')
          argv.push(String(args[1]))
          const res = await runProc(argv, { signal, cwd: MAC_DIR })
          if (res.code !== 0) throw new Error('open failed: ' + (res.err || res.out).slice(0, 300))
          return 'ok'
        }
        const bin = await ensureMacHelper(signal)
        const res = await runProc([bin, ...args.map(String)], { signal, cwd: MAC_DIR })
        if (res.code === 3 && res.err.includes('ACCESSIBILITY_NOT_TRUSTED')) {
          throw new Error('computer-use: Accessibility permission is required for mouse/keyboard control. Grant it to the app hosting DeepSeek Harness in System Settings > Privacy & Security > Accessibility, then retry.')
        }
        if (res.code !== 0) throw new Error('computer-use helper error: ' + (res.err || res.out).slice(0, 800))
        return res.out
      }
      if (plat === 'linux') {
        const script = await ensureLinuxHelper(signal)
        const res = await runProc(['/bin/bash', script, ...args.map(String)], { signal, cwd: MAC_DIR })
        if (res.code === 4) throw new Error('computer-use: ' + (res.err || res.out).trim().slice(0, 500))
        if (res.code !== 0) throw new Error('computer-use helper error: ' + (res.err || res.out).slice(0, 800))
        return res.out
      }
      const script = await ensureWinHelper(signal)
      const argv = [POWERSHELL, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', String(args[0])]
      const a = args.slice(1)
      switch (args[0]) {
        case 'click':
          argv.push('-X', String(a[0]), '-Y', String(a[1]), '-Button', String(a[2] || 'left'))
          if (a[3] === 'double') argv.push('-Double')
          break
        case 'move':
          argv.push('-X', String(a[0]), '-Y', String(a[1]))
          break
        case 'scroll':
          argv.push('-X', String(a[0]), '-Y', String(a[1]), '-DX', String(a[2] || 0), '-DY', String(a[3] || 0))
          break
        case 'type':
          argv.push('-Text', String(a[0]))
          break
        case 'key':
          argv.push('-Key', String(a[0]), '-Modifiers', String(a[1] || ''))
          break
        case 'open':
          argv.push('-Target', String(a[0]))
          if (a[1] === '1') argv.push('-App')
          break
        case 'size':
        case 'trusted':
          break
        default:
          throw new Error('computer-use: unknown native action ' + args[0])
      }
      const res = await runProc(argv, { signal, cwd: await helperDir(signal) })
      if (res.code !== 0) throw new Error('computer-use helper error: ' + (res.err || res.out).slice(0, 800))
      return res.out
    }

    async function nativeSize(signal) {
      const out = (await nativeRun(['size'], signal)).trim()
      const parts = out.split(/\s+/).map(Number)
      return { w: parts[0] || 2560, h: parts[1] || 1440 }
    }

    function toPoint(x, y) {
      const s = lastShot.get()
      if (!s) return { x: Math.round(x), y: Math.round(y) }
      const sx = s.pointW / s.pixelW
      const sy = s.pointH / s.pixelH
      return { x: Math.round(s.originX + x * sx), y: Math.round(s.originY + y * sy) }
    }

    async function captureScreen(opts = {}, signal) {
      if (attachments === undefined) throw new Error('computer-use: attachments service unavailable')
      if (fs === undefined) throw new Error('computer-use: fs service unavailable')
      const plat = await detectPlatform(signal)
      const display = opts.display == null ? 1 : opts.display
      const hasRegion = opts.region_x != null && opts.region_y != null && opts.region_width != null && opts.region_height != null
      const format = opts.format === 'png' ? 'png' : 'jpeg'
      const dir = await helperDir(signal)
      const file = dir + '/screen-' + Date.now() + '.' + format
      let res
      if (plat === 'darwin') {
        const argv = ['/usr/sbin/screencapture', '-x', '-t', format]
        if (opts.include_cursor) argv.push('-C')
        if (hasRegion) argv.push('-R', String(opts.region_x) + ',' + String(opts.region_y) + ',' + String(opts.region_width) + ',' + String(opts.region_height))
        else argv.push('-D', String(display))
        argv.push(file)
        res = await runProc(argv, { signal, cwd: dir })
        if (res.code !== 0 || res.err.includes('could not create image from display')) {
          throw new Error('computer-use: screen capture failed. Screen Recording permission is required — grant it to the app hosting DeepSeek Harness in System Settings > Privacy & Security > Screen Recording, then retry. Detail: ' + (res.err || res.out).slice(0, 300))
        }
      } else if (plat === 'linux') {
        const script = await ensureLinuxHelper(signal)
        const argv = ['/bin/bash', script, 'capture', file]
        if (hasRegion) argv.push(String(opts.region_x), String(opts.region_y), String(opts.region_width), String(opts.region_height))
        res = await runProc(argv, { signal, cwd: dir })
        if (res.code !== 0) throw new Error('computer-use: screen capture failed. ' + (res.err || res.out).trim().slice(0, 400))
      } else {
        const script = await ensureWinHelper(signal)
        const argv = [POWERSHELL, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', 'capture', '-OutFile', file, '-Format', format]
        if (hasRegion) argv.push('-X', String(opts.region_x), '-Y', String(opts.region_y), '-W', String(opts.region_width), '-H', String(opts.region_height))
        res = await runProc(argv, { signal, cwd: dir })
        if (res.code !== 0) throw new Error('computer-use: screen capture failed. ' + (res.err || res.out).slice(0, 400))
      }
      const target = await fs.resolve(file)
      const cap = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes)
      const data = await fs.readBytes(target, signal, cap)
      const mediaType = format === 'png' ? 'image/png' : 'image/jpeg'
      const ref = await attachments.saveImage({ data, mediaType, name: 'screen.' + format })
      const pt = await nativeSize(signal)
      const pointW = hasRegion ? opts.region_width : pt.w
      const pointH = hasRegion ? opts.region_height : pt.h
      lastShot.set({
        path: file,
        pixelW: ref.width,
        pixelH: ref.height,
        pointW,
        pointH,
        originX: hasRegion ? opts.region_x : 0,
        originY: hasRegion ? opts.region_y : 0,
        capturedAt: Date.now(),
      })
      return { ref, pixelW: ref.width, pixelH: ref.height, pointW, pointH, capturedAt: lastShot.get().capturedAt }
    }

    async function latestPayload() {
      const s = lastShot.get()
      if (!s || !fs) return { dataUrl: null, width: 0, height: 0, capturedAt: null, error: 'no screenshot yet' }
      try {
        const target = await fs.resolve(s.path)
        const data = await fs.readBytes(target, undefined, 20_000_000)
        let bin = ''
        for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i])
        const mediaType = s.path.endsWith('.png') ? 'image/png' : 'image/jpeg'
        return { dataUrl: 'data:' + mediaType + ';base64,' + btoa(bin), width: s.pixelW, height: s.pixelH, capturedAt: s.capturedAt, error: null }
      } catch (e) {
        return { dataUrl: null, width: 0, height: 0, capturedAt: null, error: String(e && e.message || e) }
      }
    }

    async function statusPayload() {
      let helperReady = false
      let accessibility = null
      let platLabel = 'unknown'
      try {
        const plat = await detectPlatform()
        platLabel = plat === 'darwin' ? 'macOS' : (plat === 'linux' ? 'Linux' : 'Windows')
        if (plat === 'darwin') {
          const bin = await ensureMacHelper()
          helperReady = true
          const res = await runProc([bin, 'trusted'], { cwd: MAC_DIR })
          accessibility = res.code === 0 && res.out.trim() === '1'
        } else {
          await nativeRun(['trusted'])
          helperReady = true
          accessibility = true
        }
      } catch (e) {
        accessibility = false
      }
      return { ok: true, platform: platLabel, helperReady, accessibility }
    }

    async function assertImageRoute(exec) {
      const llm = ctx.get('llm')
      if (llm === undefined) return
      try {
        const routed = exec.agent && exec.agent.session && exec.agent.session.requestHeader ? exec.agent.session.requestHeader().config : undefined
        const provider = (routed && routed.provider) || (exec.agent && exec.agent.options && exec.agent.options.provider)
        const model = (routed && routed.model) || (exec.agent && exec.agent.options && exec.agent.options.model)
        if (!provider || !model) return
        const info = await llm.resolveModelInfo(provider, model, exec.signal)
        if (info.inputModalities && !info.inputModalities.includes('image')) {
          throw new Error('computer_screenshot requires an image-capable model; the current model does not declare image input')
        }
      } catch (e) {
        if (e && e.message && String(e.message).includes('image-capable')) throw e
      }
    }

    const register = (def) => harness.registerTool(ctx, harness.defineTool(def))

    register({
      name: 'computer_screenshot',
      description: 'Capture the desktop screen (or a region) and return the image. Use the returned image to locate UI elements; its pixel coordinates are the coordinate space for computer_click / computer_move / computer_scroll (0,0 = top-left). macOS needs Screen Recording permission; Linux needs grim/scrot/imagemagick; Windows uses built-in .NET.',
      parameters: {
        display: { type: 'integer', description: 'Display id to capture; 1 = main display (default). macOS only.' },
        region_x: { type: 'integer', description: 'Optional capture region left (points, main-display space).' },
        region_y: { type: 'integer', description: 'Optional capture region top (points, main-display space).' },
        region_width: { type: 'integer', description: 'Optional capture region width in points.' },
        region_height: { type: 'integer', description: 'Optional capture region height in points.' },
        format: { type: 'string', enum: ['jpeg', 'png'], description: 'Image format; jpeg (default) is much smaller.' },
        include_cursor: { type: 'boolean', description: 'Include the mouse cursor in the capture; default false. macOS only.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            image: {
              type: 'object', additionalProperties: false, required: true,
              properties: {
                attachmentId: { type: 'string', required: true },
                mediaType: { type: 'string', enum: ['image/png', 'image/jpeg'], required: true },
                bytes: { type: 'integer', required: true },
                width: { type: 'integer', required: true },
                height: { type: 'integer', required: true },
                name: { type: 'string' },
              },
            },
            pixelWidth: { type: 'integer', required: true },
            pixelHeight: { type: 'integer', required: true },
            pointWidth: { type: 'integer', required: true },
            pointHeight: { type: 'integer', required: true },
            capturedAt: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: 'Screen captured: ' + value.pixelWidth + 'x' + value.pixelHeight + ' px (' + value.pointWidth + 'x' + value.pointHeight + ' pt). Use these image pixel coordinates for click/move/scroll.' },
          { type: 'image', attachment: { attachmentId: value.image.attachmentId, mediaType: value.image.mediaType, bytes: value.image.bytes, width: value.image.width, height: value.image.height } },
        ],
      },
      timeoutMs: 120000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        await assertImageRoute(exec)
        const r = await captureScreen(args, exec.signal)
        return {
          image: { attachmentId: r.ref.attachmentId, mediaType: r.ref.mediaType, bytes: r.ref.bytes, width: r.ref.width, height: r.ref.height, name: r.ref.name },
          pixelWidth: r.pixelW, pixelHeight: r.pixelH, pointWidth: r.pointW, pointHeight: r.pointH, capturedAt: r.capturedAt,
        }
      },
    })

    const actionOutput = {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    }

    register({
      name: 'computer_click',
      description: 'Move the mouse to (x, y) in the coordinate space of the last computer_screenshot image and click. Coordinates are image pixels with (0,0) top-left. Use button=left|right|middle and double=true for a double-click.',
      parameters: {
        x: { type: 'number', required: true, description: 'X in image pixels of the last screenshot.' },
        y: { type: 'number', required: true, description: 'Y in image pixels of the last screenshot.' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button; default left.' },
        double: { type: 'boolean', description: 'Double-click; default false.' },
      },
      output: actionOutput,
      timeoutMs: 90000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const p = toPoint(args.x, args.y)
        await nativeRun(['click', p.x, p.y, args.button || 'left', args.double ? 'double' : 'single'], exec.signal)
        return { ok: true, message: 'Clicked ' + (args.button || 'left') + (args.double ? ' double' : '') + ' at (' + p.x + ', ' + p.y + ')' }
      },
    })

    register({
      name: 'computer_move',
      description: 'Move the mouse to (x, y) in the coordinate space of the last computer_screenshot image, without clicking.',
      parameters: {
        x: { type: 'number', required: true },
        y: { type: 'number', required: true },
      },
      output: actionOutput,
      timeoutMs: 90000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const p = toPoint(args.x, args.y)
        await nativeRun(['move', p.x, p.y], exec.signal)
        return { ok: true, message: 'Moved mouse to (' + p.x + ', ' + p.y + ')' }
      },
    })

    register({
      name: 'computer_scroll',
      description: 'Move the mouse to (x, y) and scroll the wheel. delta_y positive scrolls up, negative scrolls down; delta_x positive scrolls right. Coordinates are image pixels of the last screenshot.',
      parameters: {
        x: { type: 'number', required: true },
        y: { type: 'number', required: true },
        delta_x: { type: 'integer', description: 'Horizontal scroll delta; default 0.' },
        delta_y: { type: 'integer', description: 'Vertical scroll delta; default 0.' },
      },
      output: actionOutput,
      timeoutMs: 90000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const p = toPoint(args.x, args.y)
        await nativeRun(['scroll', p.x, p.y, args.delta_x || 0, args.delta_y || 0], exec.signal)
        return { ok: true, message: 'Scrolled at (' + p.x + ', ' + p.y + ') dx=' + (args.delta_x || 0) + ' dy=' + (args.delta_y || 0) }
      },
    })

    register({
      name: 'computer_type',
      description: 'Type text into the currently focused field or window. Unicode and punctuation are supported (Windows types non-ASCII via clipboard paste). Click the target first if needed.',
      parameters: {
        text: { type: 'string', required: true, description: 'Text to type.' },
      },
      output: actionOutput,
      timeoutMs: 90000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        await nativeRun(['type', args.text], exec.signal)
        return { ok: true, message: 'Typed ' + args.text.length + ' characters' }
      },
    })

    register({
      name: 'computer_key',
      description: 'Press a key, optionally with modifiers. Key names: return/enter, tab, space, escape, backspace, delete, up/down/left/right, home, end, pageup, pagedown, a-z, 0-9, f1-f12. Modifiers: cmd, shift, alt, ctrl, fn. Example: key="c", modifiers=["cmd"] for Cmd+C (Windows: use ctrl).',
      parameters: {
        key: { type: 'string', required: true, description: 'Key name or single character.' },
        modifiers: { type: 'array', items: { type: 'string' }, description: 'Modifier list, e.g. ["cmd", "shift"].' },
      },
      output: actionOutput,
      timeoutMs: 90000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const mods = Array.isArray(args.modifiers) ? args.modifiers.join(',') : ''
        await nativeRun(['key', args.key, mods], exec.signal)
        return { ok: true, message: 'Pressed ' + args.key + (mods ? ' with ' + mods : '') }
      },
    })

    register({
      name: 'computer_open',
      description: 'Launch or activate an app, open a file path, or open a URL with the default app. Pass app=true to force treating target as an app name.',
      parameters: {
        target: { type: 'string', required: true, description: 'App name, file path, or URL.' },
        app: { type: 'boolean', description: 'Treat target as an app name; default false.' },
      },
      output: actionOutput,
      timeoutMs: 90000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        await nativeRun(['open', args.target, args.app ? '1' : '0'], exec.signal)
        return { ok: true, message: 'Opened ' + args.target }
      },
    })

    harness.handle('computer-use/status', async () => statusPayload())
    harness.handle('computer-use/latest', async () => latestPayload())
    harness.handle('computer-use/capture', async () => {
      try {
        await captureScreen({}, undefined)
        return await latestPayload()
      } catch (e) {
        return { dataUrl: null, width: 0, height: 0, capturedAt: null, error: String(e && e.message || e) }
      }
    })
    harness.handle('computer-use/click', async (args) => {
      try {
        const p = toPoint(Number(args.x), Number(args.y))
        await nativeRun(['click', p.x, p.y, args.button || 'left', args.double ? 'double' : 'single'])
        return { ok: true, message: 'Clicked at (' + p.x + ', ' + p.y + ')' }
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) }
      }
    })
  },
}
