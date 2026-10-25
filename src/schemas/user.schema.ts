import { Type, Static } from '@sinclair/typebox';

export const UserSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid', description: 'User unique UUID' }),
    email: Type.String({ format: 'email', description: 'User email address' }),
    username: Type.Union([Type.String(), Type.Null()], { description: 'User public handle' }),
    role: Type.String({ default: 'user', description: 'Account role (user, admin, moderator)' }),
    status: Type.String({ default: 'active', description: 'Account status (active, suspended, deleted)' }),
    email_verified_at: Type.Union([Type.String(), Type.Null()]),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { $id: 'User', description: 'Public User Account Profile' }
);

export type UserType = Static<typeof UserSchema>;

export const CreateUserSchema = Type.Object({
  email: Type.String({ format: 'email', description: 'Unique user email' }),
  password: Type.String({ minLength: 6, description: 'Plaintext password (will be hashed)' }),
  username: Type.Optional(Type.String({ minLength: 2, maxLength: 50, description: 'Optional unique username' })),
});

export type CreateUserType = Static<typeof CreateUserSchema>;

export const LoginUserSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});

export type LoginUserType = Static<typeof LoginUserSchema>;
