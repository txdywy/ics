# Month Calendar View and Favicon Design

## Goal

Add a complete monthly calendar overview to the existing static ICS Calendar Shelf site. The month view should show events from all indexed calendars on their calendar dates, support switching year and month, and preserve the existing calendar card gallery for subscription and download details. Also add a cute favicon that matches the site identity.

## Current Context

The site is a pure static GitHub Pages app. `scripts/generate-calendars.mjs` scans root-level `.ics` files and writes `calendars.json`. `index.html`, `assets/app.js`, and `assets/styles.css` render the current hero, filters, cards, download actions, webcal actions, and subscription guide. The current deployment uses GitHub Actions and the canonical custom domain `https://ics.hackx64.eu.org/`.

## Chosen Approach

Add the month calendar as a primary overview section below the hero and above the existing search/filter/card gallery.

The existing gallery remains available because it answers a different user question: what each calendar is and how to subscribe to it. The month view answers what happens on each day.

## Data Model Changes

Each calendar record in `calendars.json` should continue to include `previewEvents` for the card gallery.

Each calendar record should also include a full `events` array for month rendering. Each event should contain:

- `summary`: display title of the event
- `date`: normalized `YYYY-MM-DD` date
- `calendarId`: parent calendar id
- `calendarTitle`: parent calendar title
- `category`: parent calendar category object or label/id pair
- `visual`: parent visual metadata needed for emoji and colors

`previewEvents` remains capped for cards. `events` is the source of truth for the month view.

Events without parseable dates are excluded from `events` but do not prevent the calendar from appearing as a card.

## Page Structure

The page order becomes:

1. Hero and site statistics
2. Month calendar overview
3. Existing search/filter/display controls
4. Existing calendar card/list gallery
5. Existing subscription guide

The month section is introduced with a friendly title and short explanation, making it clear that all calendars are shown together by default.

## Month Calendar Controls

The month calendar header includes:

- Previous month button
- Year dropdown
- Month dropdown
- Today button
- Next month button

The displayed heading uses Chinese date formatting, such as `2026 年 4 月`.

Year options should be derived from the indexed event date range. If there are no dated events, the fallback range is current year minus two through current year plus two.

## Month Grid Behavior

The month grid uses a stable 6-row by 7-column layout with Monday as the first day of the week.

Each cell includes:

- day number
- subdued style if the date belongs to the previous or next month
- visible highlight for today
- up to three event pills
- `+N 更多` indicator when more than three events occur on the date

Each event pill includes:

- a theme color marker derived from the calendar visual colors
- a short event title
- calendar emoji when available

Clicking a day cell or its `+N 更多` indicator selects that date.

## Selected Day Detail Panel

Below the month grid, show a selected-day detail panel.

The default selected date is today. If today is not in the currently displayed month, the panel still reflects the selected date until the user selects another date or uses the Today button.

The detail panel includes:

- selected date heading
- all events for that date, not capped
- event title
- parent calendar title
- category or theme marker
- small download and webcal links for the parent calendar when safe URLs are available

If there are no events for the selected date, show a cute empty state such as `这一天还没有事件，适合发呆和喝奶茶。`

## Relationship to Existing Filters

The month calendar always shows all indexed calendars. Existing search, category filters, sort, card/list view, and event preview toggle continue to affect only the card gallery.

This keeps the month overview stable while users search for subscription sources below.

## Favicon

Add `favicon.svg` and reference it from `index.html`:

```html
<link rel="icon" href="favicon.svg" type="image/svg+xml">
```

The favicon should be a small rounded calendar icon with a star or heart accent. It should be readable at small tab sizes and match the warm, cute visual language of the site.

## Error Handling

- If `events` is missing from older `calendars.json` data, the frontend may fall back to `previewEvents` and mark the month data as limited.
- If no dated events exist, the month grid still renders and the detail panel shows empty states.
- If an event has malformed data, it is skipped in month grouping instead of breaking rendering.
- Existing URL sanitization continues to protect download, webcal, and copy actions.

## Testing and Verification

Implementation should add or update tests for:

- generator output includes full `events`
- `previewEvents` remains capped for cards
- generated event entries include calendar id/title/category/visual context
- `buildMonthGrid(year, month)` returns 42 day cells
- month grid starts on Monday
- previous/next month padding cells are included
- `groupEventsByDate` merges events from multiple calendars on the same date
- `getYearOptions` derives years from event dates and uses fallback years when empty

Browser verification should confirm:

- month calendar appears below the hero and above the existing controls
- current month renders by default
- year/month dropdowns switch the grid
- previous month, next month, and Today buttons work
- dates show at most three event pills plus `+N 更多`
- selecting a date updates the detail panel
- existing card search/filter/sort/view/download/webcal/copy behavior still works
- favicon loads without a browser console 404

## Out of Scope

- Full recurrence expansion beyond already parsed concrete `DTSTART` dates
- Per-calendar toggles in the month calendar
- Drag-and-drop calendar editing
- Persisted user preferences
- Moving `.ics` files out of the repository root
