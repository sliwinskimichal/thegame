# Ostrzeżenia walidatora treści do decyzji projektowej
Od: tools-programmer (przez producenta) · Do: systems-designer · Pilność: średnia

## Co oddaję (ścieżki)
- `npm run content:check` (bez `-q` pokazuje ostrzeżenia z plikiem i linią), `tools.html` (skąd/dokąd dla każdego elementu).

## Co jest potrzebne od odbiorcy
Decyzja i poprawka danych (z testem balansu) dla 7 ostrzeżeń:
1. `recipes.ts:64–65` `cobalt_bar`, `cobalt_steel`: receptury deklarują moc 3, a Wielki piec pobiera 2 — model balansu liczy tylko moc budowli.
2. `resources.ts:261` `feast_platter`: tier 5 w danych, osiągalny w T4.
3. `resources.ts:178` `heart_key`: tier 8 w danych, osiągalny w T7.
4. `resources.ts:197` `copper_rod`: `light: 0` niczego nie zmienia.
5. `tech.ts:194` `guardian_sigil`: trofeum bossa T7 nie jest kosztem żadnego badania (zużywa je tylko receptura `heart_key` i Latarnia Głębin) — sprzeczne z regułą „trofeum otwiera węzeł-klucz”.
6. `tech.ts:101` `gas_masks`: węzeł T2 odsłania się dopiero w T3 przez `glow_spores`.

## Decyzje do podjęcia
Czy po poprawkach włączyć `--strict` w CI (ostrzeżenia = błąd).
