import cheerio from 'cheerio';
import MangaScraper, {
  GetImagesQuery,
} from '../../core/MangaScraper';
import { SourceChapter, SourceManga } from '../../types/data';
import { fulfilledPromises } from '../../utils';


export default class MangalhScraper extends MangaScraper {
  constructor() {
    // Pass axiosConfig to the parent class
    super('lh', 'lh', { baseURL: 'https://www.truyentranhlh.net' });

    // Languages that the source supports (Two letter code)
    this.locales = ['vi'];
    // See more: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
    this.monitor.interval = 20 * 60 * 1000; // 20 minutes
  }

  shouldMonitorChange(oldPage: string, newPage: string): boolean {
    if (!oldPage || !newPage) return false;

    const $old = cheerio.load(oldPage);
    const $new = cheerio.load(newPage);

    const selector = '.thumb-item-flow ';

    const oldTitle = $old(selector).find('.series-title').text().trim();
    const newTitle = $new(selector).find('.series-title').text().trim();

    return oldTitle !== newTitle;

  }

  async scrapeMangaPage(page: number): Promise<SourceManga[]> {

    const { data } = await this.client.get('/danh-sach?sort=update&page=' + page);

    const $ = cheerio.load(data);

    const mangaList = $('.thumb-item-flow ');

    return fulfilledPromises(
      mangaList.toArray().map(
        (el) => {
          const manga = $(el);

          const slug = this.urlToSourceId(manga.find('.series-title').find('a').attr('href'));


          return this.scrapeManga(slug);
        })
    )

  }
  async scrapeManga(sourceId: string): Promise<SourceManga> {
    const { data } = await this.client.get(`/truyen-tranh/${sourceId}`);

    const $ = cheerio.load(data);

    const blacklistKeys = ['truyện chữ'];

    const mainTitle = $(`.series-name`).find('a').text().trim();

    const altTitle = this.parseTitle($(`.info-item:first-child`).find('.info-value').text().trim());

    const allTitles = [mainTitle, ...altTitle];

    const { titles } = this.filterTitles(allTitles);

    if (
      allTitles.some((title) =>
        blacklistKeys.some((key) => title.toLowerCase().includes(key)),
      )
    ) {
      return null;
    }

    const chapters: SourceChapter[] = $('.list-chapters a')
      .toArray()
      .map((el) => {
        const chapter = $(el);
        const chapterName = chapter.attr('title').trim();
        const chapter_id = this.urlToSourceChapterId(chapter.attr('href').trim());
        const chapter_time = chapter.find('.chapter-time').text().trim();
        return {
          name: chapterName,
          chapterTime: chapter_time,
          sourceChapterId: chapter_id,
          sourceMediaId: sourceId,
        };
      });

    return {
      chapters,
      sourceId: this.id,
      sourceMediaId: sourceId,
      titles,
    };
  }

  async getImages(query: GetImagesQuery) {
    const { source_media_id, chapter_id } = query;

    const { data } = await this.client.get(
      `/truyen-tranh/${source_media_id}/${chapter_id}`,
    );
    console.log(`data: `, data);
    return this.composeImages(data);
  }

  composeImages(html: string) {
    const $ = cheerio.load(html);

    const images = $('#chapter-content img');

    return images.toArray().map((el) => {
      const imageEl = $(el);
      const image = imageEl.attr('data-src');
      console.log(`image : `, image);
      return {
        image,
      };
    });
  }


  urlToSourceId(url: string) {
    const splitted = url.split('/');
    const slug = splitted[splitted.length - 1];
    const slugSplitted = slug.split('-');

    return slugSplitted.join('-');
  }

  urlToSourceChapterId(url: string) {
    const splitted = url.split('/');
    return splitted[splitted.length - 1];
  }
}