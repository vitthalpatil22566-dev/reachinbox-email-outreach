import { SafeUser } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}
