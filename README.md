# 集运追踪

`index.html` + `shipments.json`. GitHub Pages serves the repo root.

## 证据图片 / evidence photos

Photos Nick opens in a package or consolidation detail live in **`evidence/`** (committed, published with Pages).
Keep `inbox/`, `wechat/`, and `private_numbers.json` on the ops machine only. Do not commit them.

1. Copy a scrubbed shot from `inbox/` into `evidence/` (strip phone numbers and full street addresses). Example: `evidence/2026-10-26/pkg-001-received.png`.
2. Point that parcel or consolidation at the file. A plain string still works and shows as a text note when there is no image.

```json
"evidence": [
  {
    "type": "received_photo",
    "src": "evidence/2026-10-26/pkg-001-received.png",
    "caption": "广州仓收货",
    "at": "2026-10-26"
  }
]
```

| type | Detail label | Use |
| --- | --- | --- |
| `received_photo` | 到仓收货照 | 厂家收到货 / 已入仓 |
| `tracking_shot` | 在途运单截图 | 在途：承运商页面或微信运单 |

`src` must be a png, jpg, webp, or gif under `evidence/`. Field notes are also in `evidence/SCHEMA.md`.

Examples: PKG-001 到仓收货照 and CON-004 在途运单截图 use labeled demo PNGs in `evidence/demo/`. PKG-012 keeps main's array entry `evidence/PKG-012-tracking-20261024.png`. A plain string, or `evidence_note` beside an array, still shows as a text note.
