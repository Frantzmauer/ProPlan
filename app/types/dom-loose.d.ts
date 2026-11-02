// TYMCZASOWE na czas przejścia ekranów na TypeScript.
// Kod ekranów pisany był w JavaScript: querySelector zwraca Element, getElementById HTMLElement,
// a kod używa na nich .value, .dataset, .onclick itd. Te deklaracje pozwalają go sprawdzać bez
// przepisywania każdej linii. Gdy moduł dostanie własne typy (np. HTMLInputElement), przechodzi do
// tsconfig.strict.json, gdzie ten plik nie obowiązuje.
export {};

declare global {
  interface Element {
    dataset: DOMStringMap;
    style: CSSStyleDeclaration;
    onclick: any;
    onchange: any;
    oninput: any;
    click(): void;
    focus(options?: FocusOptions): void;
    blur(): void;
    value?: any;
    checked?: boolean;
    disabled?: boolean;
    files?: FileList | null;
    offsetTop?: number;
    hidden: boolean;
  }
  interface HTMLElement {
    value?: any;
    checked?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    files?: FileList | null;
    select?(): void;
    placeholder?: string;
    srcObject?: MediaProvider | null;
    play?(): Promise<void>;
  }
  interface Element {
    isContentEditable?: boolean;
  }
  interface HTMLElement {
    href?: string;
    getContext?(id: string, opts?: unknown): any;
    width?: number;
    height?: number;
    toDataURL?(type?: string, q?: number): string;
    setSelectionRange?(a: number, b: number): void;
    _hide?: ReturnType<typeof setTimeout>;
  }
  // Obiekty budowane od {} w kodzie JS mają typ {} — ich wartości traktujemy jako any
  interface ObjectConstructor {
    values(o: {}): any[];
    entries(o: {}): [string, any][];
  }
  interface Element { href?: string; placeholder?: string; offsetWidth?: number }
  // API przeglądarki spoza standardowych typów TypeScript
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    webkitAudioContext?: typeof AudioContext;
    showSaveFilePicker?(opts?: unknown): Promise<any>;
    showOpenFilePicker?(opts?: unknown): Promise<any[]>;
    ZXing?: any;
  }
  // biblioteka skanera (CDN, wczytywana przy pierwszym skanie) i czytnik kodów wbudowany w Chrome
  var ZXing: any;
  var BarcodeDetector: any;
  interface EventTarget {
    id?: string;
    value?: any;
    files?: FileList | null;
    dataset?: DOMStringMap;
    style?: CSSStyleDeclaration;
    closest?(selector: string): Element | null;
    classList?: DOMTokenList;
    selectionStart?: number | null;
  }
}
