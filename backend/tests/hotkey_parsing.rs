use lucidclip_lib::platform::hotkeys::ShortcutKey;

#[test]
fn test_standard_and_alias_shortcut_parsing() {
    let cases = vec![
        ("ctrl+shift+v", "Ctrl+Shift+V", true, true, false, false, "V"),
        ("CTRL+ALT+C", "Ctrl+Alt+C", true, false, true, false, "C"),
        ("CommandOrControl+Shift+Space", "Ctrl+Shift+SPACE", true, true, false, false, "SPACE"),
        ("meta+shift+enter", "Shift+Meta+ENTER", false, true, false, true, "ENTER"),
        ("alt+shift+f12", "Alt+Shift+F12", false, true, true, false, "F12"),
    ];

    for (raw, expected_canonical, ctrl, shift, alt, meta, key) in cases {
        let parsed = ShortcutKey::parse(raw).unwrap_or_else(|e| panic!("Failed to parse '{}': {}", raw, e));
        assert_eq!(parsed.ctrl, ctrl, "ctrl mismatch for '{}'", raw);
        assert_eq!(parsed.shift, shift, "shift mismatch for '{}'", raw);
        assert_eq!(parsed.alt, alt, "alt mismatch for '{}'", raw);
        assert_eq!(parsed.meta, meta, "meta mismatch for '{}'", raw);
        assert_eq!(parsed.key, key, "key mismatch for '{}'", raw);
        assert_eq!(parsed.canonical(), expected_canonical, "canonical mismatch for '{}'", raw);
    }
}

#[test]
fn test_invalid_shortcut_strings() {
    let invalid_inputs = vec![
        "",
        "   ",
        "Ctrl",
        "Shift",
        "Alt",
        "Ctrl+Shift",
        "Ctrl++V",
        "+Shift+V",
        "Ctrl+Shift+",
        "Ctrl+Shift+V+Extra",
    ];

    for input in invalid_inputs {
        assert!(
            ShortcutKey::parse(input).is_err(),
            "Expected failure for input: '{}'",
            input
        );
    }
}

#[test]
fn test_canonical_format_idempotency() {
    let raw = "shift+control+v";
    let parsed1 = ShortcutKey::parse(raw).expect("First parse");
    let canonical = parsed1.canonical();
    assert_eq!(canonical, "Ctrl+Shift+V");

    let parsed2 = ShortcutKey::parse(&canonical).expect("Second parse");
    assert_eq!(parsed2.canonical(), canonical);
    assert_eq!(parsed1, parsed2);
}
