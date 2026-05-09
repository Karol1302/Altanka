# Specyfikacja dla Codex — viewer 3D konstrukcji drewnianej v13

Źródło geometrii: `freecad_konstrukcja_generator_v13_grill_komin.py`.

## Cel narzędzia

Zbudować przeglądarkowy viewer 3D konstrukcji, najlepiej w Three.js / React Three Fiber.

Viewer ma pokazywać:
- konstrukcję drewnianą 400×600 cm,
- dach dwuspadowy 20° z okapem 50 cm,
- 8 par krokwi,
- słupy, wieniec, jętki, podpory, BK, zastrzały A/B,
- grill murowany przy tylnej ścianie,
- komin niezależny od drewna,
- opcjonalne warstwy/tryby: wymiary, nazwy elementów, obciążenia, strefa bezpieczeństwa komina.

## Układ współrzędnych

Wszystkie wymiary w pliku JSON są w **centymetrach**.

| Oś | Znaczenie |
|---|---|
| X | szerokość konstrukcji, 0 = lewy bok, 400 = prawy bok |
| Y | długość konstrukcji, 0 = front/południe, 600 = tył/północ |
| Z | wysokość, 0 = poziom fundamentów/podstaw |

## Parametry globalne

| Parametr | Wartość |
|---|---:|
| Szerokość konstrukcji | 400.0 cm |
| Długość konstrukcji | 600.0 cm |
| Dach z okapem | 500.0 × 600.0 cm |
| Wysokość słupów | 250.0 cm |
| Przekrój słupów | 14.0×14.0 cm |
| Przekrój wieńca | 14.0×14.0 cm |
| Kąt dachu | 20.0° |
| Okap po X | 50.0 cm na stronę |
| Wysokość góry wieńca | 264.0 cm |
| Wysokość kalenicy | 336.8 cm |
| Wysokość okapu przy końcu krokwi | 245.8 cm |

## Elementy konstrukcyjne

### Słupy `S1–S6`

- 6 szt.
- przekrój 14×14 cm,
- wysokość 250 cm,
- materiał: sosna C18.

Pozycje dolnego-lewego narożnika w rzucie XY:
- `S1_front_left`: `[0, 0]`
- `S2_front_right`: `[386, 0]`
- `S3_mid_left`: `[0, 293]`
- `S4_mid_right`: `[386, 293]`
- `S5_back_left`: `[0, 586]`
- `S6_back_right`: `[386, 586]`

### Wieniec `W`

- przekrój 14×14 cm,
- materiał: świerk C24,
- front/tył: 2× belka 400 cm,
- boki: 4× belka 300 cm,
- dolna wysokość wieńca: Z=250 cm,
- górna wysokość wieńca: Z=264 cm.

### Krokwie `K1–K8`

- 8 par, czyli 16 krokwi,
- przekrój geometryczny: 14×7 cm,
- długość osiowa: `266.0` cm,
- kąt: 20°,
- rozstaw modułowy po Y: `84.7` cm,
- światło między krokwiami: `77.7` cm,
- cięcie przy kalenicy: pionowe, do styku z drugą krokwią,
- siodło: opisowo głębokość `3.5` cm, ale w v13 nie jest wycięte booleanowo.

### BK

- 1 szt.,
- przekrój 7×7 cm,
- długość 600 cm,
- pozycja: X około `196.5`, Y=0, Z=`322.8`,
- funkcja: belka podkalenicowa pod stykiem krokwi.

### Jętki `J1–J8`

- 8 szt.,
- przekrój 7×7 cm,
- bazowo 200 cm, finalnie skrócone po 10,8 cm z każdej strony,
- dolna długość: `178.4` cm,
- górne naroża docięte pod krokiew,
- Z dolne: `296.9` cm,
- Z górne: `303.9` cm.

### Podpory `P`

- 4 szt.,
- przekrój 7×7 cm,
- wysokość: `32.9` cm,
- dół na górze wieńca: Z=`264.0` cm,
- przesunięcie po X do środka przekroju: `14.35` cm.

### Zastrzały A

- 12 szt.,
- trapez równoramienny obrócony 45°,
- dłuższa podstawa 76 cm,
- krótsza podstawa 56 cm,
- wysokość ok. 11 cm,
- grubość 7 cm,
- materiał: sosna C18.

Uwaga implementacyjna:
- w przesłanym v13 prawa para środkowa ma przesunięcie ±7 cm,
- lewa para środkowa w samym pliku v13 jest bez tego przesunięcia,
- w viewerze można już przyjąć finalną korektę z późniejszej wersji: środkowe zastrzały A po obu bokach mają przesunięcie ±7 cm.

### Zastrzały B

- 4 szt.,
- naroża wieńca,
- trapez równoramienny w rzucie z góry,
- dłuższa podstawa 96 cm,
- krótsza podstawa 76 cm,
- wysokość ok. 11 cm,
- grubość 7 cm,
- materiał: sosna C18.

## Grill i komin

### Grill

- bryła murowana,
- wymiary: 120×80×115 cm,
- położenie: przy tylnej ścianie, centralnie,
- dolny lewy narożnik: X=`140.0`, Y=`512.0`, Z=0.

### Komin

- niezależny od konstrukcji drewnianej,
- nie jest podporą dachu,
- wymiary przekroju: 58×45 cm,
- ustawiony osiowo nad grillem,
- dolny lewy narożnik: X=`171.0`, Y=`529.5`, Z=115,
- góra komina: Z=`376.8` cm,
- wystaje ok. 40 cm nad kalenicę.

### Strefa bezpieczeństwa komina

Pokazać jako półprzezroczystą czerwoną bryłę:
- offset od komina: 8 cm,
- dolny lewy narożnik: X=`163.0`, Y=`521.5`, Z=115,
- wymiar: `74.0`×`61.0` cm.

## Materiały / kolory sugerowane

| Element | Kolor |
|---|---|
| słupy | brąz jasny |
| wieniec | brąz ciemniejszy |
| krokwie | pomarańczowy |
| jętki/podpory | zielony |
| BK | fioletowy |
| zastrzały A | czerwony |
| zastrzały B | niebieski |
| grill | ceglasty/brązowy |
| komin | szary |
| strefa bezpieczeństwa | czerwony, transparentny |

## Funkcje viewera

Minimalny zakres:
1. orbit controls,
2. włącz/wyłącz nazwy elementów,
3. włącz/wyłącz wymiary globalne,
4. włącz/wyłącz grill/komin,
5. włącz/wyłącz strefę bezpieczeństwa komina,
6. tryb obciążeń:
   - ciężar własny,
   - śnieg ciężki,
   - wiatr SW,
7. eksport screena PNG.

## Obciążenia referencyjne do wizualizacji

Nie robić pełnego FEM na tym etapie. Pokazać strzałki i wartości:
- dach OSB18+papa+gont: 0,242 kN/m²,
- śnieg ciężki: 1,28 kN/m²,
- śnieg bardzo ciężki: 1,60 kN/m²,
- ssanie wiatru: 0,8–1,0 kN/m²,
- wiatr poziomy SW: 8–10 kN.

## Pliki wejściowe dla Codexa

- `structure_spec_v13.json` — dane parametryczne.
- `README_for_codex.md` — ten opis.

