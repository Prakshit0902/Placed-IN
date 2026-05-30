import { Hono } from 'hono';
import { getCompanies, getCompanyProblems } from '../controllers/companies.controller.js';

export const companiesRouter = new Hono();

companiesRouter.get('/', getCompanies);
companiesRouter.get('/:name/problems', getCompanyProblems);
