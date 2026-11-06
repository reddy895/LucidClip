# LucidClip — Desktop Frontend Implementation & Design Guide

**Document:** Frontend Architecture & Design Specification  
**Status:** Completed & Verified  
**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React  

---

## 1. Design Identity & Tokens

LucidClip follows a quiet, dark graphite desktop aesthetic engineered for professional daily use.

### 1.1 Color Palette

| Token | Value | Functional Role |
|---|---|---|
| Application Background | `#111315` | Deep graphite main workspace background |
| Sidebar Background | `#151719` | Structured secondary surface for navigation and preview panels |
| Primary Surface | `#191C20` | Base container and list card surface |
| Elevated Surface | `#22262B` | Modals, active rows, dialogs, popovers |
| Hover Surface | `#292E34` | Micro-interaction hover states |
| Border Primary | `#30363D` | Crisp structural separators and outlines |
| Border Secondary | `#252A30` | Subtle hairline dividers |
| Primary Text | `#F3F4F6` | High-contrast body and title typography |
| Secondary Text | `#A1A7B0` | Descriptive subtitles and labels |
| Muted Text | `#747C86` | Minor metadata, timestamps, and line counts |
| Accent | `#8B9CF7` | Restrained indigo/purple accent for focus, active views, selection |
| Accent Hover | `#A3B0FF` | Interactive accent hover |
| Success | `#55B889` | Operational success and active monitoring indicator |
| Warning | `#E5B567` | Monitoring paused and favorite markers |
| Error | `#E47777` | Destructive actions and delete confirmation triggers |

### 1.2 Typography Hierarchy

- **Font Family:** `Inter`, `Segoe UI`, system-ui, sans-serif
- **Monospace Family:** `JetBrains Mono`, `Cascadia Code`, `Consolas`, monospace
- **Page Titles:** 20px, font weight 600
- **Section Headings:** 14–16px, font weight 600
- **Primary Body:** 13px, font weight 400
- **Secondary Body / Metadata:** 11–12px
- **Buttons & Controls:** 13px, font weight 500

---

## 2. Desktop Application Structure

The interface uses a three-part desktop layout:

```text
+--------------------------------------------------------------------------+
|  [Sidebar Toggle]  LucidClip v1.0   [Quick Access]   [Monitoring Active] |
+------------------+------------------------------------+------------------+
|                  |  Section Title        Search & Sort|                  |
|  All Items       |  [ Search input               / ]  |  PREVIEW PANEL   |
|  Clipboard       |  [ All ] [ Text ] [ Code ] [ URLs ]|  Selected Item   |
|  Screenshots     |                                    |                  |
|  Pinned          |  Chrono History Feed               |  Full Content /  |
|  Favorites       |  - Today                           |  OCR Explorer    |
|                  |    > Entry 1                       |  Image Inspector |
|  ----------------|    > Entry 2                       |                  |
|  Storage Info    |  - Yesterday                       |  Metadata &      |
|  Settings        |    > Entry 3                       |  Quick Actions   |
+------------------+------------------------------------+------------------+
|  Monitoring Active • Win32 Hook    Total Entries      SQLite: Local-first|
+--------------------------------------------------------------------------+
```

### 2.1 Navigation Sidebar (`w-[220px]`, collapsible to `w-14`)
- Top LucidClip desktop icon + wordmark + version badge
- Navigation rows: All Items, Clipboard, Screenshots, Pinned, Favorites
- Bottom: Storage statistics display (`formatBytes`), Settings entry

### 2.2 Main Workspace Area
- Header with title, description, count badge, and sort dropdown
- Unified SearchBar with real-time text matching and category filter chips
- Chronological feeds with date group separators (`Today`, `Yesterday`, `Last 7 Days`, `Earlier`)
- Keyboard arrow navigation (`ArrowDown`, `ArrowUp`, `Enter`, `P`, `Delete`)

### 2.3 Right Contextual Preview Panel (`w-[320px]–[350px]`, collapsible)
- **Text Preview:** Syntax-highlighted code with line numbers, URL previews with domain cards, formatted full timestamps, word and character counts.
- **Screenshot Preview:** Aspect-ratio-preserved thumbnail, full image inspector modal, OCR extracted text viewer with one-click copy, and file export.

### 2.4 Quick Access Launcher Overlay (`Alt + Space`)
- Centered keyboard-driven launcher modal
- Search-as-you-type with query highlight
- Arrow navigation, Enter to copy immediately, Escape to dismiss

---

## 3. Desktop Resolution & Responsive Verification

Tested and validated across standard Windows resolutions:

| Target Resolution | Aspect Ratio | Sidebar | Preview Panel | Behavior |
|---|---|---|---|---|
| **1280 × 720** | 16:9 | 220px | Auto-collapsed (toggleable) | Clean 2-column workspace, no horizontal overflow |
| **1366 × 768** | ~16:9 | 220px | 320px | Full three-column layout, compact density |
| **1440 × 900** | 16:10 | 220px | 340px | Balanced layout, comfortable typography |
| **1920 × 1080** | 16:9 | 220px | 350px | Widescreen gallery (3-column screenshots grid) |

---

## 4. Keyboard Shortcuts Reference

| Shortcut | Scope | Action |
|---|---|---|
| `Alt + Space` | Global | Toggle Quick Access Launcher |
| `/` or `Ctrl + F` | Global | Focus search input |
| `Ctrl + B` | Global | Toggle sidebar collapse |
| `Ctrl + P` | Global | Toggle right preview panel |
| `Ctrl + 1` | Global | Switch to All Items |
| `Ctrl + 2` | Global | Switch to Clipboard |
| `Ctrl + 3` | Global | Switch to Screenshots |
| `Ctrl + 4` | Global | Switch to Pinned |
| `Ctrl + 5` | Global | Switch to Favorites |
| `Ctrl + ,` | Global | Switch to Settings |
| `↑` / `↓` | List View | Move active selection |
| `Enter` | List View | Copy selected item to clipboard |
| `P` | List View | Toggle pin status on selected item |
| `Delete` | List View | Delete selected item |
| `Escape` | Global | Close overlay, modal, or blur search input |

---

## 5. Development Verification

```bash
# Run development server
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Run production build
npm run build
```

