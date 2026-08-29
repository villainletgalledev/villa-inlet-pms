import { Request, Response, NextFunction } from 'express';
import { createServerClient } from '../lib/supabase/server';
import { getPrisma } from '../lib/prisma';
import { UserRole } from '../lib/rbac';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Extracts and verifies the Supabase access token from the request.
 * Resolves the authenticated user and their authoritative role from the database.
 * Returns null if the token is missing, invalid, or expired.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return null;
    }

    const authUser = data.user;
    const email = authUser.email;
    if (!email) {
      return null;
    }

    const prismaClient = getPrisma();
    let dbUser = null;

    if (prismaClient) {
      try {
        dbUser = await prismaClient.user.findFirst({
          where: {
            OR: [
              { id: authUser.id },
              { email: email.toLowerCase() },
            ],
          },
        });

        // If user exists in DB and is deactivated, reject authentication
        if (dbUser && !dbUser.isActive) {
          return null;
        }

        // If user is authenticated via Supabase but has no DB record yet,
        // create their DB profile automatically using their auth metadata.
        if (!dbUser) {
          const metadataRole = (authUser.user_metadata?.role as UserRole) || 'STAFF';
          const fullName =
            authUser.user_metadata?.full_name ||
            authUser.email?.split('@')[0] ||
            'Staff Member';

          dbUser = await prismaClient.user.create({
            data: {
              id: authUser.id,
              email: email.toLowerCase(),
              fullName,
              role: metadataRole as any,
              isActive: true,
            },
          });
        }
      } catch (dbErr) {
        console.error('Database user lookup error in auth middleware:', dbErr);
      }
    }

    // Role from DB is authoritative; fallback to Supabase user metadata only if DB is not available
    const role =
      (dbUser?.role as UserRole) ||
      (authUser.user_metadata?.role as UserRole) ||
      'STAFF';
    const fullName =
      dbUser?.fullName ||
      authUser.user_metadata?.full_name ||
      email.split('@')[0];
    const id = dbUser?.id || authUser.id;
    const isActive = dbUser ? dbUser.isActive : true;

    if (!isActive) {
      return null;
    }

    return {
      id,
      email: email.toLowerCase(),
      fullName,
      role,
      isActive,
    };
  } catch (err) {
    console.error('Authentication verification error:', err);
    return null;
  }
}

/**
 * Express middleware that enforces authentication.
 * Returns 401 Unauthorized if no valid Supabase session/token is provided.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Valid authentication session required.' });
  }
  req.user = user;
  next();
}

/**
 * Express middleware that requires one of the specified roles.
 */
export function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.user.role}' is not authorized to perform this action.`,
      });
    }
    next();
  };
}
