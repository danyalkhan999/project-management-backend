import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { users, UserSelect } from './user.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(private readonly dbService: DbService) {}

  private get db() {
    return this.dbService.database;
  }

  async create(name: string, email: string, passwordHash: string): Promise<UserSelect> {
    const [user] = await this.db.insert(users).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'member',
      plan: 'free',
      isActive: true,
    }).returning();
    return user;
  }

  async findByEmail(email: string): Promise<UserSelect | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return user || null;
  }

  async findById(id: string): Promise<UserSelect | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  async updateRefreshTokenHash(id: string, hash: string): Promise<UserSelect | null> {
    const [user] = await this.db.update(users)
      .set({ refreshTokenHash: hash })
      .where(eq(users.id, id))
      .returning();
    return user || null;
  }

  async clearRefreshTokenHash(id: string): Promise<void> {
    await this.db.update(users)
      .set({ refreshTokenHash: null })
      .where(eq(users.id, id));
  }

  async deactivate(id: string): Promise<void> {
    await this.db.update(users)
      .set({ isActive: false, refreshTokenHash: null })
      .where(eq(users.id, id));
  }
}
