import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../db/database.module';
import { users, NewUser } from '../db/schema';
import * as schema from '../db/schema';
import { UpdatePacesDto } from './dto/update-paces.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return result[0] ?? null;
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async create(data: Pick<NewUser, 'email' | 'passwordHash' | 'displayName'>) {
    const result = await this.db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName,
      })
      .returning();
    return result[0];
  }

  async updateProfile(
    userId: string,
    data: Partial<Pick<NewUser, 'displayName'>>,
  ) {
    const result = await this.db
      .update(users)
      .set({ ...data })
      .where(eq(users.id, userId))
      .returning();

    if (!result[0]) {
      throw new NotFoundException('User not found');
    }
    return result[0];
  }

  async updatePaces(userId: string, data: UpdatePacesDto) {
    const result = await this.db
      .update(users)
      .set({
        pace5kMinPerKm: data.pace5kMinPerKm,
        pace10kMinPerKm: data.pace10kMinPerKm,
        pace15kMinPerKm: data.pace15kMinPerKm,
        paceHalfMarathonMinPerKm: data.paceHalfMarathonMinPerKm,
      })
      .where(eq(users.id, userId))
      .returning();

    if (!result[0]) {
      throw new NotFoundException('User not found');
    }
    return result[0];
  }
}
