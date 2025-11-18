import { Request, Response } from 'express';
import { CompanyResearch } from '../services/company-research.service';

export const researchCompanyUrl = async (req: Request, res: Response): Promise<void> => {
  let companyResearch: CompanyResearch | null = null;
  
  try {
    const { companyUrl } = req.body;

    if (!companyUrl || typeof companyUrl !== 'string') {
      res.status(400).json({
        error: 'Missing required field',
        message: 'companyUrl is required and must be a string'
      });
      return;
    }

    // Validate URL format
    try {
      new URL(companyUrl);
    } catch (error) {
      res.status(400).json({
        error: 'Invalid URL',
        message: 'companyUrl must be a valid URL'
      });
      return;
    }

    console.log(`🔍 Starting company research for: ${companyUrl}`);

    // Initialize and run research
    companyResearch = new CompanyResearch();
    await companyResearch.init();

    const result = await companyResearch.companyUrlResearch(companyUrl);

    res.json({
      success: true,
      data: result,
      companyUrl: companyUrl
    });

  } catch (error) {
    console.error('Company research error:', error);
    res.status(500).json({
      error: 'Company research failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  } finally {
    // Always close the stagehand instance
    if (companyResearch) {
      try {
        await companyResearch.close();
      } catch (closeError) {
        console.error('Error closing company research:', closeError);
      }
    }
  }
};

