import { chromium, Browser, Page } from 'playwright';
import { SearchResult, SearchResultItem, QueryCategory, SpecializedSource } from '@/types/mcp';
import { ALL_SPECIALIZED_SOURCES } from './specialized-sources';

interface ExtractionResult {
  title: string;
  url: string;
  description: string;
  content?: string;
}

/**
 * 使用 Playwright 从专业网站提取信息
 */
export class PlaywrightExtractor {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 根据查询类别获取相关信息
   */
  async extractByCategory(
    query: string,
    category: QueryCategory
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      await this.init();

      // 获取该类别下的数据源
      const sources = ALL_SPECIALIZED_SOURCES.filter(s => s.category === category);

      if (sources.length === 0) {
        return {
          query,
          engine: 'playwright',
          results: [],
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          reasoning: `未找到类别 "${category}" 的专用数据源`,
          category,
        };
      }

      console.log(`[Playwright] Extracting from ${sources.length} sources for category: ${category}`);

      const allResults: SearchResultItem[] = [];

      // 从每个数据源提取信息
      for (const source of sources.slice(0, 3)) {
        try {
          const results = await this.extractFromSource(query, source);
          allResults.push(...results);
        } catch (error) {
          console.error(`[Playwright] Failed to extract from ${source.name}:`, error);
        }
      }

      const duration = Date.now() - startTime;

      return {
        query,
        engine: 'playwright',
        results: allResults,
        timestamp: Date.now(),
        duration,
        reasoning: `从 ${sources.length} 个专业网站提取了 ${allResults.length} 条结果`,
        category,
      };
    } catch (error) {
      console.error('[Playwright] Extraction failed:', error);
      return {
        query,
        engine: 'playwright',
        results: [],
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        reasoning: `Playwright 提取失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: true,
        category,
      };
    }
  }

  /**
   * 从特定数据源提取信息
   */
  private async extractFromSource(
    query: string,
    source: SpecializedSource
  ): Promise<SearchResultItem[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    const results: SearchResultItem[] = [];

    try {
      // 构建搜索 URL
      const searchUrl = source.searchUrl
        ? source.searchUrl.replace('{query}', encodeURIComponent(query))
        : `${source.url}/search?q=${encodeURIComponent(query)}`;

      console.log(`[Playwright] Navigating to: ${searchUrl}`);

      // 访问页面
      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 等待页面加载
      await page.waitForTimeout(2000);

      // 提取信息
      const extractions = await this.extractFromPage(page, source);

      for (const extraction of extractions.slice(0, 5)) {
        results.push({
          title: extraction.title,
          url: extraction.url,
          description: extraction.description,
          content: extraction.content,
          source: source.name,
        });
      }

    } catch (error) {
      console.error(`[Playwright] Error extracting from ${source.name}:`, error);
    } finally {
      await context.close();
    }

    return results;
  }

  /**
   * 从页面提取信息
   */
  private async extractFromPage(
    page: Page,
    source: SpecializedSource
  ): Promise<ExtractionResult[]> {
    // 根据网站使用不同的提取策略
    switch (source.name) {
      case '雪球':
        return this.extractXueqiu(page);
      case '东方财富':
        return this.extractEastmoney(page);
      case '第一财经':
        return this.extractYicai(page);
      case '财新网':
        return this.extractCaixin(page);
      case '知乎':
        return this.extractZhihu(page);
      case '维基百科':
        return this.extractWikipedia(page);
      case '百度百科':
        return this.extractBaiduBaike(page);
      default:
        return this.extractGeneric(page, source);
    }
  }

  /**
   * 提取雪球数据
   */
  private async extractXueqiu(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];
      const articles = document.querySelectorAll('.article__content, .stock__content');

      articles.forEach((article) => {
        const titleEl = article.querySelector('.article__title, .stock__title, h1, h2, h3');
        const contentEl = article.querySelector('.article__abstract, .stock__abstract, p');

        if (titleEl) {
          items.push({
            title: titleEl.textContent?.trim() || '',
            url: window.location.href,
            description: contentEl?.textContent?.trim().substring(0, 200) || '',
          });
        }
      });

      return items;
    });
  }

  /**
   * 提取东方财富数据
   */
  private async extractEastmoney(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];
      const newsItems = document.querySelectorAll('.news-item, .article-list .item, .list li');

      newsItems.forEach((item) => {
        const link = item.querySelector('a');
        const title = link?.textContent?.trim() || '';
        const url = link?.href || window.location.href;
        const desc = item.querySelector('p, .summary, .brief')?.textContent?.trim() || '';

        if (title) {
          items.push({ title, url, description: desc.substring(0, 200) });
        }
      });

      return items;
    });
  }

  /**
   * 提取第一财经数据
   */
  private async extractYicai(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];
      const articles = document.querySelectorAll('.news-list .item, .article-item, article');

      articles.forEach((article) => {
        const link = article.querySelector('a');
        const title = link?.textContent?.trim() || '';
        const url = link?.href || window.location.href;
        const desc = article.querySelector('p, .desc, .summary')?.textContent?.trim() || '';

        if (title) {
          items.push({ title, url, description: desc.substring(0, 200) });
        }
      });

      return items;
    });
  }

  /**
   * 提取财新网数据
   */
  private async extractCaixin(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];
      const articles = document.querySelectorAll('.news-item, .article-item, article');

      articles.forEach((article) => {
        const link = article.querySelector('a');
        const title = link?.textContent?.trim() || '';
        const url = link?.href || window.location.href;
        const desc = article.querySelector('p, .desc')?.textContent?.trim() || '';

        if (title) {
          items.push({ title, url, description: desc.substring(0, 200) });
        }
      });

      return items;
    });
  }

  /**
   * 提取知乎数据
   */
  private async extractZhihu(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];
      const answers = document.querySelectorAll('.ContentItem, .SearchResult-Card');

      answers.forEach((answer) => {
        const titleEl = answer.querySelector('.ContentItem-title, .SearchResult-Card-title');
        const contentEl = answer.querySelector('.RichContent-inner, .SearchResult-Card-content');

        if (titleEl) {
          items.push({
            title: titleEl.textContent?.trim() || '',
            url: window.location.href,
            description: contentEl?.textContent?.trim().substring(0, 300) || '',
          });
        }
      });

      return items;
    });
  }

  /**
   * 提取维基百科数据
   */
  private async extractWikipedia(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];

      const title = document.querySelector('#firstHeading')?.textContent?.trim() || '';
      const content = document.querySelector('#mw-content-text .mw-parser-output > p')?.textContent?.trim() || '';

      if (title) {
        items.push({
          title,
          url: window.location.href,
          description: content.substring(0, 500),
          content: content.substring(0, 2000),
        });
      }

      return items;
    });
  }

  /**
   * 提取百度百科数据
   */
  private async extractBaiduBaike(page: Page): Promise<ExtractionResult[]> {
    return page.evaluate(() => {
      const items: ExtractionResult[] = [];

      const title = document.querySelector('.lemma-title, h1')?.textContent?.trim() || '';
      const content = document.querySelector('.lemma-summary, .para')?.textContent?.trim() || '';

      if (title) {
        items.push({
          title,
          url: window.location.href,
          description: content.substring(0, 500),
          content: content.substring(0, 2000),
        });
      }

      return items;
    });
  }

  /**
   * 通用提取方法
   */
  private async extractGeneric(
    page: Page,
    source: SpecializedSource
  ): Promise<ExtractionResult[]> {
    return page.evaluate((selectors: { results?: string; title?: string; description?: string; content?: string } | undefined) => {
      const items: ExtractionResult[] = [];

      // 尝试多种常见的选择器
      const resultSelectors = selectors?.results || 'article, .article, .news-item, .item, .result';
      const titleSelectors = selectors?.title || 'h1, h2, h3, .title, .headline';
      const descSelectors = selectors?.description || 'p, .summary, .desc, .abstract';

      const results = document.querySelectorAll(resultSelectors);

      results.forEach((result) => {
        const titleEl = result.querySelector(titleSelectors);
        const descEl = result.querySelector(descSelectors);
        const linkEl = result.querySelector('a');

        const title = titleEl?.textContent?.trim() || linkEl?.textContent?.trim() || '';
        const url = linkEl?.href || window.location.href;
        const description = descEl?.textContent?.trim() || '';

        if (title && title.length > 5) {
          items.push({
            title: title.substring(0, 200),
            url,
            description: description.substring(0, 300),
          });
        }
      });

      return items;
    }, source.selectors);
  }
}

// 单例实例
export const playwrightExtractor = new PlaywrightExtractor();
