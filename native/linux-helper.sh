#!/usr/bin/env bash
# linux-helper.sh — Linux input/screenshot helper for the Computer Use DSH plugin.
# Requires: xdotool (mouse/keyboard) and one of: grim / scrot / imagemagick(import) / gnome-screenshot.
# Usage: linux-helper.sh <action> [args...]
set -u

ACTION="${1:-}"
shift || true

case "$ACTION" in
  capture)
    # args: <outfile> [x y w h]  (region in screen pixels)
    OUT="$1"
    X="${2:-}"; Y="${3:-}"; W="${4:-}"; H="${5:-}"
    if command -v grim >/dev/null 2>&1; then
      if [ -n "$W" ]; then grim -g "${W}x${H}+${X}+${Y}" "$OUT"; else grim "$OUT"; fi
    elif command -v scrot >/dev/null 2>&1; then
      if [ -n "$W" ]; then scrot -a "${X},${Y},${W},${H}" -o "$OUT"; else scrot -o "$OUT"; fi
    elif command -v import >/dev/null 2>&1; then
      if [ -n "$W" ]; then import -window root -crop "${W}x${H}+${X}+${Y}" "$OUT"; else import -window root "$OUT"; fi
    elif command -v gnome-screenshot >/dev/null 2>&1; then
      if [ -n "$W" ]; then
        echo "NO_REGION_SUPPORT: gnome-screenshot cannot capture a region; install grim, scrot or imagemagick" >&2
        exit 4
      fi
      gnome-screenshot -f "$OUT"
    else
      echo "NO_SCREENSHOT_TOOL: install one of grim, scrot, imagemagick (import) or gnome-screenshot" >&2
      exit 4
    fi
    ;;
  size)
    # Screen size in pixels: "W H"
    if command -v xdpyinfo >/dev/null 2>&1; then
      xdpyinfo 2>/dev/null | awk '/dimensions:/{print $2; exit}' | tr 'x' ' '
    elif command -v xrandr >/dev/null 2>&1; then
      xrandr --current 2>/dev/null | awk '/primary/{print $4; exit}' | cut -d'+' -f1 | tr 'x' ' '
    elif command -v wmctrl >/dev/null 2>&1; then
      wmctrl -d 2>/dev/null | awk '/\*/{print $4; exit}' | tr 'x' ' '
    else
      echo "2560 1440"
    fi
    ;;
  move)
    xdotool mousemove "$1" "$2" 2>/dev/null || { echo "NO_XDOTOOL: install xdotool" >&2; exit 4; }
    ;;
  click)
    # args: x y [button] [double]
    xdotool mousemove "$1" "$2" 2>/dev/null || { echo "NO_XDOTOOL: install xdotool" >&2; exit 4; }
    BTN=1
    case "${3:-left}" in
      right) BTN=3 ;;
      middle) BTN=2 ;;
    esac
    if [ "${4:-single}" = "double" ]; then
      xdotool click --repeat 2 --delay 80 "$BTN"
    else
      xdotool click "$BTN"
    fi
    ;;
  scroll)
    # args: x y dx dy
    xdotool mousemove "$1" "$2" 2>/dev/null || { echo "NO_XDOTOOL: install xdotool" >&2; exit 4; }
    DX="${3:-0}"; DY="${4:-0}"
    if [ "$DY" -gt 0 ]; then
      N=$(( (DY + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 4; done
    elif [ "$DY" -lt 0 ]; then
      N=$(( (-DY + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 5; done
    fi
    if [ "$DX" -gt 0 ]; then
      N=$(( (DX + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 7; done
    elif [ "$DX" -lt 0 ]; then
      N=$(( (-DX + 119) / 120 )); for ((i=0; i<N; i++)); do xdotool click 6; done
    fi
    ;;
  type)
    # args: <text>
    if command -v xdotool >/dev/null 2>&1; then
      xdotool type --delay 30 "$1"
    elif command -v wtype >/dev/null 2>&1; then
      wtype "$1"
    else
      echo "NO_TYPE_TOOL: install xdotool or wtype" >&2
      exit 4
    fi
    ;;
  key)
    # args: <key> [modifiers csv]
    KEY="$1"; MODS="${2:-}"
    if ! command -v xdotool >/dev/null 2>&1; then
      echo "NO_XDOTOOL: install xdotool" >&2
      exit 4
    fi
    PRE=""
    if [ -n "$MODS" ]; then
      IFS=',' read -r -a MARR <<< "$MODS"
      for m in "${MARR[@]}"; do
        case "$m" in
          ctrl|control) PRE="${PRE}ctrl+" ;;
          alt|option) PRE="${PRE}alt+" ;;
          shift) PRE="${PRE}shift+" ;;
          cmd|command) PRE="${PRE}super+" ;;
          fn) PRE="${PRE}" ;;
        esac
      done
    fi
    case "$KEY" in
      return|enter) KEY=Return ;;
      tab) KEY=Tab ;;
      space) KEY=space ;;
      escape|esc) KEY=Escape ;;
      backspace) KEY=BackSpace ;;
      delete) KEY=Delete ;;
      up) KEY=Up ;;
      down) KEY=Down ;;
      left) KEY=Left ;;
      right) KEY=Right ;;
      home) KEY=Home ;;
      end) KEY=End ;;
      pageup) KEY=Page_Up ;;
      pagedown) KEY=Page_Down ;;
    esac
    xdotool key "${PRE}${KEY}"
    ;;
  trusted)
    echo "1"
    ;;
  open)
    # args: <target> [app]  — app=true -> gtk-launch, else xdg-open
    TARGET="$1"; APP="${2:-0}"
    if [ "$APP" = "1" ]; then
      if command -v gtk-launch >/dev/null 2>&1; then
        gtk-launch "$TARGET"
      else
        echo "NO_APP_LAUNCHER: gtk-launch not found" >&2
        exit 4
      fi
    else
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$TARGET"
      elif command -v gio >/dev/null 2>&1; then
        gio open "$TARGET"
      else
        echo "NO_OPENER: install xdg-utils or glib2 (gio)" >&2
        exit 4
      fi
    fi
    ;;
  *)
    echo "unknown action: $ACTION" >&2
    exit 2
    ;;
esac
