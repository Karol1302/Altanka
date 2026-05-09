# Uruchomienie viewera 3D

Projekt jest lokalną aplikacją Vite + React + Three.js. FreeCAD nie jest potrzebny do uruchomienia viewera.

## Szybki start lokalnie

W PowerShellu, w katalogu `E:\Altanka`:

```powershell
npm install
npm run dev -- --port 5173
```

Potem otwórz:

```text
http://127.0.0.1:5173
```

## Build produkcyjny

```powershell
npm run build
```

Build automatycznie generuje dokument `Altanka_dokumentacja.pdf`, kopiuje go do `public`, a gotową aplikację zapisuje w `dist`.

Sam PDF możesz też wygenerować osobno:

```powershell
npm run doc
```

## Publikacja na GitHub Pages

W repozytorium GitHub:

1. Wrzuć cały projekt do repozytorium.
2. Wejdź w `Settings -> Pages`.
3. W sekcji `Build and deployment` ustaw `Source` na `GitHub Actions`.
4. Wypchnij zmiany na branch `main`.

Workflow jest już dodany w `.github/workflows/deploy.yml`. Buduje aplikację i publikuje katalog `dist`.

Domyślnie workflow ustawia ścieżkę Vite jako `/<nazwa-repo>/`, czyli pod standardowe adresy typu:

```text
https://twoj-login.github.io/nazwa-repo/
```

Jeśli publikujesz repozytorium użytkownika `twoj-login.github.io` albo używasz własnej domeny, ustaw w workflow `VITE_BASE_PATH: /`.

## Gdyby npm/node nie były dostępne

Zainstaluj Node.js LTS z oficjalnej strony:

```text
https://nodejs.org/
```

Po instalacji zamknij i otwórz PowerShell, a potem sprawdź:

```powershell
node --version
npm --version
```

Następnie uruchom komendy z sekcji "Szybki start lokalnie".

## Zakres obecnej wersji

- model 3D generowany z `structure_spec_v13.json`,
- orbit controls i przyciski rzutów,
- chowany panel opcji wysuwany z góry i dolny pasek opisu,
- warstwy: wymiary, grill/komin, strefa komina, OSB, gotowy dach z zielonym gontem,
- tryby obciążeń opisane językiem roboczym: pokrycie, śnieg, wiatr, wszystko razem,
- zbliżenia w górnym pasku: A, B, K, J, P,
- przycisk pobrania `Altanka_dokumentacja.pdf`.

Obciążenia są poglądowe, bez analizy FEM i bez normowego doboru przekrojów/łączników.
