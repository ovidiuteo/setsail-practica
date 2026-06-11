-- Export calibrări diplome din vechiul sistem (teste.setsail.ro, MySQL rnauti39_teste).
-- Rulează fiecare query în phpMyAdmin, apoi exportă rezultatul ca JSON
-- (sub rezultat: Export → Format: JSON) și trimite-mi fișierele.
-- Le convertesc în diploma_templates / diploma_printers în Supabase (setsail-practica).

-- 1) Imprimantele definite
SELECT * FROM printers;

-- 2) Categoriile (maparea id -> A/B/C/D/S)
SELECT * FROM categories;

-- 3) Șabloanele cu coordonatele calibrate
--    (fiecare câmp e un CSV "top,left,width"; `diploma` are și culoarea textului)
SELECT t.id, p.name AS printer_name, c.name AS category_name, t.*
FROM templates t
LEFT JOIN printers p ON p.id = t.printer
LEFT JOIN categories c ON c.id = t.category;

-- 4) Ultimul număr de diplomă emis în vechiul registru
--    (ca să verificăm că noul start de 10000 nu se suprapune)
SELECT MAX(number) AS ultimul_numar FROM diplomas;
