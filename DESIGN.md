---
name: 集运追踪
description: A warehouse bin-label wall for China-to-Malaysia consolidations.
colors:
  green: "#1b3c30"
  green-ink: "#f3f6f1"
  green-dim: "#d5e4da"
  amber: "#e2a11a"
  amber-ink: "#1c1406"
  air: "#1d4e89"
  ok: "#145c32"
  warn: "#7a3e06"
  floor: "#d5e0da"
  card: "#f4f7f5"
  ink: "#14211c"
  ink-2: "#3d4a44"
  line: "#c5d1cb"
  stage: "#e7efe9"
  stage-ok: "#e3f2e8"
  stage-warn: "#f8ead8"
  proof: "#e4eeea"
typography:
  display:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  figure:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums lining-nums"
  body:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
  chip:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
  field:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  action:
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  cell: "4px"
  photo: "6px"
  card: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  stack: "10px"
  md: "12px"
  lg: "16px"
  wall: "18px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.card}"
    padding: "0 16px"
    height: "{spacing.touch}"
  shell-bar:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    typography: "{typography.display}"
    padding: "16px 16px 14px"
  button-disclosure:
    backgroundColor: "transparent"
    textColor: "{colors.green}"
    typography: "{typography.chip}"
    rounded: "{rounded.card}"
    padding: "0"
    height: "{spacing.touch}"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "{spacing.touch}"
  chip-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "{spacing.touch}"
  input-search:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.card}"
    padding: "8px 12px"
    height: "{spacing.touch}"
  select-filter:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.card}"
    padding: "8px 12px"
    height: "{spacing.touch}"
  card-shipment:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.md}"
  dest-block:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.cell}"
    padding: "7px 8px"
  stage-pill:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.green}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  stage-pill-ok:
    backgroundColor: "{colors.stage-ok}"
    textColor: "{colors.ok}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  stage-pill-warn:
    backgroundColor: "{colors.stage-warn}"
    textColor: "{colors.warn}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: 集运追踪

## Overview

**Creative North Star: "The Warehouse Bin Label"**

集运追踪 is a bin-label wall. The shell is warehouse green, the page floor is sage, and every shipment is one paper card with the same slots in the same order. The supplier is the heading, the item sits under it, tracking numbers are heavy black tabular figures, the carrier is an open cell, and 寄往 is a solid amber block. The wall is for a thumb on a phone: read 厂家, 产品名, 单号, 承运商, and 寄去哪, then expand for the trail and the photos.

The color stays in one family. Warehouse green is the shell, the selected mode, the focus ring, the word 海运, and the solid actions. Amber is the destination block and the text selection. Air blue is only the word 空运. Miss brown is the short miss label. The confirmed rejection is the dark nested card-scan: no neon, no glass, no gradient, no side stripe, and no card inside a card. A consignment and its parcels are separate cards, eight pixels apart.

Depth is tonal. The green bar, the sage floor, and the paper card are three flat layers, and the card adds a one-pixel rule plus a one-pixel lift. Corners repeat: eight pixels on the card, the fields, and the expand control; four pixels on the destination; full pills for modes and stage.

**Key Characteristics:**

- Warehouse-green shell, sage floor, paper cards
- One amber 寄往 block, including when the value is 缺目的地
- Fixed slots and heavy black tabular tracking numbers
- System Chinese type on every role
- Forty-four pixel thumb targets, with two columns from 840px

## Colors

One green warehouse family, plus a single amber bin block. Stage washes and the photo well are pale tints of that family, written as raw hex in the stylesheet and named here so they stay in the same set. Browser `theme-color` is warehouse green.

### Primary

- **Warehouse Green** (#1b3c30): the top bar, the selected mode chip, the focus ring, the word 海运, the expand label, the solid button, and the current trail dot.
- **Shell Ink** (#f3f6f1): text on warehouse green, including the page name and the solid button. On the green bar the focus ring switches to this color.
- **Shell Dim** (#d5e4da): the MYT line under the page name.

### Secondary

- **Bin Amber** (#e2a11a): the 寄往 block, and the text-selection highlight.
- **Amber Ink** (#1c1406): text on the amber block, including the 寄往 label.

### Tertiary

- **Air Blue** (#1d4e89): the word 空运 in the card meta line, at weight 800. It is not a link or button color.
- **Arrived Green** (#145c32): text on the arrived stage pill (已签收, 已到马, 已完成).
- **Miss Brown** (#7a3e06): the miss labels 缺厂家, 缺品名, 暂无单号, and 缺承运商, and the text of an unsettled stage pill (未查到, 无单号). 缺目的地 stays amber ink inside the amber block.

### Neutral

- **Sage Floor** (#d5e0da): the page background and the sticky filter bar. The scrollbar pairs warehouse green on this floor.
- **Paper Card** (#f4f7f5): cards, search, selects, and unselected mode chips.
- **Bin Ink** (#14211c): default text, supplier, item, tracking figures, and the current trail step.
- **Secondary Ink** (#3d4a44): the ID line, slot labels, placeholders, the colophon, trail times, and quiet meta.
- **Rule Line** (#c5d1cb): card borders, field borders, the sticky bar rule, the expand outline, and the trail stem.
- **Stage Wash** (#e7efe9): the resting stage pill (已入仓 and other in-progress stages).
- **Arrived Wash** (#e3f2e8): the arrived stage pill.
- **Hold Wash** (#f8ead8): the unsettled stage pill.
- **Photo Well** (#e4eeea): the expanded evidence frame behind a photo.

### Named Rules

**The Amber Bin Rule.** Bin amber and amber ink fill the 寄往 block and the text selection. They do not fill buttons, stage pills, links, or the shell.

**The Green Shell Rule.** Warehouse green is the bar, the selected mode, the focus ring, 海运, the expand label, and the solid button. Cards stay paper.

## Typography

**Display Font:** PingFang SC (Noto Sans SC, Microsoft YaHei, system-ui, sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** the same stack; figures use `tabular-nums` and `lining-nums`, not a separate mono family

**Character:** One system Chinese face. Size, weight, and tabular figures make the hierarchy. The page title is 22px and steps to 26px from 840px; that step is a breakpoint, not a fluid clamp.

### Hierarchy

- **Display** (700, 22px, line-height 1.2, letter-spacing -0.03em; 26px from 840px): the page name 集运追踪 in the green bar.
- **Headline** (700, 18px, line-height 1.3, letter-spacing -0.02em): the supplier.
- **Title** (600, 15px, line-height 1.35): the item name under the supplier. Carrier and destination values use this size at weight 700.
- **Figure** (700, 18px, line-height 1.25, letter-spacing -0.01em, tabular lining figures): the domestic and international tracking numbers, in bin ink.
- **Body** (400, 15px, line-height 1.4): the page default. Section lines such as 集运 use this size at weight 700, with tabular figures on the count. The MYT line is 13px shell dim. Trail event text is 13.5px. Notes and photo captions are 13px.
- **Label** (700, 12px, secondary ink): the slot names 国内, 国际, 承运, and 寄往. The stage pill is this size at line-height 1.2. The ID line is 12px secondary ink. Trail times and place lines are 12px.
- **Chip** (700, 14px): mode chips and the expand control.
- **Field** (400, 16px): search and the three selects, so a phone keyboard does not zoom the page.
- **Action** (700, 15px): the solid button (重试, 关闭).

### Named Rules

**The Tabular Figure Rule.** Tracking numbers, section counts, and trail times use tabular lining figures. A tracking number stays 18px, weight 700, and bin ink.

**The System Face Rule.** Set every role in PingFang SC, Noto Sans SC, Microsoft YaHei, then system-ui. Keep one Chinese face for the whole wall.

## Layout

Phone first. The frame is a 16px inset, centered, max 1120px. The green bar carries the page name and the MYT update (16px top, 14px bottom). Under it, a sticky filter bar (floor fill, 1px rule, 10px top, 12px bottom) stacks search, a horizontally scrolling chip row, and three selects, with 8px between them. The selects sit in three equal columns.

The wall is one column. Stacks are 18px apart. Inside a stack the consignment card and its parcel cards are 8px apart. Card interiors use 12px padding. The tracking block, the carrier/destination pair, and the expand control each start 10px below the previous slot. Slot rows gap 8px. At 840px the wall becomes two columns, the wall gap becomes 16px, and the page title becomes 26px. At 360px and below, the carrier and destination stack full width, and the three selects become one column.

**The Same Slots Rule.** Every card, consignment or parcel, keeps one order: supplier, item, meta, tracking figures, carrier, destination. A blank field keeps its slot and shows the short miss label. A record that fails to render stays a card, with a dashed rule, and the rest of the wall remains.

**The Thumb Target Rule.** Search, mode chips, selects, the expand control, and the solid button are at least 44px tall.

## Elevation & Depth

The wall is flat layers: warehouse green, sage floor, paper card. The only shadow is the card lift, `box-shadow: 0 1px 2px rgba(28, 26, 22, 0.06)`, present at rest. Hover does not add shadow. Focus is a 2px outline, offset 2px, in warehouse green; on the green bar the outline is shell ink. The photo viewer is a separate layer: a fixed scrim of `rgba(18, 22, 18, 0.9)` and an image well of `#111`. Those viewer values stay off the card wall.

### Shadow Vocabulary

- **Paper lift** (`box-shadow: 0 1px 2px rgba(28, 26, 22, 0.06)`): the shipment card, at rest, on the sage floor.

### Named Rules

**The Paper Lift Rule.** One shadow, on the card, at rest. Chips, fields, the expand control, and the amber block do not take a shadow. Focus is an outline, not a glow.

## Shapes

Cards, search, selects, the expand control, and the solid button share an 8px corner. The carrier cell and the destination block share a 4px corner; the carrier is unfilled, so its corner reads as the padding box, and the amber block shows the corner. Evidence photos sit in a 6px frame. Mode chips and stage pills are full pills (999px). Trail dots are 7px circles on a 1px stem. A bad record uses the same card with a dashed border.

**The Shared Corner Rule.** The destination block keeps its 4px corner when the value is 缺目的地. Cards do not grow a stripe, a notch, or a second radius.

## Components

### Buttons

The solid button is the retry control and the lightbox close. The expand control is the second button. Hover does not change either fill.

- **Shape:** 8px corner on both.
- **Primary:** warehouse green fill, shell ink text, 1px green border, 44px tall, padding 0 16px, weight 700 at body size.
- **Hover / Focus:** fill stays. Focus is the 2px warehouse-green ring, offset 2px.
- **Disclosure:** transparent fill, rule-line border, warehouse-green label at 14px weight 700, 44px tall, full width of the card. A 12px chevron sits 6px after the label and rotates 180 degrees when expanded, with no transition duration.

### Chips

Mode chips read 全部, 海运, 空运, 未分配, each with its count in the same label.

- **Style:** paper fill, rule-line border, bin ink, 14px weight 700, pill, 44px tall, padding 0 14px.
- **State:** the selected chip is warehouse green with shell ink and a green border. Unselected chips stay paper. Hover does not recolor them.

### Cards / Containers

A shipment card is the bin label. Consignment and parcel use the same skeleton. The supplier is the headline; a missing supplier is 缺厂家 in miss brown. The item is the title line; a missing item is 缺品名. The meta line is 12px secondary ink and may include the id, 海运 in warehouse green at weight 800, or 空运 in air blue at weight 800. Tracking rows are a 2.6em label column plus the figure. The carrier is an open cell (transparent, 4px corner, padding 7px 8px 7px 0). 寄往 is the amber block.

- **Corner Style:** 8px.
- **Background:** paper card.
- **Shadow Strategy:** the paper lift (see Elevation & Depth).
- **Border:** 1px rule line. A record that fails to render uses a dashed rule and the line 这条读不了.
- **Internal Padding:** 12px.

### Inputs / Fields

- **Style:** paper fill, 1px rule line, 8px corner, 44px tall, padding 8px 12px, 16px type. Placeholder is secondary ink. The three filters are the same field as selects.
- **Focus:** 2px warehouse-green outline, offset 2px.
- **Error / Disabled:** the page has no error chrome on fields. An empty result is secondary-ink copy, with the solid button when a retry is offered.

### Navigation

The green top bar is the only header: page name, then the MYT line in shell dim. It is not a link row. The sticky filter bar is the operating nav. It stays at the top of the floor, above the wall (`z-index: 5`), and holds search, mode chips, and the stage, supplier, and forwarder selects. Chips scroll sideways; the row hides its scrollbar.

### Destination block

Amber fill, amber ink, 4px corner, padding 7px 8px. The label 寄往 and the value are both amber ink; the value is 15px weight 700. The block is about 46% of the pair and at least 7.2rem, and it stacks under the carrier below 360px. 缺目的地 keeps this block and this corner.

### Stage pill

A pill on the card head, opposite the supplier: 12px weight 700, padding 4px 8px. Resting stages use stage wash and warehouse green. Arrived stages use arrived wash and arrived green. Unsettled stages use hold wash and miss brown.

### Trail and photos

The expanded panel starts 10px below the expand control, with an 8px top padding and a 1px rule. Step names are 12px weight 700 secondary ink; the current step is bin ink. Times are 12px tabular secondary ink. The first dot is warehouse green; later dots and the stem are the rule line. Event text is 13.5px. The place line is 12px weight 600 secondary ink. Notes are 13px secondary ink with a weight-700 bin-ink key. Photos stack in a 10px gap, in the photo well, 6px corner, with a 13px weight-700 caption.

### Lightbox

A fixed full-viewport layer. The scrim is `rgba(18, 22, 18, 0.9)`. The image is contained, max 78vh, on `#111`. The caption is 14px shell ink. Close is the solid button, inset from the top safe area.

## Do's and Don'ts

### Do:

- **Do** keep supplier, item, tracking figures, carrier, and 寄往 in that order on every card.
- **Do** paint 寄往 as the amber block with amber ink, and keep 缺目的地 inside that same block and corner.
- **Do** set tracking numbers at 18px, weight 700, tabular lining figures, bin ink.
- **Do** use a 2px warehouse-green focus ring, offset 2px, and switch that ring to shell ink on the green bar.
- **Do** keep search, chips, selects, the expand control, and the solid button at least 44px tall.

### Don't:

- **Don't** nest a card inside a card, or add a side stripe, glass, gradient, or neon accent.
- **Don't** use amber for anything except the destination block and text selection.
- **Don't** recolor a tracking number, or replace 缺厂家, 缺品名, 暂无单号, 缺承运商, or 缺目的地 with a guessed name.
- **Don't** change the card corner per record, or drop the destination block when the destination is missing.
- **Don't** put a shadow on chips, fields, the expand control, or the amber block. The card lift is the only shadow.
