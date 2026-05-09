# Zadanie dla Codex

Zaimplementuj przeglądarkowy viewer 3D konstrukcji drewnianej na podstawie `structure_spec_v13.json`.

Preferowany stack:
- Vite + React + TypeScript,
- React Three Fiber lub czysty Three.js,
- dat.GUI / Leva do przełączników,
- CSS zwykły.

Wymagania:
1. Renderuj konstrukcję w układzie cm przeskalowanym do metrów lub jednostek Three.js.
2. Każdy element musi mieć nazwę i typ.
3. Kolory wg README.
4. Dodaj przełączniki:
   - pokaż/ukryj etykiety,
   - pokaż/ukryj wymiary,
   - pokaż/ukryj grill/komin,
   - pokaż/ukryj strefę bezpieczeństwa komina,
   - tryby obciążeń: dead/snow/wind.
5. Strzałki obciążeń mają być poglądowe, nie FEM.
6. Kod ma być parametryczny: zmiana JSON zmienia model.
7. Nie zakładaj ścian bocznych ani tylnej zabudowy w tej wersji.

Uwaga:
Komin jest niezależny od drewna i nie podpiera dachu.
