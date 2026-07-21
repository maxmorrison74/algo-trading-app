import math
from datetime import datetime
from zoneinfo import ZoneInfo

import requests


NY_TZ = ZoneInfo("America/New_York")


def _auth_headers(api_key, api_secret):
    return {
        "APCA-API-KEY-ID": str(api_key or "").strip(),
        "APCA-API-SECRET-KEY": str(api_secret or "").strip(),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _rest_base(base_url: str):
    return str(base_url or "").rstrip("/")


def _data_base():
    return "https://data.alpaca.markets"


def _today_eastern():
    return datetime.now(NY_TZ).date().isoformat()


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _extract_quote_mark(snapshot):
    quote = snapshot.get("latest_quote") or snapshot.get("latestQuote") or snapshot.get("quote") or {}
    trade = snapshot.get("latest_trade") or snapshot.get("latestTrade") or snapshot.get("trade") or {}
    bid = _safe_float(quote.get("bid_price") or quote.get("bp"))
    ask = _safe_float(quote.get("ask_price") or quote.get("ap"))
    if bid > 0 and ask > 0 and ask >= bid:
        return round((bid + ask) / 2.0, 4), bid, ask
    last_price = _safe_float(trade.get("price") or snapshot.get("close_price") or snapshot.get("daily_bar", {}).get("close"))
    return round(last_price, 4) if last_price > 0 else 0.0, bid, ask


def _occ_option_type(symbol: str):
    symbol = str(symbol or "").upper().strip()
    if len(symbol) >= 9:
        tail = symbol[-9:]
        return "put" if "P" in tail[:1] else "call" if "C" in tail[:1] else ""
    return ""


def _normalize_snapshot(symbol, payload):
    details = payload.get("option_details") or payload.get("details") or payload.get("contract") or {}
    strike = _safe_float(
        details.get("strike_price")
        or payload.get("strike_price")
        or details.get("strike")
    )
    option_type = str(
        details.get("type")
        or payload.get("type")
        or details.get("option_type")
        or _occ_option_type(symbol)
    ).lower()
    expiration_date = str(
        details.get("expiration_date")
        or payload.get("expiration_date")
        or ""
    )
    mark, bid, ask = _extract_quote_mark(payload)
    return {
        "symbol": symbol,
        "strike_price": strike,
        "type": option_type,
        "expiration_date": expiration_date,
        "mark_price": mark,
        "bid_price": bid,
        "ask_price": ask,
        "raw": payload,
    }


def _fetch_option_snapshots(
    api_key,
    api_secret,
    underlying_symbol,
    expiration_date,
    option_type,
    strike_price_gte,
    strike_price_lte,
    feed="indicative",
    limit=200,
):
    url = f"{_data_base()}/v1beta1/options/snapshots/{str(underlying_symbol or '').upper().strip()}"
    params = {
        "feed": feed,
        "limit": max(10, min(int(limit or 200), 1000)),
        "expiration_date": expiration_date,
        "type": option_type,
        "strike_price_gte": strike_price_gte,
        "strike_price_lte": strike_price_lte,
    }
    response = requests.get(url, headers=_auth_headers(api_key, api_secret), params=params, timeout=15)
    payload = response.json() if response.content else {}
    if response.status_code >= 400:
        raise RuntimeError(payload.get("message") or payload.get("detail") or f"Errore Alpaca data API ({response.status_code})")

    snapshots = payload.get("snapshots") or payload.get("option_snapshots") or {}
    items = []
    if isinstance(snapshots, dict):
        for symbol, snapshot in snapshots.items():
            items.append(_normalize_snapshot(symbol, snapshot or {}))
    elif isinstance(snapshots, list):
        for snapshot in snapshots:
            symbol = str((snapshot or {}).get("symbol") or "").strip()
            if symbol:
                items.append(_normalize_snapshot(symbol, snapshot or {}))
    return items


def fetch_option_snapshots_for_symbols(api_key, api_secret, symbols, feed="indicative"):
    normalized = [str(symbol or "").upper().strip() for symbol in (symbols or []) if str(symbol or "").strip()]
    if not normalized:
        return {}
    response = requests.get(
        f"{_data_base()}/v1beta1/options/snapshots",
        headers=_auth_headers(api_key, api_secret),
        params={
            "symbols": ",".join(normalized[:50]),
            "feed": feed,
        },
        timeout=15,
    )
    payload = response.json() if response.content else {}
    if response.status_code >= 400:
        raise RuntimeError(payload.get("message") or payload.get("detail") or f"Errore snapshot symbols ({response.status_code})")
    snapshots = payload.get("snapshots") or {}
    result = {}
    if isinstance(snapshots, dict):
        for symbol, item in snapshots.items():
            result[symbol] = _normalize_snapshot(symbol, item or {})
    return result


def _pick_nearest_contract(contracts, target_strike):
    if not contracts:
        return None
    ranked = sorted(
        contracts,
        key=lambda item: (
            abs(_safe_float(item.get("strike_price")) - _safe_float(target_strike)),
            -_safe_float(item.get("bid_price")),
            -_safe_float(item.get("ask_price")),
        ),
    )
    return ranked[0]


def build_zero_dte_trade_plan(
    api_key,
    api_secret,
    base_url,
    underlying_symbol,
    strategy,
    quote_price,
    spread_width_points,
    contracts,
    short_put_offset_pct,
    max_risk_usd,
    feed="indicative",
):
    if not api_key or not api_secret:
        return {"ready": False, "warnings": ["Chiavi Alpaca mancanti per costruire il piano opzioni."]}

    today_et = _today_eastern()
    rounded_price = round(_safe_float(quote_price), 2)
    if rounded_price <= 0:
        return {"ready": False, "warnings": [f"Prezzo live {underlying_symbol} non disponibile."]}

    spread_width = max(1, int(spread_width_points or 1))
    order_qty = max(1, int(contracts or 1))
    offset_pct = max(0.0, _safe_float(short_put_offset_pct, 0.15))
    warnings = []

    if strategy == "bull_put_spread":
        target_short = math.floor(rounded_price * (1 - (offset_pct / 100.0)))
        target_long = target_short - spread_width
        option_type = "put"
        legs_side = [
            {"side": "sell", "position_intent": "sell_to_open", "target_strike": target_short},
            {"side": "buy", "position_intent": "buy_to_open", "target_strike": target_long},
        ]
    else:
        target_long = math.ceil(rounded_price)
        target_short = target_long + spread_width
        option_type = "call"
        legs_side = [
            {"side": "buy", "position_intent": "buy_to_open", "target_strike": target_long},
            {"side": "sell", "position_intent": "sell_to_open", "target_strike": target_short},
        ]

    strike_min = min(target_short, target_long) - 2
    strike_max = max(target_short, target_long) + 2
    contracts_pool = _fetch_option_snapshots(
        api_key=api_key,
        api_secret=api_secret,
        underlying_symbol=underlying_symbol,
        expiration_date=today_et,
        option_type=option_type,
        strike_price_gte=strike_min,
        strike_price_lte=strike_max,
        feed=feed,
    )

    if not contracts_pool:
        return {"ready": False, "warnings": [f"Nessun contratto 0DTE {option_type.upper()} disponibile oggi per {underlying_symbol}."]}

    built_legs = []
    used_symbols = set()
    for leg in legs_side:
        candidates = [item for item in contracts_pool if item["symbol"] not in used_symbols]
        selected = _pick_nearest_contract(candidates, leg["target_strike"])
        if not selected:
            return {"ready": False, "warnings": ["Impossibile trovare entrambe le gambe del vertical spread."]}
        used_symbols.add(selected["symbol"])
        built_legs.append({
            **leg,
            "symbol": selected["symbol"],
            "strike_price": selected["strike_price"],
            "mark_price": selected["mark_price"],
            "bid_price": selected["bid_price"],
            "ask_price": selected["ask_price"],
            "expiration_date": selected["expiration_date"],
        })

    if strategy == "bull_put_spread":
        net_mid = _safe_float(built_legs[0]["mark_price"]) - _safe_float(built_legs[1]["mark_price"])
        estimated_credit = round(max(0.01, net_mid), 2)
        limit_price = round(max(0.01, estimated_credit * 0.96), 2)
        estimated_max_loss = round(((spread_width - estimated_credit) * 100.0) * order_qty, 2)
        debit_credit_label = "credit"
    else:
        net_mid = _safe_float(built_legs[0]["mark_price"]) - _safe_float(built_legs[1]["mark_price"])
        estimated_debit = round(max(0.01, net_mid), 2)
        limit_price = round(max(0.01, estimated_debit * 1.04), 2)
        estimated_max_loss = round((estimated_debit * 100.0) * order_qty, 2)
        debit_credit_label = "debit"

    if estimated_max_loss > _safe_float(max_risk_usd, 0):
        warnings.append("Il piano supera il tetto rischio configurato.")
    if any(_safe_float(leg.get("mark_price")) <= 0 for leg in built_legs):
        warnings.append("Prezzi opzioni incompleti: stima meno affidabile del solito.")

    return {
        "ready": len(warnings) == 0,
        "warnings": warnings,
        "expiration_date": today_et,
        "underlying": underlying_symbol,
        "strategy": strategy,
        "contracts": order_qty,
        "spread_width_points": spread_width,
        "estimated_limit_price": limit_price,
        "estimated_net_price": estimated_credit if strategy == "bull_put_spread" else estimated_debit,
        "net_price_type": debit_credit_label,
        "estimated_max_loss_usd": max(0.0, estimated_max_loss),
        "legs": built_legs,
        "feed": feed,
    }


def submit_multileg_order(
    api_key,
    api_secret,
    base_url,
    plan,
):
    order_payload = {
        "order_class": "mleg",
        "qty": str(max(1, int(plan.get("contracts") or 1))),
        "time_in_force": "day",
        "type": "limit",
        "limit_price": str(round(_safe_float(plan.get("estimated_limit_price"), 0.01), 2)),
        "legs": [
            {
                "symbol": leg["symbol"],
                "ratio_qty": "1",
                "side": leg["side"],
                "position_intent": leg["position_intent"],
            }
            for leg in plan.get("legs", [])
        ],
    }
    response = requests.post(
        f"{_rest_base(base_url)}/v2/orders",
        headers=_auth_headers(api_key, api_secret),
        json=order_payload,
        timeout=20,
    )
    payload = response.json() if response.content else {}
    if response.status_code >= 400:
        raise RuntimeError(payload.get("message") or payload.get("detail") or f"Errore Alpaca trading API ({response.status_code})")
    return {
        "id": payload.get("id"),
        "status": payload.get("status"),
        "created_at": payload.get("created_at"),
        "limit_price": payload.get("limit_price"),
        "legs": payload.get("legs", []),
        "raw": payload,
    }


def build_close_multileg_plan(positions, strategy="bull_put_spread"):
    rows = list(positions or [])
    if len(rows) != 2:
        return {"ready": False, "reason": "Servono esattamente due gambe aperte per chiudere lo spread in un colpo."}

    contracts = sorted({_safe_float(row.get("qty"), 0) for row in rows if _safe_float(row.get("qty"), 0) != 0})
    if not contracts:
        return {"ready": False, "reason": "Quantità opzioni non leggibili."}

    first_contracts = abs(contracts[0])
    if any(abs(abs(_safe_float(row.get("qty"), 0)) - first_contracts) > 0.001 for row in rows):
        return {"ready": False, "reason": "Le due gambe non hanno la stessa quantità."}

    legs = []
    net_credit = 0.0
    net_debit = 0.0
    for row in rows:
        qty = abs(int(round(_safe_float(row.get("qty"), 0))))
        side = str(row.get("side") or "").upper()
        current_mark = _safe_float(row.get("current_mark") or row.get("mark_price") or row.get("current_price"), 0.0)
        if qty <= 0 or current_mark <= 0:
            return {"ready": False, "reason": "Prezzi o quantità non disponibili per chiudere lo spread."}
        if side == "LONG":
            close_side = "sell"
            position_intent = "sell_to_close"
            net_credit += current_mark
        else:
            close_side = "buy"
            position_intent = "buy_to_close"
            net_debit += current_mark
        legs.append({
            "symbol": row.get("symbol"),
            "side": close_side,
            "position_intent": position_intent,
            "mark_price": current_mark,
            "qty": qty,
        })

    net_price = round(abs(net_credit - net_debit), 2)
    net_price_type = "credit" if net_credit >= net_debit else "debit"
    limit_price = round(max(0.01, net_price * (0.96 if net_price_type == "credit" else 1.04)), 2)
    return {
        "ready": True,
        "strategy": strategy,
        "contracts": int(first_contracts),
        "estimated_limit_price": limit_price,
        "estimated_net_price": net_price,
        "net_price_type": net_price_type,
        "legs": legs,
    }


def list_option_orders(api_key, api_secret, base_url, underlying_symbol="SPY", limit=20):
    response = requests.get(
        f"{_rest_base(base_url)}/v2/orders",
        headers=_auth_headers(api_key, api_secret),
        params={
            "status": "all",
            "limit": max(1, min(int(limit or 20), 100)),
            "direction": "desc",
            "nested": "true",
            "symbols": str(underlying_symbol or "").upper().strip(),
            "asset_class": "us_option",
        },
        timeout=15,
    )
    payload = response.json() if response.content else []
    if response.status_code >= 400:
        raise RuntimeError((payload or {}).get("message") or (payload or {}).get("detail") or f"Errore ordini opzioni ({response.status_code})")
    orders = payload if isinstance(payload, list) else []
    rows = []
    for item in orders:
        rows.append({
            "id": item.get("id"),
            "status": item.get("status"),
            "type": item.get("type"),
            "limit_price": _safe_float(item.get("limit_price")) or None,
            "filled_avg_price": _safe_float(item.get("filled_avg_price")) or None,
            "qty": _safe_float(item.get("qty"), 0),
            "created_at": item.get("created_at"),
            "legs": item.get("legs") or [],
        })
    return rows


def list_option_positions(api_key, api_secret, base_url, underlying_symbol="SPY"):
    response = requests.get(
        f"{_rest_base(base_url)}/v2/positions",
        headers=_auth_headers(api_key, api_secret),
        timeout=15,
    )
    payload = response.json() if response.content else []
    if response.status_code >= 400:
        raise RuntimeError((payload or {}).get("message") or (payload or {}).get("detail") or f"Errore posizioni opzioni ({response.status_code})")
    positions = payload if isinstance(payload, list) else []
    rows = []
    prefix = str(underlying_symbol or "").upper().strip()
    symbols = []
    for item in positions:
        symbol = str(item.get("symbol") or "")
        if prefix and not symbol.startswith(prefix):
            continue
        asset_class = str(item.get("asset_class") or item.get("assetClass") or "").lower()
        if asset_class and asset_class != "us_option":
            continue
        symbols.append(symbol)
        rows.append({
            "symbol": symbol,
            "qty": _safe_float(item.get("qty"), 0),
            "market_value": _safe_float(item.get("market_value"), 0),
            "avg_entry_price": _safe_float(item.get("avg_entry_price"), 0),
            "unrealized_pl": _safe_float(item.get("unrealized_pl"), 0),
            "side": str(item.get("side") or "").upper(),
        })
    if rows:
        try:
            snapshots = fetch_option_snapshots_for_symbols(api_key, api_secret, symbols)
        except Exception:
            snapshots = {}
        for row in rows:
            snap = snapshots.get(row["symbol"]) or {}
            market_value = abs(_safe_float(row.get("market_value"), 0))
            qty = abs(_safe_float(row.get("qty"), 0))
            inferred_mark = round(market_value / max(qty * 100.0, 1.0), 4) if market_value > 0 and qty > 0 else 0.0
            row["mark_price"] = _safe_float(snap.get("mark_price"), inferred_mark)
            row["current_mark"] = row["mark_price"]
            row["bid_price"] = _safe_float(snap.get("bid_price"), 0)
            row["ask_price"] = _safe_float(snap.get("ask_price"), 0)
            row["expiration_date"] = snap.get("expiration_date")
    return rows
