import type {Community} from './definitions.js';
import clerk from '@clerk/clerk-sdk-node';
import {z} from 'zod';

const organizationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  publicMetadata: z.object({
    iri: z.string(),
  }),
});

// Beware: env var `CLERK_SECRET_KEY` must be set: https://clerk.com/docs/references/nodejs/overview
export class CommunityFetcher {
  private async loadFromSource(limit = 100, offset = 0) {
    let organizations = await clerk.organizations.getOrganizationList({
      limit,
      offset,
    });

    // Load more organizations recursively, if any
    if (organizations.length === limit) {
      const moreOrganizations = await this.loadFromSource(
        limit,
        offset + limit
      );
      organizations = organizations.concat(moreOrganizations);
    }

    return organizations;
  }

  async getAll() {
    const organizations = await this.loadFromSource();

    const communities = organizations.reduce(
      (communities: Community[], organization) => {
        const result = organizationSchema.safeParse(organization);

        // Keep only organizations with the required data
        if (result.success) {
          communities.push({
            iri: result.data.publicMetadata.iri,
            id: result.data.id.toString(),
            name: result.data.name,
          });
        }

        return communities;
      },
      []
    );

    return communities;
  }
}
