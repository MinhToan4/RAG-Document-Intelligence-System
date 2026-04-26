/**
 * Repository for user persistence. Executes SQL operations and maps rows to domain records.
 */
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

/**
 * Repository layer for managing User records in the PostgreSQL database.
 * Handles user creation, retrieval by unique fields (username, email), and profile updates.
 */
export class UserRepository {
  /**
   * Creates a new user record in the database.
   *
   * @param input - The payload containing user details (username, email, hashed password, etc.)
   * @returns The newly created UserRecord mapped to the domain model
   */
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

  /**
   * Finds a user by their unique username.
   *
   * @param username - The username to search for
   * @returns The UserRecord if found, null otherwise
   */
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

  /**
   * Finds a user by their unique email address.
   *
   * @param email - The email to search for
   * @returns The UserRecord if found, null otherwise
   */
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

  /**
   * Finds a user matching either a username or an email.
   * Useful for registration validation to ensure uniqueness.
   *
   * @param username - The username to check
   * @param email - The email to check
   * @returns The UserRecord if a match is found, null otherwise
   */
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

  /**
   * Finds a user by their primary ID.
   *
   * @param userId - The UUID of the user
   * @returns The UserRecord if found, null otherwise
   */
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

  /**
   * Updates a user's profile information (full name) and optionally their password.
   * Automatically updates the `updated_at` timestamp.
   *
   * @param userId - The UUID of the user to update
   * @param fullName - The new full name
   * @param passwordHash - Optional new hashed password
   * @returns The updated UserRecord, or null if the user was not found
   */
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
