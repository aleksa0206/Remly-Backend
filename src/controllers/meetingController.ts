import type { Request, Response, NextFunction } from 'express';
import * as meetingService from '../services/meetingService';
import { MEETING_STATUSES } from '../validation/meetingSchemas';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import {
  parseOptionalDateQuery,
  parseOptionalEnumListQuery,
  parseOptionalEnumQuery,
  parseOptionalIdQuery,
} from '../utils/queryParams';

export async function getAllMeetingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req);
    const filters = {
      status: parseOptionalEnumListQuery(req, 'status', MEETING_STATUSES),
      contactId: parseOptionalIdQuery(req, 'contactId'),
      from: parseOptionalDateQuery(req, 'from'),
      to: parseOptionalDateQuery(req, 'to'),
    };
    const order = parseOptionalEnumQuery(req, 'order', ['asc', 'desc'] as const) ?? 'desc';
    const { data, total } = await meetingService.getAllMeetings(
      req.user!.userId,
      filters,
      order,
      pagination
    );
    res.json({ data, meta: buildPaginationMeta(total, pagination.page, pagination.limit) });
  } catch (err) {
    next(err);
  }
}

export async function getMeetingByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meetingId = Number(req.params.meetingId);
    res.json(await meetingService.getMeetingById(meetingId, req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function createMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await meetingService.createMeeting(req.body, req.user!.userId);
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function updateMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meetingId = Number(req.params.meetingId);
    res.json(await meetingService.updateMeeting(meetingId, req.body, req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function completeMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meetingId = Number(req.params.meetingId);
    res.json(await meetingService.completeMeeting(meetingId, req.body, req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function deleteMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meetingId = Number(req.params.meetingId);
    res.json(await meetingService.deleteMeeting(meetingId, req.user!.userId));
  } catch (err) {
    next(err);
  }
}
