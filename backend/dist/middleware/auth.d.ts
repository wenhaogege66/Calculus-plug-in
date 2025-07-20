import { Request, Response, NextFunction } from 'express';
interface JwtPayload {
    userId: string;
    email: string;
    role: 'student' | 'teacher';
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireRole: (allowedRoles: Array<"student" | "teacher">) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const generateToken: (payload: JwtPayload) => string;
export declare const verifyToken: (token: string) => JwtPayload;
export {};
//# sourceMappingURL=auth.d.ts.map