#!/usr/bin/env python3
"""Refresh shipment statuses. DEX: public API. YD (sea): not auto-queryable yet -> manual."""
import json, urllib.request, datetime, pathlib
P = pathlib.Path(__file__).with_name("shipments.json")
MYT = datetime.timezone(datetime.timedelta(hours=8))
def dex(nos):
    req = urllib.request.Request("https://api.dex-i.com/api/f/logistics-management/tracking/list",
        data=json.dumps(nos).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))
def main():
    d = json.loads(P.read_text()); now = datetime.datetime.now(MYT).strftime("%Y-%m-%d %H:%M MYT")
    air = [s for s in d["shipments"] if s["mode"] == "air"]
    try:
        res = dex([s["tracking_no"] for s in air]) if air else []
    except Exception as e:
        print("DEX error:", e); res = None
    for s in air:
        if res is None: continue
        hit = [r for r in res if s["tracking_no"] in json.dumps(r, ensure_ascii=False)]
        if hit:
            r = hit[0]; s["raw"] = r
            ev = r.get("trackingDetails") or r.get("details") or r.get("items") or []
            s["history"] = ev if isinstance(ev, list) else s["history"]
            s["status"] = str(r.get("status") or r.get("statusName") or r.get("lastStatus") or "已查到(见raw)")
            s["last_event"] = json.dumps(ev[0], ensure_ascii=False)[:200] if ev else s["status"]
        else:
            s["status"] = "未查到"; s["last_event"] = "DEX 系统暂无记录"
        s["last_checked"] = now
    for s in d["shipments"]:
        if s["mode"] == "sea": s["last_event"] = s.get("last_event") or "海运需手动查 yd-wl.com"
    d["updated"] = now; P.write_text(json.dumps(d, ensure_ascii=False, indent=1))
    for s in d["shipments"]: print(s["id"], s["tracking_no"], s["status"], s["last_event"])
if __name__ == "__main__": main()
