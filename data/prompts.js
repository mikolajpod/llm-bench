window.DATA = window.DATA || {};
window.DATA.prompts = [
  {
    "prompt_id": "reasoning_math_pl",
    "category": "reasoning",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Kupiłem 1,2 kg jabłek po 3,50 zł/kg. Z tego 35% wagi sprzedaję po 4 zł/kg,\na resztę po 6 zł/kg.\nIle zarobiłem netto (przychód minus koszt zakupu)? Pokaż obliczenia\nkrok po kroku, na końcu wynik w złotówkach."
  },
  {
    "prompt_id": "reasoning_logic_en",
    "category": "reasoning",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Alice, Bob, and Carol each have a hat. The hats are red, blue, and green (one each).\n- Alice does NOT have the red hat.\n- The person with the green hat is NOT Bob.\n- Carol does NOT have the blue hat.\nWho has which hat? Give a brief justification."
  },
  {
    "prompt_id": "reasoning_knights_en",
    "category": "reasoning",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "On an island, knights always tell the truth and knaves always lie. You meet three\nislanders A, B, C.\n- A says: \"B is a knave.\"\n- B says: \"A and C are the same type.\"\n- C says: \"I am a knight.\"\nDetermine each one's type. Justify briefly."
  },
  {
    "prompt_id": "knowledge_polyhedra_en",
    "category": "knowledge",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "How many regular convex polyhedra (Platonic solids) exist in three-dimensional\nEuclidean space? List them by name, and for each give the number of faces and\nthe shape of each face."
  },
  {
    "prompt_id": "knowledge_polyhedra_pl",
    "category": "knowledge",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Ile jest brył foremnych (wielościanów foremnych wypukłych) w przestrzeni\ntrójwymiarowej? Wymień je z nazwy, dla każdej podaj liczbę ścian i ich kształt."
  },
  {
    "prompt_id": "knowledge_kingsofpoland_pl",
    "category": "knowledge",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Wymień pięciu pierwszych władców Polski Piastów w kolejności panowania.\nPodaj imiona i przybliżone lata panowania. Nie podawaj więcej niż 5."
  },
  {
    "prompt_id": "knowledge_galois_pl",
    "category": "knowledge",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Wyjaśnij w 3-4 zdaniach, co mówi twierdzenie Galois o rozwiązalności równań\nwielomianowych w pierwiastnikach. Wymień minimalny stopień, od którego ogólne\nrównanie nie jest rozwiązalne przez pierwiastniki."
  },
  {
    "prompt_id": "code_bug_fix_js",
    "category": "code",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "The following JavaScript binary search has TWO bugs. Identify both bugs and\nwrite the corrected function. Explain each bug in one sentence.\n\n```javascript\nfunction bsearch(arr, target) {\n  let lo = 0, hi = arr.length;\n  while (lo < hi) {\n    const mid = (lo + hi) / 2;\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) lo = mid;\n    else hi = mid;\n  }\n  return -1;\n}\n```"
  },
  {
    "prompt_id": "code_refactor_py",
    "category": "code",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Refactor the function below into THREE smaller functions while preserving the\nexact public API: `process_orders(orders: list[dict]) -> dict` with the same\nreturn shape and behavior. Use type hints. No comments. Output only Python code\nin a single ```python``` block.\n\n```python\ndef process_orders(orders):\n    result = {\"valid_count\": 0, \"invalid_count\": 0, \"total_cents\": 0,\n              \"by_country\": {}, \"summary\": \"\"}\n    for o in orders:\n        if not isinstance(o, dict):\n            result[\"invalid_count\"] += 1\n            continue\n        if \"id\" not in o or \"country\" not in o or \"amount_cents\" not in o:\n            result[\"invalid_count\"] += 1\n            continue\n        if not isinstance(o[\"amount_cents\"], int) or o[\"amount_cents\"] < 0:\n            result[\"invalid_count\"] += 1\n            continue\n        if not isinstance(o[\"country\"], str) or len(o[\"country\"]) != 2:\n            result[\"invalid_count\"] += 1\n            continue\n        country = o[\"country\"].upper()\n        result[\"valid_count\"] += 1\n        result[\"total_cents\"] += o[\"amount_cents\"]\n        if country not in result[\"by_country\"]:\n            result[\"by_country\"][country] = {\"count\": 0, \"total_cents\": 0}\n        result[\"by_country\"][country][\"count\"] += 1\n        result[\"by_country\"][country][\"total_cents\"] += o[\"amount_cents\"]\n    total_dollars = result[\"total_cents\"] / 100\n    if result[\"by_country\"]:\n        top_country = max(result[\"by_country\"].items(),\n                          key=lambda x: x[1][\"total_cents\"])[0]\n    else:\n        top_country = \"N/A\"\n    result[\"summary\"] = (f\"Processed {result['valid_count']} valid orders \"\n                         f\"({result['invalid_count']} invalid), total \"\n                         f\"${total_dollars:.2f}, top country: {top_country}\")\n    return result\n```"
  },
  {
    "prompt_id": "code_sql_query",
    "category": "code",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Schema:\n  users(id, name, country, signup_date)\n  orders(id, user_id, amount_cents, created_at, status)\n\nWrite a SINGLE SQL query (PostgreSQL dialect). For each country, return the\nnumber of users who in the last 30 days had at least 2 orders with status 'paid'\nand a combined paid-order total above 100 USD (10000 cents). Order descending\nby that count.\n\nOutput: only the SQL in a ```sql``` block, no prose."
  },
  {
    "prompt_id": "code_test_writing_py",
    "category": "code",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Write pytest tests for a function `parse_iso_duration(s: str) -> int` that parses\na subset of ISO-8601 duration strings (e.g. \"PT1H30M\" -> 5400) into seconds.\nCover at minimum: happy path with hours+minutes+seconds, zero duration (\"PT0S\"),\nmalformed input (raises ValueError), leading/trailing whitespace, unsupported\nyear/month components (\"P1Y\" must raise). Use @pytest.mark.parametrize where\nappropriate. Output only the test code in a single ```python``` block."
  },
  {
    "prompt_id": "code_async_py",
    "category": "code",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Write an async Python function with this exact signature:\n\n```python\nasync def fetch_all(urls: list[str], *, concurrency: int, timeout_s: float) -> list[dict]:\n    ...\n```\n\nRequirements:\n- Use `aiohttp` to GET each URL.\n- Limit in-flight requests to at most `concurrency` at any time (use `asyncio.Semaphore`).\n- Per-request timeout of `timeout_s` seconds; on timeout, do NOT cancel sibling requests.\n- Return a list, same length and order as `urls`. Each element is a dict with keys\n  `url` (str), `status` (int or None), `body` (str or None), `error` (str or None).\n  Exactly one of `body`/`error` is non-None.\n- The function must NOT raise — any per-request exception is captured into `error`.\n- Single `aiohttp.ClientSession` for the whole call, properly closed even on\n  cancellation of the outer task.\n- Output ONLY Python code in a single ```python``` block. No prose, no comments."
  },
  {
    "prompt_id": "polish_explain",
    "category": "polish",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Wyjaśnij w 3-4 zdaniach, na czym polega \"eventual consistency\" w systemach\nrozproszonych i czym różni się od \"strong consistency\". Pisz naturalnym,\ntechnicznym polskim. Unikaj kalk z angielskiego — w szczególności nie używaj\nsłowa \"ewentualnie\" w sensie \"ostatecznie\"."
  },
  {
    "prompt_id": "polish_creative_pl",
    "category": "polish",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.7,
    "prompt": "Napisz krótki opis (4-6 zdań) jesiennego poranka w Krakowie, z perspektywy\nosoby, która właśnie wysiadła z nocnego pociągu. Naturalna, literacka polszczyzna.\nBez nadmiernych ozdobników, bez kalk z angielskiego, bez słów \"magiczny\",\n\"niesamowity\", \"klimat\", \"wibracja\"."
  },
  {
    "prompt_id": "instruction_format_json",
    "category": "instruction",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "List exactly 3 European capital cities. Output ONLY a JSON array, no prose,\nno markdown, no code fences.\nEach element must be an object with keys: \"city\" (str), \"country\" (str),\n\"population_millions\" (number, float allowed).\nSort the array descending by population_millions."
  },
  {
    "prompt_id": "instruction_constraint_pl",
    "category": "instruction",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Napisz dokładnie 3 zdania o korzyściach z chodzenia pieszo.\nŻadne z tych zdań nie może zawierać litery \"e\" ani \"ę\". Po polsku."
  },
  {
    "prompt_id": "instruction_wordcount_pl",
    "category": "instruction",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Napisz krótki opis miasta Kraków o długości DOKŁADNIE 40 słów (liczę po\nwhitespace). Liczba zdań dowolna. Po polsku."
  },
  {
    "prompt_id": "longctx_qa",
    "category": "longctx",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Below is a long passage. After reading, answer the following three questions\nwith one sentence each. Be precise; if information is missing, say so.\n\n─── PASSAGE BEGINS ───\n{haystack}\n─── PASSAGE ENDS ───\n\n1. {q1}\n2. {q2}\n3. {q3}"
  },
  {
    "prompt_id": "agent_tool_choice_pl",
    "category": "agent",
    "lang": "pl",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "Dostępne narzędzia (JSON):\n[\n  {\"name\":\"web_search\",\"args\":{\"query\":\"str\"}},\n  {\"name\":\"get_weather\",\"args\":{\"city\":\"str\",\"date\":\"YYYY-MM-DD\"}},\n  {\"name\":\"calculator\",\"args\":{\"expression\":\"str\"}},\n  {\"name\":\"send_email\",\"args\":{\"to\":\"str\",\"subject\":\"str\",\"body\":\"str\"}}\n]\n\nDzisiejsza data: 2026-05-14.\n\nZapytanie użytkownika: \"Jaka będzie pogoda w Krakowie pojutrze i ile to\nstopni Fahrenheita, jeśli prognoza mówi 18 stopni Celsjusza?\"\n\nWybierz wywołania narzędzi w odpowiedniej kolejności. Output: ONLY a JSON array\nof objects {\"name\": ..., \"args\": ...}. Nic więcej, żadnego prose ani markdown."
  },
  {
    "prompt_id": "agent_react_en",
    "category": "agent",
    "lang": "en",
    "max_tokens": 8000,
    "temperature": 0.3,
    "prompt": "You are an agent that solves problems step by step using the following tools:\n- `read_file(path: str) -> str`\n- `list_dir(path: str) -> list[str]`\n- `run_python(code: str) -> str`\n- `write_file(path: str, content: str) -> None`\n- `finish(answer: str) -> None`\n\nToday's date is 2026-05-24. You operate in directory `/work/`.\n\nUser request: \"I have a folder of CSV files in /work/data/. Each row has columns\n`user_id, amount_cents, timestamp`. Compute the total amount per user across all\nCSV files and write the top 10 users (by total amount, descending) to\n/work/top10.csv with columns `user_id, total_dollars`.\"\n\nOutput a plan as a JSON array of tool calls in the order you would execute them,\neach as `{\"step\": <int>, \"tool\": \"<name>\", \"args\": {...}, \"reason\": \"<one line>\"}`.\nThe last step must be `finish`. Output ONLY the JSON array, no prose, no markdown."
  }
];
