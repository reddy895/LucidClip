use lucidclip_lib::platform::hotkeys::{DEFAULT_HISTORY_SHORTCUT, FALLBACK_HISTORY_SHORTCUT, ShortcutKey};

#[test]
fn test_parse_ctrl_v_z_sequence() {
    let parsed = ShortcutKey::parse("Ctrl+V+Z").expect("Failed to parse Ctrl+V+Z");
    assert!(parsed.ctrl);
    assert!(!parsed.shift);
    assert!(!parsed.alt);
    assert!(!parsed.meta);
    assert!(parsed.is_sequence());
    assert_eq!(parsed.sequence_keys, vec!["V", "Z"]);
    assert_eq!(parsed.canonical(), "Ctrl+V+Z");
}

#[test]
fn test_parse_lowercase_sequence() {
    let parsed = ShortcutKey::parse("ctrl+v+z").expect("Failed to parse lowercase ctrl+v+z");
    assert!(parsed.ctrl);
    assert!(parsed.is_sequence());
    assert_eq!(parsed.sequence_keys, vec!["V", "Z"]);
    assert_eq!(parsed.canonical(), "Ctrl+V+Z");
}

#[test]
fn test_parse_fallback_chord() {
    let parsed = ShortcutKey::parse("Ctrl+Shift+V").expect("Failed to parse Ctrl+Shift+V");
    assert!(parsed.ctrl);
    assert!(parsed.shift);
    assert!(!parsed.is_sequence());
    assert_eq!(parsed.sequence_keys, vec!["V"]);
    assert_eq!(parsed.canonical(), "Ctrl+Shift+V");
}

#[test]
fn test_parse_cmdorctrl_alias() {
    let parsed = ShortcutKey::parse("CommandOrControl+V+Z").expect("Failed to parse CommandOrControl alias");
    assert!(parsed.ctrl);
    assert!(parsed.is_sequence());
    assert_eq!(parsed.canonical(), "Ctrl+V+Z");
}

#[test]
fn test_parse_constants() {
    let def = ShortcutKey::parse(DEFAULT_HISTORY_SHORTCUT).unwrap();
    assert!(def.is_sequence());
    assert_eq!(def.canonical(), "Ctrl+V+Z");

    let fallback = ShortcutKey::parse(FALLBACK_HISTORY_SHORTCUT).unwrap();
    assert!(!fallback.is_sequence());
    assert_eq!(fallback.canonical(), "Ctrl+Shift+V");
}

#[test]
fn test_parse_invalid_inputs() {
    assert!(ShortcutKey::parse("").is_err());
    assert!(ShortcutKey::parse("Ctrl").is_err()); // No primary key
    assert!(ShortcutKey::parse("Ctrl+").is_err()); // Empty part
    assert!(ShortcutKey::parse("Ctrl+V+Z+X").is_err()); // More than 2 sequence keys
    assert!(ShortcutKey::parse("Ctrl+InvalidKeyName").is_err()); // Invalid key name
}
