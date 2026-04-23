import { query } from '../config/db.js';
import type { UserRecord, UserRole } from '../types/index.js';

type CreateUserInput = {
  username: string;
  email: string;
  passwordHash: string;
  fullName?: string | null;
  role?: UserRole;
};

type DbUserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

function mapUser(row: DbUserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class UserRepository {
  async create(input: CreateUserInput): Promise<UserRecord> {
    const result = await query<DbUserRow>(
      `
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [input.username, input.email, input.passwordHash, input.fullName ?? null, input.role ?? 'ROLE_USER'],
    );
    return mapUser(result.rows[0]);
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const result = await query<DbUserRow>(
      `
      SELECT *
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapUser(result.rows[0]);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await query<DbUserRow>(
      `
      SELECT *
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapUser(result.rows[0]);
  }

  async findByUsernameOrEmail(username: string, email: string): Promise<UserRecord | null> {
    const result = await query<DbUserRow>(
      `
      SELECT *
      FROM users
      WHERE username = $1 OR email = $2
      LIMIT 1
      `,
      [username, email],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapUser(result.rows[0]);
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const result = await query<DbUserRow>(
      `
      SELECT *
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapUser(result.rows[0]);
  }

  async updateProfile(userId: string, fullName: string, passwordHash?: string): Promise<UserRecord | null> {
    const result = await query<DbUserRow>(
      `
      UPDATE users
      SET 
        full_name = $2, 
        updated_at = NOW()
        ${passwordHash ? ', password_hash = $3' : ''}
      WHERE id = $1
      RETURNING *
      `,
      passwordHash ? [userId, fullName, passwordHash] : [userId, fullName]
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapUser(result.rows[0]);
  }
}
