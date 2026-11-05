// Testy czytają pliki modelu sylwetki z dysku — tylko te dwie funkcje Node (bez całego @types/node).
type NodeBuffer = Uint8Array & { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
declare module 'node:fs' { export function readFileSync(path: string): NodeBuffer; }
declare module 'node:zlib' { export function gunzipSync(data: Uint8Array): NodeBuffer; }
