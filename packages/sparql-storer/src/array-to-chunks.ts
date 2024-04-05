// https://stackoverflow.com/a/55435856
export function* toChunks<T>(
  arr: T[],
  numberOfElementsPerChunk: number
): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += numberOfElementsPerChunk) {
    yield arr.slice(i, i + numberOfElementsPerChunk);
  }
}
