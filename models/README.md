# Model sylwetki 3D (Postęp → Sylwetka 3D)

`body-male.zbm`, `body-female.zbm` — siatka i kształty **MakeHuman / MPFB2**, licencja **CC0 1.0**
(tekst: `LICENSE-CC0.md`; bez warunków, także do użytku komercyjnego). Dane z kopii w repozytorium
[naver/anny](https://github.com/naver/anny), commit `8f35dc2`, katalog `src/anny/data/mpfb2/`.

Zmiany względem oryginału: tylko ciało, oczy i spodenki (przycięty `helper-tights`), sylwetka kobieca
z wygładzoną klatką i sportowym topem, kształty pomiarowe zmierzone na siatce (obwody w cm).

Odtworzenie: pobierz pliki wymienione w `tools/body_model.py` (TARGETS, base.obj, basemesh_vertex_groups.json)
i uruchom `python3 tools/body_model.py <katalog mpfb2>`. Wynik jest powtarzalny (te same pliki bajt w bajt).
