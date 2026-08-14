// macos-helper.swift — macOS input helper for the Computer Use DSH plugin.
// Compiled once with `swiftc -O` on first use and cached by the Host half.
// Subcommands: move / click / scroll / type / key / size / screensize / trusted
import CoreGraphics
import Foundation
import ApplicationServices

let args = CommandLine.arguments
if args.count < 2 {
    FileHandle.standardError.write("usage: helper <cmd> ...".data(using: .utf8)!)
    exit(2)
}
let cmd = args[1]

let posting = ["move", "click", "scroll", "type", "key"]
if posting.contains(cmd) {
    if !AXIsProcessTrusted() {
        FileHandle.standardError.write("ACCESSIBILITY_NOT_TRUSTED: the host process needs Accessibility permission in System Settings > Privacy & Security > Accessibility.".data(using: .utf8)!)
        exit(3)
    }
}

func num(_ i: Int) -> CGFloat { CGFloat(Double(args[i]) ?? 0) }
func int32(_ i: Int) -> Int32 { Int32(Double(args[i]) ?? 0) }

func moveMouse(_ x: CGFloat, _ y: CGFloat) {
    let p = CGPoint(x: x, y: y)
    CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
}

func clickAt(_ x: CGFloat, _ y: CGFloat, button: CGMouseButton, double: Bool) {
    moveMouse(x, y)
    usleep(60_000)
    let down: CGEventType = button == .right ? .rightMouseDown : (button == .center ? .otherMouseDown : .leftMouseDown)
    let up: CGEventType = button == .right ? .rightMouseUp : (button == .center ? .otherMouseUp : .leftMouseUp)
    let p = CGPoint(x: x, y: y)
    for _ in 0..<(double ? 2 : 1) {
        CGEvent(mouseEventSource: nil, mouseType: down, mouseCursorPosition: p, mouseButton: button)?.post(tap: .cghidEventTap)
        CGEvent(mouseEventSource: nil, mouseType: up, mouseCursorPosition: p, mouseButton: button)?.post(tap: .cghidEventTap)
        usleep(80_000)
    }
}

func scrollAt(_ x: CGFloat, _ y: CGFloat, dx: Int32, dy: Int32) {
    moveMouse(x, y)
    usleep(40_000)
    let s = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0)
    s?.post(tap: .cghidEventTap)
}

func typeText(_ text: String) {
    let src = CGEventSource(stateID: .hidSystemState)
    var chars = Array(text.utf16)
    let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)
    down?.keyboardSetUnicodeString(stringLength: chars.count, unicodeString: &chars)
    down?.post(tap: .cghidEventTap)
    let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
    up?.keyboardSetUnicodeString(stringLength: chars.count, unicodeString: &chars)
    up?.post(tap: .cghidEventTap)
}

let keyCodes: [String: CGKeyCode] = [
    "return": 36, "enter": 36, "tab": 48, "space": 49, "escape": 53, "esc": 53,
    "backspace": 51, "delete": 117, "up": 126, "down": 125, "left": 123, "right": 124,
    "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
    "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
    "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19,
    "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28,
    "0": 29, "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "l": 37, "j": 38,
    "'": 39, "k": 40, ";": 41, ",": 43, "/": 44, "n": 45, "m": 46, ".": 47,
    "`": 50, "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
    "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
]

func keyPress(_ name: String, modifiers: [String]) {
    let lower = name.lowercased()
    var flags: CGEventFlags = []
    for m in modifiers {
        switch m.lowercased() {
        case "cmd", "command": flags.insert(.maskCommand)
        case "shift": flags.insert(.maskShift)
        case "alt", "option": flags.insert(.maskAlternate)
        case "ctrl", "control": flags.insert(.maskControl)
        case "fn": flags.insert(.maskSecondaryFn)
        default: break
        }
    }
    if let code = keyCodes[lower] {
        let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true)
        down?.flags = flags
        down?.post(tap: .cghidEventTap)
        let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false)
        up?.flags = flags
        up?.post(tap: .cghidEventTap)
    } else {
        typeText(name)
    }
}

switch cmd {
case "move":
    moveMouse(num(2), num(3))
case "click":
    let button: CGMouseButton = args.count > 4 && args[4] == "right" ? .right : (args.count > 4 && args[4] == "middle" ? .center : .left)
    let double = args.count > 5 && args[5] == "double"
    clickAt(num(2), num(3), button: button, double: double)
case "scroll":
    scrollAt(num(2), num(3), dx: int32(4), dy: int32(5))
case "type":
    if args.count > 2 { typeText(args[2]) }
case "key":
    let modifiers = args.count > 3 ? Array(args[3].split(separator: ",")).map(String.init) : []
    keyPress(args[2], modifiers: modifiers)
case "screensize":
    fallthrough
case "size":
    let b = CGDisplayBounds(CGMainDisplayID())
    print(String(Int(b.width)) + " " + String(Int(b.height)))
case "trusted":
    print(AXIsProcessTrusted() ? "1" : "0")
default:
    FileHandle.standardError.write(("unknown command " + cmd).data(using: .utf8)!)
    exit(2)
}
