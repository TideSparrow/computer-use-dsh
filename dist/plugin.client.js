// Computer Use for DSH — Client half (browser): live screen panel in the run card.
return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`.dsh-cu-panel { font-size: 12px; line-height: 1.5; }
.dsh-cu-panel .row { display: flex; gap: 6px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
.dsh-cu-panel button { font-size: 12px; padding: 2px 10px; border-radius: 6px; border: 1px solid rgba(127,127,127,.5); background: transparent; color: inherit; cursor: pointer; }
.dsh-cu-panel button:disabled { opacity: .5; cursor: default; }
.dsh-cu-panel .shot { max-width: 100%; max-height: 420px; border: 1px solid rgba(127,127,127,.35); border-radius: 6px; cursor: crosshair; display: block; }
.dsh-cu-panel .meta { color: rgba(127,127,127,.9); }
.dsh-cu-panel .error { color: #e5484d; white-space: pre-wrap; }
.dsh-cu-panel .ok { color: #30a46c; }
`)

    function ComputerUsePanel() {
      const [shot, setShot] = React.useState(null)
      const [status, setStatus] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [live, setLive] = React.useState(false)

      const applyRefresh = () => {
        host.call('computer-use/latest').then((r) => setShot(r)).catch((e) => setShot({ error: String(e && e.message || e) }))
        host.call('computer-use/status').then((r) => setStatus(r)).catch(() => {})
      }

      React.useEffect(() => {
        applyRefresh()
        return undefined
      }, [])

      React.useEffect(() => {
        if (!live) return undefined
        const dispose = ctx.interval(() => applyRefresh(), 2500)
        return dispose
      }, [live])

      const onShotClick = (ev) => {
        const img = ev.currentTarget
        const rect = img.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const x = Math.round((ev.clientX - rect.left) * (img.naturalWidth / rect.width))
        const y = Math.round((ev.clientY - rect.top) * (img.naturalHeight / rect.height))
        setBusy(true)
        host.call('computer-use/click', { x, y })
          .then(() => host.call('computer-use/latest'))
          .then((r) => setShot(r))
          .catch((e) => setShot({ error: String(e && e.message || e) }))
          .finally(() => setBusy(false))
      }

      const onCapture = () => {
        setBusy(true)
        host.call('computer-use/capture')
          .then((r) => setShot(r))
          .catch((e) => setShot({ error: String(e && e.message || e) }))
          .finally(() => setBusy(false))
      }

      const err = (shot && shot.error) || null
      const needsScreen = err && err.includes('Screen Recording')
      const needsA11y = err && err.includes('Accessibility')

      return React.createElement('div', { className: 'dsh-cu-panel' },
        React.createElement('div', { className: 'row' },
          React.createElement('strong', null, '🖥 Computer Use'),
          React.createElement('span', { className: 'meta' }, status ? 'platform: ' + (status.platform || '?') + (status.accessibility ? ' · accessibility ✓' : ' · accessibility ✗') : ''),
        ),
        React.createElement('div', { className: 'row' },
          React.createElement('button', { onClick: onCapture, disabled: busy }, busy ? '…' : '📷 Capture'),
          React.createElement('button', { onClick: applyRefresh, disabled: busy }, 'Refresh'),
          React.createElement('button', { onClick: () => setLive(!live) }, live ? '● Live' : '○ Live'),
          React.createElement('span', { className: 'meta' }, shot && shot.width ? shot.width + 'x' + shot.height + ' px' : ''),
        ),
        err ? React.createElement('div', { className: 'error' }, err) : null,
        needsScreen ? React.createElement('div', { className: 'error' }, '→ System Settings › Privacy & Security › Screen Recording: enable the app hosting DSH, then press Capture.') : null,
        needsA11y ? React.createElement('div', { className: 'error' }, '→ System Settings › Privacy & Security › Accessibility: enable the app hosting DSH for mouse/keyboard control.') : null,
        shot && shot.dataUrl ? React.createElement('img', { className: 'shot', src: shot.dataUrl, alt: 'screen', onClick: onShotClick, title: 'Click to click at that point' }) : null,
        shot && !shot.dataUrl && !shot.error ? React.createElement('div', { className: 'meta' }, 'No screenshot yet — press Capture.') : null,
      )
    }

    slots.inject('tool.view.cordis', () => slots.register(
      { name: 'tool.view.cordis', key: 'self' },
      () => React.createElement(ComputerUsePanel, null),
    ))
  },
}
