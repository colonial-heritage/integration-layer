import {type Community, type Person} from './definitions.js';
import {clerkClient} from '@clerk/clerk-sdk-node';
import {z} from 'zod';

const organizationSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  publicMetadata: z.object({
    iri: z.string(),
  }),
});

const userSchema = z.object({
  id: z.coerce.string(),
  publicMetadata: z.object({
    iri: z.string(),
  }),
});

// Beware: env var `CLERK_SECRET_KEY` must be set: https://clerk.com/docs/references/nodejs/overview
// Docs: https://clerk.com/docs/references/nodejs/available-methods
export class Fetcher {
  private async loadOrganizationsFromSource(limit = 100, offset = 0) {
    let {data: organizations} =
      await clerkClient.organizations.getOrganizationList({
        limit,
        offset,
      });

    // Load more organizations recursively, if any
    if (organizations.length === limit) {
      const moreOrganizations = await this.loadOrganizationsFromSource(
        limit,
        offset + limit
      );
      organizations = organizations.concat(moreOrganizations);
    }

    return organizations;
  }

  async getCommunities() {
    const organizations = await this.loadOrganizationsFromSource();

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

  private async loadUsersFromSource(limit = 100, offset = 0) {
    let {data: users} = await clerkClient.users.getUserList({limit, offset});

    // Load more users recursively, if any
    if (users.length === limit) {
      const moreUsers = await this.loadUsersFromSource(limit, offset + limit);
      users = users.concat(moreUsers);
    }

    return users;
  }

  async getPersons() {
    const users = await this.loadUsersFromSource();

    const persons = users.reduce((persons: Person[], user) => {
      const result = userSchema.safeParse(user);

      // Keep only users with the required data
      if (result.success) {
        // Not processing the `name`, for privacy reasons
        persons.push({
          iri: result.data.publicMetadata.iri,
          id: result.data.id.toString(),
        });
      }

      return persons;
    }, []);

    return persons;
  }
}
