# LucidClip — Critical Bug Fix & Keyboard Control Commit Ledger (81 Commits)

This ledger documents the implementation of all 81 commits resolving the screenshot history unavailability bug and implementing the system-wide `Ctrl+V+Z` sequence keyboard control engine.

---

## Phase 1: Audit, Root Cause Investigation & Data Models (Commits 1–9)
1. `7a3b57b` - `docs(audit): establish root cause analysis for screenshot pipeline failures`
2. `2e0bfc6` - `docs(shortcuts): specify Ctrl+V followed by Ctrl+Z sequence engine architecture`
3. `aa2bc9f` - `chore(types): define structured ScreenshotImagePayload and DataUrl response models`
4. `19abdae` - `chore(types): update ImageVariant and MediaType contracts in frontend types`
5. `6dd1b4a` - `chore(types): add sequence shortcut definition to settings schema`
6. `b856eb2` - `feat(backend): add error variants for image decoding, sequence timeouts, and corrupt files`
7. `c987ac0` - `feat(backend): implement serialization helpers for ScreenshotImageData`
8. `2b595b4` - `test(types): add type regression test for image response payload unpacking`
9. `9659d96` - `chore(scripts): register image payload test suite in automated test runner`

---

## Phase 2: Pipeline Fix: Robust Media Storage & Path Resolution (Commits 10–18)
10. `3db711b` - `feat(storage): support relative and basename path resolution in AppPaths`
11. `333b7d2` - `feat(storage): implement restart-safe image resolution with directory migration fallback`
12. `101c99c` - `feat(storage): implement automatic thumbnail regeneration for missing or corrupted thumbnails`
13. `1c338b6` - `feat(storage): add corrupted image detection and recovery in resolve_image_file`
14. `307d06f` - `feat(storage): implement safe cleanup of associated media files on entry deletion`
15. `fff154c` - `feat(storage): prevent deletion of unrelated files during history cleanup`
16. `693a6ec` - `feat(storage): store canonical relative paths in database to survive folder relocation`
17. `948336b` - `test(storage): add unit tests for relative path resolution and restart survival`
18. `3c6e589` - `test(storage): add unit tests for thumbnail regeneration and corrupt file handling`

---

## Phase 3: Pipeline Fix: Clipboard Image Detection & Ingestion (Commits 19–27)
19. `a0e0ffc` - `feat(clipboard): support registered PNG and JPEG clipboard formats on Windows`
20. `be78e10` - `feat(clipboard): decode memory-backed PNG/JPEG streams via image crate on Windows`
21. `a64d839` - `feat(clipboard): enhance Linux GTK clipboard image ingestion with fallback target probing`
22. `e43a947` - `feat(clipboard): implement image dimension and byte size validation guards`
23. `e8da83b` - `feat(clipboard): compute collision-resistant image hashes including format tags`
24. `4a58f41` - `feat(clipboard): preserve source format metadata in clipboard entry database records`
25. `18dd853` - `feat(clipboard): emit versioned image capture events with dimensions and thumbnail availability`
26. `5e93c2a` - `test(clipboard): add unit tests for multi-format image detection and decoding`
27. `6682a09` - `test(clipboard): add unit tests for image deduplication and repeated copy timestamp refresh`

---

## Phase 4: Frontend Fix: Data URL Parsing & Rendering (Commits 28–36)
28. `8b0f7cb` - `fix(frontend): unpack data_url from ScreenshotImageData in TauriClipboardService`
29. `14ad132` - `fix(frontend): unpack data_url from ScreenshotImageData in TauriScreenshotService`
30. `117ce7c` - `fix(frontend): render real image thumbnails in FloatingClipboardPopup rows`
31. `f2ede9b` - `fix(frontend): handle image loading, error, and fallback states in PopupHistoryRow`
32. `de0ccb5` - `fix(frontend): eliminate broken [object Object] img src in ClipboardRow`
33. `88a5d60` - `fix(frontend): enhance TextPreview modal with full-resolution clipboard image inspection`
34. `22edaf2` - `fix(frontend): add fallback badges for missing or corrupted image files`
35. `918aeca` - `test(frontend): add component test for PopupHistoryRow image thumbnail rendering`
36. `cc5c5ff` - `chore(scripts): register popup image rendering test in test-runner.mjs`

---

## Phase 5: Global Sequence Hotkey Engine Architecture (Commits 37–45)
37. `d6aa7d2` - `feat(hotkeys): design sequence shortcut state machine specification`
38. `681198e` - `feat(hotkeys): implement timing window and key release tracking in SequenceDetector`
39. `1281bab` - `feat(hotkeys): parse multi-key sequence shortcut strings like 'Ctrl+V+Z'`
40. `8be9322` - `feat(hotkeys): add SequenceShortcut configuration model with fallback chord support`
41. `0d26cba` - `feat(hotkeys): implement pass-through forwarding for incomplete sequences`
42. `282ce66` - `feat(hotkeys): add accidental paste and undo suppression on sequence match`
43. `a7cdf51` - `feat(hotkeys): implement hotkey configuration persistence in user settings`
44. `6ef493e` - `test(hotkeys): add unit tests for sequence detection state machine transitions`
45. `72eb4b5` - `test(hotkeys): add unit tests for sequence shortcut string parsing and validation`

---

## Phase 6: Native Windows Low-Level Hook & Sequence Detection (Commits 46–54)
46. `f8d402e` - `feat(hotkeys): implement Windows low-level keyboard hook (WH_KEYBOARD_LL)`
47. `cca6fc2` - `feat(hotkeys): intercept VK_CONTROL, VK_V, and VK_Z in Windows hook procedure`
48. `7f2d6f4` - `feat(hotkeys): dispatch popup open event on Ctrl+V+Z detection in Windows hook`
49. `2656f2a` - `feat(hotkeys): swallow matching sequence keys to prevent accidental paste and undo`
50. `8c7fcdd` - `feat(hotkeys): forward normal Ctrl+V and Ctrl+Z events when sequence is not completed`
51. `53b50c9` - `feat(hotkeys): implement clean hook unregistration on thread termination`
52. `f29496f` - `feat(hotkeys): capture foreground target window before displaying popup in hook`
53. `abb3f96` - `feat(hotkeys): surface Windows hook registration errors cleanly in status IPC`
54. `7c97195` - `test(hotkeys): add unit tests for Windows hook keycode mapping and sequence simulation`

---

## Phase 7: Native Linux X11/Wayland Shortcut Engine & Sequence Handling (Commits 55–63)
55. `a7b1e9a` - `feat(hotkeys): implement Linux X11 global key grab listener for sequence keys`
56. `97b23b4` - `feat(hotkeys): feed X11 KeyPress/KeyRelease events into SequenceDetector`
57. `f1318de` - `feat(hotkeys): forward uncompleted Ctrl+V and Ctrl+Z via XTest fake key events`
58. `6585ec2` - `feat(hotkeys): swallow keys and trigger popup when Ctrl+V+Z sequence matches on Linux`
59. `10707eb` - `feat(hotkeys): capture active window via _NET_ACTIVE_WINDOW in Linux sequence listener`
60. `7abfed4` - `feat(hotkeys): provide honest Wayland diagnostics and fallback notification`
61. `de86e49` - `feat(hotkeys): manage Linux hotkey thread lifecycle with atomic stop signal`
62. `4800322` - `feat(hotkeys): wire Linux sequence hotkey listener in application startup`
63. `115765a` - `test(hotkeys): add unit tests for Linux X11 sequence event translation and timeouts`

---

## Phase 8: Popup Integration, Selection vs Paste, and Keyboard Controls (Commits 64–72)
64. `8ce0054` - `feat(popup): support configurable paste-on-select vs copy-to-clipboard behavior`
65. `c9c1506` - `feat(popup): implement Shift+Enter for copy-only without synthetic paste`
66. `225d0d2` - `feat(popup): enhance Enter key to respect pasteOnSelect preference`
67. `53ab0f8` - `feat(popup): prevent LucidClip clipboard updates from re-recording during popup actions`
68. `1211c78` - `feat(popup): display clear action indicators in popup footer (Enter vs Shift+Enter)`
69. `0d0ed8b` - `feat(settings): expose Ctrl+V+Z shortcut option and pasteOnSelect toggle in Settings UI`
70. `28637bf` - `feat(settings): validate shortcut input and display sequence explanation in Settings`
71. `40ec82a` - `test(popup): add integration tests for pasteOnSelect and Shift+Enter behavior`
72. `a4f1bb0` - `chore(scripts): register popup paste action test in test-runner.mjs`

---

## Phase 9: Comprehensive Regression Test Suite & Documentation (Commits 73–81)
73. `dcc5d38` - `test(regression): add full end-to-end test copying screenshot and verifying rendering`
74. `15d32ad` - `test(regression): add test verifying screenshot survives application restart simulation`
75. `bc4289b` - `test(regression): add test verifying normal Ctrl+V and Ctrl+Z are not broken by sequence hook`
76. `a64b8fe` - `test(regression): add test verifying global Ctrl+V+Z triggers popup while app is in background`
77. `80b9f19` - `docs(shortcuts): document complete Ctrl+V+Z sequence workflow and platform behavior`
78. `18281fa` - `docs(screenshots): document screenshot pipeline architecture and image data URL contract`
79. (This commit) - `docs(ledger): record audit ledger for all 81 bug fix and control commits`
80. (Next commit) - `docs(architecture): update architecture documentation with sequence engine and image contracts`
81. (Final commit) - `chore(release): verify all test suites, typechecks, and production bundle for push`
