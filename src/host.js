// Computer Use for DSH — Host half (cross-platform: macOS / Linux / Windows).
// Build step replaces the __*_SOURCE__ placeholders with the native helper file contents.
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const subprocess = ctx.get('subprocess')
    const attachments = ctx.get('attachments')

    const MACOS_HELPER_SOURCE = __MACOS_HELPER_SOURCE__
    const LINUX_HELPER_SOURCE = __LINUX_HELPER_SOURCE__
    const WINDOWS_HELPER_SOURCE = __WINDOWS_HELPER_SOURCE__

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
