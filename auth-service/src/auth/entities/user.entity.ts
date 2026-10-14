import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * User entity representing a registered user in the authentication system.
 * This type is exposed in GraphQL API responses for registration and token validation.
 */
@ObjectType({ description: 'A registered user in the system' })
export class User {
  @Field(() => ID, { description: 'Unique identifier for the user (UUID)' })
  id: string;

  @Field({ description: 'Email address of the user (unique)' })
  email: string;

  @Field({ description: 'Timestamp when the user account was created' })
  createdAt: Date;

  @Field({ description: 'Timestamp when the user account was last updated' })
  updatedAt: Date;
}
