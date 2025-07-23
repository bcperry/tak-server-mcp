declare module 'mgrs' {
  export function forward(point: [number, number], accuracy?: number): string;
  export function inverse(mgrs: string): [number, number];
  export function toPoint(mgrs: string): [number, number];
}