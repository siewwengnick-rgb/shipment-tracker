# evidence schema (Nick / 私人助理 2026-10-27)

`shipments.json` field `evidence` is an array (parcels + consolidations). Legacy string evidence may remain as a note.

```json
"evidence": [
  {
    "type": "received_photo",
    "src": "evidence/PKG-014-received-20261026.jpg",
    "caption": "云第入仓收货照",
    "at": "2026-10-26"
  },
  {
    "type": "tracking_shot",
    "src": "evidence/PKG-014-tracking-20261026.png",
    "caption": "安能在途截图",
    "at": "2026-10-26"
  }
]
```

- type: only `received_photo` (inbound/received) or `tracking_shot` (in-transit waybill/tracking)
- src: relative to repo root, file under `evidence/` only (desensitize phones/full street addresses first); never point at `inbox/`
- caption / at: optional but preferred
