window.DATA = window.DATA || {};
window.DATA.mtp = {
  "rows": [
    {
      "backend": "2.59.0",
      "pair": "qat",
      "config": "off",
      "model": "gemma-4-12B QAT UD-Q4_K_XL",
      "drafter": "drafter QAT Q8_0 (osobny plik)",
      "placement": "pełny GPU",
      "n": 4,
      "tps": 29.41,
      "watts": 90.7,
      "j_per_token": 3.125,
      "accept": null,
      "speedup": 1.0,
      "energy_delta": 0.0
    },
    {
      "backend": "2.59.0",
      "pair": "qat",
      "config": "n1",
      "model": "gemma-4-12B QAT UD-Q4_K_XL",
      "drafter": "drafter QAT Q8_0 (osobny plik)",
      "placement": "pełny GPU",
      "n": 4,
      "tps": 34.11,
      "watts": 76.1,
      "j_per_token": 2.214,
      "accept": 0.962,
      "speedup": 1.16,
      "energy_delta": -0.292
    },
    {
      "backend": "2.59.0",
      "pair": "qat",
      "config": "n4",
      "model": "gemma-4-12B QAT UD-Q4_K_XL",
      "drafter": "drafter QAT Q8_0 (osobny plik)",
      "placement": "pełny GPU",
      "n": 4,
      "tps": 41.11,
      "watts": 73.6,
      "j_per_token": 1.797,
      "accept": 0.86,
      "speedup": 1.398,
      "energy_delta": -0.425
    },
    {
      "backend": "2.59.0",
      "pair": "plain",
      "config": "off",
      "model": "gemma-4-12B Q4_K_M (lmstudio)",
      "drafter": "drafter plain Q8_0 (osobny plik)",
      "placement": "pełny GPU",
      "n": 4,
      "tps": 26.8,
      "watts": 113.6,
      "j_per_token": 4.257,
      "accept": null,
      "speedup": 1.0,
      "energy_delta": 0.0
    },
    {
      "backend": "2.59.0",
      "pair": "plain",
      "config": "n1",
      "model": "gemma-4-12B Q4_K_M (lmstudio)",
      "drafter": "drafter plain Q8_0 (osobny plik)",
      "placement": "pełny GPU",
      "n": 4,
      "tps": 28.85,
      "watts": 82.5,
      "j_per_token": 2.832,
      "accept": 0.96,
      "speedup": 1.076,
      "energy_delta": -0.335
    },
    {
      "backend": "2.59.0",
      "pair": "plain",
      "config": "n4",
      "model": "gemma-4-12B Q4_K_M (lmstudio)",
      "drafter": "drafter plain Q8_0 (osobny plik)",
      "placement": "pełny GPU",
      "n": 4,
      "tps": 34.54,
      "watts": 77.1,
      "j_per_token": 2.21,
      "accept": 0.85,
      "speedup": 1.289,
      "energy_delta": -0.481
    },
    {
      "backend": "2.59.0",
      "pair": "qwen3.6-35b-a3b-mtp",
      "config": "off",
      "model": "Qwen3.6-35B-A3B-MTP UD-Q4_K_S",
      "drafter": "głowica wbudowana",
      "placement": "MoE, 30 warstw ekspertów na CPU (tylko rozgrzane powt.)",
      "n": 2,
      "tps": 19.3,
      "watts": 43.6,
      "j_per_token": 2.246,
      "accept": null,
      "speedup": 1.0,
      "energy_delta": 0.0
    },
    {
      "backend": "2.59.0",
      "pair": "qwen3.6-35b-a3b-mtp",
      "config": "n1",
      "model": "Qwen3.6-35B-A3B-MTP UD-Q4_K_S",
      "drafter": "głowica wbudowana",
      "placement": "MoE, 30 warstw ekspertów na CPU (tylko rozgrzane powt.)",
      "n": 2,
      "tps": 23.65,
      "watts": 44.0,
      "j_per_token": 1.848,
      "accept": 0.959,
      "speedup": 1.225,
      "energy_delta": -0.177
    },
    {
      "backend": "2.59.0",
      "pair": "qwen3.6-35b-a3b-mtp",
      "config": "n4",
      "model": "Qwen3.6-35B-A3B-MTP UD-Q4_K_S",
      "drafter": "głowica wbudowana",
      "placement": "MoE, 30 warstw ekspertów na CPU (tylko rozgrzane powt.)",
      "n": 2,
      "tps": 26.7,
      "watts": 44.0,
      "j_per_token": 1.637,
      "accept": 0.818,
      "speedup": 1.383,
      "energy_delta": -0.271
    },
    {
      "backend": "2.59.0",
      "pair": "qwen3.8-27b",
      "config": "off",
      "model": "Qwen3.8-27B UD-Q4_K_M",
      "drafter": "głowica wbudowana",
      "placement": "dense, -ngl 30 (reszta na CPU)",
      "n": 4,
      "tps": 1.89,
      "watts": 37.8,
      "j_per_token": 19.933,
      "accept": null,
      "speedup": 1.0,
      "energy_delta": 0.0
    },
    {
      "backend": "2.59.0",
      "pair": "qwen3.8-27b",
      "config": "n1",
      "model": "Qwen3.8-27B UD-Q4_K_M",
      "drafter": "głowica wbudowana",
      "placement": "dense, -ngl 30 (reszta na CPU)",
      "n": 4,
      "tps": 2.73,
      "watts": 37.7,
      "j_per_token": 13.951,
      "accept": 0.967,
      "speedup": 1.444,
      "energy_delta": -0.3
    },
    {
      "backend": "2.59.0",
      "pair": "qwen3.8-27b",
      "config": "n4",
      "model": "Qwen3.8-27B UD-Q4_K_M",
      "drafter": "głowica wbudowana",
      "placement": "dense, -ngl 30 (reszta na CPU)",
      "n": 4,
      "tps": 2.8,
      "watts": 37.7,
      "j_per_token": 13.194,
      "accept": 0.811,
      "speedup": 1.481,
      "energy_delta": -0.338
    }
  ],
  "idle_watts": 29.6,
  "history_qwen36_may": [
    {
      "binary": "upstream llama.cpp b9432",
      "config": "01_nospec",
      "temp": 0,
      "tps": 16.22,
      "accept": null
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "01_nospec",
      "temp": 0.1,
      "tps": 18.18,
      "accept": null
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "02_mtp_n1",
      "temp": 0,
      "tps": 20.93,
      "accept": 0.896
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "02_mtp_n1",
      "temp": 0.1,
      "tps": 22.12,
      "accept": 0.917
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "03_mtp_n2",
      "temp": 0,
      "tps": 19.79,
      "accept": 0.832
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "03_mtp_n2",
      "temp": 0.1,
      "tps": 22.1,
      "accept": 0.828
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "04_mtp_n3",
      "temp": 0,
      "tps": 21.1,
      "accept": 0.781
    },
    {
      "binary": "upstream llama.cpp b9432",
      "config": "04_mtp_n3",
      "temp": 0.1,
      "tps": 22.85,
      "accept": 0.766
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "01_nospec",
      "temp": 0,
      "tps": 17.56,
      "accept": null
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "01_nospec",
      "temp": 0.1,
      "tps": 18.45,
      "accept": null
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "02_mtp_n1",
      "temp": 0,
      "tps": 20.08,
      "accept": 0.896
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "02_mtp_n1",
      "temp": 0.1,
      "tps": 22.66,
      "accept": 0.917
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "03_mtp_n2",
      "temp": 0,
      "tps": 21.07,
      "accept": 0.832
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "03_mtp_n2",
      "temp": 0.1,
      "tps": 23.23,
      "accept": 0.828
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "04_mtp_n3",
      "temp": 0,
      "tps": 21.28,
      "accept": 0.781
    },
    {
      "binary": "llama-server z LMS 2.16",
      "config": "04_mtp_n3",
      "temp": 0.1,
      "tps": 22.25,
      "accept": 0.766
    }
  ]
};
