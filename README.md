# ab-datepicker

A lightweight, zero-dependency date-row + calendar picker with a fully integrated timeslot engine. Built for delivery scheduling UIs — supports timezone-aware cutoff logic, per-date/per-weekday slot overrides, slot-dependency date disabling, and automatic slot selection.

---

## Files

| File               | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `ab-datepicker.js` | Core library — `AbDatepicker` + `AbTimeslot`    |
| `ab-calendar.css`  | All styles for the datepicker and timeslot grid |
| `index.html`       | Full working demo                               |

---

## Quick start

```html
<!-- 1. Stylesheet -->
<link rel="stylesheet" href="ab-calendar.css" />

<!-- 2. Your markup (full layout control) -->
<div class="ab-datepicker-wrapper">
  <div class="ab-datepicker-header">
    <p>1. Select Delivery Date</p>
    <span id="ab-clock"></span>
  </div>
  <div id="my-daterow"></div>
  <div id="my-calendar" mode="popup" timezone="Asia/Kuala_Lumpur"></div>
</div>

<div class="ab-timeslot-wrapper">
  <div class="ab-timeslot-header">
    <p>2. Select Time Slot</p>
  </div>
  <div id="my-timeslots"></div>
</div>

<!-- 3. Script -->
<script src="ab-datepicker.js"></script>
<script>
  // Always init AbDatepicker FIRST — AbTimeslot inherits timezone from it.
  const picker = AbDatepicker.init({
    daterowId: "my-daterow",
    calendarId: "my-calendar",
    clockId: "ab-clock",
    timezone: "Asia/Kuala_Lumpur",
    accent: "#3a8b6b",
    slotDependency: true, // disable dates with no available slots
    initialRender: true, // fire onChange on page load
    onChange(val) {
      currentDateObj = val;
      if (typeof ts !== "undefined") ts.setDate(val.dateKey);
      updateSummary();
    },
  });

  const ts = AbTimeslot.init({
    containerId: "my-timeslots",
    slots: [
      {
        id: "9am_1pm",
        open: true,
        label: "Morning",
        timeRange: "9am – 1pm",
        prevdayCutoff: "17:00",
        displayText: "Between 9am and 1pm",
      },
      {
        id: "1pm_6pm",
        open: true,
        label: "Afternoon",
        timeRange: "1pm – 6pm",
        samedayCutoff: "14:00",
        displayText: "Between 1pm and 6pm",
      },
      {
        id: "6pm_9pm",
        open: true,
        label: "Evening",
        timeRange: "6pm – 9pm",
        samedayCutoff: "17:00",
        displayText: "Between 6pm and 9pm",
      },
      {
        id: "express",
        open: true,
        label: "Express",
        timeRange: "Next 90 mins",
        samedayCutoff: "16:00",
        showFrom: "10:00",
        showUntil: "19:00",
        displayText: "Express delivery (next 90 mins)",
      },
    ],
    onChange({ dateKey, slot, status }) {
      selectedSlot = slot;
      updateSummary();
    },
  });

  ts.linkDatepicker(picker, { lookAheadDays: 60 });
  ts.setDate(picker.getSelected());
</script>
```

---

## AbDatepicker options

| Option           | Type                  | Default               | Description                                                                                           |
| ---------------- | --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `daterowId`      | `string`              | —                     | ID of the date-row chip container                                                                     |
| `calendarId`     | `string`              | —                     | ID of the calendar panel. Reads `mode` and `timezone` attributes.                                     |
| `clockId`        | `string`              | —                     | Optional ID of an external element to receive the live clock                                          |
| `mode`           | `'inline' \| 'popup'` | `'inline'`            | Calendar display mode                                                                                 |
| `timezone`       | `string`              | `'Asia/Kuala_Lumpur'` | IANA timezone                                                                                         |
| `accent`         | `string`              | `'#3a8b6b'`           | Brand color (CSS hex)                                                                                 |
| `initialRender`  | `boolean`             | `false`               | Fire `onChange` once on load (via `setTimeout`) so downstream state is populated without a user click |
| `slotDependency` | `boolean`             | `false`               | Disable dates that have no available timeslots. Requires `ts.linkDatepicker()`.                       |
| `blockedDates`   | `string[]`            | `[]`                  | Dates to block, format `'DD-MM-YYYY'`                                                                 |
| `blockedRanges`  | `{start,end}[]`       | `[]`                  | Date ranges to block, `'YYYY-MM-DD'` format                                                           |
| `prevDayCutoff`  | `'HH:MM'`             | `null`                | Block tomorrow after this time today                                                                  |
| `sameDayCutoff`  | `'HH:MM'`             | `null`                | Block today after this time                                                                           |
| `sundayCutoff`   | `'HH:MM'`             | `null`                | Override cutoff for Sundays                                                                           |
| `noSunday`       | `boolean`             | `false`               | Block all Sundays                                                                                     |
| `noSaturday`     | `boolean`             | `false`               | Block all Saturdays                                                                                   |
| `dateCutoffs`    | `object`              | `{}`                  | Per-date cutoff overrides `{ 'YYYY-MM-DD': 'HH:MM' }`                                                 |
| `onChange`       | `function`            | —                     | Fired when date changes                                                                               |
| `beforeShowDay`  | `function`            | —                     | Return `false` to disable a date                                                                      |

### onChange payload

```js
{
  date      : '05-04-2026',   // DD-MM-YYYY (display format)
  dateKey   : '2026-04-05',   // YYYY-MM-DD (internal/sort format)
  time      : '14:30',        // current HH:MM in configured TZ
  dayofweek : 'Sun',
  dayIndex  : 0,              // 0=Sun … 6=Sat
  isToday   : false,
  isDisabled: false,
  year      : 2026,
  month     : 4,              // 1-based
  day       : 5,
  monthName : 'April',
}
```

### Public API

```js
picker.getSelected(); // 'DD-MM-YYYY' | null
picker.open() / picker.close();
picker.setCalMode("popup"); // 'inline' | 'popup'
picker.addBlockedDate("25-12-2026"); // DD-MM-YYYY
picker.clearBlockedDates();
picker.reload(); // full re-render after config changes
```

---

## AbTimeslot options

| Option             | Type         | Default                                        | Description                                              |
| ------------------ | ------------ | ---------------------------------------------- | -------------------------------------------------------- |
| `containerId`      | `string`     | —                                              | ID of the timeslot grid container                        |
| `timezone`         | `string`     | inherited                                      | Inherits from `AbDatepicker` automatically               |
| `closesSoonMins`   | `number`     | `120`                                          | Show "Closes Soon" badge this many minutes before cutoff |
| `noSlotsText`      | `string`     | `'No delivery slots available for this date.'` | Empty-state message                                      |
| `slots`            | `Slot[]`     | `[]`                                           | Base slot definitions (see below)                        |
| `blockSlots`       | `string[]`   | `[]`                                           | Slot IDs to hide on all dates                            |
| `blockSlotsByDate` | `object`     | `{}`                                           | Per-date slot overrides                                  |
| `weekdayRules`     | `object`     | `{}`                                           | Per-weekday slot overrides                               |
| `rules`            | `function[]` | `[]`                                           | Arbitrary callback rules — highest precedence            |
| `onChange`         | `function`   | —                                              | Fired when a slot is selected                            |

### Slot definition

```js
{
  id           : '9am_1pm',            // unique string — use time-range format
  open         : true,                 // false = globally hidden on all dates
  label        : 'Morning',            // chip heading
  timeRange    : '9am – 1pm',          // chip body text
  displayText  : 'Between 9am and 1pm',// used in booking confirmations
  prevdayCutoff: '17:00',              // today always blocked; tomorrow blocked after 17:00
  samedayCutoff: null,                 // today blocked after this time
  showFrom     : null,                 // today: hidden BEFORE this time
  showUntil    : null,                 // today: hidden FROM this time onwards
}
```

### Slot status values

| Status          | Meaning                                        |
| --------------- | ---------------------------------------------- |
| `'available'`   | Visible, selectable                            |
| `'closes_soon'` | Visible, selectable, shows "Closes Soon" badge |
| `'unavailable'` | Visible, greyed out, not selectable            |
| `'hidden'`      | Not rendered                                   |

### prevdayCutoff vs samedayCutoff

```
samedayCutoff: '14:00'
  → TODAY available until 14:00, then shown as unavailable.
  → No effect on any other date.

prevdayCutoff: '17:00'
  → TODAY always unavailable (same-day booking impossible).
  → TOMORROW unavailable once the clock passes 17:00 today.
  → Day-after-tomorrow and beyond: always available.
```

### "Closes Soon" badge

The badge appears only on the **first bookable slot** (the first slot that is `available` or `closes_soon`). It shows `closesSoonMins` minutes before the cutoff — on today's slots via `samedayCutoff`, and on tomorrow's slots via `prevdayCutoff` (when today is the deadline day).

---

## Rule precedence

Overrides are applied in this order — most powerful wins:

```
rules[]  >  blockSlotsByDate  >  weekdayRules  >  slot defaults
```

1. `slot.open === false` — always hidden (global kill-switch)
2. `blockSlots[]` — globally hidden by ID
3. `blockSlotsByDate` — merged into `cfg` first
4. `weekdayRules` — merged into `cfg` (skipped if date override exists)
5. **`rules[]`** — run LAST, see the already-merged `cfg`, can override anything
6. `prevdayCutoff` logic
7. `showFrom` / `showUntil` (today only)
8. `samedayCutoff` (today only)
9. `prevdayCutoff` closes-soon check (deadline day)
10. → `'available'`

---

## blockSlotsByDate

Keys accept `'DD-MM-YYYY'` or `'YYYY-MM-DD'`. Value per slot ID:

| Value                                                                        | Effect                                                                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `false` / `null`                                                             | Hide on this date                                                                               |
| `'open'`                                                                     | Skip `samedayCutoff` only (`prevdayCutoff` still applies)                                       |
| `'force'`                                                                    | Always available — skip all cutoffs                                                             |
| `'HH:MM'`                                                                    | Override `samedayCutoff`, auto-clears `prevdayCutoff`                                           |
| `{ samedayCutoff, prevdayCutoff, showFrom, showUntil, hidden, unavailable }` | Full object merge. Setting `samedayCutoff` without `prevdayCutoff` auto-clears `prevdayCutoff`. |

```js
blockSlotsByDate: {
  '01-05-2026': { '9am_1pm': false, '1pm_6pm': false },   // holiday — hide slots
  '20-04-2026': { '9am_1pm': 'force' },                   // force morning open
  '21-04-2026': { '1pm_6pm': '11:00' },                   // afternoon closes earlier
  '25-04-2026': { '6pm_9pm': { prevdayCutoff: '20:00' } },
},
```

---

## weekdayRules

```js
weekdayRules: {
  friday  : { express: false },                              // hide express every Friday
  sunday  : {
    '9am_1pm': { samedayCutoff: '10:00' },  // prevdayCutoff auto-cleared on override
    '6pm_9pm': false,
  },
  saturday: ['9am_1pm', 'express'],                         // array shorthand = hide
  1       : { '1pm_6pm': { samedayCutoff: '12:00' } },     // Monday by index
},
```

**Important:** when a weekday rule sets `samedayCutoff` for a slot that has `prevdayCutoff` by default, `prevdayCutoff` is **automatically cleared** — switching the slot to same-day mode for that weekday only.

---

## rules[] callbacks

The most powerful layer. Runs **after** `blockSlotsByDate` and `weekdayRules` are merged into `cfg`.

```js
rules: [
  ({ slot, dateKey, dow, dowName, isToday, isTomorrow, now, cfg }) => {

    // Hide express on all future dates (only show today)
    if (slot.id === 'express' && !isToday) return false;

    // Override samedayCutoff on a specific date
    // IMPORTANT: also clear prevdayCutoff when the slot has one
    if (dateKey === '2026-04-05' && slot.id === '9am_1pm') {
      cfg.samedayCutoff = '12:00';
      cfg.prevdayCutoff = null;   // ← required when slot has prevdayCutoff
    }

    // Custom cutoff on Wednesdays for afternoon
    if (dowName === 'wednesday' && slot.id === '1pm_6pm') {
      cfg.samedayCutoff = '12:00';
    }

    // Hide express on Fridays (alternative to weekdayRules)
    if (dowName === 'friday' && slot.id === 'express') return false;

    // Show slot as greyed-out (unavailable, not hidden)
    if (dowName === 'sunday' && slot.id === '6pm_9pm') {
      cfg.unavailable = true;
    }
  },
],
```

> **Why must I set `cfg.prevdayCutoff = null` in rules?**
> When you call `cfg.samedayCutoff = '12:00'` in a rule for a slot that has `prevdayCutoff: '17:00'`, both cutoffs are now set. `prevdayCutoff` fires first in Step 5 and returns `'unavailable'` before `samedayCutoff` at Step 7 is ever reached. Setting `cfg.prevdayCutoff = null` disables Step 5 so your `samedayCutoff` actually runs.
> Object overrides (`blockSlotsByDate`, `weekdayRules`) handle this automatically. Rules do not — because they are free-form callbacks and the engine cannot know whether the change was intentional.

---

## Public API

```js
// AbTimeslot
ts.setDate('2026-04-20')              // 'YYYY-MM-DD' or 'DD-MM-YYYY'
ts.getSelected()                      // { dateKey, slot } | null
ts.clearSelection()
ts.refresh()                          // re-render current date
ts.hasAvailableSlots('2026-04-05')    // true | false

ts.setSlots(arr)
ts.patchSlot('express', { samedayCutoff: '15:00' })

ts.setBlockSlots(['express'])
ts.addBlockSlots('express', '9am_6pm')
ts.removeBlockSlots('express')

ts.setBlockSlotsByDate({ ... })
ts.addBlockSlotsByDate({ '20-04-2026': { '9am_1pm': false } })

ts.setWeekdayRules({ ... })
ts.addWeekdayRules({ thursday: { express: false } })

ts.setRules([ ... ])
ts.addRule(fn)

ts.linkDatepicker(picker, { lookAheadDays: 60 })
```

---

## slotDependency

When `slotDependency: true` is set on `AbDatepicker.init`:

- Dates with no available timeslots are greyed-out and disabled in the calendar grid and chip row
- On boot (and after any slot config change), if the currently selected date has no available slots, the picker automatically advances to the nearest future date that does
- The first available slot on that date is automatically selected

```js
const picker = AbDatepicker.init({
  // ...
  slotDependency: true,
});

const ts = AbTimeslot.init({ ... });

ts.linkDatepicker(picker, { lookAheadDays: 60 });
ts.setDate(picker.getSelected());
```

---

## Supported timezones

| Timezone              | Region              |
| --------------------- | ------------------- |
| `Asia/Kuala_Lumpur`   | Malaysia MYT +8     |
| `Asia/Singapore`      | Singapore SGT +8    |
| `Asia/Manila`         | Philippines PHT +8  |
| `Asia/Hong_Kong`      | Hong Kong HKT +8    |
| `Asia/Bangkok`        | Thailand ICT +7     |
| `Asia/Jakarta`        | Indonesia WIB +7    |
| `Asia/Dhaka`          | Bangladesh BDT +6   |
| `Asia/Kolkata`        | India IST +5:30     |
| `Asia/Tokyo`          | Japan JST +9        |
| `Asia/Shanghai`       | China CST +8        |
| `Asia/Seoul`          | South Korea KST +9  |
| `Asia/Dubai`          | UAE GST +4          |
| `Asia/Riyadh`         | Saudi Arabia AST +3 |
| `Europe/London`       | UK GMT/BST          |
| `Europe/Paris`        | Central Europe CET  |
| `America/New_York`    | New York EST        |
| `America/Los_Angeles` | Los Angeles PST     |
| `Australia/Sydney`    | Sydney AEST         |

Any valid IANA timezone string is accepted.

---

## Browser support

Modern browsers (Chrome, Firefox, Safari, Edge). No IE11. No build step — plain IIFE.

---

## License

MIT
