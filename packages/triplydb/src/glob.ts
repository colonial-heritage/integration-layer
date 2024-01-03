import {glob} from 'glob';

export async function getRdfFiles(dir: string) {
  const filenames = await glob(`${dir}/**/*.{nt,ttl}`, {
    nodir: true,
    absolute: true,
  });

  return filenames;
}
