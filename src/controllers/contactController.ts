import type { Request, Response, NextFunction } from 'express';
import * as contactService from '../services/contactService';
import { ValidationError } from '../errors/ValidationError';
import { CONTACT_SORTS } from '../repositories/contactRepository';
import { RELATIONSHIPS } from '../validation/contactSchemas';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import {
  parseOptionalBooleanQuery,
  parseOptionalDateQuery,
  parseOptionalEnumQuery,
  parseOptionalSearchQuery,
} from '../utils/queryParams';

export async function getAllContactsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(req);
    const filters = {
      search: parseOptionalSearchQuery(req, 'search'),
      relationship: parseOptionalEnumQuery(req, 'relationship', RELATIONSHIPS),
      isFavorite: parseOptionalBooleanQuery(req, 'isFavorite'),
      // Archived contacts stay out of lists unless asked for.
      isArchived: parseOptionalBooleanQuery(req, 'isArchived') ?? false,
      dueBy: parseOptionalDateQuery(req, 'dueBy'),
      metSince: parseOptionalDateQuery(req, 'metSince'),
      notMetSince: parseOptionalDateQuery(req, 'notMetSince'),
      neverMet: parseOptionalBooleanQuery(req, 'neverMet'),
    };
    if (filters.neverMet !== undefined && (filters.metSince || filters.notMetSince)) {
      throw new ValidationError('neverMet cannot be combined with metSince or notMetSince', [
        { path: 'neverMet', message: 'cannot be combined with metSince or notMetSince' },
      ]);
    }
    const sort = parseOptionalEnumQuery(req, 'sort', CONTACT_SORTS) ?? 'name';
    const { data, total } = await contactService.getAllContacts(
      req.user!.userId,
      filters,
      sort,
      pagination
    );
    res.json({ data, meta: buildPaginationMeta(total, pagination.page, pagination.limit) });
  } catch (err) {
    next(err);
  }
}

export async function getContactByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    res.json(await contactService.getContactById(contactId, req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function createContactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.createContact(req.body, req.user!.userId);
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
}

export async function updateContactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    res.json(await contactService.updateContact(contactId, req.body, req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function deleteContactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    res.json(await contactService.deleteContact(contactId, req.user!.userId));
  } catch (err) {
    next(err);
  }
}
