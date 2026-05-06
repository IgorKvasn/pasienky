# Timeline Bar Visualization

Replace the card-based weekly view with horizontal timeline bars. Switch to dark theme. Add XLS source link.

## Changes

### Timeline bars (replaces week-grid + cards)

- One row per day (Mon–Sun), all 7 days shown even if no data
- Each row: day label (left, ~80px), horizontal bar (flex: 1) spanning 05:00–24:00
- Bar divided into segments by `TimetableSlot` time ranges
- Gaps (no slot data) rendered as dark/empty segments
- Hour tick marks overlaid on bars; hour labels in a header row above

### Segment coloring

Lane count → color mapping (same scale as mockup):

| Lanes | Color   | Hex       |
|-------|---------|-----------|
| 0     | dark bg | `#1a1c22` |
| 1     | red     | `#7a2e2e` |
| 2     | orange  | `#8a5a20` |
| 3     | yellow  | `#7a7a22` |
| 4     | green   | `#2a7a4a` |
| 5     | green+  | `#1e8a5a` |
| 6     | teal    | `#18806e` |
| 7     | blue    | `#1a6a8a` |
| 8     | blue+   | `#2255aa` |

Lane count number displayed inside segment text if segment is wide enough (>30px).

### Legend

Horizontal row of color swatches with lane counts below the timeline, similar to mockup.

### Dark theme

- Body/page background: `#0f1117`
- Card/container backgrounds: `#181a20`
- Text: `#e0e0e0` (primary), `#888` (secondary)
- Borders: `#2a2d35`
- Buttons: `#2a2d35` bg, `#ccc` text

### XLS source link

Display below the timeline: "Zdroj: Rozpis dráh – Bratislava.sk (XLS)" linking to `response().lastImport?.workbookUrl`. Only shown when URL is available.

### Removed

- Minimum lanes filter (slider) — removed entirely
- `minimumLanes` signal and `setMinimumLanes()` method
- `laneClass()` method
- Card/slot CSS

### Kept

- Header with title, last-updated timestamp, week navigation
- Loading/error/empty states
- Data fetching logic, `TimetableService`, week-utils

### Responsive (< 760px)

- Day label moves above the bar (column layout per row)
- Bars remain full-width

## Files to modify

- `app.html` — new template
- `app.css` — full rewrite (dark theme + timeline styles)
- `app.ts` — remove filter logic, add helper for timeline segment positioning
- `week-utils.ts` — add function to generate all 7 days of the week (even empty ones) and compute segment positions as percentages

## Data flow for segments

Given a day's `TimetableSlot[]` and the time range 05:00–24:00 (19 hours = 1140 minutes):

```
segmentLeftPercent = (slotStartMinutes - 300) / 1140 * 100
segmentWidthPercent = (slotEndMinutes - slotStartMinutes) / 1140 * 100
```

Gaps between slots rendered implicitly (bar background color = empty/dark).
