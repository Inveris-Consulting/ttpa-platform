# R&R TTPA Platform — Design System Specification

Welcome to the official **R&R TTPA Analytical Platform Design System**. This document defines the design tokens, visual language, UI components, typography hierarchy, chart guidelines, and dark mode rules for all applications under the R&R TTPA division.

---

## 🎨 1. Brand Identity & Color Tokens

### 1.1 Core Brand Colors
The color scheme is anchored around R&R's corporate Royal Navy Blue, combined with TTPA's Electric Blue action color and Gold accent highlights.

| Token Name | CSS Variable | Hex Code | Usage / Purpose |
| :--- | :--- | :--- | :--- |
| **Navy Deep** | `--rr-navy-deep` | `#0B1340` | Dark background gradients, deep header surfaces |
| **Navy Header** | `--rr-navy-header` | `#15226D` | Primary navigation header & corporate brand banner |
| **Navy Surface** | `--rr-navy-surface` | `#1B2980` | Elevated navy card containers & primary buttons |
| **Electric Blue** | `--ttpa-blue-primary` | `#2563EB` | Primary interactive buttons, active tabs, chart primary series |
| **Electric Blue Hover** | `--ttpa-blue-hover` | `#1D4ED8` | Hover state for electric blue elements |
| **Gold Accent** | `--rr-gold` | `#F59E0B` | Accent badges, gold buttons, star highlights, alert warnings |
| **Gold Light** | `--rr-gold-light` | `#FEF3C7` | Background highlight for gold badges |

### 1.2 Data Visualization Color Palette
Curated colors specifically tuned for dark/light mode chart contrast:

- **Primary Series**: `#2563EB` (Electric Blue)
- **Dark Neutral Series**: `#1E293B` (Slate Dark)
- **Cyan Series**: `#06B6D4` (SMS / Short Calls)
- **Amber Series**: `#F59E0B` (Deals / +1min Calls)
- **Purple Series**: `#8B5CF6` (+30s Calls)
- **Green Status**: `#10B981` (Conversion Growth / Positive Metrics)
- **Red Status**: `#EF4444` (Drop / Escalations)

---

## ✒️ 2. Typography System

The platform uses **Plus Jakarta Sans** for headings/UI controls and **Inter** for dense data displays.

### 2.1 Font Scale
```css
/* Typography Scale Tokens */
--font-family-sans: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
```

- **Display KPI**: `36px` / Line Height: `1.1` / Weight: `800 (Extra Bold)` / Tracking: `-0.03em`
- **Heading 1**: `24px` / Weight: `700 (Bold)` / Tracking: `-0.02em`
- **Heading 2**: `18px` / Weight: `600 (SemiBold)`
- **Heading 3 / Subtitle**: `15px` / Weight: `600 (SemiBold)`
- **Body Standard**: `14px` / Weight: `400 (Regular)` or `500 (Medium)`
- **Caption / Badge**: `12px` / Weight: `600 (SemiBold)`
- **Micro / Subtext**: `11px` / Weight: `500 (Medium)`

---

## 📐 3. Grid, Radii & Elevation

### 3.1 Border Radius Tokens
- **Small (`--radius-sm`)**: `6px` (Buttons, inputs, dropdowns)
- **Medium (`--radius-md`)**: `10px` (Cards, filter containers)
- **Large (`--radius-lg`)**: `14px` (Main modal dialogs, hero banners)
- **Pill (`--radius-full`)**: `9999px` (Status badges, tab pills)

### 3.2 Shadows & Layering
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04);
--shadow-card: 0 10px 30px -5px rgba(21, 34, 109, 0.06), 0 4px 10px -2px rgba(0, 0, 0, 0.02);
--shadow-card-hover: 0 18px 36px -6px rgba(21, 34, 109, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.04);
```

---

## 🧩 4. Core UI Components

### 4.1 Header Banner (`.ttpa-header`)
The top bar uses a deep royal navy gradient with a 2px R&R Gold accent bottom border:
```tsx
<header className="ttpa-header">
  <div className="ttpa-brand">
    <img src="/assets/rr_logo_white.webp" className="ttpa-brand-logo" />
    <div className="ttpa-brand-title">
      TTPA Dashboard <span className="ttpa-brand-badge">R&R Division</span>
    </div>
  </div>
</header>
```

### 4.2 KPI Metric Cards (`.ttpa-kpi-card`)
Cards designed for scannability with large numbers, context labels, and trend badges:
```tsx
<div className="ttpa-kpi-card">
  <span className="ttpa-kpi-label">Submissions</span>
  <span className="ttpa-kpi-value">131</span>
  <span className="ttpa-kpi-subtext">HubSpot CRM</span>
</div>
```

### 4.3 Buttons (`.ttpa-btn`)
Variants:
- `.ttpa-btn-primary`: Electric Blue with soft shadow
- `.ttpa-btn-navy`: Deep R&R Navy
- `.ttpa-btn-gold`: R&R Gold accent
- `.ttpa-btn-outline`: Bordered with hover fill

---

## 🌓 5. Light & Dark Theme Guidelines

Theme switching is handled dynamically by toggling `data-theme="dark"` on `document.documentElement`:

```css
[data-theme="dark"] {
  --bg-app: #0B1120;
  --bg-surface: #1E293B;
  --border-subtle: #334155;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
}
```

---
*R&R Rent & Recruit — TTPA Division Analytical Platform Design System v1.0.0*
