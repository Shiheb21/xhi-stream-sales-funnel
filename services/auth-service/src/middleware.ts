/**
 * Auth Service — RBAC Middleware
 *
 * Checks JWT claims against a role-based permissions map.
 * Enforces LiveManager specific rules (isolation to assigned sessions).
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// ═══════════════════════════════════════════════════════════════════════════
// Types & Role Definitions
// ═══════════════════════════════════════════════════════════════════════════

export enum UserRole {
  OWNER = 'Owner',
  ADMIN = 'Admin',
  LIVE_MANAGER = 'LiveManager',
  ADS_MANAGER = 'AdsManager',
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  // If role is LiveManager, this specifies which sessions they can access
  assignedSessions?: string[]; 
}

// Map of roles to allowed operations/resources
const PERMISSIONS_MAP: Record<UserRole, string[]> = {
  [UserRole.OWNER]: ['*'],
  [UserRole.ADMIN]: ['*'], // Might have billing restrictions
  [UserRole.LIVE_MANAGER]: ['read:leads', 'read:sessions', 'update:lead_status'],
  [UserRole.ADS_MANAGER]: ['read:sessions', 'read:ads', 'write:ads', 'read:attributions'],
};

// ═══════════════════════════════════════════════════════════════════════════
// RBAC Middleware Factory
// ═══════════════════════════════════════════════════════════════════════════

export function checkPermissions(requiredPermission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Verify standard JWT (assuming fastify-jwt decorator request.user)
      await request.jwtVerify();
      
      const user = request.user as JwtPayload;
      if (!user || !user.role) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token claims' });
      }

      // 2. Check global permission map
      const userPerms = PERMISSIONS_MAP[user.role];
      const hasPermission = userPerms.includes('*') || userPerms.includes(requiredPermission);

      if (!hasPermission) {
        return reply.code(403).send({ 
          error: 'Forbidden', 
          message: `Role ${user.role} missing permission: ${requiredPermission}` 
        });
      }

      // 3. Tenancy / Isolation Checks (LiveManager specifically)
      // If they are accessing a specific /sessions/:sessionId API...
      const params = request.params as { sessionId?: string };
      
      if (user.role === UserRole.LIVE_MANAGER && params.sessionId) {
        const allowedSessions = user.assignedSessions || [];
        
        if (!allowedSessions.includes(params.sessionId)) {
          return reply.code(403).send({ 
            error: 'Forbidden', 
            message: 'LiveManager not assigned to this session' 
          });
        }
      }

      // Proceed to controller
      return;
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Token missing or invalid' });
    }
  };
}
