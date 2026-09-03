import { eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  LoginUserBody,
  RegisterUserBody,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
} from "@workspace/api-zod";
import { db, usersTable, type User } from "@workspace/db";

const router: IRouter = Router();
const SESSION_COOKIE = "pge_session";
const MATRIC_PATTERN = /^20\d{2}\/1\/\d{5}IP$/i;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

class RouteError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function userResponse(user: User) {
  return {
    id: user.id,
    name: user.name,
    matric: user.matric,
    level: user.level,
    isAdmin: user.isAdmin,
  };
}

async function signedInUser(req: Request) {
  const id = req.signedCookies?.[SESSION_COOKIE];
  if (!id || typeof id !== "string") return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user ?? null;
}

function setSession(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE, userId, { ...COOKIE_OPTIONS, signed: true });
}

function handleRouteError(res: Response, error: unknown) {
  if (error instanceof RouteError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

router.post("/users/register", async (req, res) => {
  try {
    const input = RegisterUserBody.parse(req.body);
    const name = input.name.trim();
    const matric = input.matric.trim().toUpperCase();
    if (!name || !MATRIC_PATTERN.test(matric)) {
      throw new RouteError(400, "Use a valid name and matric format: 20XX/1/XXXXXIP.");
    }

    const user = await db.transaction(async (tx) => {
      // Serialise the first-user check so two simultaneous registrations cannot
      // both receive the automatic administrator role.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pge_users_first_admin'))`);
      const [existing] = await tx.select().from(usersTable).where(eq(usersTable.matric, matric)).limit(1);
      if (existing) throw new RouteError(409, "That matric number is already registered. Sign in instead.");

      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(usersTable);
      const [created] = await tx.insert(usersTable).values({
        id: crypto.randomUUID(),
        name,
        matric,
        level: input.level,
        isAdmin: Number(count) === 0,
      }).returning();
      return created;
    });

    setSession(res, user.id);
    res.status(201).json(userResponse(user));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/users/login", async (req, res) => {
  try {
    const input = LoginUserBody.parse(req.body);
    const matric = input.matric.trim().toUpperCase();
    if (!MATRIC_PATTERN.test(matric)) {
      throw new RouteError(400, "Use the format 20XX/1/XXXXXIP.");
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.matric, matric)).limit(1);
    if (!user) throw new RouteError(401, "No account matches that matric number. Create an account first.");

    setSession(res, user.id);
    res.json(userResponse(user));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.get("/users/me", async (req, res) => {
  try {
    const user = await signedInUser(req);
    if (!user) throw new RouteError(401, "No active session.");
    res.json(userResponse(user));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.post("/users/logout", (_req, res) => {
  const clearOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  res.clearCookie(SESSION_COOKIE, clearOptions);
  res.clearCookie(`${SESSION_COOKIE}.sig`, clearOptions);
  res.status(204).send();
});

router.get("/users", async (req, res) => {
  try {
    const user = await signedInUser(req);
    if (!user) throw new RouteError(401, "No active session.");
    if (!user.isAdmin) throw new RouteError(403, "Administrator access required.");

    const users = await db.select().from(usersTable);
    res.json(users.map(userResponse));
  } catch (error) {
    handleRouteError(res, error);
  }
});

router.patch("/users/:userId/role", async (req, res) => {
  try {
    const actor = await signedInUser(req);
    if (!actor) throw new RouteError(401, "No active session.");
    if (!actor.isAdmin) throw new RouteError(403, "Administrator access required.");

    const params = UpdateUserRoleParams.parse(req.params);
    const input = UpdateUserRoleBody.parse(req.body);
    if (params.userId === actor.id) throw new RouteError(400, "You cannot change your own administrator role.");

    const [updated] = await db.update(usersTable)
      .set({ isAdmin: input.isAdmin })
      .where(eq(usersTable.id, params.userId))
      .returning();
    if (!updated) throw new RouteError(404, "User not found.");

    res.json(userResponse(updated));
  } catch (error) {
    handleRouteError(res, error);
  }
});

export default router;