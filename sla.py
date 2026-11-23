"""阶段超时。阈值只读 sla_rules.json，不写电话或地址。"""
import json, re, datetime
from pathlib import Path

RULES_PATH = Path(__file__).with_name("sla_rules.json")
MYT = datetime.timezone(datetime.timedelta(hours=8))
ISO_START = re.compile(r"^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?")

def load_rules():
    return json.loads(RULES_PATH.read_text())

def parse_instant(v):
    if v in (None, ""):
        return None
    if isinstance(v, datetime.datetime):
        return v if v.tzinfo else v.replace(tzinfo=MYT)
    if isinstance(v, datetime.date) and not isinstance(v, datetime.datetime):
        return datetime.datetime(v.year, v.month, v.day, tzinfo=MYT)
    s = str(v).strip()
    m = ISO_START.match(s)
    if not m:
        return None
    y, mo, d = map(int, m.group(1).split("-"))
    hh = int(m.group(2) or 0)
    mm = int(m.group(3) or 0)
    ss = int(m.group(4) or 0)
    tz = MYT
    zm = re.search(r"([Zz]|[+-]\d{2}:\d{2})$", s)
    if zm:
        z = zm.group(1)
        if z in ("Z", "z"):
            tz = datetime.timezone.utc
        else:
            sign = 1 if z[0] == "+" else -1
            tz = datetime.timezone(datetime.timedelta(hours=sign * int(z[1:3]), minutes=int(z[4:6])))
    return datetime.datetime(y, mo, d, hh, mm, ss, tzinfo=tz)

def myt_date(v, tz_hours=8):
    dt = parse_instant(v)
    if dt is None:
        m = re.match(r"^(\d{4}-\d{2}-\d{2})", str(v or ""))
        return m.group(1) if m else None
    return dt.astimezone(datetime.timezone(datetime.timedelta(hours=tz_hours))).date().isoformat()

def days_between(fro, to, tz_hours=8):
    a, b = myt_date(fro, tz_hours), myt_date(to, tz_hours)
    if not a or not b:
        return None
    da = datetime.date.fromisoformat(a)
    db = datetime.date.fromisoformat(b)
    return (db - da).days

def is_arrived_port_text(text):
    t = str(text or "")
    stripped = re.sub(r"预计[^。；;\n]*到港", "", t)
    return "到港" in stripped

def has_kw(text, words):
    t = str(text or "")
    for w in words or []:
        if w == "到港":
            return is_arrived_port_text(t)
        if w in t:
            return True
    return False

def mode_of(inp):
    m = inp.get("mode") or ""
    if m in ("air", "空运"):
        return "air"
    if m in ("sea", "海运"):
        return "sea"
    route = inp.get("route") or ""
    if route == "air":
        return "air"
    if route in ("sea", "seaPlan", "seaProposed"):
        return "sea"
    hint = str(inp.get("hint") or "")
    if "空运" in hint and "海运" not in hint:
        return "air"
    if "海运" in hint:
        return "sea"
    return ""

def extract_eta(inp):
    for s in [inp.get("eta"), inp.get("etaNote"), inp.get("eta_note")]:
        if not s:
            continue
        s = str(s)
        if re.search(r"已到港|实际.*到港", s) and not re.search(r"^20\d{2}-\d{2}-\d{2}（yd 预计", s):
            if re.match(r"^yd ", s, re.I) or "实际" in s or "已到港" in s:
                continue
        m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
        if m and "已到港" not in s:
            return m.group(1)
    te = inp.get("trackingEta") or inp.get("tracking_eta")
    if te:
        d = myt_date(te)
        if d:
            return d
    hits = []
    for ev in inp.get("history") or []:
        if "预计航班到达时间" in str(ev.get("description") or ev.get("text") or ""):
            d = myt_date(ev.get("time"))
            if d:
                hits.append(d)
    if hits:
        hits.sort()
        return hits[-1]
    last = str(inp.get("lastEvent") or inp.get("last_event") or "")
    if "预计航班到达时间" in last:
        d = myt_date(last)
        if d:
            return d
    return None

def sla_key(stage, last_event, status, rules):
    if not stage or stage in (rules.get("skipped_stages") or []):
        return None
    if stage in (rules.get("factory_stages") or []):
        return "factory"
    if stage in (rules.get("domestic_stages") or []):
        return "domestic"
    if stage in (rules.get("inbound_stages") or []):
        return "inbound"
    if stage in (rules.get("to_my_stages") or []):
        return "to_my"
    if stage in (rules.get("arrived_stages") or []):
        text = " ".join(x for x in [status, last_event] if x)
        if has_kw(text, (rules.get("keywords") or {}).get("delivering")) or "派送中" in str(status or ""):
            return "delivering"
        if has_kw(text, (rules.get("keywords") or {}).get("cleared")):
            return "cleared"
        return "arrived_port"
    return None

def refine_chase(key, inp, rules):
    base = (rules.get("chase") or {}).get(key) or ""
    if key in ("inbound", "to_my"):
        fwd = str(inp.get("forwarder") or "")
        if "零零九" in fwd:
            return "零零九（先翻微信历史）"
        if "云第" in fwd or "yd-wl" in fwd.lower() or re.search(r"\byd\b", fwd, re.I):
            return "钟（CC 群）"
    return base

def limit_for(key, inp, rules, eta):
    mode = mode_of(inp)
    if key == "factory":
        return rules["factory"]["limit_days_after_promise"] if inp.get("promisedShipDate") or inp.get("promised_ship_date") else rules["factory"]["limit_days_after_order"]
    if key == "domestic":
        return rules["domestic"]["limit_days"]
    if key == "inbound":
        return rules["inbound"]["limit_days_air"] if mode == "air" else rules["inbound"]["limit_days_sea"]
    if key == "to_my":
        if eta:
            return rules["to_my"]["limit_days_past_eta_air"] if mode == "air" else rules["to_my"]["limit_days_past_eta_sea"]
        return rules["to_my"]["limit_days_no_eta_air"] if mode == "air" else rules["to_my"]["limit_days_no_eta_sea"]
    if key == "arrived_port":
        return rules["arrived_port"]["limit_days"]
    if key == "cleared":
        return rules["cleared"]["limit_days"]
    if key == "delivering":
        return rules["delivering"]["limit_days"]
    return None

def evaluate(inp, now, rules=None):
    rules = rules or load_rules()
    tz = rules.get("tz_offset_hours", 8)
    stage = inp.get("stage")
    skipped = bool(inp.get("done") or inp.get("route") == "local" or stage in (rules.get("skipped_stages") or []))
    empty = {"skipped": True, "overdue": False, "days": None, "limitDays": None, "key": None, "label": "", "chase": "", "since": None, "sinceKnown": False, "display": "", "eta": None}
    if skipped:
        return empty
    key = sla_key(stage, inp.get("lastEvent") or inp.get("last_event"), inp.get("status"), rules)
    if not key:
        return empty
    since = inp.get("stageSince") or inp.get("stage_since") or None
    since_known = bool(myt_date(since, tz))
    eta = extract_eta(inp) if key == "to_my" else None
    promised = inp.get("promisedShipDate") or inp.get("promised_ship_date")
    inp2 = dict(inp)
    inp2["promisedShipDate"] = promised
    limit_days = limit_for(key, inp2, rules, eta)
    days = days_between(since, now, tz) if since_known else None
    anchor_days = days
    if key == "factory" and promised:
        anchor_days = days_between(promised, now, tz)
    elif key == "to_my" and eta:
        anchor_days = days_between(eta, now, tz)
    overdue = anchor_days is not None and limit_days is not None and anchor_days >= limit_days
    if overdue and days is not None:
        display = f"卡住 {days} 天"
    elif overdue:
        display = "已超时"
    elif days is not None:
        display = f"本阶段第 {days} 天"
    else:
        display = "起始日期待确认"
    return {
        "skipped": False,
        "overdue": overdue,
        "days": days,
        "limitDays": limit_days,
        "key": key,
        "label": (rules.get("labels") or {}).get(key, key),
        "chase": refine_chase(key, inp, rules),
        "since": myt_date(since, tz) if since_known else None,
        "sinceKnown": since_known,
        "display": display,
        "eta": eta,
    }

def effective_stage(parcel, cons, rules=None):
    rules = rules or load_rules()
    if cons and cons.get("stage") in (rules.get("inherit_stages") or []):
        return cons.get("stage")
    return parcel.get("stage")

def events_of(*objs):
    out = []
    for obj in objs:
        if not obj:
            continue
        for h in obj.get("history") or []:
            if isinstance(h, dict):
                out.append(h)
        last = obj.get("last_event") or obj.get("lastEvent")
        if last:
            m = ISO_START.match(str(last).strip())
            desc = str(last)
            if m:
                desc = str(last)[m.end():].strip()
            out.append({"time": str(last), "description": desc})
    return out

def infer_since(events, key, rules):
    kws = (rules.get("keywords") or {})
    if key == "to_my":
        words = list(kws.get("departed_sea") or []) + list(kws.get("departed_air") or [])
    elif key == "factory":
        return None
    else:
        words = list(kws.get(key) or [])
    hits = []
    for ev in events or []:
        desc = ev.get("description") or ev.get("text") or ""
        if key == "arrived_port":
            ok = is_arrived_port_text(desc)
        else:
            ok = has_kw(desc, words)
        if ok and myt_date(ev.get("time")):
            hits.append(ev.get("time"))
    if not hits:
        return None
    hits.sort(key=lambda x: str(x))
    return hits[0]

def card_input(parcel, cons, linked=None, rules=None):
    rules = rules or load_rules()
    linked = linked or []
    stage = effective_stage(parcel, cons, rules)
    inherit = cons and cons.get("stage") in (rules.get("inherit_stages") or [])
    last = (cons.get("last_event") if inherit and cons else None) or parcel.get("last_event")
    since = parcel.get("stage_since") or (cons.get("stage_since") if cons else None)
    mode = (cons.get("mode") if cons else None) or parcel.get("mode")
    eta = parcel.get("eta") or (cons.get("eta") if cons else None)
    eta_note = parcel.get("eta_note") or (cons.get("eta_note") if cons else None)
    done = stage in (rules.get("skipped_stages") or []) or parcel.get("stage") in (rules.get("skipped_stages") or [])
    if (cons and cons.get("stage") == "已签收") or parcel.get("stage") == "已签收":
        done = True
    if parcel.get("stage") == "已完成（中国本地自取）" or parcel.get("forwarder") == "中国本地自取":
        done = True
        route = "local"
    else:
        route = "air" if mode == "air" else ("sea" if mode == "sea" else "")
    return {
        "id": parcel.get("id"),
        "item": parcel.get("item") or "",
        "supplier": parcel.get("supplier") or "",
        "stage": stage,
        "lastEvent": last,
        "eta": eta,
        "etaNote": eta_note,
        "mode": mode,
        "route": route,
        "done": done,
        "promisedShipDate": parcel.get("promised_ship_date"),
        "stageSince": since,
        "forwarder": parcel.get("forwarder") or (cons.get("forwarder") if cons else ""),
        "hint": parcel.get("hint") or (cons.get("hint") if cons else ""),
        "status": last,
        "trackingEta": parcel.get("tracking_eta") or (cons.get("tracking_eta") if cons else None),
        "history": (cons.get("history") if cons else None) or parcel.get("history") or [],
    }

def orphan_input(cons, rules=None):
    rules = rules or load_rules()
    done = cons.get("stage") in (rules.get("skipped_stages") or [])
    return {
        "id": cons.get("id"),
        "item": cons.get("item") or "",
        "supplier": "待确认",
        "stage": cons.get("stage"),
        "lastEvent": cons.get("last_event"),
        "eta": cons.get("eta"),
        "etaNote": cons.get("eta_note"),
        "mode": cons.get("mode"),
        "route": "air" if cons.get("mode") == "air" else "sea",
        "done": done,
        "promisedShipDate": None,
        "stageSince": cons.get("stage_since"),
        "forwarder": cons.get("forwarder") or "",
        "hint": cons.get("hint") or "",
        "status": cons.get("last_event"),
        "trackingEta": cons.get("tracking_eta"),
        "history": cons.get("history") or [],
    }

def used_cons_ids(data):
    used = set()
    for p in data.get("parcels") or []:
        if p.get("consolidation_id"):
            used.add(p["consolidation_id"])
    for c in data.get("consolidations") or []:
        if (c.get("parcels") or []) or (c.get("parcel_ids") or []):
            used.add(c["id"])
    return used

def iter_cards(data, rules=None):
    rules = rules or load_rules()
    byid = {c["id"]: c for c in data.get("consolidations") or []}
    for p in data.get("parcels") or []:
        cons = byid.get(p.get("consolidation_id"))
        linked = [c for c in (data.get("consolidations") or []) if c is not cons and (p.get("id") in (c.get("parcels") or []) or p.get("id") in (c.get("parcel_ids") or []))]
        yield card_input(p, cons, linked, rules)
    used = used_cons_ids(data)
    for c in data.get("consolidations") or []:
        if c["id"] not in used:
            yield orphan_input(c, rules)

def evaluate_all(data, now, rules=None):
    rules = rules or load_rules()
    rows = []
    for inp in iter_cards(data, rules):
        sla = evaluate(inp, now, rules)
        rows.append({"input": inp, "sla": sla})
    return rows

def stuck_payload(data, now, rules=None):
    rules = rules or load_rules()
    rows = evaluate_all(data, now, rules)
    overdue, unknown = [], []
    for row in rows:
        sla, inp = row["sla"], row["input"]
        if sla.get("skipped"):
            continue
        rec = {
            "id": inp.get("id"),
            "item": inp.get("item") or "",
            "supplier": inp.get("supplier") or "",
            "stage": sla.get("label") or "",
            "days": sla.get("days"),
            "limit_days": sla.get("limitDays"),
            "since": sla.get("since"),
            "chase": sla.get("chase") or "",
        }
        if sla.get("overdue"):
            overdue.append(rec)
        elif not sla.get("sinceKnown"):
            unknown.append(rec)
    overdue.sort(key=lambda r: (-(r["days"] if r["days"] is not None else -1), r["id"] or ""))
    updated = data.get("updated") or ""
    return {"updated": updated, "overdue": overdue, "unknown_start": unknown}

def print_stuck(payload):
    print("超时清单")
    if not payload["overdue"]:
        print("（无）")
    for r in payload["overdue"]:
        days = "起始日期待确认" if r["days"] is None else f"已卡 {r['days']} 天"
        lim = "—" if r["limit_days"] is None else f"时限 {r['limit_days']} 天"
        print(f"{r['id']}  {r['item']}  {r['supplier']}  {r['stage']}  {days}（{lim}）  建议：{r['chase']}")
    print("起始日期待确认")
    if not payload["unknown_start"]:
        print("（无）")
    for r in payload["unknown_start"]:
        print(f"{r['id']}  {r['item']}  {r['supplier']}  {r['stage']}")

def write_stuck(payload, path):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")

def insert_after(d, after, key, val):
    out = {}
    placed = False
    for k, v in d.items():
        out[k] = v
        if k == after and key not in d:
            out[key] = val
            placed = True
    if key in d:
        out[key] = val
        placed = True
    if not placed:
        out[key] = val
    return out

def fill_stage_since(data, mapping, rules=None):
    """Only fill empty stage_since. mapping: {id: iso-or-date}."""
    rules = rules or load_rules()
    by = {x["id"]: x for x in (data.get("parcels") or []) + (data.get("consolidations") or [])}
    for oid, val in mapping.items():
        obj = by.get(oid)
        if not obj or obj.get("stage_since"):
            continue
        if val:
            idx = (data.get("parcels") or [])
            if obj in idx:
                data["parcels"][idx.index(obj)] = insert_after(obj, "stage", "stage_since", val)
            else:
                idx = data.get("consolidations") or []
                data["consolidations"][idx.index(obj)] = insert_after(obj, "stage", "stage_since", val)
    return data


STEP_LABEL_KEY = {
    "厂家": "factory", "国内配送": "domestic", "国内快递": "domestic", "国内送仓": "domestic",
    "集运仓": "warehouse", "空运": "transit", "海运": "transit",
    "到马派送": "arrived", "到港清关": "arrived",
    "签收": "delivered", "派送签收": "delivered", "酒店自取": "delivered",
    "方式待定": "pending",
}
TONE_RANK = {"red": 0, "yellow": 1, "cyan": 2, "gray": 3, "done": 4}

def route_steps(route, domestic_label="国内快递"):
    if route == "local":
        return ["厂家", "国内配送", "酒店自取"]
    if route == "warehouse":
        return ["厂家", domestic_label or "国内快递", "集运仓", "方式待定"]
    air = route == "air"
    return ["厂家", domestic_label or "国内快递", "集运仓", "空运" if air else "海运", "到马派送" if air else "到港清关", "签收" if air else "派送签收"]

def format_step_when(v, tz_hours=8):
    day = myt_date(v, tz_hours)
    if not day:
        return None
    md = day[5:7] + "-" + day[8:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", str(v or "").strip()):
        return md
    inst = parse_instant(v)
    if not inst:
        return md
    local = inst.astimezone(datetime.timezone(datetime.timedelta(hours=tz_hours)))
    if local.hour == 0 and local.minute == 0:
        return md
    return f"{md} {local.hour:02d}:{local.minute:02d}"

def tone_for(dwell, limit, rules=None):
    if dwell is None or limit is None or limit <= 0:
        return "gray"
    rules = rules or load_rules()
    red = (rules.get("tones") or {}).get("red_above", 1)
    cyan = (rules.get("tones") or {}).get("cyan_below", 0.5)
    r = dwell / limit
    if r > red:
        return "red"
    if r >= cyan:
        return "yellow"
    return "cyan"

def step_limit(key, inp, rules, start=None):
    mode = mode_of(inp)
    if key == "factory":
        return rules["factory"]["limit_days_after_promise"] if inp.get("promisedShipDate") or inp.get("promised_ship_date") else rules["factory"]["limit_days_after_order"]
    if key == "domestic":
        return rules["domestic"]["limit_days"]
    if key == "warehouse":
        return rules["inbound"]["limit_days_air"] if mode == "air" else rules["inbound"]["limit_days_sea"]
    if key == "transit":
        eta = extract_eta(inp)
        if eta and start:
            planned = days_between(start, eta, rules.get("tz_offset_hours", 8))
            grace = rules["to_my"]["limit_days_past_eta_air"] if mode == "air" else rules["to_my"]["limit_days_past_eta_sea"]
            return max(0, 0 if planned is None else planned) + grace
        return rules["to_my"]["limit_days_no_eta_air"] if mode == "air" else rules["to_my"]["limit_days_no_eta_sea"]
    if key == "arrived":
        return rules["arrived_port"]["limit_days"]
    if key == "delivered":
        return rules["delivering"]["limit_days"]
    return None

def skip_event(desc):
    t = str(desc or "")
    return bool(re.match(r"^(线索|微信跟进翻查|台账核对)", t) or "推断线索" in t or "预计航班到达时间" in t)

def classify_event(ev, rules=None):
    rules = rules or load_rules()
    desc = ev.get("description") or ev.get("text") or ""
    if skip_event(desc):
        return None
    kws = rules.get("step_keywords") or {}
    for key in ("delivered", "arrived", "transit", "warehouse", "domestic", "factory"):
        if key == "arrived":
            if is_arrived_port_text(desc) or has_kw(desc, kws.get("arrived")):
                return "arrived"
            continue
        if has_kw(desc, kws.get(key) or []):
            return key
    return None

def infer_step_dates(objs, rules=None):
    rules = rules or load_rules()
    events = []
    for o in objs or []:
        if not o:
            continue
        for h in o.get("history") or []:
            if isinstance(h, dict):
                events.append(h)
        last = o.get("last_event") or o.get("lastEvent")
        if last:
            m = ISO_START.match(str(last).strip())
            events.append({"time": m.group(0) if m else last, "description": str(last)})
    events.sort(key=lambda e: str(e.get("time") or ""))
    def has_clock(v):
        s = str(v or "")
        return bool(re.search(r"[T ]\d{2}:\d{2}", s) and not re.search(r"[T ]00:00", s))
    dates = {}
    for ev in events:
        key = classify_event(ev, rules)
        if not (key and ev.get("time") and myt_date(ev.get("time"))):
            continue
        prev = dates.get(key)
        if not prev:
            dates[key] = ev.get("time")
        elif myt_date(prev) == myt_date(ev.get("time")) and not has_clock(prev) and has_clock(ev.get("time")):
            dates[key] = ev.get("time")
    return dates

def merge_step_dates(list_):
    out = {}
    for sd in list_ or []:
        if not sd:
            continue
        for k, v in sd.items():
            if not v:
                continue
            if k not in out or str(v) < str(out[k]):
                out[k] = v
    return out

def decorate_steps(inp, now, rules=None):
    rules = rules or load_rules()
    tz = rules.get("tz_offset_hours", 8)
    labels = inp.get("stepLabels") or route_steps(inp.get("route"), inp.get("domesticLabel") or inp.get("domestic_label") or "国内快递")
    n = inp.get("currentStep") if inp.get("currentStep") is not None else inp.get("current_step")
    dates = inp.get("stepDates") or inp.get("step_dates") or {}
    raw = []
    for i, label in enumerate(labels):
        key = STEP_LABEL_KEY.get(label)
        raw.append({"key": key, "label": label, "i": i, "isFuture": i > n, "isCurrent": i == n, "isPast": i < n, "at": (key and dates.get(key)) or None})
    out = []
    for i, s in enumerate(raw):
        item = dict(s)
        if s["isFuture"]:
            item.update({"dwell": None, "dwellLabel": "", "whenLabel": "", "tone": ""})
            out.append(item)
            continue
        if not s["at"]:
            item.update({"dwell": None, "dwellLabel": "日期待确认", "whenLabel": "日期待确认", "tone": "gray"})
            out.append(item)
            continue
        end = None
        for j in range(i + 1, len(raw)):
            if raw[j]["at"]:
                end = raw[j]["at"]
                break
        can = end or s["isCurrent"]
        dwell = days_between(s["at"], now if s["isCurrent"] else end, tz) if can else None
        limit = step_limit(s["key"], inp, rules, s["at"])
        tone = "gray" if dwell is None else tone_for(dwell, limit, rules)
        if dwell is None:
            dwell_label = "停留待确认"
        elif inp.get("done") and s["isCurrent"]:
            dwell_label = "完成"
        elif s["isCurrent"]:
            dwell_label = f"已卡 {dwell} 天"
        else:
            dwell_label = f"停留 {dwell} 天"
        item.update({"dwell": dwell, "dwellLabel": dwell_label, "whenLabel": format_step_when(s["at"], tz), "tone": tone, "limit": limit})
        out.append(item)
    return out

# note-only dates that history does not contain; do not invent others
NOTE_STEP_DATES = {
    "PKG-005": {"factory": "2026-10-20", "domestic": "2026-10-20"},
    "PKG-010": {"factory": "2026-10-16", "domestic": "2026-10-16"},
    "PKG-006": {"warehouse": "2026-10-21"},
    "CON-002": {"warehouse": "2026-10-21"},
    "CON-006": {"warehouse": "2026-10-24"},
    "PKG-021": {"warehouse": "2026-11-06T21:04:00+08:00"},
}

def sla_key_to_step(key):
    return {"factory": "factory", "domestic": "domestic", "inbound": "warehouse", "to_my": "transit", "arrived_port": "arrived", "cleared": "arrived", "delivering": "delivered"}.get(key)


def detect_tracking_eta(objs):
    hits = []
    for ev in events_of(*[o for o in (objs or []) if o]):
        if "预计航班到达时间" in str(ev.get("description") or ""):
            d = myt_date(ev.get("time"))
            if d:
                hits.append((str(ev.get("time") or ""), d))
    if not hits:
        return None
    hits.sort()
    return hits[-1][1]

def refresh_step_dates(data, rules=None):
    """Fill step_dates from history (and a few note-confirmed dates). Also fill empty stage_since."""
    rules = rules or load_rules()
    cons_list = data.get("consolidations") or []
    parcels = data.get("parcels") or []

    def linked_of(p, cons):
        return [c for c in cons_list if c is not cons and (p.get("id") in (c.get("parcels") or []) or p.get("id") in (c.get("parcel_ids") or []))]

    def apply(obj, inferred, manual):
        dates = dict(inferred)
        for k, v in (manual or {}).items():
            dates.setdefault(k, v)
        obj["step_dates"] = dates
        if not obj.get("stage_since") and dates:
            inp = {"stage": obj.get("stage"), "lastEvent": obj.get("last_event"), "status": obj.get("last_event"), "done": obj.get("stage") in (rules.get("skipped_stages") or [])}
            key = sla_key(obj.get("stage"), obj.get("last_event"), obj.get("status"), rules)
            sk = sla_key_to_step(key) if key else None
            if sk and dates.get(sk):
                obj["stage_since"] = dates[sk]
        return obj

    for i, c in enumerate(cons_list):
        inferred = infer_step_dates([c], rules)
        cons_list[i] = apply(c, inferred, NOTE_STEP_DATES.get(c["id"]))
    byc = {c["id"]: c for c in cons_list}
    for i, p in enumerate(parcels):
        cons = byc.get(p.get("consolidation_id"))
        linked = linked_of(p, cons)
        inferred = infer_step_dates([p, cons, *linked], rules)
        merged = merge_step_dates([inferred, cons.get("step_dates") if cons else None] + [c.get("step_dates") for c in linked] + [NOTE_STEP_DATES.get(p["id"])])
        # apply() would overwrite with only inferred+manual; use merged
        p["step_dates"] = {k: v for k, v in merged.items() if v}
        if not p.get("stage_since") and p["step_dates"]:
            inherit = cons and cons.get("stage") in (rules.get("inherit_stages") or [])
            stage = cons.get("stage") if inherit else p.get("stage")
            last = (cons.get("last_event") if inherit and cons else None) or p.get("last_event")
            key = sla_key(stage, last, last, rules)
            sk = sla_key_to_step(key) if key else None
            if sk and p["step_dates"].get(sk):
                p["stage_since"] = p["step_dates"][sk]
        parcels[i] = p
    data["consolidations"] = cons_list
    data["parcels"] = parcels
    for c in cons_list:
        te = detect_tracking_eta([c])
        if te:
            c["tracking_eta"] = te
    byc = {c["id"]: c for c in cons_list}
    for p in parcels:
        cons = byc.get(p.get("consolidation_id"))
        te = detect_tracking_eta([p, cons]) or (cons.get("tracking_eta") if cons else None)
        if te:
            p["tracking_eta"] = te
    return data
