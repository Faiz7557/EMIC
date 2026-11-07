// Exact subset of reference/analysis.json (TRD ?9). No floor cells in the app bundle.
export const analysis = {
  "grid": {
    "1_5": {
      "capture": 0.87405,
      "median_trigger": 16.954122756387772,
      "fa_room_h": 4.12
    },
    "1_10": {
      "capture": 0.87405,
      "median_trigger": 16.954122756387772,
      "fa_room_h": 4.12
    },
    "1_15": {
      "capture": 0.87405,
      "median_trigger": 16.954122756387772,
      "fa_room_h": 4.12
    },
    "1_20": {
      "capture": 0.87405,
      "median_trigger": 16.954122756387772,
      "fa_room_h": 4.12
    },
    "1_30": {
      "capture": 0.87405,
      "median_trigger": 16.954122756387772,
      "fa_room_h": 4.12
    },
    "2_5": {
      "capture": 0.2419,
      "median_trigger": 29.7373772020398,
      "fa_room_h": 0.3388816334911754
    },
    "2_10": {
      "capture": 0.36245,
      "median_trigger": 29.200976580520166,
      "fa_room_h": 0.6498892957402033
    },
    "2_15": {
      "capture": 0.43365,
      "median_trigger": 29.03418522880475,
      "fa_room_h": 0.9353156995884492
    },
    "2_20": {
      "capture": 0.48325,
      "median_trigger": 28.826425427470607,
      "fa_room_h": 1.1972649757722276
    },
    "2_30": {
      "capture": 0.5412,
      "median_trigger": 29.675265571292872,
      "fa_room_h": 1.6582975501728616
    },
    "3_5": {
      "capture": 0.02155,
      "median_trigger": 31.490437115735098,
      "fa_room_h": 0.014335640365834635
    },
    "3_10": {
      "capture": 0.0676,
      "median_trigger": 31.98795760958693,
      "fa_room_h": 0.0541869581756046
    },
    "3_15": {
      "capture": 0.11705,
      "median_trigger": 33.77785242063763,
      "fa_room_h": 0.11525949223247488
    },
    "3_20": {
      "capture": 0.15925,
      "median_trigger": 33.965689128024486,
      "fa_room_h": 0.19379261745402573
    },
    "3_30": {
      "capture": 0.23445,
      "median_trigger": 35.25233664226973,
      "fa_room_h": 0.3905207885118856
    },
    "4_5": {
      "capture": 0.0012,
      "median_trigger": 33.17279176763353,
      "fa_room_h": 0.00040720816087224776
    },
    "4_10": {
      "capture": 0.00825,
      "median_trigger": 35.960302826376655,
      "fa_room_h": 0.0030558408679764695
    },
    "4_15": {
      "capture": 0.0207,
      "median_trigger": 34.608355220948255,
      "fa_room_h": 0.009677255535393066
    },
    "4_20": {
      "capture": 0.03605,
      "median_trigger": 37.14018478688613,
      "fa_room_h": 0.02152986260940073
    },
    "4_30": {
      "capture": 0.07185,
      "median_trigger": 38.99558562330502,
      "fa_room_h": 0.0640682723841839
    }
  },
  "profiles": {
    "Q1": {
      "3_10": {
        "capture": 0.0123,
        "median_trigger": 29.664576212318856,
        "dose_red": 0.005322432298053514
      },
      "2_15": {
        "capture": 0.17555,
        "median_trigger": 32.306310238095065,
        "dose_red": 0.07458302087935231
      },
      "2_10": {
        "capture": 0.1364,
        "median_trigger": 31.959897619927133,
        "dose_red": 0.05869071116429081
      }
    },
    "Median": {
      "3_10": {
        "capture": 0.06875,
        "median_trigger": 32.01038920988136,
        "dose_red": 0.028976693588777414
      },
      "2_15": {
        "capture": 0.44215,
        "median_trigger": 28.541186298332434,
        "dose_red": 0.2052699309528465
      },
      "2_10": {
        "capture": 0.37015,
        "median_trigger": 28.985415393001656,
        "dose_red": 0.17239240236700393
      }
    },
    "Q3": {
      "3_10": {
        "capture": 0.261,
        "median_trigger": 30.224981012404402,
        "dose_red": 0.115620766849866
      },
      "2_15": {
        "capture": 0.7631,
        "median_trigger": 23.106360849639188,
        "dose_red": 0.4050323755169659
      },
      "2_10": {
        "capture": 0.69655,
        "median_trigger": 24.335291793763375,
        "dose_red": 0.3637589286956583
      }
    }
  },
  "two_tier": {
    "Q1": {
      "0.0": {
        "dose_red": 0.07464247019044867,
        "any_signal": 0.65825
      },
      "0.5": {
        "dose_red": 0.1574000074834938,
        "any_signal": 0.66325
      }
    },
    "Median": {
      "0.0": {
        "dose_red": 0.20603677033991785,
        "any_signal": 0.87415
      },
      "0.5": {
        "dose_red": 0.30461741155756417,
        "any_signal": 0.8783
      }
    },
    "Q3": {
      "0.0": {
        "dose_red": 0.40810146088559784,
        "any_signal": 0.9743
      },
      "0.5": {
        "dose_red": 0.490586991729005,
        "any_signal": 0.9756
      }
    }
  },
  "delay_curve": {
    "5": 0.88,
    "10": 0.7966666666666666,
    "15": 0.7133333333333334,
    "20": 0.63,
    "30": 0.46333333333333326,
    "40": 0.29666666666666663,
    "50": 0.13
  },
  "latency": [
    [
      "Tampung jendela 1 s",
      1000,
      "rancangan"
    ],
    [
      "Geser jendela 0,5 s",
      500,
      "rancangan"
    ],
    [
      "Log-mel 64 x 49",
      40,
      "estimasi"
    ],
    [
      "Inferensi CNN int8",
      54,
      "batas atas"
    ],
    [
      "Keputusan ambang",
      1,
      "estimasi"
    ],
    [
      "ESP-NOW + kirim ulang",
      30,
      "estimasi"
    ],
    [
      "Getar pager + LED",
      100,
      "estimasi"
    ]
  ],
  "ram": [
    [
      "Buffer audio 1 s",
      32
    ],
    [
      "DMA I2S",
      8
    ],
    [
      "Log-mel int8",
      3.1
    ],
    [
      "Tensor arena",
      40
    ],
    [
      "Stack RTOS",
      24
    ],
    [
      "Wi-Fi + ESP-NOW",
      90
    ],
    [
      "Aplikasi",
      30
    ],
    [
      "Server web (koordinator)",
      40
    ]
  ],
  "kit_hw": 2388720,
  "attrib": {
    "amb_pct": 36.0,
    "max_range": 2.9073183520213264
  }
} as const;

export const ANALYSIS = analysis;
export const LATENCY_TOTAL_MS = analysis.latency.reduce((sum, row) => sum + row[1], 0);
export const RAM_TOTAL_KB = analysis.ram.reduce((sum, row) => sum + row[1], 0);
