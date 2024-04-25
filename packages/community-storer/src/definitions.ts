import {z} from 'zod';

export const communitySchema = z.object({
  iri: z.string(),
  id: z.string(),
  name: z.string(),
});

export type Community = z.infer<typeof communitySchema>;

export const personSchema = z.object({
  iri: z.string(),
  id: z.string(),
});

export type Person = z.infer<typeof personSchema>;
