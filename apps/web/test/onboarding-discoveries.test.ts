import { describe, expect, it } from 'vitest';
import { describeDiscoveries } from '../src/features/brands/onboarding-discoveries';

function page(url: string, title: string) {
  return { url, title };
}

function competitor(name: string) {
  return { name, url: '', positioning: '', strengths: [], weaknesses: [], sourceUrls: [] };
}

const findings = { name: 'Sunrise', features: [], audience: { segments: [], painPoints: [], buyingTriggers: [], objections: [], channels: [] } };

describe('describeDiscoveries', () => {
  it('starts on reading the site when nothing is saved yet', () => {
    expect(describeDiscoveries('https://www.sunrise.example/', null, null)).toEqual({
      host: 'sunrise.example',
      stage: 0,
      pages: [],
      palette: [],
      research: null,
    });
  });

  it('labels pages by the first part of their title, falling back to the path', () => {
    const crawl = {
      pages: [
        page('https://sunrise.example/', 'Sunrise Bakery | Fresh bread daily'),
        page('https://sunrise.example/menu', 'Menu - Sunrise Bakery'),
        page('https://sunrise.example/about-us', ''),
        page('https://sunrise.example/', ''),
      ],
      palette: ['#ffaa00', '#222222'],
      logoAssetId: 'logo-1',
    };
    expect(describeDiscoveries('https://sunrise.example', crawl, null)).toMatchObject({
      stage: 1,
      logoUrl: '/api/assets/logo-1',
      pages: ['Sunrise Bakery', 'Menu', '/about-us', 'Home'],
      palette: ['#ffaa00', '#222222'],
    });
  });

  it('counts unique web domains and verified competitors once research is saved', () => {
    const research = {
      status: 'succeeded' as const,
      brief: '',
      sources: [
        { url: 'https://www.yelp.com/biz/sunrise', title: '' },
        { url: 'https://yelp.com/other', title: '' },
        { url: 'https://news.example.org/a', title: '' },
        { url: 'javascript:alert(1)', title: '' },
      ],
      findings: { ...findings, competitors: [competitor('Golden Crust'), competitor('Dawn Loaves')] },
      researchedAt: new Date(),
      attemptedAt: new Date(),
    };
    expect(describeDiscoveries('https://sunrise.example', { pages: [], palette: [] }, research)).toMatchObject({
      stage: 2,
      research: { finished: true, sourceCount: 3, sources: ['yelp.com', 'news.example.org'], competitors: ['Golden Crust', 'Dawn Loaves'] },
    });
  });

  it('reports research that did not finish', () => {
    const research = { status: 'failed' as const, brief: '', sources: [], findings: null, researchedAt: null, attemptedAt: new Date() };
    expect(describeDiscoveries('https://sunrise.example', null, research).research).toEqual({
      finished: false,
      sourceCount: 0,
      sources: [],
      competitors: [],
    });
  });
});
