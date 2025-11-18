import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

interface CompanyUrlResearchResponse {
  researchSummary: string;
}

export class CompanyResearch {
  private apikey: string;
  private stagehand: Stagehand;

  constructor() {
    this.apikey = process.env.GEMINI_API_KEY || "";
    this.stagehand = new Stagehand({
      env: "LOCAL", // or "BROWSERBASE" depending on setup
      model: { modelName: "google/gemini-2.5-flash", apiKey: this.apikey },
      cacheDir: "stagehand-cache" // optional, for caching
    });
  }

  async init(): Promise<void> {
    await this.stagehand.init();
  }

  async companyUrlResearch(companyUrl: string): Promise<CompanyUrlResearchResponse> {
    const page = this.stagehand.context.pages()[0];
    await page.goto(companyUrl);

    // 1. Observe what actions are possible for "click login" (or any instruction)
    const actions = await this.stagehand.observe("find the login button on the page");
    // pick first action (or filter by description)
    const loginAction = actions.find(a => a.description.toLowerCase().includes("login"));
    if (loginAction) {
      await this.stagehand.act(loginAction);
    }

    // 2. Extract some data: say, company name, founding date, etc.
    const schema = z.object({
      companyName: z.string(),
      description: z.string().optional(),
      founded: z.string().optional()
    });

    const extraction = await this.stagehand.extract(
      "extract the company name, description, and founding date",
      schema
    );

    // 3. Summarize or process extracted data
    const summary = `Name: ${extraction.companyName}, ` +
      (extraction.description ? `Desc: ${extraction.description}, ` : "") +
      (extraction.founded ? `Founded: ${extraction.founded}` : "");

    return { researchSummary: summary };
  }

  async close(): Promise<void> {
    await this.stagehand.close();
  }
}
