#!/usr/bin/env python3
"""Refresh shipment statuses into the shared schema.
Schema per shipment: id, mode(sea|air|domestic-pending), carrier, tracking_no, contents, supplier,
stage(国内/入仓/出运/清关/派送/签收/未查到), last_event, last_checked, history=[{time,location,description,source}].
No phone numbers, addresses or contact names are stored (scrubbed below).
DEX (air): public API, auto. YD (sea) & domestic (SF/中通快运/安能): no reliable public API -> manual, keep existing."""
import json, re, urllib.request, datetime, pathlib
P = pathlib.Path(__file__).with_name("shipments.json")
MYT = datetime.timezone(datetime.timedelta(hours=8))
DEX_URL = "https://api.dex-i.com/api/f/logistics-management/tracking/list"
STAGES = ["国内", "入仓", "出运", "清关", "派送", "签收"]
PHONE = re.compile(r"(\+?\d[\d\- ]{6,}\d)")
def scrub(t): return PHONE.sub("[已隐去]", str(t or ""))
def iso(t):
    if not t: return None
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try: return datetime.datetime.strptime(str(t)[:19], f).replace(tzinfo=MYT).isoformat()
        except ValueError: pass
    if isinstance(t, (int, float)):
        return datetime.datetime.fromtimestamp(t / 1000 if t > 1e11 else t, MYT).isoformat()
    return str(t)
def stage_of(text):
    t = text or ""
    for kw, st in [("签收", "签收"), ("派送", "派送"), ("派件", "派送"), ("清关", "清关"), ("海关", "清关"),
                   ("起飞", "出运"), ("航班", "出运"), ("出运", "出运"), ("装柜", "出运"), ("离港", "出运"),
                   ("入仓", "入仓"), ("入库", "入仓"), ("到仓", "入仓"), ("揽收", "国内")]:
        if kw in t: return st
    return None
def dex(nos):
    req = urllib.request.Request(DEX_URL, data=json.dumps(nos).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))
def dex_events(r):
    ev = r.get("trackingDetails") or r.get("details") or r.get("items") or r.get("traces") or []
    out = []
    for e in ev if isinstance(ev, list) else []:
        if not isinstance(e, dict): continue
        desc = e.get("description") or e.get("context") or e.get("content") or e.get("status") or json.dumps(e, ensure_ascii=False)
        out.append({"time": iso(e.get("time") or e.get("trackTime") or e.get("date")),
                    "location": scrub(e.get("location") or e.get("city") or ""),  # city-level only
                    "description": scrub(desc), "source": "DEX api.dex-i.com"})
    out.sort(key=lambda x: x["time"] or "", reverse=True)
    return out
def main():
    d = json.loads(P.read_text()); now = datetime.datetime.now(MYT)
    air = [s for s in d["shipments"] if s["mode"] == "air" and s.get("tracking_no")]
    try: res = dex([s["tracking_no"] for s in air]) if air else []
    except Exception as e: print("DEX error:", e); res = None
    if isinstance(res, dict): res = res.get("data") or res.get("result") or []
    for s in air:
        if res is None: continue
        hit = [r for r in res if s["tracking_no"] in json.dumps(r, ensure_ascii=False)]
        if hit:
            hist = dex_events(hit[0])
            if hist:
                s["history"] = hist  # full per-event history, newest first
                s["last_event"] = f'{hist[0]["time"]} {hist[0]["description"]}'
                s["stage"] = stage_of(hist[0]["description"]) or s.get("stage") or "出运"
            else:
                s["stage"] = s.get("stage") if s.get("stage") in STAGES else "未查到"
                s["last_event"] = "DEX 有记录但无轨迹事件"
        else:
            s["stage"] = "未查到"; s["last_event"] = "DEX 系统暂无记录（可能仍在国内段）"
        s["last_checked"] = now.isoformat(timespec="minutes")
    for s in d["shipments"]:
        s["status"] = s["stage"]  # legacy field for current index.html
        s["last_event"] = scrub(s.get("last_event"))
    d["updated"] = now.strftime("%Y-%m-%d %H:%M MYT")
    P.write_text(json.dumps(d, ensure_ascii=False, indent=1))
    for s in d["shipments"]: print(s["id"], s["tracking_no"], s["stage"], "|", s["last_event"])
if __name__ == "__main__": main()
