# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nick scans this tracker on his phone over 5G. He needs to see, for each parcel and each consignment, who shipped it, what it is, the tracking number, who is carrying it, and where it is going. A private assistant may open the same Pages URL. Brand Intel Hub embeds that URL (iframe or open link); the hub repo is separate.

## Product Purpose

A static shipment tracker for China-to-Malaysia consolidations and the parcels inside them. Success is a compact ledger: product name first, then factory, number, carrier, stage, destination, and 预计到马. A bad field never replaces the list with 「数据加载失败」.

## Positioning

The page is the published record of `shipments.json`: real suppliers, items, domestic and international numbers, carriers, and destinations, with short miss labels when a field is blank. It does not guess missing names.

## Operating Context

GitHub Pages serves the repo root at https://siewwengnick-rgb.github.io/shipment-tracker/. Nick reviews on a phone. Timestamps are Malaysia time (MYT, UTC+8). Evidence photos live under `evidence/`. `check.py` updates `shipments.json` from carrier APIs and manual facts. Phones, street addresses, and contact names stay off the UI.

## Capabilities and Constraints

- Search, mode chips (海运 / 空运 / 未分配), and stage, supplier, and forwarder filters stay.
- Expanding a card shows timeline and evidence photos. Privacy scrubbing stays.
- Do not invent supplier or item. Blankish values (`待确认`, `待查`, empty, null) show 缺厂家, 缺品名, or 暂无单号.
- `evidence` may be a string or a list. `confirm` is usually an object; PKG-014 has a list. One bad record must not blank the page.
- Keep a static site (HTML/CSS/JS + `shipments.json` + `evidence/`). Do not change the JSON schema or `check.py` behavior.
- Chinese UI copy.

Inferred from the repo, not restated in the brief: consolidations carry the international number, carrier, and often the destination; parcels carry supplier, item, and the domestic number. A parcel with no destination of its own shows the parent consignment’s destination when that field exists.

## Brand Commitments

The name on the page is 集运追踪. The rejected look is the cramped dark 「card-scan」 hierarchy (nested cards, neon accents) and the tall card wall that showed two or three parcels per screen. The replacement is a dense ledger. No neon or cyber chrome.

## Evidence on Hand

- `shipments.json` (updated 2026-11-05 10:07 MYT): 9 consolidations, 21 parcels, 4 forwarders.
- Evidence images under `evidence/`, including PKG-006 and PKG-012, plus demo shots.
- Do not fabricate suppliers, items, tracking numbers, or destinations.

## Product Principles

- The row answers 品名, 厂家, 单号, 承运, 阶段, 寄往, and 预计到马, then stops. Photos, notes, and the trail open on click.
- Missing data is a short label, never a guessed name.
- One bad field degrades that card, not the page.
- Phone scanning outranks decoration.
- Logistics facts only. No phones, addresses, or contacts.

## Accessibility & Inclusion

Phone-first. Search and filters stay usable with a thumb. Text must remain readable in daylight. Controls need visible focus.
