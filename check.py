#!/usr/bin/env python3
"""Schema v3: {updated, consolidations[], parcels[]}.
evidence: a legacy text note, or a list of {type: received_photo|tracking_shot, src, caption, at}.
src is a path under evidence/ (GitHub Pages). Copy scrubbed shots from inbox/ into evidence/; do not commit inbox/ or private_numbers.json.
consolidation stage: 国内快递/已入仓/运往马来西亚/已到马/已签收 — from own carrier events, else 已入仓 if any linked parcel inbound.
parcel stage: 无单号/国内运输中/已入仓/未查到 from own facts; once linked & consolidation moved past 已入仓, inherits it.
无单号 = domestic tracking not yet obtained (chase factory); 未查到 = have a number but no public/API trail.
Air = DEX API; sea = yd-wl placeholder (manual). Domestic (SF/中通快运/安能) no reliable public API -> manual.
Never guess supplier/item ('待确认'; seed hints in 'hint'). No phones/addresses/names."""
import json, re, urllib.request, datetime, pathlib
P = pathlib.Path(__file__).with_name("shipments.json")
MYT = datetime.timezone(datetime.timedelta(hours=8))
DEX_URL = "https://api.dex-i.com/api/f/logistics-management/tracking/list"
CSTAGES = ["国内快递", "已入仓", "运往马来西亚", "已到马", "已签收"]
PARCEL_FINAL = "已完成（中国本地自取）"  # parcel stage set manually; never overwritten
PHONE = re.compile(r"\+?\d[\d\- ]{6,}\d")
def scrub(t): return PHONE.sub("[已隐去]", str(t or ""))
def iso(t):
    if t in (None, ""): return None
    if isinstance(t, (int, float)): return datetime.datetime.fromtimestamp(t/1000 if t > 1e11 else t, MYT).isoformat()
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try: return datetime.datetime.strptime(str(t)[:19], f).replace(tzinfo=MYT).isoformat()
        except ValueError: pass
    return str(t)
def ev_stage(desc):
    t = desc or ""
    if "签收" in t or "派送完成" in t: return 4
    if any(k in t for k in ("清关", "海关", "到达马", "派送", "派件", "Malaysia", "KUL", "吉隆坡")): return 3
    return 2  # any forwarder event => 运往马来西亚
def dex(nos):
    req = urllib.request.Request(DEX_URL, data=json.dumps(nos).encode(), headers={"Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=40))
    return (r.get("data") or r.get("result") or []) if isinstance(r, dict) else r
def dex_time(t):
    try: return datetime.datetime.fromisoformat(str(t).replace("Z", "+00:00")).astimezone(MYT).isoformat()
    except Exception: return iso(t)
def dex_events(r):
    ev = r.get("trackingItemList") or r.get("trackingDetails") or r.get("details") or r.get("items") or []
    out = [{"time": dex_time(e.get("actionTime") or e.get("time")),
            "location": scrub(e.get("location") or ""),
            "description": scrub(" ".join(x for x in [e.get("displayStatus") or e.get("description") or "", e.get("remark") or ""] if x).strip()),
            "source": "DEX api.dex-i.com"} for e in ev if isinstance(e, dict)] if isinstance(ev, list) else []
    return sorted(out, key=lambda x: x["time"] or "", reverse=True)
def main():
    d = json.loads(P.read_text()); now = datetime.datetime.now(MYT).isoformat(timespec="minutes")
    C, PK = d["consolidations"], d["parcels"]
    for c in C:  # normalize older/alt field names
        if "tracking_no" not in c: c["tracking_no"] = c.pop("tracking", None)
        c["mode"] = {"空运": "air", "海运": "sea"}.get(c.get("mode"), c.get("mode"))
        if c.get("history"): c["history"].sort(key=lambda x: x.get("time") or "", reverse=True)
    air = [c for c in C if c["mode"] == "air" and c.get("tracking_no")]
    priv = json.loads(P.with_name("private_numbers.json").read_text()) if P.with_name("private_numbers.json").exists() else {}  # real nos, gitignored
    real = lambda c: priv.get(c["id"], c["tracking_no"])
    try: res = dex([real(c) for c in air]) if air else []
    except Exception as e: print("DEX error:", e); res = None
    for c in air:
        if res is None: continue
        hit = [r for r in res if real(c) == str(r.get("trackingNumber", "")) or real(c) in json.dumps(r, ensure_ascii=False)]
        ev = dex_events(hit[0]) if hit else []
        if ev: c["history"] = ev
        c["last_checked"] = now
    for c in C:
        if c["mode"] == "sea": c["last_checked"] = now  # yd-wl: manual/browser placeholder
        mine = [p for p in PK if p.get("consolidation_id") == c["id"]]
        c["parcel_ids"] = [p["id"] for p in mine]
        if c.get("stage_manual") and not c.get("history"): continue  # manual fact (e.g. Nick told us), keep until carrier events
        if c.get("history"):
            c["stage"] = CSTAGES[max(ev_stage(h.get("description")) for h in c["history"])]
            c["stage_source"] = f'{c["carrier"]} 返回轨迹'; c["last_event"] = f'{c["history"][0]["time"]} {c["history"][0]["description"]}'
        elif any(p.get("warehouse_ref") for p in mine):
            c["stage"] = "已入仓"; c["stage_source"] = "所含包裹有入仓号；承运商暂无轨迹"; c["last_event"] = f'{c["carrier"]} {c["tracking_no"]} 暂无轨迹'
        else:
            c["stage"] = "国内快递"; c["stage_source"] = "无入仓/轨迹证据"
    byid = {c["id"]: c for c in C}
    for p in PK:
        if p.get("stage") == PARCEL_FINAL or p.get("stage_manual"): p["last_checked"] = now; continue  # manual fields never overwritten
        c = byid.get(p.get("consolidation_id"))
        if c and c["stage"] in CSTAGES and CSTAGES.index(c["stage"]) > 1:
            p["stage"] = c["stage"]; p["stage_source"] = f'继承集运单 {c["id"]}'; p["last_event"] = c["last_event"]
        elif p.get("warehouse_ref"):
            p["stage"] = "已入仓"; p["stage_source"] = f'有入仓号 {p["warehouse_ref"]}'
        elif p.get("history"):
            p["stage"] = "国内运输中"; p["stage_source"] = "国内段有轨迹"; p["last_event"] = f'{p["history"][0]["time"]} {p["history"][0]["description"]}'
        else:
            tn = str(p.get("domestic_tracking_no") or p.get("tracking") or "").strip()
            if not tn or tn in ("待确认", "None", "none"):
                p["stage"] = "无单号"; p["stage_source"] = "尚未拿到国内快递单号"
            else:
                p["stage"] = "未查到"; p["stage_source"] = "有国内单号但暂无轨迹"
        p["last_checked"] = now
    d.pop("shipments", None)
    d["updated"] = datetime.datetime.now(MYT).strftime("%Y-%m-%d %H:%M MYT")
    P.write_text(json.dumps(d, ensure_ascii=False, indent=1))
    for c in C: print(c["id"], c["tracking_no"], c["stage"], c["parcel_ids"])
    for p in PK: print(p["id"], p.get("domestic_tracking_no"), p["stage"], p.get("consolidation_id"))
if __name__ == "__main__": main()
