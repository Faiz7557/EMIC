"""Semua perhitungan rekayasa SUAR. Tanpa data lapangan: hasilnya model/estimasi, bukan hasil uji."""
import json
import math
from pathlib import Path

import numpy as np

SEED = 20261107
HERE = Path(__file__).parent


def first_trigger(times, N, T):
    """Waktu pemicu pertama: kejadian ke-N yang jatuh dalam jendela T menit."""
    for i in range(N - 1, len(times)):
        if times[i] - times[i - N + 1] <= T:
            return times[i]
    return None


def simulate(rate_per_h, sens, N, T_min, wait_min=60, n=20000, rng=None):
    rng = rng or np.random.default_rng(SEED)
    lam = rate_per_h * sens / 60.0
    out = []
    for _ in range(n):
        k = rng.poisson(lam * wait_min)
        t = np.sort(rng.uniform(0, wait_min, k))
        out.append(first_trigger(t, N, T_min) if k >= N else None)
    return out


def false_alarm_per_hour(lam_h, N, T_min, zones=4):
    """Laju alarm palsu orde pertama: suara palsu yang menjadi kejadian ke-N dalam T menit."""
    x = lam_h * T_min / 60.0
    p = 1 - sum(math.exp(-x) * x**k / math.factorial(k) for k in range(N - 1))
    return lam_h * p * zones


def dose_fraction(trig, wait=60.0, react=5.0, mask_eff=0.56):
    """Fraksi dosis pengunjung lain dibanding tanpa SUAR, untuk satu sesi tunggu."""
    if trig is None or trig >= wait:
        return 1.0
    return (trig + react * (1 - mask_eff)) / wait


def wr_risk(q, ach, minutes, V=150.0, p=0.48):
    return 1 - math.exp(-q * p * (minutes / 60.0) / (V * ach))


def model_table():
    h, w, c = 64, 49, 1
    rows = []

    def conv(f, k, s):
        nonlocal h, w, c
        nh, nw = math.ceil(h / s), math.ceil(w / s)
        rows.append(("Conv2D", f"3x3, {f} filter, langkah {s}", f"{nh}x{nw}x{f}", k * k * c * f + f, nh * nw * k * k * c * f))
        h, w, c = nh, nw, f

    def ds(f, s):
        nonlocal h, w, c
        nh, nw = math.ceil(h / s), math.ceil(w / s)
        rows.append(("DS-Conv", f"3x3, {f} filter, langkah {s}", f"{nh}x{nw}x{f}", 9 * c + c + c * f + f, nh * nw * (9 * c + c * f)))
        h, w, c = nh, nw, f

    conv(32, 3, 2)
    ds(64, 2)
    ds(64, 1)
    ds(96, 2)
    ds(96, 1)
    rows.append(("GAP", "rata-rata global", f"1x1x{c}", 0, h * w * c))
    rows.append(("Dense", "2 kelas, softmax", "2", c * 2 + 2, c * 2))
    return rows


def main():
    R = {}
    SENS, LAM_F = 0.904, 1.03
    grid = {}
    for N in (1, 2, 3, 4):
        for T in (5, 10, 15, 20, 30):
            sims = simulate(2.3, SENS, N, T, rng=np.random.default_rng(SEED))
            hit = [s for s in sims if s is not None]
            grid[f"{N}_{T}"] = dict(
                capture=len(hit) / len(sims),
                median_trigger=float(np.median(hit)) if hit else None,
                fa_room_h=false_alarm_per_hour(LAM_F, N, T),
            )
    R["grid"] = grid

    prof = {}
    for name, r in (("Q1", 1.2), ("Median", 2.3), ("Q3", 4.1)):
        row = {}
        for N, T in ((3, 10), (2, 15), (2, 10)):
            sims = simulate(r, SENS, N, T, rng=np.random.default_rng(SEED + N + T))
            hit = [s for s in sims if s is not None]
            row[f"{N}_{T}"] = dict(
                capture=len(hit) / len(sims),
                median_trigger=float(np.median(hit)) if hit else None,
                dose_red=1 - float(np.mean([dose_fraction(s) for s in sims])),
            )
        prof[name] = row
    R["profiles"] = prof

    # Dua tingkat: T1 (1 batuk, ajakan masker mandiri, kepatuhan c) + T2 (2 batuk/15 menit, pager petugas)
    def two_tier(rate, c, wait=60.0, n=20000, N2=2, T2=15, react=5.0, eff=0.56):
        rng = np.random.default_rng(SEED + int(rate * 10) + int(c * 10))
        lam = rate * SENS / 60.0
        total = 0.0
        hit_any = 0
        for _ in range(n):
            k = rng.poisson(lam * wait)
            t = np.sort(rng.uniform(0, wait, k))
            t1 = t[0] if k else None
            t2 = first_trigger(t, N2, T2) if k >= N2 else None
            end = min(t2 + react, wait) if t2 is not None else wait
            if t1 is not None:
                hit_any += 1
            if t1 is not None and rng.random() < c and t1 + 1 < end:
                d = (t1 + 1) + (end - t1 - 1) * (1 - eff)
            else:
                d = t2 + react * (1 - eff) if t2 is not None and t2 + react <= wait else (wait if t2 is None else t2 + (wait - t2) * (1 - eff))
            total += d / wait
        return dict(dose_red=1 - total / n, any_signal=hit_any / n)

    R["two_tier"] = {name: {str(c): two_tier(r, c) for c in (0.0, 0.5)} for name, r in (("Q1", 1.2), ("Median", 2.3), ("Q3", 4.1))}

    R["best_case_dose_red"] = 1 - dose_fraction(10)
    R["delay_curve"] = {str(t): 1 - dose_fraction(t) for t in (5, 10, 15, 20, 30, 40, 50)}
    R["no_mask_red"] = 1 - dose_fraction(10, mask_eff=0.0)
    R["wr_q82_ach3"] = dict(no=100 * wr_risk(8.2, 3, 60), yes=100 * wr_risk(8.2, 3, 10 + 5 * 0.44))

    rows = model_table()
    R["model"] = dict(layers=rows, params=sum(x[3] for x in rows), macs=sum(x[4] for x in rows))
    R["model_flash_kb"] = round((R["model"]["params"] + 3000) / 1024, 1)

    R["latency"] = [
        ["Tampung jendela 1 s", 1000, "rancangan"],
        ["Geser jendela 0,5 s", 500, "rancangan"],
        ["Log-mel 64 x 49", 40, "estimasi"],
        ["Inferensi CNN int8", 54, "batas atas"],
        ["Keputusan ambang", 1, "estimasi"],
        ["ESP-NOW + kirim ulang", 30, "estimasi"],
        ["Getar pager + LED", 100, "estimasi"],
    ]
    R["latency_total"] = sum(x[1] for x in R["latency"])

    R["ram"] = [
        ["Buffer audio 1 s", 32],
        ["DMA I2S", 8],
        ["Log-mel int8", 3.1],
        ["Tensor arena", 40],
        ["Stack RTOS", 24],
        ["Wi-Fi + ESP-NOW", 90],
        ["Aplikasi", 30],
        ["Server web (koordinator)", 40],
    ]
    # Peta atribusi zona: ruang 10 x 5 m, 4 simpul tinggi 2 m, sumber batuk 1,2 m, medan bebas 1/r
    nodes = [(1.25, 2.5), (3.75, 2.5), (6.25, 2.5), (8.75, 2.5)]
    cells, amb = [], 0
    xs, ys = np.arange(0.125, 10, 0.25), np.arange(0.125, 5, 0.25)
    for y in ys:
        for x in xs:
            r = sorted((math.dist((x, y), n) ** 2 + 0.8**2, i) for i, n in enumerate(nodes))
            dl = 10 * math.log10(r[1][0] / r[0][0])
            cells.append([float(x), float(y), r[0][1], r[1][1], dl])
            amb += dl < 3
    R["attrib"] = dict(nodes=nodes, cells=cells, amb_pct=100 * amb / len(cells),
                       max_range=math.sqrt(1.25**2 + 2.5**2 + 0.8**2))
    R["ram_total"] = sum(x[1] for x in R["ram"])
    R["ram_cap"] = 512

    R["power_node"] = [["ESP32-S3, CPU + radio RX", 130], ["INMP441", 1.4], ["Cincin LED rata-rata", 25], ["Regulator dan rugi lain", 15]]
    current = sum(x[1] for x in R["power_node"])
    R["node_mA"] = current
    R["node_W"] = current * 5 / 1000
    R["kit_kWh_yr"] = R["node_W"] * 24 * 365 / 1000 * 4
    R["kit_cost_yr"] = R["kit_kWh_yr"] * 1444.7
    R["pager_h"] = 1000 * 0.85 / 90

    node, pager = 564680, 130000
    R["kit_hw"] = node * 4 + pager
    umk = 5288796
    R["umk"] = umk
    R["kit_vs_umk_days"] = R["kit_hw"] / (umk / 30)
    yrs = [0, 1, 2, 3]
    R["tco"] = {
        "Petugas triase tambahan": [umk * 12 * y for y in yrs],
        "CCTV + visi komputer": [9000000 + 1800000 * y for y in yrs],
        "SUAR, paket 4 zona": [R["kit_hw"] + (R["kit_cost_yr"] + 250000) * y for y in yrs],
    }

    price, service = 4900000, 600000
    cogs = [3000000, 2600000, 2200000]
    opex = [90000000, 180000000, 320000000]
    units = [15, 60, 200]
    base, fin = 0, []
    for i in range(3):
        rev = units[i] * price + base * service
        gp = rev - units[i] * cogs[i]
        fin.append(dict(tahun=i + 1, unit=units[i], basis=base + units[i], rev=rev, gp=gp, opex=opex[i], ebit=gp - opex[i]))
        base += units[i]
    R["fin"] = fin
    R["price"] = price
    R["service"] = service
    R["cogs"] = cogs
    R["share_y3"] = fin[2]["basis"] / 10268
    R["log_days"] = 1024 * 1024 / (200 * 32)

    (HERE / "analysis.json").write_text(json.dumps(R, indent=1), encoding="utf-8")
    return R


if __name__ == "__main__":
    R = main()
    # self-check: logika ambang dan dosis
    assert first_trigger([1, 2, 30], 2, 5) == 2
    assert first_trigger([1, 20, 40], 2, 5) is None
    assert abs(R["best_case_dose_red"] - 0.797) < 0.001
    for key in ("3_10", "2_10", "2_15", "2_20", "3_15", "1_10"):
        print(key, R["grid"][key])
    print(json.dumps(R["profiles"], indent=0)[:1500])
    for k in ("best_case_dose_red", "delay_curve", "no_mask_red", "wr_q82_ach3", "latency_total", "ram_total", "model_flash_kb", "node_mA", "node_W", "kit_kWh_yr", "kit_cost_yr", "pager_h", "kit_hw", "kit_vs_umk_days", "share_y3", "log_days"):
        print(k, R[k])
    print(R["model"]["params"], R["model"]["macs"], R["model"]["layers"])
    print(R["fin"])
    print({k: [round(x / 1e6, 1) for x in v] for k, v in R["tco"].items()})
