#!/usr/bin/env python3
"""Refresh end-to-end orders (schema v2). One shipment = one order with linked legs:
 legs.domestic {carrier,tracking_no,status,history[]}   厂家→集运仓 (SF/安能/中通快运: no reliable public API -> manual)
 legs.warehouse {warehouse_ref,mark,ctns,weight,status,history[]}
 legs.international {mode sea|air,carrier,tracking_no,status,history[]}  air=DEX API auto, sea=yd-wl placeholder
Unknown legs stay null. Stage from CONFIRMED facts only, furthest wins. Flat legacy fields mirrored for index.html.
No phones/addresses/contact names stored."""
import json, re, urllib.request, datetime, pathlib
P = pathlib.Path(__file__).with_name("shipments.json")
MYT = datetime.timezone(datetime.timedelta(hours=8))
DEX_URL = "https://api.dex-i.com/api/f/logistics-management/tracking/list"
STAGES = ["国内", "入仓", "出运", "清关", "派送", "签收"]
PHONE = re.compile(r"\+?\d[\d\- ]{6,}\d")
def scrub(t): return PHONE.sub("[已隐去]", str(t or ""))
def iso(t):
    if t in (None, ""): return None
    if isinstance(t, (int, float)): return datetime.datetime.fromtimestamp(t/1000 if t > 1e11 else t, MYT).isoformat()
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try: return datetime.datetime.strptime(str(t)[:19], f).replace(tzinfo=MYT).isoformat()
        except ValueError: pass
    return str(t)
KW = [("签收", 5), ("派送", 4), ("派件", 4), ("清关", 3), ("海关", 3)]
def intl_stage(desc):
    for k, i in KW:
        if k in (desc or ""): return i
    return 2  # any international event => at least 出运
def dex(nos):
    req = urllib.request.Request(DEX_URL, data=json.dumps(nos).encode(), headers={"Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=40))
    return r.get("data") or r.get("result") or [] if isinstance(r, dict) else r
def dex_events(r):
    ev = r.get("trackingDetails") or r.get("details") or r.get("items") or r.get("traces") or []
    out = [{"time": iso(e.get("time") or e.get("trackTime") or e.get("date")),
            "location": scrub(e.get("location") or e.get("city") or ""),
            "description": scrub(e.get("description") or e.get("context") or e.get("content") or e.get("status") or ""),
            "source": "DEX api.dex-i.com"} for e in ev if isinstance(e, dict)] if isinstance(ev, list) else []
    return sorted(out, key=lambda x: x["time"] or "", reverse=True)
def derive(s):
    L = s["legs"]; dom, wh, it = L.get("domestic"), L.get("warehouse"), L.get("international")
    st, src = -1, None
    if dom and dom.get("history"): st, src = 0, "国内段有轨迹事件"
    elif dom and dom.get("tracking_no"): st, src = 0, "仅有单号，未查到轨迹"
    if wh and wh.get("warehouse_ref"): st, src = 1, f'有入仓号 {wh["warehouse_ref"]}（入仓凭证）'
    if it and it.get("history"):
        n = max(intl_stage(e["description"]) for e in it["history"][:1])
        if n > st: st, src = n, f'{it["carrier"]} 返回轨迹事件'
    elif it and it.get("tracking_no") and st >= 1:
        src += f'；货代已分配{it["carrier"]}单号 {it["tracking_no"]}，承运商暂无轨迹，未标出运'
    s["stage"] = STAGES[st] if st >= 0 else "未查到"; s["stage_source"] = src or "无已确认信息"
    # merged history across legs, tagged
    h = [dict(e, leg=k) for k in ("domestic", "warehouse", "international") if L.get(k) for e in L[k].get("history", [])]
    s["history"] = sorted(h, key=lambda x: x["time"] or "", reverse=True)
    s["last_event"] = scrub(f'{h[0]["time"]} [{h[0]["leg"]}] {h[0]["description"]}' if s["history"] and (h := s["history"]) else s.get("note") or "暂无轨迹事件")
    # legacy flat mirrors for index.html (prefer furthest known leg)
    top = it or wh or dom or {}
    s["mode"] = it["mode"] if it else "domestic-pending"
    s["status"] = s["stage"]; s["carrier"] = (it or dom or {}).get("carrier"); s["tracking_no"] = (it or dom or {}).get("tracking_no")
    s["mark"] = wh.get("mark") if wh else None; s["ctns"] = wh.get("ctns") if wh else None; s["weight"] = wh.get("weight") if wh else None
    s["china_ref"] = "; ".join(x for x in [dom and f'国内 {dom["carrier"]} {dom["tracking_no"]}', wh and f'入仓号 {wh["warehouse_ref"]}'] if x) or None
def main():
    d = json.loads(P.read_text()); now = datetime.datetime.now(MYT).isoformat(timespec="minutes")
    air = [s for s in d["shipments"] if (s["legs"].get("international") or {}).get("mode") == "air"]
    try: res = dex([s["legs"]["international"]["tracking_no"] for s in air]) if air else []
    except Exception as e: print("DEX error:", e); res = None
    for s in air:
        it = s["legs"]["international"]
        if res is not None:
            hit = [r for r in res if it["tracking_no"] in json.dumps(r, ensure_ascii=False)]
            ev = dex_events(hit[0]) if hit else []
            if ev: it["history"] = ev
            it["status"] = ev[0]["description"] if ev else ("DEX 有记录无事件" if hit else "未查到（DEX 暂无记录）")
        s["last_checked"] = now
    for s in d["shipments"]:
        it = s["legs"].get("international")
        if it and it.get("mode") == "sea":  # yd-wl placeholder: manual / browser only
            it["status"] = it.get("status") or "需手动查 yd-wl.com"; s["last_checked"] = now
        derive(s)
    d["updated"] = datetime.datetime.now(MYT).strftime("%Y-%m-%d %H:%M MYT")
    P.write_text(json.dumps(d, ensure_ascii=False, indent=1))
    for s in d["shipments"]: print(s["id"], s["tracking_no"], s["stage"], "|", s["stage_source"])
if __name__ == "__main__": main()
