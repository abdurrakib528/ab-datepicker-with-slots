# ab-datepicker-with-slots

A lightweight, zero-dependency date-row + full calendar picker with a powerful integrated timeslot engine. Designed for delivery and booking scheduling UIs.

**Key features:**
- Timezone-aware cutoff logic (`prevdayCutoff` / `samedayCutoff`)
- Per-date, per-weekday, and flexible custom rule overrides
- Automatic "Closes Soon" badge and first-slot auto-selection
- Optional slot-dependency (auto-disable dates with no available slots)
- Live clock in the configured timezone
- Clean, modern UI with customizable accent color

---

## Files

| File               | Purpose                                              |
|--------------------|------------------------------------------------------|
| `ab-datepicker.js` | Core library — `AbDatepicker` + `AbTimeslot`         |
| `ab-calendar.css`  | All styles for datepicker, chips, calendar & timeslots |
| `index.html`       | Full working demo (with `Asia/Dhaka` example)        |

---

## Screenshots

Below are visual examples of similar delivery date & time slot pickers (the ab-datepicker component follows a clean, modern card-based design with horizontal date chips, full calendar popup/inline, and selectable time slot grid).

### Date & Time Slot Picker UI Examples

- **Horizontal Date Chips + Time Slots** (common in delivery apps like Uber Eats, DoorDash, Instacart)  
- **Calendar + Timeslot Combination** (typical booking flows)

For real-world inspiration:
- Dribbble: [Date Time Picker](https://dribbble.com/search/date-time-picker)
- Mobbin & Pinterest boards for modern delivery scheduling UIs

(The actual demo in `index.html` features a minimal green-accented design with live clock, 7-day chip row, popup calendar, and responsive timeslot grid with "Closes Soon" badge.)

---

## Quick Start

```html
<link rel="stylesheet" href="ab-calendar.css" />

<div class="ab-datepicker-wrapper">
  <div class="ab-datepicker-header">
    <p class="step">1. Select Delivery Date</p>
    <span id="ab-clock"></span>
  </div>
  <div id="my-daterow"></div>
  <div id="my-calendar" mode="popup" timezone="Asia/Dhaka"></div>
</div>

<div class="ab-timeslot-wrapper">
  <div class="ab-timeslot-header">
    <p class="step">2. Select Time Slot</p>
  </div>
  <div id="my-timeslots"></div>
</div>

<script src="ab-datepicker.js"></script>
<script>
  let currentDateObj = null;
  let selectedSlot = null;

  // Always init AbDatepicker FIRST — AbTimeslot inherits timezone automatically
  const picker = AbDatepicker.init({
    daterowId: "my-daterow",
    calendarId: "my-calendar",
    clockId: "ab-clock",
    accent: "#3a8b6b",
    slotDependency: false,
    initialRender: false,
    onChange(val) {
      currentDateObj = val;
      if (typeof ts !== "undefined") ts.setDate(val.dateKey);
      updateSummary();
    },
  });

  const ts = AbTimeslot.init({
    containerId: "my-timeslots",
    noSlotsText: "No delivery slots available for this date.",
    slots: [ /* your slot definitions here */ ],
    blockSlots: ["9am_6pm"],
    blockSlotsByDate: { /* per-date overrides */ },
    weekdayRules: { /* per-weekday overrides */ },
    rules: [ /* custom logic */ ],

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

## AbDatepicker Options & Callbacks

| Option            | Type                    | Default                  | Description |
|-------------------|-------------------------|--------------------------|-----------|
| `daterowId`       | `string`                | —                        | Container for the 7-day chip row |
| `calendarId`      | `string`                | —                        | Container for full calendar (reads `mode` and `timezone` attributes) |
| `clockId`         | `string`                | —                        | Element for live timezone clock |
| `mode`            | `'inline' \| 'popup'`   | `'inline'`               | Calendar display mode |
| `timezone`        | `string`                | `'Asia/Kuala_Lumpur'`    | IANA timezone |
| `accent`          | `string` (hex)          | `'#3a8b6b'`              | Brand accent color |
| `slotDependency`  | `boolean`               | `false`                  | Disable dates with no available slots |
| `initialRender`   | `boolean`               | `false`                  | Fire `onChange` once on page load |
| `blockedDates`    | `string[]`              | `[]`                     | `'DD-MM-YYYY'` dates to block |
| `blockedRanges`   | `{start, end}[]`        | `[]`                     | Date ranges to block (`'YYYY-MM-DD'`) |
| `noSunday`        | `boolean`               | `false`                  | Block all Sundays |
| `noSaturday`      | `boolean`               | `false`                  | Block all Saturdays |
| `onChange`        | `function`              | —                        | Fired when date is selected |
| `beforeShowDay`   | `function`              | —                        | Return `false` to disable a date |

### `onChange` Example

```js
onChange(val) {
  currentDateObj = val;
  console.log("Selected Date:", val.date);   // e.g. "06-04-2026"

  if (typeof ts !== "undefined") ts.setDate(val.dateKey);
}
```

### `beforeShowDay` Examples

```js
beforeShowDay(dateObj) {
  // Block December completely
  if (dateObj.month === 12) return false;

  // Block specific holidays
  const holidays = ["25-12-2026", "01-01-2027"];
  if (holidays.includes(dateObj.date)) return false;

  return true;
}
```

---

## AbTimeslot Options

### Blocking Options

#### `blockSlots`

Globally hides slots by ID on all dates.

```js
blockSlots: ["9am_6pm", "express"]
```

#### `blockSlotsByDate`

Per-date slot overrides. Keys accept both `'DD-MM-YYYY'` and `'YYYY-MM-DD'`.

**Full Object Example:**

```js
blockSlotsByDate: {
  "2026-04-06": {
    "9am_1pm": false,
    "1pm_6pm": "12:00",
    "6pm_9pm": { prevdayCutoff: "20:00", unavailable: true },
    "express": "force"
  }
}
```

---

## `rules[]` — Custom Logic (Highest Precedence)

```js
rules: [
  ({ slot, isToday }) => {
    if (slot.id === "express" && !isToday) return false;
  },

  ({ slot, dateKey, cfg }) => {
    if (dateKey === "2026-04-06" && slot.id === "9am_1pm") {
      cfg.samedayCutoff = "12:00";
      cfg.prevdayCutoff = null;
    }
  },

  ({ slot, dowName, cfg }) => {
    if (dowName === "wednesday" && slot.id === "1pm_6pm") {
      cfg.samedayCutoff = "11:00";
    }
  }
]
```

---

## Supported Timezones

| Region              | Timezone                  | Offset      | Notes |
|---------------------|---------------------------|-------------|-------|
| Bangladesh          | `Asia/Dhaka`              | +06:00      | BDT (used in demo) |
| India               | `Asia/Kolkata`            | +05:30      | IST |
| Malaysia            | `Asia/Kuala_Lumpur`       | +08:00      | MYT |
| Singapore           | `Asia/Singapore`          | +08:00      | SGT |
| Philippines         | `Asia/Manila`             | +08:00      | PHT |
| Thailand            | `Asia/Bangkok`            | +07:00      | ICT |
| UAE                 | `Asia/Dubai`              | +04:00      | GST |
| United Kingdom      | `Europe/London`           | GMT/BST     | — |
| New York            | `America/New_York`        | EST/EDT     | — |

---

## Developer

**Abdul Rakib**  
Senior Shopify & Full Stack Developer  

- **Email**: [abdurrakib528@gmail.com](mailto:abdurrakib528@gmail.com)  
- **WhatsApp**: [+8801744328768](https://wa.me/8801744328768)

---

**License:** MIT

---
