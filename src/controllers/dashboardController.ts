import type { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboardService';
import { todayUtc } from '../utils/dates';
import { parseOptionalDateQuery } from '../utils/queryParams';

export async function getDashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const today = parseOptionalDateQuery(req, 'today') ?? todayUtc();
    res.json(await dashboardService.getDashboard(req.user!.userId, today));
  } catch (err) {
    next(err);
  }
}
