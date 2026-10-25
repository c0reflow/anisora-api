import crypto from 'crypto';
import prisma from '../db/prisma';
import { CreateUserType, UserType } from '../schemas/user.schema';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function formatUser(u: any): UserType {
  return {
    id: u.id,
    email: u.email,
    username: u.username ?? null,
    role: u.role,
    status: u.status,
    email_verified_at: u.email_verified_at ? u.email_verified_at.toISOString() : null,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
  };
}

export class UserService {
  async createUser(input: CreateUserType): Promise<UserType> {
    const passwordHash = hashPassword(input.password);
    const user = await prisma.users.create({
      data: {
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        username: input.username || null,
      },
    });
    return formatUser(user);
  }

  async getUserById(id: string): Promise<UserType | null> {
    const user = await prisma.users.findUnique({
      where: { id },
    });
    return user ? formatUser(user) : null;
  }

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.users.count(),
      prisma.users.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(formatUser),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}

export const userService = new UserService();
