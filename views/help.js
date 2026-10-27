// Help view — glossary + how to read the app
(function () {
  const html = String.raw;

  window.renderHelp = function (root) {
    root.innerHTML = html`
      <h1 class="section-title">Help</h1>
      <p class="section-sub">
        Ściąga do widoków i terminów. Specyfikacje konkretnych eksperymentów
        są w <code>eval/README.md</code>.
      </p>

      <div class="e3-grid">
        <section class="panel">
          <h2>O co chodzi w tej apce</h2>
          <p>
            Hub do wizualizacji wyników kolejnych edycji własnego benchmarka LLM.
            Każda zakładka <code>Experiment N</code> = osobny zestaw runów
            (inne hardware, inne prompty, inna metodologia samplera).
            Wspólny widok <code>Models</code> trzyma rejestr modeli z metadanymi GGUF —
            niezależny od konkretnego eksperymentu.
          </p>
          <p>
            Modele to lokalne GGUF-y uruchamiane przez <code>llama-server.exe</code>.
            Każdy model dostaje N promptów × k sampli (różne seedy), pomiary z silnika
            (tok/s, finish_reason, truncation), oceny <strong>manualne 0–10</strong> per
            (model, prompt, stage) w oparciu o per-prompt rubrykę.
          </p>
        </section>

        <section class="panel">
          <h2>Tagi przy modelach (uniwersalne)</h2>
          <table class="help-table">
            <tr>
              <td><span class="tag unsloth">unsloth</span></td>
              <td>GGUF zbudowany przez <code>unsloth.ai</code>. Często quanty UD-Q4_K_S / UD-Q4_K_XL — własna metodologia kwantyzacji (Unsloth Dynamic). Brak tagu = quant od kogoś innego (najczęściej <code>lmstudio-community</code>, standardowe Q4_K_M / Q6_K).</td>
            </tr>
            <tr>
              <td><span class="tag warn">sampler-variant</span></td>
              <td>
                Ten sam plik GGUF, ale uruchomiony z niestandardowym samplerem
                (parametry generacji odbiegające od baseline'u eksperymentu).
                Disambiguowany w <code>models.py</code> przez suffix <code>@&lt;tag&gt;</code> w kluczu modelu
                (np. <code>@zai</code> dla parametrów rekomendowanych przez Z.ai).
                Pozostałe <code>@…</code> w nazwach (np. <code>@q4_k_m</code>, <code>@q6_k</code>) to po prostu
                różne quanty tego samego modelu — nie są sampler-variantami.
              </td>
            </tr>
          </table>
        </section>

        <section class="panel">
          <h2>Jak czytać heatmapę (uniwersalne)</h2>
          <ul class="help-list">
            <li>
              <strong>Kolor komórki</strong>: skala 0→10, czerwony → pomarańczowy → zielony.
              0 = błąd albo TRUNC, 10 = wzorcowa odpowiedź. Cyfra w środku to ocena.
            </li>
            <li>
              <strong>Czerwona kropka</strong> w prawym górnym rogu komórki = przynajmniej jeden z sampli
              skończył się truncacją (<code>finish_reason=length</code>, czyli model wyczerpał budżet tokenów).
            </li>
            <li>
              <strong>Kolumna "avg"</strong> po prawej = średnia ocena modelu po wszystkich promptach.
            </li>
            <li>
              <strong>Wiersz "avg"</strong> na dole = średnia per prompt po wszystkich modelach danego stage'u.
              Pokazuje, które prompty są trudne dla całej populacji.
            </li>
            <li>
              <strong>Róg dolno-prawy</strong> (pogrubiony) = grand mean: średnia wszystkich ocen razem.
            </li>
            <li>
              <strong>Klik na komórkę</strong> otwiera drawer z treścią promptu, notą oceniającego oraz
              wszystkimi samplami (treść, tok/s, finish_reason, opcjonalny reasoning trace).
            </li>
          </ul>
        </section>

        <section class="panel">
          <h2>Wykres Quality vs Speed (uniwersalne)</h2>
          <p>
            Każda kropka = jeden model (albo (model, stage) w trybie all).
            Oś X = mediana <code>decode_tok_per_s</code>, oś Y = średnia ocena.
            Prawy górny róg = idealny model (szybki i dobry).
            Lewy górny = wolny ale jakościowy (np. dense 24B partial offload).
            Prawy dolny = szybki ale słaby. Lewy dolny = pomyłka życiowa.
          </p>
        </section>

        <section class="panel">
          <h2>Models view — co znaczą pola</h2>
          <p>
            Models view skanuje <code>~\.lmstudio\models</code> rekurencyjnie po plikach GGUF
            (pomijając <code>mmproj-*</code> — to CLIP/multimodal projectors, nie LLM-y).
            Pokazuje wszystkie modele na dysku, nawet te jeszcze nieużyte w żadnym eksperymencie.
            Wszystkie metadane są wyciągnięte z plików GGUF; tu nie ma runtime configów
            (te są w widokach eksperymentów po kliknięciu w nazwę modelu).
          </p>
          <table class="help-table">
            <tr><td><code>params</code></td><td>Liczba parametrów modelu. Liczona dokładnie jako suma <code>produkt(wymiarów)</code> po wszystkich tensorach z pliku GGUF — tyle parametrów ma model niezależnie od kwantyzacji (quant kompresuje bajty na parametr, nie liczbę parametrów). W detalu "metadane" widać surowy integer i deklarację z <code>general.size_label</code> (raw string z metadanych, np. "35B-A3B" lub bezużyteczne "mini").</td></tr>
            <tr><td><code>quant</code></td><td>Schemat kwantyzacji (Q4_K_M, UD-Q4_K_S, Q5_K_M, …) parsowany z nazwy pliku. Dyktuje rozmiar pliku i jakość.</td></tr>
            <tr><td><code>arch</code></td><td>Typ architektury z GGUF (<code>qwen3moe</code>, <code>gemma4</code>, <code>deepseek2</code>, <code>llama</code>, <code>nemotron_h_moe</code>, …).</td></tr>
            <tr><td><code>layers</code></td><td>Liczba bloków transformera (<code>&lt;arch&gt;.block_count</code>). Dla hybrydów typu Nemotron-H niektóre bloki to Mamba — pokazujemy w nawiasie ile z nich faktycznie ma attention (bo tylko one zużywają KV cache).</td></tr>
            <tr><td><code>heads (Q/KV)</code></td><td>Liczba attention heads dla Q (queries) / KV (keys + values). Jeśli KV &lt; Q, model używa GQA (grouped-query attention) — KV cache jest mniejszy.</td></tr>
            <tr><td><code>experts</code></td><td>Dla MoE: liczba ekspertów / ilu aktywnych per token. Reszta siedzi bez ruchu, można je offloadować na CPU bez kosztu jakości (<code>--n-cpu-moe</code>, ustawiane w runtime).</td></tr>
            <tr><td><code>ctx natywny</code></td><td>Maksymalny context length z trenowania modelu (<code>&lt;arch&gt;.context_length</code>). Powyżej tego są skutki ekstrapolacji RoPE.</td></tr>
            <tr><td><code>embedding</code></td><td><code>&lt;arch&gt;.embedding_length</code> — wymiar d_model. Wpływa na size KV cache i FFN.</td></tr>
            <tr><td><code>KV/token @Q8</code></td><td>Ile bajtów zajmuje cache K+V dla jednego tokena, przy kwantyzacji KV cache do Q8. Wzór: <code>2 × n_attn_layers × n_kv_heads × head_dim × 1 B</code>. Mnożenie przez ctx daje całkowity rozmiar KV.</td></tr>
            <tr><td>tag <span class="tag" style="background:rgba(76,209,129,0.12); color:var(--good); border-color:rgba(76,209,129,0.4)">exp N</span></td><td>Model był używany w eksperymencie N. Brak tagu = leży na dysku, niezbenchowany.</td></tr>
            <tr><td>detail "metadane"</td><td>Rozwijany panel z surowymi danymi: deklaracja GGUF (<code>general.size_label</code>), dokładna liczba parametrów jako integer, oraz pełna ścieżka pliku na dysku.</td></tr>
          </table>
        </section>

        <section class="panel">
          <h2>Runtime config (w widoku eksperymentu)</h2>
          <p>
            Klik w nazwę modelu w leaderboardzie/scatter otwiera drawer, w którym (oprócz listy promptów)
            pokazany jest <strong>runtime config</strong> z którym ten model był uruchamiany w tym eksperymencie.
          </p>
          <table class="help-table">
            <tr><td><code>-ngl N</code></td><td>llama.cpp flag: ile warstw modelu trafia na GPU (99 = wszystkie).</td></tr>
            <tr><td><code>--n-cpu-moe N</code></td><td>llama.cpp flag: ile bloków MoE ma trzymać ekspertów na CPU (a nie na GPU). Im więcej, tym mniej VRAM, tym wolniejszy decode. Tuned per model i per hardware.</td></tr>
            <tr><td><code>-c N (ctx)</code></td><td>Wielkość kontekstu w trakcie testu. Częsty kompromis między longctx promptami a budżetem VRAM. W E3 najczęściej 24576 (24k).</td></tr>
            <tr><td><code>thinking</code></td><td>Wartość z <code>models.py</code>: <code>none</code> = brak reasoning mode, <code>optional</code> = toggle przez <code>chat_template_kwargs.enable_thinking</code>, <code>obligatory</code> = zawsze myśli (np. <code>phi-4-mini-reasoning</code>).</td></tr>
            <tr><td><code>sampler override</code></td><td>Niestandardowe parametry samplera (zob. <span class="tag warn">sampler-variant</span>). Pokazywane jako JSON.</td></tr>
          </table>
        </section>

        <section class="panel">
          <h2>Skróty i terminy (uniwersalne)</h2>
          <table class="help-table">
            <tr><td><code>NT / WT</code></td><td>no_thinking / with_thinking — używane w stage "all" do disambiguacji wierszy modelu.</td></tr>
            <tr><td><code>tok/s</code></td><td>Decode throughput: ile tokenów na sekundę model generuje po zaczęciu generacji. W odróżnieniu od <code>prompt_tok/s</code> (prefill).</td></tr>
            <tr><td><code>TRUNC / truncated</code></td><td>Model wyczerpał budżet <code>max_tokens</code> nie kończąc odpowiedzi. Najczęściej oznacza pętlę albo za mały budżet.</td></tr>
            <tr><td><code>sample</code></td><td>Jedno z k powtórzeń tego samego promptu z różnymi seedami. Pomaga ocenić wariancję modelu.</td></tr>
            <tr><td><code>reasoning trace</code></td><td>Wewnętrzne "myślenie" modelu, oddzielone od finalnej odpowiedzi. W drawerze rozwinięte przyciskiem.</td></tr>
            <tr><td><code>MoE</code></td><td>Mixture of Experts — model ma N ekspertów, ale per token używa tylko k z nich. Można niewykorzystywanych offloadować na CPU bez utraty jakości.</td></tr>
            <tr><td><code>GQA</code></td><td>Grouped-Query Attention — KV jest dzielone między grupy Q heads, redukuje rozmiar KV cache. <code>n_kv_heads &lt; n_heads</code>.</td></tr>
            <tr><td><code>PLE</code></td><td>Per-Layer Embeddings — dodatkowa tablica embeddingów <em>per warstwa</em> (osobna od głównej <code>token_embd</code>). Liczy się do całkowitej masy parametrów, ale ładowana just-in-time per warstwę z CPU/RAM, więc nie wchodzi w ciężkie GEMM-y. Pozwala mieć model o jakości 7.5B przy koszcie obliczeń ~4B. Występuje w Gemma E-series.</td></tr>
            <tr><td><code>MatFormer</code></td><td>Matryoshka Transformer — model trenowany tak, że w jego wagach zagnieżdżony jest mniejszy, w pełni używalny submodel (np. E2B siedzi w E4B). Te same wagi, mniejszy plaster FFN. Pozwala "elastycznie" wybrać rozmiar bez retreningu. Google używa w Gemma 3n / 4 E-series.</td></tr>
            <tr><td><code>MTP</code></td><td>Multi-Token Prediction — dodatkowe głowy predykcyjne doklejone do modelu (pomysł z DeepSeek-V3). Inferencyjnie używane do self-speculative decoding (model sam sobie generuje draft, weryfikuje główną głową) — przy odpowiednich flagach <code>llama-server</code> może dać ~1.5–2× szybsze decode. Bez flag siedzą bezczynnie, zajmując VRAM.</td></tr>
          </table>
        </section>

        <section class="panel">
          <h2>Gemma E-series — co znaczy "E4B"</h2>
          <p>
            "E" = <strong>Effective parameters</strong>, czyli ile parametrów <em>faktycznie wykonuje się na akceleratorze</em>
            per token — nie ile waży plik. Gemma 4 E4B ma ~7.5B parametrów na dysku, ale tylko ~4B z nich
            uczestniczy w głównym forward passie. Różnica to <code>PLE</code> (per-layer embeddings)
            ładowane z CPU/RAM just-in-time per warstwę.
          </p>
          <p>
            Drugi filar to <code>MatFormer</code>: ten sam plik wag zawiera w sobie zagnieżdżony submodel E2B.
            Wybierasz rozmiar przez plaster FFN, nie przez retrening. Z perspektywy LM Studio /
            <code>llama-server</code> ładujemy całość — to bardziej ciekawostka projektowa niż runtime flag.
          </p>
          <p>
            Nie mylić z <code>MoE</code>: w MoE są <em>oddzielni eksperci</em> wśród których router wybiera k.
            W Gemma E nie ma routera ani ekspertów — jest jeden gęsty model, którego część wag siedzi
            "na boku" w PLE. Stąd <code>experts</code> w karcie modelu jest puste.
          </p>
        </section>

        <section class="panel">
          <h2>Experiment 3 — co tam jest</h2>
          <p>
            <strong>Hardware:</strong> RTX 3060 12 GB, Windows 11.
            Stack: <code>llama-server.exe</code> natywnie (bez SDK), per-model
            tuningowane <code>-ngl</code> / <code>--n-cpu-moe</code> tak żeby zmieścić się
            w ~10 GiB VRAM przy kontekście 24k.
          </p>
          <p>
            <strong>Zakres:</strong> 18 modeli (5–35B, kwantyzacja Q4/Q5/Q6), 20 promptów × 3 sample,
            17 modeli ma run w no_thinking, 11 w with_thinking (zależnie od pola
            <code>thinking</code> w <code>models.py</code>).
          </p>
          <p>
            <strong>Stage switch</strong> w widoku Experiment 3:
          </p>
          <table class="help-table">
            <tr><td><code>no_thinking</code></td><td>Thinking mode wyłączony albo niedostępny. 17 modeli.</td></tr>
            <tr><td><code>with_thinking</code></td><td>Thinking mode włączony (toggle przez <code>chat_template_kwargs.enable_thinking</code>). 11 modeli.</td></tr>
            <tr><td><code>all</code></td><td>Wszystko razem. Każda para (model, stage) jako osobny wiersz/punkt, oznaczona <code> · NT</code> albo <code> · WT</code>. Sortowane jedną wspólną listą — szybko widać, czy włączenie thinkingu opłaca się dla danego modelu.</td></tr>
          </table>
          <p>
            Aktualny <strong>sampler-variant</strong> w E3: tylko <code>unsloth/glm-4.7-flash@zai</code>
            (GLM-4.7-Flash z parametrami rekomendowanymi przez Z.ai zamiast baseline'u).
            Powód: baseline dawał 22/60 TRUNC w no_thinking, 43/60 w with_thinking;
            sampler Z.ai zredukował do 0/60 i 6/60. Pełny audyt samplerów → Etap 4.
          </p>
        </section>

        <section class="panel">
          <h2>Regeneracja danych</h2>
          <p>Po nowych runach (<code>runner.py</code>) lub regradzie (<code>temp/grades/*.json</code>):</p>
          <pre style="background: var(--bg-3); padding: var(--space-3); border-radius: var(--radius-sm); overflow-x: auto; font-size: 12px">$env:PYTHONIOENCODING="utf-8"
python C:\Users\User\claude\llm\app\build_app_data.py</pre>
          <p>Potem <strong>Ctrl+Shift+R</strong> w przeglądarce (twardy reload, omija cache ~13 MB).</p>
        </section>
      </div>
    `;
  };
})();
