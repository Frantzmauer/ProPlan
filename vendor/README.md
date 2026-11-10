# Biblioteki w paczce aplikacji

Pliki pobrane z oficjalnych źródeł, żeby aplikacja nie łączyła się z zewnętrznymi serwerami (CDN) — działa offline
i adres IP użytkownika nie trafia do dostawców. Serwowane obok wersji stabilnej (`vendor/`), kopiowane do aplikacji na telefon.

| Katalog | Źródło | Wersja | Licencja |
|---|---|---|---|
| `mediapipe/vision_bundle.mjs`, `mediapipe/wasm/` | npm `@mediapipe/tasks-vision` | 0.10.14 | Apache-2.0 |
| `mediapipe/pose_landmarker_lite.task` | storage.googleapis.com/mediapipe-models (pose_landmarker_lite, float16, v1) | 1 | Apache-2.0 |
| `zxing/index.min.js` | npm `@zxing/library` (umd) | 0.21.3 | MIT |

Aktualizacja: `npm pack <pakiet>@<wersja>`, rozpakować do pustego katalogu tymczasowego, skopiować te same pliki;
zmienić `POSE_VER` w `app/features/formcheck.ts`, jeśli zmienia się wersja MediaPipe.
