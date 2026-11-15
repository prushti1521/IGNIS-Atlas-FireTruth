import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Flame, MapPinned, Satellite, ShieldCheck } from 'lucide-react';

interface GuidedScientificStoryProps {
  setActiveTab: (tab: string) => void;
}

const chapters = [
  {
    number: '01',
    title: 'The observation problem',
    text: 'MODIS and VIIRS observe active fire at different native resolutions. Raw counts therefore cannot be joined into one honest multi-decadal series.',
    action: 'overview',
    label: 'See the mission',
    icon: Satellite,
    accent: 'cyan'
  },
  {
    number: '02',
    title: 'Where sensors disagree',
    text: 'The authentic California spatial artifact aligns observations on a 25 km equal-area grid and separates shared, MODIS-only and VIIRS-only cell-months.',
    action: 'explorer',
    label: 'Explore disagreement',
    icon: MapPinned,
    accent: 'amber'
  },
  {
    number: '03',
    title: 'Harmonization',
    text: 'B0, B1 and B2 make progressively stronger assumptions. Training and holdout periods stay visible so calibration is inspectable rather than magical.',
    action: 'lab',
    label: 'Compare models',
    icon: Flame,
    accent: 'cyan'
  },
  {
    number: '04',
    title: 'External context',
    text: 'CAL FIRE 2020 perimeters provide geographic context. They are final perimeters, not complete daily detection labels or ground truth for satellite activity.',
    action: 'case-study',
    label: 'Open case study',
    icon: MapPinned,
    accent: 'fire'
  },
  {
    number: '05',
    title: 'The transfer test',
    text: 'California-trained B2 performs worse than B0 on Pacific Northwest holdout RMSE, while destination-local B2 improves agreement. That failure is a result, not a footnote.',
    action: 'transfer',
    label: 'Inspect transfer',
    icon: ShieldCheck,
    accent: 'fire'
  },
  {
    number: '06',
    title: 'What we learned',
    text: 'FireTruth makes sensor disagreement measurable, preserves uncertainty, and shows where regional calibration is required. Agreement is not ground-truth accuracy.',
    action: 'dossier',
    label: 'Read the evidence',
    icon: CheckCircle2,
    accent: 'emerald'
  }
];

export const GuidedScientificStory: React.FC<GuidedScientificStoryProps> = ({ setActiveTab }) => (
  <div className="story-shell">
    <section className="story-hero">
      <div className="eyebrow"><BookOpen size={14} /> Guided research briefing · 3–5 minutes</div>
      <h1>One planet. Multiple fire sensors. A clearer view of the evidence.</h1>
      <p>
        Follow the measured path from sensor disagreement to cross-region transfer failure.
        Every chapter opens the full research tool behind the summary.
      </p>
      <div className="story-hero-actions">
        <button className="btn-primary" onClick={() => setActiveTab('overview')}>Open research overview <ArrowRight size={16} /></button>
        <button className="btn-secondary" onClick={() => setActiveTab('science')}>Understand the science</button>
      </div>
      <div className="story-proof-strip">
        <span><strong>2018–2022</strong> authentic observation window</span>
        <span><strong>25 km</strong> equal-area cell-day grid</span>
        <span><strong>60 months</strong> Pacific Northwest overlap</span>
      </div>
    </section>

    <section className="story-chapters" aria-label="Guided scientific chapters">
      {chapters.map(({ number, title, text, action, label, icon: Icon, accent }) => (
        <article className={`story-chapter story-accent-${accent}`} key={number}>
          <div className="story-chapter-top"><span className="story-number">{number}</span><Icon size={20} aria-hidden="true" /></div>
          <h2>{title}</h2>
          <p>{text}</p>
          <button className="text-button" onClick={() => setActiveTab(action)}>{label} <ArrowRight size={15} /></button>
        </article>
      ))}
    </section>

    <div className="scientific-note">
      <strong>Scope note:</strong> validated observational results cover selected California and Oregon/Washington study boundaries, not global fire activity. VIIRS is a comparison sensor, not ground truth.
    </div>
  </div>
);
